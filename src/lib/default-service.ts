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
 * Resolve the service window list for a given weekday. Returns either the
 * user's per-time-window override (if any rows are configured for that day)
 * or a single window spanning the whole working day with the single-default
 * service. Returns [] when nothing is configured.
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
  const userWindows = windowsConfig[String(weekday)];

  if (userWindows && userWindows.length > 0) {
    return userWindows
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
  }

  const sid = settings.defaultServiceByWeekday?.[String(weekday)];
  if (!sid) return [];
  const svc = services.find((s) => s.id === sid);
  if (!svc) return [];
  return [{ startMin: dayStart, endMin: dayEnd, service: svc }];
}
