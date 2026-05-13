export type WorkScheduleEntry = {
  closed?: boolean;
  start?: string;
  end?: string;
};

export type ScheduleSettings = {
  workdayStart: string;
  workdayEnd: string;
  workScheduleByWeekday?: Record<string, WorkScheduleEntry>;
};

export type DayHours = {
  open: boolean;
  start: string;
  end: string;
};

/**
 * Resolves the effective working hours for a given date, blending the per-weekday
 * override (settings.workScheduleByWeekday) with the global fallback.
 *
 * Rules:
 *   - If the weekday entry exists and is `{closed: true}` → closed.
 *   - If the weekday entry has start+end → open with those hours.
 *   - Otherwise → open with global workdayStart/workdayEnd.
 */
export function getDayHours(date: Date, settings: ScheduleSettings): DayHours {
  const entry = settings.workScheduleByWeekday?.[String(date.getDay())];
  if (entry?.closed) {
    return { open: false, start: settings.workdayStart, end: settings.workdayEnd };
  }
  if (entry?.start && entry?.end) {
    return { open: true, start: entry.start, end: entry.end };
  }
  return { open: true, start: settings.workdayStart, end: settings.workdayEnd };
}
