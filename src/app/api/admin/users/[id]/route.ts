import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.active !== undefined) data.active = !!body.active;
  if (body.password) data.password = await bcrypt.hash(body.password, 10);

  const updated = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, email: updated.email, name: updated.name, active: updated.active });
}
