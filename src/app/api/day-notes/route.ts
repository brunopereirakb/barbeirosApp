import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

function toDateOnly(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to UTC midnight so @db.Date storage is stable across timezones.
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function GET(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  const url = new URL(req.url);
  const date = toDateOnly(url.searchParams.get("date"));
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
  const date = toDateOnly(body.date);
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
