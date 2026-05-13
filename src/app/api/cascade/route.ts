import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/api-auth";
import { acceptOffer, declineOffer, processCascadeTick, forceAdvance } from "@/lib/cascade";
import { prisma } from "@/lib/db";

export async function GET() {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const offers = await prisma.cascadeOffer.findMany({
    where: { userId: tenantId, status: { in: ["pending", "queued"] } },
    include: {
      waitlistEntry: { include: { client: true, service: true } },
    },
    orderBy: [{ cascadeId: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(offers);
}

export async function POST(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const { action, offerId, cascadeId } = body;

  if (action === "accept" && offerId) {
    const result = await acceptOffer(offerId, tenantId);
    return NextResponse.json(result);
  }
  if (action === "decline" && offerId) {
    const result = await declineOffer(offerId, tenantId, body.removeFromWaitlist === true);
    return NextResponse.json(result);
  }
  if (action === "tick") {
    const result = await processCascadeTick(tenantId);
    return NextResponse.json(result);
  }
  if (action === "force-advance" && cascadeId) {
    const result = await forceAdvance(cascadeId, tenantId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
