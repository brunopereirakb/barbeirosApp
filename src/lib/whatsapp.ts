import { prisma } from "./db";

export interface SendMessageOptions {
  to: string;
  body: string;
  context?: Record<string, unknown>;
  tenantId?: string;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  mode: "mock" | "real";
  logId: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

async function sendViaTwilio(opts: SendMessageOptions): Promise<{ messageId: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    throw new Error("Credenciais Twilio em falta no .env");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const phone = normalizePhone(opts.to);

  const params = new URLSearchParams();
  params.set("From", from);
  params.set("To", `whatsapp:${phone}`);
  params.set("Body", opts.body);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twilio error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as { sid: string };
  return { messageId: data.sid };
}

export async function sendWhatsApp(opts: SendMessageOptions): Promise<SendMessageResult> {
  const mode = (process.env.WHATSAPP_MODE || "mock") as "mock" | "real";
  const phone = normalizePhone(opts.to);

  if (mode === "mock") {
    const log = await prisma.messageLog.create({
      data: {
        userId: opts.tenantId || null,
        channel: "whatsapp",
        recipient: phone,
        content: opts.body,
        status: "mocked",
        context: opts.context ? JSON.stringify(opts.context) : null,
      },
    });
    console.log(`[WhatsApp MOCK] → ${phone}: ${opts.body.substring(0, 80)}...`);
    return { ok: true, messageId: `mock_${log.id}`, mode: "mock", logId: log.id };
  }

  try {
    const { messageId } = await sendViaTwilio(opts);
    const log = await prisma.messageLog.create({
      data: {
        userId: opts.tenantId || null,
        channel: "whatsapp",
        recipient: phone,
        content: opts.body,
        status: "sent",
        context: JSON.stringify({ ...opts.context, twilioSid: messageId }),
      },
    });
    return { ok: true, messageId, mode: "real", logId: log.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const log = await prisma.messageLog.create({
      data: {
        userId: opts.tenantId || null,
        channel: "whatsapp",
        recipient: phone,
        content: opts.body,
        status: "failed",
        context: JSON.stringify({ ...opts.context, error }),
      },
    });
    console.error(`[WhatsApp REAL] falhou para ${phone}: ${error}`);
    return { ok: false, error, mode: "real", logId: log.id };
  }
}

export const messageTemplates = {
  reminder24h(clientName: string, serviceName: string, when: Date, salonName: string): string {
    const time = when.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const date = when.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    return `Olá ${clientName}! 👋

Lembrete da sua marcação no ${salonName}:
📅 ${date}
🕐 ${time}
✂️ ${serviceName}

Se precisar de remarcar, responda a esta mensagem. Até amanhã!`;
  },

  birthdayWish(clientName: string, salonName: string): string {
    return `🎂 Parabéns, ${clientName}!

Que tenha um dia especial cheio de alegrias.
Um grande abraço da equipa do ${salonName} ✨`;
  },

  cascadeOffer(clientName: string, serviceName: string, when: Date, expiresInMin: number): string {
    const time = when.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const date = when.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = expiresInMin >= 60
      ? `${Math.round(expiresInMin / 60)} hora${Math.round(expiresInMin / 60) !== 1 ? "s" : ""}`
      : `${expiresInMin} minuto${expiresInMin !== 1 ? "s" : ""}`;
    return `Olá ${clientName}! 👋

Abriu uma vaga que pode ser do seu interesse:
📅 ${date}
🕐 ${time}
✂️ ${serviceName}

Quer aproveitar? Responda SIM nas próximas ${timeStr} para confirmar. Caso contrário, a vaga passa para o cliente seguinte na lista.`;
  },

  cascadeAccepted(clientName: string, serviceName: string, when: Date): string {
    const time = when.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const date = when.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    return `✅ Marcação confirmada!

${clientName}, ficou agendado:
📅 ${date}
🕐 ${time}
✂️ ${serviceName}

Até breve!`;
  },
};
