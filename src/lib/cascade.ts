import { prisma } from "./db";
import { sendWhatsApp, messageTemplates } from "./whatsapp";

export interface FreedSlot {
  startsAt: Date;
  endsAt: Date;
  serviceId?: string;
}

export async function findEligibleWaitlist(slot: FreedSlot, tenantId: string) {
  const all = await prisma.waitlistEntry.findMany({
    where: { userId: tenantId, active: true },
    include: { client: true, service: true },
    orderBy: { createdAt: "asc" },
  });

  const slotDurationMin = (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000;
  const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][slot.startsAt.getDay()];
  const hour = slot.startsAt.getHours();
  const periodOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return all.filter((entry: typeof all[number]) => {
    if (entry.service.durationMin > slotDurationMin) return false;
    try {
      const prefs = JSON.parse(entry.preferences || "{}") as {
        weekdays?: string[];
        timeOfDay?: string;
      };
      if (prefs.weekdays && prefs.weekdays.length && !prefs.weekdays.includes("any") && !prefs.weekdays.includes(dayOfWeek)) {
        return false;
      }
      if (prefs.timeOfDay && prefs.timeOfDay !== "any" && prefs.timeOfDay !== periodOfDay) {
        return false;
      }
    } catch {}
    return true;
  });
}

export async function startCascade(slot: FreedSlot, candidateIds: string[], tenantId: string): Promise<{ cascadeId: string; firstOfferId: string | null }> {
  if (candidateIds.length === 0) return { cascadeId: "", firstOfferId: null };

  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const waitMin = settings?.cascadeWaitMinutes ?? 30;

  const cascadeId = `cas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const firstOffer = await sendOfferTo(candidateIds[0], slot, cascadeId, 0, waitMin, tenantId);

  for (let i = 1; i < candidateIds.length; i++) {
    await prisma.cascadeOffer.create({
      data: {
        userId: tenantId,
        cascadeId,
        waitlistEntryId: candidateIds[i],
        freedStartsAt: slot.startsAt,
        freedEndsAt: slot.endsAt,
        sentAt: new Date(0),
        expiresAt: new Date(0),
        status: "queued",
        position: i,
      },
    });
  }

  return { cascadeId, firstOfferId: firstOffer.id };
}

async function sendOfferTo(waitlistEntryId: string, slot: FreedSlot, cascadeId: string, position: number, waitMin: number, tenantId: string) {
  const entry = await prisma.waitlistEntry.findUniqueOrThrow({
    where: { id: waitlistEntryId },
    include: { client: true, service: true },
  });

  const expiresAt = new Date(Date.now() + waitMin * 60_000);

  const offer = await prisma.cascadeOffer.create({
    data: {
      userId: tenantId,
      cascadeId,
      waitlistEntryId,
      freedStartsAt: slot.startsAt,
      freedEndsAt: slot.endsAt,
      expiresAt,
      status: "pending",
      position,
    },
  });

  if (entry.client.phone) {
    await sendWhatsApp({
      to: entry.client.phone,
      body: messageTemplates.cascadeOffer(entry.client.name, entry.service.name, slot.startsAt, waitMin),
      context: { cascadeId, offerId: offer.id, type: "cascade_offer" },
      tenantId,
    });
  }

  return offer;
}

export async function acceptOffer(offerId: string, tenantId: string): Promise<{ appointmentId: string }> {
  const offer = await prisma.cascadeOffer.findFirstOrThrow({
    where: { id: offerId, userId: tenantId },
    include: { waitlistEntry: { include: { client: true, service: true } } },
  });

  if (offer.status !== "pending") {
    throw new Error(`Oferta já não está pendente (estado: ${offer.status})`);
  }

  const entry = offer.waitlistEntry;
  const endsAt = new Date(offer.freedStartsAt.getTime() + entry.service.durationMin * 60_000);

  const appointment = await prisma.appointment.create({
    data: {
      userId: tenantId,
      clientId: entry.clientId,
      serviceId: entry.serviceId,
      startsAt: offer.freedStartsAt,
      endsAt,
      status: "confirmed",
    },
  });

  await prisma.cascadeOffer.update({
    where: { id: offerId },
    data: { status: "accepted", resolvedAt: new Date() },
  });

  await prisma.cascadeOffer.updateMany({
    where: {
      cascadeId: offer.cascadeId,
      id: { not: offerId },
      status: { in: ["pending", "queued"] },
    },
    data: { status: "superseded", resolvedAt: new Date() },
  });

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { active: false },
  });

  if (entry.client.phone) {
    await sendWhatsApp({
      to: entry.client.phone,
      body: messageTemplates.cascadeAccepted(entry.client.name, entry.service.name, offer.freedStartsAt),
      context: { appointmentId: appointment.id, type: "cascade_accepted" },
      tenantId,
    });
  }

  return { appointmentId: appointment.id };
}

export async function declineOffer(offerId: string, tenantId: string, removeFromWaitlist = false): Promise<{ nextOfferId: string | null }> {
  const offer = await prisma.cascadeOffer.findFirstOrThrow({ where: { id: offerId, userId: tenantId } });
  await prisma.cascadeOffer.update({
    where: { id: offerId },
    data: { status: "declined", resolvedAt: new Date() },
  });
  if (removeFromWaitlist) {
    await prisma.waitlistEntry.update({ where: { id: offer.waitlistEntryId }, data: { active: false } });
  }
  return advanceCascade(offer.cascadeId, tenantId);
}

export async function processCascadeTick(tenantId: string): Promise<{ expired: number; advanced: number }> {
  const now = new Date();
  const expired = await prisma.cascadeOffer.findMany({
    where: { userId: tenantId, status: "pending", expiresAt: { lte: now } },
  });

  let advanced = 0;
  for (const offer of expired) {
    await prisma.cascadeOffer.update({
      where: { id: offer.id },
      data: { status: "expired", resolvedAt: now },
    });
    const result = await advanceCascade(offer.cascadeId, tenantId);
    if (result.nextOfferId) advanced++;
  }

  return { expired: expired.length, advanced };
}

export async function advanceCascade(cascadeId: string, tenantId: string): Promise<{ nextOfferId: string | null }> {
  const accepted = await prisma.cascadeOffer.findFirst({
    where: { cascadeId, status: "accepted" },
  });
  if (accepted) return { nextOfferId: null };

  const next = await prisma.cascadeOffer.findFirst({
    where: { cascadeId, status: "queued" },
    orderBy: { position: "asc" },
  });
  if (!next) return { nextOfferId: null };

  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const waitMin = settings?.cascadeWaitMinutes ?? 30;
  const expiresAt = new Date(Date.now() + waitMin * 60_000);

  const updated = await prisma.cascadeOffer.update({
    where: { id: next.id },
    data: { status: "pending", sentAt: new Date(), expiresAt },
    include: { waitlistEntry: { include: { client: true, service: true } } },
  });

  const entry = updated.waitlistEntry;
  if (entry.client.phone) {
    await sendWhatsApp({
      to: entry.client.phone,
      body: messageTemplates.cascadeOffer(entry.client.name, entry.service.name, updated.freedStartsAt, waitMin),
      context: { cascadeId, offerId: updated.id, type: "cascade_offer" },
      tenantId,
    });
  }

  return { nextOfferId: updated.id };
}

export async function forceAdvance(cascadeId: string, tenantId: string): Promise<{ nextOfferId: string | null }> {
  const pending = await prisma.cascadeOffer.findFirst({
    where: { cascadeId, userId: tenantId, status: "pending" },
  });
  if (pending) {
    await prisma.cascadeOffer.update({
      where: { id: pending.id },
      data: { status: "expired", resolvedAt: new Date() },
    });
  }
  return advanceCascade(cascadeId, tenantId);
}
