// Email sender. Currently disabled until an SMTP provider is configured.
// To enable: set SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS + SMTP_FROM
// in the environment and wire up nodemailer (or your preferred provider) in
// the body of `sendEmail` below.

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailDisabledError extends Error {
  constructor() {
    super(
      "Envio de email desactivado. Pede ao administrador para configurar SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS."
    );
    this.name = "EmailDisabledError";
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(_opts: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    throw new EmailDisabledError();
  }
  // Hook your nodemailer / Resend / Postmark client here.
  throw new EmailDisabledError();
}

export function passwordResetEmailTemplate(name: string, resetLink: string, salonName: string) {
  return {
    subject: `Recuperar palavra-passe — ${salonName}`,
    text: `Olá ${name},

Pediste para recuperar a tua palavra-passe no ${salonName}.

Clica neste link nos próximos 30 minutos para escolher uma nova:
${resetLink}

Se não foste tu a pedir, ignora este email — a palavra-passe não foi alterada.`,
    html: `<p>Olá ${name},</p>
<p>Pediste para recuperar a tua palavra-passe no <strong>${salonName}</strong>.</p>
<p>Clica neste link nos próximos 30 minutos para escolher uma nova:</p>
<p><a href="${resetLink}">${resetLink}</a></p>
<p style="color:#888;font-size:12px;margin-top:24px">Se não foste tu a pedir, ignora este email — a palavra-passe não foi alterada.</p>`,
  };
}
