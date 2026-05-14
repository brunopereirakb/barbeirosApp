import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { startCascade, findEligibleWaitlist } from "@/lib/cascade";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId: tenantId },
    include: { client: true, service: true },
  });
  if (!appointment) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(appointment);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.noteForClient !== undefined) data.noteForClient = body.noteForClient || null;
  if (body.clientId !== undefined) {
    const c = await prisma.client.findFirst({ where: { id: body.clientId, userId: tenantId } });
    if (!c) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    data.clientId = c.id;
  }

  let newRange: { start: Date; end: Date } | null = null;
  // When either startsAt or serviceId change, we must recompute the time
  // window from scratch — the duration depends on the service.
  if (body.startsAt || body.serviceId) {
    const existing = await prisma.appointment.findFirstOrThrow({
      where: { id, userId: tenantId },
      include: { service: true },
    });
    const start = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "startsAt inválido" }, { status: 400 });
    }
    let durationMin = existing.service.durationMin;
    if (body.serviceId && body.serviceId !== existing.serviceId) {
      const newSvc = await prisma.service.findFirst({ where: { id: body.serviceId, userId: tenantId } });
      if (!newSvc) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
      data.serviceId = newSvc.id;
      durationMin = newSvc.durationMin;
    }
    const end = new Date(start.getTime() + durationMin * 60_000);
    data.startsAt = start;
    data.endsAt = end;
    newRange = { start, end };
  }

  // When moving an appointment, refuse if the new window overlaps another
  // non-cancelled booking unless allowOverlap is set. `id: { not: id }`
  // lets the appointment overlap itself (a no-op or same-window edit).
  if (newRange && !body.allowOverlap) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        userId: tenantId,
        id: { not: id },
        status: { not: "cancelled" },
        AND: [
          { startsAt: { lt: newRange.end } },
          { endsAt: { gt: newRange.start } },
        ],
      },
      include: { client: true, service: true },
    });
    if (overlap) {
      return NextResponse.json(
        {
          error: "slot_taken",
          message: `Já existe uma marcação neste horário (${overlap.client.name} · ${overlap.service.name}).`,
          conflictWith: {
            id: overlap.id,
            clientName: overlap.client.name,
            serviceName: overlap.service.name,
            startsAt: overlap.startsAt.toISOString(),
            endsAt: overlap.endsAt.toISOString(),
          },
        },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data,
    include: { client: true, service: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const url = new URL(req.url);
  const triggerCascade = url.searchParams.get("cascade") === "true";
  const candidatesParam = url.searchParams.get("candidates");

  // Scope the lookup by tenant so we never touch another tenant's row, and
  // return a clean 404 instead of throwing.
  const appointment = await prisma.appointment.findFirst({
    where: { id, userId: tenantId },
    include: { service: true },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 });
  }

  // Idempotent: if already cancelled, don't update again and don't fire another
  // cascade. Returning the same shape avoids surprising clients that retry.
  if (appointment.status === "cancelled") {
    return NextResponse.json({ cancelled: true, alreadyCancelled: true });
  }

  // updateMany scoped to (id, userId, current status not cancelled) → if a
  // concurrent request already flipped it, our update affects 0 rows and we
  // skip the cascade. This is the safeguard against double-cancellations.
  const result = await prisma.appointment.updateMany({
    where: { id, userId: tenantId, status: { not: "cancelled" } },
    data: { status: "cancelled" },
  });
  if (result.count === 0) {
    return NextResponse.json({ cancelled: true, alreadyCancelled: true });
  }

  if (triggerCascade) {
    const slot = {
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      serviceId: appointment.serviceId,
    };
    const candidateIds = candidatesParam ? candidatesParam.split(",").filter(Boolean) : [];
    if (candidateIds.length === 0) {
      const eligible = await findEligibleWaitlist(slot, tenantId);
      const cascade = await startCascade(slot, eligible.map((e: { id: string }) => e.id), tenantId);
      return NextResponse.json({ cancelled: true, cascade });
    } else {
      const cascade = await startCascade(slot, candidateIds, tenantId);
      return NextResponse.json({ cancelled: true, cascade });
    }
  }

  return NextResponse.json({ cancelled: true });
}
