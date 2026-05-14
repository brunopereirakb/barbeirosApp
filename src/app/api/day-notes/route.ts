import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";
import { zonedParts } from "@/lib/timezone";

/**
 * Resolve an arbitrary client-sent ISO to UTC midnight of the salon's
 * CIVIL day. This guarantees the storage key matches what the user
 * intuitively sees on the calendar, regardless of either party's clock.
 */
async function toSalonDateOnly(input: string | null, tenantId: string): Promise<Date | null> {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const settings = await prisma.settings.findUnique({ where: { userId: tenantId } });
  const tz = settings?.timezone || "Europe/Lisbon";
  const p = zonedParts(d, tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const date = await toSalonDateOnly(url.searchParams.get("date"), tenantId);
  if (!date) {
    return NextResponse.json({ error: "date inválida" }, { status: 400 });
  }

  const note = await prisma.dayNote.findUnique({
    where: { userId_date: { userId: tenantId, date } },
  });
  return NextResponse.json(note ? { text: note.text } : { text: "" });
}

export async function PUT(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const body = await req.json();
  const date = await toSalonDateOnly(body.date, tenantId);
  const text: string = (body.text ?? "").toString();
  if (!date) {
    return NextResponse.json({ error: "date inválida" }, { status: 400 });
  }

  if (text.trim() === "") {
    await prisma.dayNote.deleteMany({ where: { userId: tenantId, date } });
    return NextResponse.json({ text: "" });
  }

  const saved = await prisma.dayNote.upsert({
    where: { userId_date: { userId: tenantId, date } },
    create: { userId: tenantId, date, text },
    update: { text },
  });
  return NextResponse.json({ text: saved.text });
}
