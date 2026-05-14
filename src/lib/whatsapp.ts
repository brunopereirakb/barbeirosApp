// WhatsApp sender. No-history mode: we send (or "send" in mock) and return the
// result, but we don't persist to MessageLog and don't console.log on success.
// Failures still surface as { ok: false } to the caller.

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
    // Mock mode: pretend it succeeded. No DB write, no console line.
    return { ok: true, messageId: `mock_${Date.now()}`, mode: "mock" };
  }

  try {
    const { messageId } = await sendViaTwilio({ ...opts, to: phone });
    return { ok: true, messageId, mode: "real" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error, mode: "real" };
  }
}

export const DEFAULT_REMINDER_TEMPLATE = `Olá {cliente}! 👋

Lembrete da sua marcação no {salao}:
📅 {data}
🕐 {hora}
✂️ {servico}

Se precisar de remarcar, responda a esta mensagem. Até amanhã!`;

/**
 * Render the 24h reminder by substituting placeholders into the salon's
 * configured template (or the default if none is set).
 */
export function renderReminderTemplate(
  template: string | null | undefined,
  vars: { clientName: string; serviceName: string; when: Date; salonName: string }
): string {
  const tpl = template?.trim() ? template : DEFAULT_REMINDER_TEMPLATE;
  const time = vars.when.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const date = vars.when.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  return tpl
    .replaceAll("{cliente}", vars.clientName)
    .replaceAll("{servico}", vars.serviceName)
    .replaceAll("{hora}", time)
    .replaceAll("{data}", date)
    .replaceAll("{salao}", vars.salonName);
}

export const messageTemplates = {
  reminder24h(clientName: string, serviceName: string, when: Date, salonName: string): string {
    return renderReminderTemplate(null, { clientName, serviceName, when, salonName });
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
