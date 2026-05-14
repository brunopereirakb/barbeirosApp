/**
 * Server-side timezone helpers.
 *
 * The server (Docker container) runs in UTC, but every salon has its own
 * civil-day notion (Settings.timezone, IANA). Anything that asks
 * "what day/weekday/hour is this booking in the salon's timezone?" must
 * go through these helpers — never through Date.getDay()/getHours() on
 * the server, which return UTC values.
 */

const WEEKDAY_FROM_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  weekday: number; // 0=Sun..6=Sat
};

/** Decompose a UTC instant into civil parts of the given IANA timezone. */
export function zonedParts(d: Date, tz: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  // hour can come back as "24" in some node versions when the time is exactly
  // midnight; normalise to 0.
  const hour = Number(get("hour")) % 24;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY_FROM_SHORT[get("weekday")] ?? 0,
  };
}

/**
 * Convert a civil date/time in `tz` to a UTC instant.
 * Iterates twice so DST transitions are handled correctly.
 */
export function zonedDayToUTC(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  // Start with the value interpreted as if it were UTC, then adjust by the
  // offset implied by the target timezone at that moment.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(utcMs), tz);
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    utcMs += desired - observed;
  }
  return new Date(utcMs);
}

/** UTC instant for 00:00 of the salon's civil day containing `d`. */
export function salonStartOfDay(d: Date, tz: string): Date {
  const p = zonedParts(d, tz);
  return zonedDayToUTC(p.year, p.month, p.day, 0, 0, tz);
}

/**
 * UTC instant for the last millisecond of the salon's civil day containing
 * `d`. DST-safe: computed as (next civil day at 00:00) − 1 ms.
 */
export function salonEndOfDay(d: Date, tz: string): Date {
  const p = zonedParts(d, tz);
  const nextStart = zonedDayToUTC(p.year, p.month, p.day + 1, 0, 0, tz);
  return new Date(nextStart.getTime() - 1);
}

/** 0=Sunday … 6=Saturday in the salon's timezone. */
export function salonDayOfWeek(d: Date, tz: string): number {
  return zonedParts(d, tz).weekday;
}

/** 0..23 in the salon's timezone. */
export function salonHour(d: Date, tz: string): number {
  return zonedParts(d, tz).hour;
}

/**
 * "YYYY-MM-DD" date key for the salon's civil day containing `d`.
 * Useful for storing/looking up day-scoped rows (like day notes).
 */
export function salonDateKey(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
