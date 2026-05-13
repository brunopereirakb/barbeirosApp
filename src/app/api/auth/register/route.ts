import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nome, email e palavra-passe são obrigatórios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A palavra-passe deve ter pelo menos 8 caracteres" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este email já está registado" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "user",
      subscription: { create: { plan: "BASE", addons: "[]" } },
      settings: { create: { salonName: name } },
    },
  });

  return NextResponse.json({ ok: true });
}
