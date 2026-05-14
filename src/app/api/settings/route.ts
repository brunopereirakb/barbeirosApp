import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/api-auth";

async function userExists(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return u !== null;
}

export async function GET() {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  if (!(await userExists(tenantId))) {
    return NextResponse.json({ error: "Sessão expirada — inicie sessão novamente" }, { status: 401 });
  }

  const settings = await prisma.settings.upsert({
    where: { userId: tenantId },
    create: { userId: tenantId },
    update: {},
  });

  const subscription = await prisma.subscription.findUnique({
    where: { userId: tenantId },
  });

  let defaultServiceByWeekday: Record<string, string> = {};
  try {
    defaultServiceByWeekday = JSON.parse(settings.defaultServiceByWeekday || "{}");
  } catch {
    defaultServiceByWeekday = {};
  }

  let workScheduleByWeekday: Record<string, unknown> = {};
  try {
    workScheduleByWeekday = JSON.parse(settings.workScheduleByWeekday || "{}");
  } catch {
    workScheduleByWeekday = {};
  }

  let defaultServiceWindowsByWeekday: Record<string, unknown> = {};
  try {
    defaultServiceWindowsByWeekday = JSON.parse(settings.defaultServiceWindowsByWeekday || "{}");
  } catch {
    defaultServiceWindowsByWeekday = {};
  }

  return NextResponse.json({
    ...settings,
    defaultServiceByWeekday,
    defaultServiceWindowsByWeekday,
    workScheduleByWeekday,
    whatsappMode: process.env.WHATSAPP_MODE || "mock",
    subscription: subscription
      ? { plan: subscription.plan, addons: JSON.parse(subscription.addons) }
      : { plan: "BASE", addons: [] },
  });
}

export async function PATCH(req: NextRequest) {
  const { tenantId, response } = await requireTenant();
  if (response) return response;

  if (!(await userExists(tenantId))) {
    return NextResponse.json({ error: "Sessão expirada — inicie sessão novamente" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.salonName !== undefined) data.salonName = body.salonName;
  if (body.timezone !== undefined) {
    // Validate the IANA name by trying to build a formatter — bad values
    // throw RangeError. Reject so we don't poison every server-side day
    // calculation later.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: String(body.timezone) });
      data.timezone = String(body.timezone);
    } catch {
      return NextResponse.json(
        { error: "Timezone IANA inválida" },
        { status: 400 }
      );
    }
  }
  if (body.workdayStart !== undefined) data.workdayStart = body.workdayStart;
  if (body.workdayEnd !== undefined) data.workdayEnd = body.workdayEnd;
  if (body.lunchStart !== undefined) data.lunchStart = body.lunchStart;
  if (body.lunchEnd !== undefined) data.lunchEnd = body.lunchEnd;
  if (body.cascadeWaitMinutes !== undefined) data.cascadeWaitMinutes = Number(body.cascadeWaitMinutes);
  if (body.reminderHoursBefore !== undefined) data.reminderHoursBefore = Number(body.reminderHoursBefore);
  if (body.reminderTemplate !== undefined) {
    // Empty string ↔ revert to default. Treating null/"" the same way means
    // the user can reset by clearing the textarea.
    const t = typeof body.reminderTemplate === "string" ? body.reminderTemplate : "";
    data.reminderTemplate = t.trim() === "" ? null : t;
  }
  if (body.defaultServiceByWeekday !== undefined) {
    // Accept either an object map or a JSON string; persist as JSON string.
    data.defaultServiceByWeekday =
      typeof body.defaultServiceByWeekday === "string"
        ? body.defaultServiceByWeekday
        : JSON.stringify(body.defaultServiceByWeekday);
  }
  if (body.workScheduleByWeekday !== undefined) {
    data.workScheduleByWeekday =
      typeof body.workScheduleByWeekday === "string"
        ? body.workScheduleByWeekday
        : JSON.stringify(body.workScheduleByWeekday);
  }
  if (body.defaultServiceWindowsByWeekday !== undefined) {
    data.defaultServiceWindowsByWeekday =
      typeof body.defaultServiceWindowsByWeekday === "string"
        ? body.defaultServiceWindowsByWeekday
        : JSON.stringify(body.defaultServiceWindowsByWeekday);
  }

  const updated = await prisma.settings.upsert({
    where: { userId: tenantId },
    update: data,
    create: { userId: tenantId, ...data },
  });
  return NextResponse.json(updated);
}
