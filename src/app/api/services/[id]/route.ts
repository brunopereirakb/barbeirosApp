import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.service.findFirst({ where: { id, userId: tenantId } });
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.durationMin !== undefined) data.durationMin = Number(body.durationMin);
  if (body.category !== undefined) data.category = body.category || null;
  if (body.active !== undefined) data.active = !!body.active;

  const updated = await prisma.service.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.service.findFirst({ where: { id, userId: tenantId } });
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await prisma.service.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
