import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  salonStartOfDay,
  salonEndOfDay,
  zonedParts,
  zonedDayToUTC,
} from "@/lib/timezone";

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { scope, date, message } = await req.json() as {
    scope: "today" | "tomorrow" | "week" | "day" | "all";
    date?: string;
    message: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });
  }

  let phones: { phone: string; name: string }[] = [];

  if (scope === "all") {
    const clients = await prisma.client.findMany({ where: { userId: tenantId, phone: { not: null } } });
    phones = clients.map((c) => ({ phone: c.phone!, name: c.name }));
  } else {
    const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
    const tz = settings?.timezone || "Europe/Lisbon";
    const now = new Date();
    const p = zonedParts(now, tz);

    // Windows are computed against the SALON's civil calendar, not the
    // server's UTC clock.
    let from: Date;
    let to: Date;

    if (scope === "today") {
      from = salonStartOfDay(now, tz);
      to = salonEndOfDay(now, tz);
    } else if (scope === "tomorrow") {
      from = zonedDayToUTC(p.year, p.month, p.day + 1, 0, 0, tz);
      to = new Date(zonedDayToUTC(p.year, p.month, p.day + 2, 0, 0, tz).getTime() - 1);
    } else if (scope === "week") {
      from = salonStartOfDay(now, tz);
      // 7-day window ending at the last ms of day+6
      to = new Date(zonedDayToUTC(p.year, p.month, p.day + 7, 0, 0, tz).getTime() - 1);
    } else if (scope === "day" && date) {
      // `date` is expected as YYYY-MM-DD in the salon's calendar.
      const [yStr, mStr, dStr] = date.split("-");
      const y = Number(yStr), m = Number(mStr), dn = Number(dStr);
      if (!y || !m || !dn) {
        return NextResponse.json({ error: "date inválida — esperado YYYY-MM-DD" }, { status: 400 });
      }
      from = zonedDayToUTC(y, m, dn, 0, 0, tz);
      to = new Date(zonedDayToUTC(y, m, dn + 1, 0, 0, tz).getTime() - 1);
    } else {
      return NextResponse.json({ error: "scope/date inválidos" }, { status: 400 });
    }

    const appts = await prisma.appointment.findMany({
      where: { userId: tenantId, status: { in: ["confirmed", "pending"] }, startsAt: { gte: from, lte: to } },
      include: { client: true },
    });

    const seen = new Set<string>();
    for (const a of appts) {
      if (a.client.phone && !seen.has(a.client.id)) {
        seen.add(a.client.id);
        phones.push({ phone: a.client.phone, name: a.client.name });
      }
    }
  }

  let sent = 0;
  for (const { phone, name } of phones) {
    try {
      await sendWhatsApp({
        to: phone,
        body: message,
        context: { type: "broadcast", scope },
        tenantId,
      });
      sent++;
    } catch {}
  }

  return NextResponse.json({ sent, total: phones.length });
}
