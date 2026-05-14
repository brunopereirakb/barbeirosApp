import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { sendWhatsApp, renderReminderTemplate } from "@/lib/whatsapp";
import { salonStartOfDay, salonEndOfDay, zonedParts, zonedDayToUTC } from "@/lib/timezone";

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { day } = await req.json() as { day: "today" | "tomorrow" };

  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const tz = settings?.timezone || "Europe/Lisbon";
  const salonName = settings?.salonName ?? "O Meu Salão";

  // "today" / "tomorrow" mean the salon's civil day — not the server's UTC
  // day, which can be off by one near midnight or in any non-UTC timezone.
  const now = new Date();
  const todayParts = zonedParts(now, tz);
  const target =
    day === "tomorrow"
      ? zonedDayToUTC(todayParts.year, todayParts.month, todayParts.day + 1, 0, 0, tz)
      : salonStartOfDay(now, tz);
  const end = salonEndOfDay(target, tz);

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
        body: renderReminderTemplate(settings?.reminderTemplate, {
          clientName: appt.client.name,
          serviceName: appt.service.name,
          when: appt.startsAt,
          salonName,
        }),
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
