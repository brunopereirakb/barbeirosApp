import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";
  const serviceId = url.searchParams.get("serviceId") || "";
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 500);

  const where: Record<string, unknown> = { userId: tenantId };

  if (status) where.status = status;
  if (serviceId) where.serviceId = serviceId;

  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.startsAt = range;
  }

  if (q) {
    (where as Record<string, unknown>).client = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: { client: true, service: true },
    orderBy: { startsAt: "desc" },
    take: limit,
  });

  return NextResponse.json(appointments);
}
