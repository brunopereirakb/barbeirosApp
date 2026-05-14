import { timeStringToMinutes } from "./utils";

export type ServiceLike = { id: string; name: string; durationMin: number };

export type ServiceWindow = {
  startMin: number;
  endMin: number;
  service: ServiceLike;
};

export type WindowConfig = { start: string; end: string; serviceId: string };

type SettingsLike = {
  defaultServiceByWeekday?: Record<string, string>;
  defaultServiceWindowsByWeekday?: Record<string, WindowConfig[]> | string;
};

/**
 * Parse the JSON-string-or-object settings field into a plain
 * weekday→windows[] map. Tolerant of malformed input — bad JSON returns {}.
 */
export function parseWindowsConfig(
  raw: string | Record<string, WindowConfig[]> | undefined | null
): Record<string, WindowConfig[]> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, WindowConfig[]>;
    } catch {
      return {};
    }
  }
  return raw;
}

/**
 * Resolve the service window list for a given weekday.
 *
 * The single `defaultServiceByWeekday[weekday]` entry is the "everywhere
 * else" service for that day; any per-time-window overrides for the same
 * weekday slot in on top, and the gaps left between/around them are filled
 * with the default. That way the barber can say "Tuesday is Corte 20min,
 * except 18:15–21:00 do Corte 15min" without having to redeclare the
 * morning/afternoon explicitly.
 *
 * Returns [] when neither default nor windows are configured.
 */
export function getServiceWindows(
  weekday: number,
  hours: { start: string; end: string },
  settings: SettingsLike,
  services: ServiceLike[]
): ServiceWindow[] {
  const dayStart = timeStringToMinutes(hours.start);
  const dayEnd = timeStringToMinutes(hours.end);
  const windowsConfig = parseWindowsConfig(settings.defaultServiceWindowsByWeekday);
  const userWindowsRaw = windowsConfig[String(weekday)];

  const sid = settings.defaultServiceByWeekday?.[String(weekday)];
  const defaultSvc = sid ? services.find((s) => s.id === sid) ?? null : null;

  // No user windows: just one window for the whole day with the default.
  if (!userWindowsRaw || userWindowsRaw.length === 0) {
    if (!defaultSvc) return [];
    return [{ startMin: dayStart, endMin: dayEnd, service: defaultSvc }];
  }

  // Resolve user windows (drop ones whose service no longer exists), sort
  // them, and clamp to the working hours.
  const userWindows: ServiceWindow[] = userWindowsRaw
    .map((w) => {
      const service = services.find((s) => s.id === w.serviceId);
      if (!service) return null;
      return {
        startMin: timeStringToMinutes(w.start),
        endMin: timeStringToMinutes(w.end),
        service,
      } as ServiceWindow;
    })
    .filter((w): w is ServiceWindow => w !== null)
    .sort((a, b) => a.startMin - b.startMin);

  // Walk through [dayStart, dayEnd] in order, inserting each user window in
  // turn and filling any preceding gap with the default service (when
  // present). The cursor tracks the next minute we still need to cover.
  const result: ServiceWindow[] = [];
  let cursor = dayStart;
  for (const w of userWindows) {
    if (w.endMin <= dayStart) continue; // entirely before workday
    if (w.startMin >= dayEnd) break; // entirely after workday — sorted, so stop
    const start = Math.max(w.startMin, cursor);
    const end = Math.min(w.endMin, dayEnd);
    if (start > cursor && defaultSvc) {
      result.push({ startMin: cursor, endMin: start, service: defaultSvc });
    }
    if (end > start) {
      result.push({ startMin: start, endMin: end, service: w.service });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < dayEnd && defaultSvc) {
    result.push({ startMin: cursor, endMin: dayEnd, service: defaultSvc });
  }
  return result;
}
