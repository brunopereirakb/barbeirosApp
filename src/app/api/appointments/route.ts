import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  // Callers MUST send dateFrom/dateTo (ISO) computed in *their* local
  // timezone — otherwise this endpoint can't know which civil day they
  // mean. Previous behaviour (`?date=...` + server-side setHours) silently
  // returned the wrong UTC day for any timezone east of UTC, which made
  // bookings vanish from the slot list.
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "dateFrom and dateTo are required (ISO timestamps)" },
      { status: 400 }
    );
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: tenantId,
      startsAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    },
    include: { client: true, service: true },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { clientId, serviceId, startsAt, notes, status } = body;

  if (!clientId || !serviceId || !startsAt) {
    return NextResponse.json(
      { error: "clientId, serviceId e startsAt são obrigatórios" },
      { status: 400 }
    );
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Data de início inválida" }, { status: 400 });
  }

  const [service, client] = await Promise.all([
    prisma.service.findFirst({ where: { id: serviceId, userId: tenantId } }),
    prisma.client.findFirst({ where: { id: clientId, userId: tenantId } }),
  ]);
  if (!service) {
    return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
  }
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const end = new Date(start.getTime() + service.durationMin * 60_000);

  const appointment = await prisma.appointment.create({
    data: {
      userId: tenantId,
      clientId,
      serviceId,
      startsAt: start,
      endsAt: end,
      status: status || "confirmed",
      notes: notes || null,
    },
    include: { client: true, service: true },
  });

  return NextResponse.json(appointment);
}
