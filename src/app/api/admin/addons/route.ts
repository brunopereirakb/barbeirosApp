import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { ADDON_REGISTRY } from "@/lib/addon-registry";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  // Auto-sync: ensure every registry addon has a DB row.
  // Uses upsert so admin customisations (name/price/description) are never overwritten.
  await Promise.all(
    ADDON_REGISTRY.map((entry) =>
      prisma.addonDefinition.upsert({
        where: { key: entry.key },
        create: {
          key: entry.key,
          name: entry.defaultName,
          description: entry.defaultDescription,
          price: entry.defaultPrice,
        },
        update: {}, // never overwrite admin edits
      })
    )
  );

  const addons = await prisma.addonDefinition.findMany({
    where: { key: { in: ADDON_REGISTRY.map((a) => a.key) } },
    orderBy: { createdAt: "asc" },
  });

  // Attach implementedIn metadata from registry (not persisted in DB)
  return NextResponse.json(
    addons.map((a) => ({
      ...a,
      implementedIn: ADDON_REGISTRY.find((r) => r.key === a.key)?.implementedIn ?? "",
    }))
  );
}
