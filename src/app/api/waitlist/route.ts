import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { findEligibleWaitlist } from "@/lib/cascade";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const slotStart = url.searchParams.get("slotStart");
  const slotEnd = url.searchParams.get("slotEnd");

  if (slotStart && slotEnd) {
    const eligible = await findEligibleWaitlist(
      { startsAt: new Date(slotStart), endsAt: new Date(slotEnd) },
      tenantId
    );
    return NextResponse.json(eligible);
  }

  const entries = await prisma.waitlistEntry.findMany({
    where: { userId: tenantId, active: true },
    include: { client: true, service: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { clientId, serviceId, preferences } = body;
  if (!clientId || !serviceId) {
    return NextResponse.json({ error: "clientId e serviceId obrigatórios" }, { status: 400 });
  }
  const entry = await prisma.waitlistEntry.create({
    data: {
      userId: tenantId,
      clientId,
      serviceId,
      preferences: preferences ? JSON.stringify(preferences) : "{}",
    },
    include: { client: true, service: true },
  });
  return NextResponse.json(entry);
}
