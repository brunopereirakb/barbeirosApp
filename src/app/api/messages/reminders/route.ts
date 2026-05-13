import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { sendWhatsApp, messageTemplates } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { day } = await req.json() as { day: "today" | "tomorrow" };
  const target = new Date();
  if (day === "tomorrow") target.setDate(target.getDate() + 1);
  target.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const salonName = settings?.salonName ?? "O Meu Salão";

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: tenantId,
      status: { in: ["confirmed", "pending"] },
      startsAt: { gte: target, lte: end },
    },
    include: { client: true, service: true },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const appt of appointments) {
    if (!appt.client.phone) continue;
    try {
      await sendWhatsApp({
        to: appt.client.phone,
        body: messageTemplates.reminder24h(appt.client.name, appt.service.name, appt.startsAt, salonName),
        context: { type: "reminder", appointmentId: appt.id },
        tenantId,
      });
      sent++;
    } catch (e) {
      errors.push(appt.client.name);
    }
  }

  return NextResponse.json({ sent, total: appointments.length, errors });
}
