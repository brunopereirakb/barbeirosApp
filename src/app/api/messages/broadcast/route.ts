import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { sendWhatsApp } from "@/lib/whatsapp";

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
    let from = new Date();
    let to = new Date();

    if (scope === "today") {
      from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
    } else if (scope === "tomorrow") {
      from.setDate(from.getDate() + 1); from.setHours(0, 0, 0, 0);
      to = new Date(from); to.setHours(23, 59, 59, 999);
    } else if (scope === "week") {
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
    } else if (scope === "day" && date) {
      from = new Date(date); from.setHours(0, 0, 0, 0);
      to = new Date(date); to.setHours(23, 59, 59, 999);
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
