import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { ensureClientCodes, nextClientCode } from "@/lib/client-codes";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  // Backfill missing codes once, lazily, so existing clients get 1, 2, 3, … on first read.
  await ensureClientCodes(tenantId);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  let where: object = { userId: tenantId };
  if (q) {
    const or: object[] = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    // If the query is a pure integer, also match it exactly against the client code.
    if (/^\d+$/.test(q)) or.push({ code: Number(q) });
    where = { userId: tenantId, OR: or };
  }

  const clients = await prisma.client.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { name, phone, email, birthday, notes } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
  }

  // Make sure any legacy clients have codes before we compute the next one.
  await ensureClientCodes(tenantId);

  // Retry a few times in case of a rare race on the unique [userId, code] constraint.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextClientCode(tenantId);
    try {
      const client = await prisma.client.create({
        data: {
          userId: tenantId,
          code,
          name: name.trim(),
          phone: phone || null,
          email: email || null,
          birthday: birthday ? new Date(birthday) : null,
          notes: notes || null,
        },
      });
      return NextResponse.json(client);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue; // unique violation, try next code
      throw e;
    }
  }
  return NextResponse.json(
    { error: "Não foi possível atribuir um código ao cliente, tenta novamente" },
    { status: 500 }
  );
}
