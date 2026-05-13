import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function GET() {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const services = await prisma.service.findMany({
    where: { userId: tenantId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { name, durationMin, category } = body;
  if (!name || !durationMin) {
    return NextResponse.json({ error: "nome e duração obrigatórios" }, { status: 400 });
  }
  const service = await prisma.service.create({
    data: {
      userId: tenantId,
      name,
      durationMin: Number(durationMin),
      category: category || null,
    },
  });
  return NextResponse.json(service);
}
