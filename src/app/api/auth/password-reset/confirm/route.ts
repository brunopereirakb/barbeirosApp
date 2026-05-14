import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumeResetToken } from "@/lib/password-reset";
import { validatePassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Token e palavra-passe são obrigatórios" }, { status: 400 });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return NextResponse.json(
      { error: `Palavra-passe inválida: ${pwCheck.errors.join(", ")}` },
      { status: 400 }
    );
  }

  const userId = await consumeResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Pede um novo." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
