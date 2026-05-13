import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const plans = await prisma.planDefinition.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(plans.map((p) => ({ ...p, features: JSON.parse(p.features) })));
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await req.json();
  const { key, name, description, price, features } = body;

  if (!key || !name) {
    return NextResponse.json({ error: "key e name são obrigatórios" }, { status: 400 });
  }

  const existing = await prisma.planDefinition.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um plano com esse key" }, { status: 409 });
  }

  const plan = await prisma.planDefinition.create({
    data: {
      key: key.toUpperCase().replace(/\s+/g, "_"),
      name,
      description: description || null,
      price: Number(price) || 0,
      features: JSON.stringify(Array.isArray(features) ? features : []),
    },
  });
  return NextResponse.json({ ...plan, features: JSON.parse(plan.features) });
}
