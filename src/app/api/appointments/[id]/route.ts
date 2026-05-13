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

  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id, userId: tenantId },
    include: { service: true },
  });

  await prisma.appointment.update({ where: { id }, data: { status: "cancelled" } });

  if (triggerCascade) {
    const slot = {
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      serviceId: appointment.serviceId,
    };
    const candidateIds = candidatesParam ? candidatesParam.split(",").filter(Boolean) : [];
    if (candidateIds.length === 0) {
      const eligible = await findEligibleWaitlist(slot, tenantId);
      const result = await startCascade(slot, eligible.map((e: { id: string }) => e.id), tenantId);
      return NextResponse.json({ cancelled: true, cascade: result });
    } else {
      const result = await startCascade(slot, candidateIds, tenantId);
      return NextResponse.json({ cancelled: true, cascade: result });
    }
  }

  return NextResponse.json({ cancelled: true });
}
