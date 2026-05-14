import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { salonDayOfWeek } from "@/lib/timezone";

type Conflict = {
  index: number;
  startsAt: string;
  reason: "closed" | "booked";
  conflictWith?: {
    clientName: string;
    serviceName: string;
    startsAt: string;
    endsAt: string;
  };
};

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { appointments, skipConflicts = false } = body as {
    appointments: { clientId: string; serviceId: string; startsAt: string }[];
    skipConflicts?: boolean;
  };

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return NextResponse.json({ error: "appointments[] obrigatório" }, { status: 400 });
  }
  if (appointments.length > 100) {
    return NextResponse.json({ error: "Máximo 100 marcações de uma vez" }, { status: 400 });
  }

  // Validate referenced services + clients belong to tenant
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, userId: tenantId },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const clientIds = [...new Set(appointments.map((a) => a.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, userId: tenantId },
  });
  const clientSet = new Set(clients.map((c) => c.id));

  // Build planned items with computed end times. Reject if any reference is bogus.
  type Planned = {
    idx: number;
    start: Date;
    end: Date;
    clientId: string;
    serviceId: string;
  };
  const planned: Planned[] = [];
  for (let i = 0; i < appointments.length; i++) {
    const a = appointments[i];
    const svc = serviceMap.get(a.serviceId);
    if (!svc || !clientSet.has(a.clientId)) {
      return NextResponse.json(
        { error: "Cliente ou serviço inválido", index: i },
        { status: 400 }
      );
    }
    const start = new Date(a.startsAt);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Data inválida", index: i },
        { status: 400 }
      );
    }
    const end = new Date(start.getTime() + svc.durationMin * 60_000);
    planned.push({ idx: i, start, end, clientId: a.clientId, serviceId: a.serviceId });
  }

  // Fetch overlapping existing appointments in the planned range
  const minStart = new Date(Math.min(...planned.map((p) => p.start.getTime())));
  const maxEnd = new Date(Math.max(...planned.map((p) => p.end.getTime())));
  const existing = await prisma.appointment.findMany({
    where: {
      userId: tenantId,
      status: { not: "cancelled" },
      AND: [{ startsAt: { lt: maxEnd } }, { endsAt: { gt: minStart } }],
    },
    include: { client: true, service: true },
  });

  // Closed-day check
  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const tz = settings?.timezone || "Europe/Lisbon";
  let workSchedule: Record<string, { closed?: boolean; start?: string; end?: string }> = {};
  try {
    workSchedule = JSON.parse(settings?.workScheduleByWeekday || "{}");
  } catch {
    workSchedule = {};
  }

  const conflicts: Conflict[] = [];
  const flagged = new Set<number>();

  for (const p of planned) {
    const entry = workSchedule[String(salonDayOfWeek(p.start, tz))];
    if (entry?.closed) {
      conflicts.push({ index: p.idx, startsAt: p.start.toISOString(), reason: "closed" });
      flagged.add(p.idx);
      continue;
    }
    const overlap = existing.find((e) => p.start < e.endsAt && p.end > e.startsAt);
    if (overlap) {
      conflicts.push({
        index: p.idx,
        startsAt: p.start.toISOString(),
        reason: "booked",
        conflictWith: {
          clientName: overlap.client.name,
          serviceName: overlap.service.name,
          startsAt: overlap.startsAt.toISOString(),
          endsAt: overlap.endsAt.toISOString(),
        },
      });
      flagged.add(p.idx);
    }
  }

  // Intra-batch overlap (same request, two occurrences hit each other)
  for (let i = 0; i < planned.length; i++) {
    if (flagged.has(planned[i].idx)) continue;
    for (let j = i + 1; j < planned.length; j++) {
      if (flagged.has(planned[j].idx)) continue;
      if (
        planned[i].start < planned[j].end &&
        planned[i].end > planned[j].start
      ) {
        conflicts.push({
          index: planned[j].idx,
          startsAt: planned[j].start.toISOString(),
          reason: "booked",
        });
        flagged.add(planned[j].idx);
      }
    }
  }

  // Refuse the whole batch unless caller opts in to skipping
  if (conflicts.length > 0 && !skipConflicts) {
    return NextResponse.json(
      { error: "Conflitos detectados", conflicts, created: 0 },
      { status: 409 }
    );
  }

  const toCreate = planned.filter((p) => !flagged.has(p.idx));
  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, skipped: conflicts.length, conflicts });
  }

  const created = await prisma.$transaction(
    toCreate.map((p) =>
      prisma.appointment.create({
        data: {
          userId: tenantId,
          clientId: p.clientId,
          serviceId: p.serviceId,
          startsAt: p.start,
          endsAt: p.end,
          status: "confirmed",
        },
      })
    )
  );

  return NextResponse.json({
    created: created.length,
    skipped: conflicts.length,
    conflicts,
  });
}
