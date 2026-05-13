import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const where = q
    ? {
        userId: tenantId,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      }
    : { userId: tenantId };

  const clients = await prisma.client.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { name, phone, email, birthday, notes } = body;
  if (!name) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      userId: tenantId,
      name,
      phone: phone || null,
      email: email || null,
      birthday: birthday ? new Date(birthday) : null,
      notes: notes || null,
    },
  });
  return NextResponse.json(client);
}
