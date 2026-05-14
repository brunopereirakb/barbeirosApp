import { prisma } from "./db";

/**
 * Marks any appointment past its endsAt that's still pending/confirmed
 * as "done". This runs from the cascade tick so the dashboard's normal
 * polling silently completes bookings that the user forgot to close.
 *
 * Returns the number of rows updated for telemetry/debugging.
 */
export async function autoCompleteExpired(tenantId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.appointment.updateMany({
    where: {
      userId: tenantId,
      endsAt: { lt: now },
      status: { in: ["pending", "confirmed"] },
    },
    data: { status: "done" },
  });
  return result.count;
}
