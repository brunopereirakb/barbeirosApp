import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { sendWhatsApp, messageTemplates, renderReminderTemplate } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "100");
  const messages = await prisma.messageLog.findMany({
    where: { userId: tenantId },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { type, clientId, content, appointmentId } = body;

  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, userId: tenantId } });
  if (!client) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  if (!client.phone) {
    return NextResponse.json({ error: "Cliente sem telefone" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const salonName = settings?.salonName || "O Meu Salão";

  let messageBody = content || "";

  if (type === "birthday") {
    messageBody = messageTemplates.birthdayWish(client.name, salonName);
  } else if (type === "reminder" && appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, userId: tenantId },
      include: { service: true },
    });
    if (!appt) return NextResponse.json({ error: "marcação não encontrada" }, { status: 404 });
    messageBody = renderReminderTemplate(settings?.reminderTemplate, {
      clientName: client.name,
      serviceName: appt.service.name,
      when: appt.startsAt,
      salonName,
    });
  }

  if (!messageBody) {
    return NextResponse.json({ error: "conteúdo da mensagem em falta" }, { status: 400 });
  }

  const result = await sendWhatsApp({
    to: client.phone,
    body: messageBody,
    context: { type, clientId, appointmentId },
    tenantId,
  });

  return NextResponse.json(result);
}
