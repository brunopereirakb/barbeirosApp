import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { appointments } = body as { appointments: { clientId: string; serviceId: string; startsAt: string }[] };

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return NextResponse.json({ error: "appointments[] obrigatório" }, { status: 400 });
  }
  if (appointments.length > 100) {
    return NextResponse.json({ error: "Máximo 100 marcações de uma vez" }, { status: 400 });
  }

  // Validate all referenced services belong to tenant
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, userId: tenantId } });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const clientIds = [...new Set(appointments.map((a) => a.clientId))];
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds }, userId: tenantId } });
  const clientSet = new Set(clients.map((c) => c.id));

  const created = await prisma.$transaction(
    appointments.map((a) => {
      const service = serviceMap.get(a.serviceId);
      if (!service || !clientSet.has(a.clientId)) throw new Error("Dados inválidos");
      const start = new Date(a.startsAt);
      const end = new Date(start.getTime() + service.durationMin * 60_000);
      return prisma.appointment.create({
        data: { userId: tenantId, clientId: a.clientId, serviceId: a.serviceId, startsAt: start, endsAt: end, status: "confirmed" },
      });
    })
  );

  return NextResponse.json({ created: created.length });
}
