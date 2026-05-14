import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/api-auth";
import { acceptOffer, declineOffer, processCascadeTick, forceAdvance } from "@/lib/cascade";
import { autoCompleteExpired } from "@/lib/auto-complete";
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
    // Run both the cascade-offer sweep and the auto-complete sweep so the
    // dashboard's minute-polling silently closes bookings the user forgot
    // to mark as done.
    const [cascade, autoCompleted] = await Promise.all([
      processCascadeTick(tenantId),
      autoCompleteExpired(tenantId),
    ]);
    return NextResponse.json({ ...cascade, autoCompleted });
  }
  if (action === "force-advance" && cascadeId) {
    const result = await forceAdvance(cascadeId, tenantId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
