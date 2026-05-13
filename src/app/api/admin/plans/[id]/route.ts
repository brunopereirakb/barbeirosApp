import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.price !== undefined) data.price = Number(body.price);
  if (body.features !== undefined) data.features = JSON.stringify(Array.isArray(body.features) ? body.features : []);
  if (body.active !== undefined) data.active = !!body.active;

  const updated = await prisma.planDefinition.update({ where: { id }, data });
  return NextResponse.json({ ...updated, features: JSON.parse(updated.features) });
}
