import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nome, email e palavra-passe são obrigatórios" },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return NextResponse.json(
      { error: `Palavra-passe inválida: ${pwCheck.errors.join(", ")}` },
      { status: 400 }
    );
  }

  const normalizedEmail = (email as string).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Este email já está registado" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: (name as string).trim(),
      email: normalizedEmail,
      password: hashed,
      role: "user",
      subscription: { create: { plan: "BASE", addons: "[]" } },
      settings: { create: { salonName: (name as string).trim() } },
    },
  });

  return NextResponse.json({ ok: true });
}
