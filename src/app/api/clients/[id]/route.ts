import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, userId: tenantId },
    include: {
      appointments: {
        include: { service: true },
        orderBy: { startsAt: "desc" },
        take: 50,
      },
    },
  });
  if (!client) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.birthday !== undefined) data.birthday = body.birthday ? new Date(body.birthday) : null;

  const existing = await prisma.client.findFirst({ where: { id, userId: tenantId } });
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const updated = await prisma.client.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.client.findFirst({ where: { id, userId: tenantId } });
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const count = await prisma.appointment.count({ where: { clientId: id, userId: tenantId } });
  if (count > 0) {
    return NextResponse.json({ error: "Cliente tem marcações associadas" }, { status: 400 });
  }
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
