import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const VALID_STATUSES = ["active", "trial", "paused", "expired", "cancelled"];
const VALID_RENEWAL = ["monthly", "annual", "manual"];
const VALID_PAYMENT = ["paid", "pending", "overdue"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (Array.isArray(body.addons)) data.addons = JSON.stringify(body.addons);
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.status !== undefined && VALID_STATUSES.includes(body.status)) data.status = body.status;
  if (body.renewalType !== undefined && VALID_RENEWAL.includes(body.renewalType)) data.renewalType = body.renewalType;
  if (body.paymentStatus !== undefined && VALID_PAYMENT.includes(body.paymentStatus)) data.paymentStatus = body.paymentStatus;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.trialEndsAt !== undefined) data.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const sub = await prisma.subscription.upsert({
    where: { userId: id },
    update: data,
    create: { userId: id, plan: "BASE", addons: "[]", ...data },
  });

  return NextResponse.json({
    plan: sub.plan,
    addons: JSON.parse(sub.addons),
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    expiresAt: sub.expiresAt,
    renewalType: sub.renewalType,
    paymentStatus: sub.paymentStatus,
    notes: sub.notes,
    createdAt: sub.createdAt,
  });
}
