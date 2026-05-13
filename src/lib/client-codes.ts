import { prisma } from "@/lib/db";

/**
 * Returns the next sequential code for a tenant's clients (1, 2, 3, …).
 * Codes are assigned per-tenant; gaps from deletions are not reused.
 */
export async function nextClientCode(userId: string): Promise<number> {
  const max = await prisma.client.aggregate({
    where: { userId, code: { not: null } },
    _max: { code: true },
  });
  return (max._max.code ?? 0) + 1;
}

/**
 * Lazily assigns codes to any pre-existing clients that don't have one yet.
 * Safe to call from any GET handler — short-circuits to zero work once codes are populated.
 */
export async function ensureClientCodes(userId: string): Promise<void> {
  const missing = await prisma.client.findMany({
    where: { userId, code: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (missing.length === 0) return;

  let next = await nextClientCode(userId);
  for (const c of missing) {
    try {
      await prisma.client.update({ where: { id: c.id }, data: { code: next } });
      next += 1;
    } catch {
      // If a unique conflict somehow races us, skip and try the next number.
      next += 1;
    }
  }
}
