import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createResetToken, purgeExpiredTokens } from "@/lib/password-reset";
import {
  EmailDisabledError,
  isEmailConfigured,
  passwordResetEmailTemplate,
  sendEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  // Per the requirement: if no provider is configured, refuse with a clear
  // error rather than pretending success. This is shown to the user.
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Recuperação de palavra-passe está desactivada. Contacta o administrador para configurar o serviço de email.",
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
  }

  void purgeExpiredTokens(); // fire-and-forget cleanup

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same generic success — don't let an attacker enumerate
  // which emails are registered.
  const generic = NextResponse.json({
    ok: true,
    message:
      "Se este email estiver registado, vais receber um link de recuperação nos próximos minutos.",
  });

  if (!user || !user.active) return generic;

  try {
    const rawToken = await createResetToken(user.id);
    const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
    const salonName = settings?.salonName || "Schedule Hairdresser";

    const baseUrl =
      process.env.PUBLIC_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password/${rawToken}`;

    const { subject, text, html } = passwordResetEmailTemplate(user.name, resetLink, salonName);
    await sendEmail({ to: user.email, subject, text, html });
  } catch (e) {
    // If the provider is configured but the actual send fails, surface a clear
    // error. EmailDisabledError shouldn't be possible here (we checked above),
    // but handle it defensively.
    if (e instanceof EmailDisabledError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Falha a enviar email: ${msg}` }, { status: 502 });
  }

  return generic;
}
