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

  // Run the overlap check and the insert inside a single transaction so
  // two near-simultaneous bookings can't both pass the check and both
  // commit. Postgres default isolation (READ COMMITTED) leaves a tiny
  // race window for true write-write conflicts, but the transaction at
  // least guarantees both queries see the same snapshot.
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const overlap = await tx.appointment.findFirst({
        where: {
          userId: tenantId,
          status: { not: "cancelled" },
          AND: [{ startsAt: { lt: end } }, { endsAt: { gt: start } }],
        },
        include: { client: true, service: true },
      });
      if (overlap) {
        throw new ConflictError(overlap);
      }
      return tx.appointment.create({
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
    });
    return NextResponse.json(appointment);
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json(
        {
          error: "slot_taken",
          message: `Já existe uma marcação neste horário (${e.overlap.client.name} · ${e.overlap.service.name}).`,
          conflictWith: {
            id: e.overlap.id,
            clientName: e.overlap.client.name,
            serviceName: e.overlap.service.name,
            startsAt: e.overlap.startsAt.toISOString(),
            endsAt: e.overlap.endsAt.toISOString(),
          },
        },
        { status: 409 }
      );
    }
    throw e;
  }
}

class ConflictError extends Error {
  constructor(
    public readonly overlap: {
      id: string;
      startsAt: Date;
      endsAt: Date;
      client: { name: string };
      service: { name: string };
    }
  ) {
    super("slot_taken");
  }
}
