import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.waitlistEntry.findFirst({ where: { id, userId: tenantId } });
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await prisma.waitlistEntry.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
