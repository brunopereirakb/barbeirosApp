import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

interface SubRow {
  plan: string;
  addons: string;
  status: string;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  renewalType: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: Date;
}

function mapSub(sub: SubRow | null, fallbackDate: Date) {
  if (!sub) return { plan: "BASE", addons: [], status: "active", trialEndsAt: null, expiresAt: null, renewalType: "monthly", paymentStatus: "paid", notes: null, createdAt: fallbackDate };
  return {
    plan: sub.plan,
    addons: JSON.parse(sub.addons),
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    expiresAt: sub.expiresAt,
    renewalType: sub.renewalType,
    paymentStatus: sub.paymentStatus,
    notes: sub.notes,
    createdAt: sub.createdAt,
  };
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    where: { role: "user" },
    include: { subscription: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      active: u.active,
      createdAt: u.createdAt,
      subscription: mapSub(u.subscription, u.createdAt),
    }))
  );
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await req.json();
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password e name são obrigatórios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email já registado" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role: "user",
      subscription: { create: { plan: "BASE", addons: "[]", status: "active" } },
      settings: { create: { salonName: name } },
    },
    include: { subscription: true },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    createdAt: user.createdAt,
    subscription: mapSub(user.subscription, user.createdAt),
  });
}
