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
  if (body.startsAt) {
    const start = new Date(body.startsAt);
    data.startsAt = start;
    const existing = await prisma.appointment.findFirstOrThrow({ where: { id, userId: tenantId }, include: { service: true } });
    data.endsAt = new Date(start.getTime() + existing.service.durationMin * 60_000);
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
