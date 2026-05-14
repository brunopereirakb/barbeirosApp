"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isSameDay, isToday, timeStringToMinutes } from "@/lib/utils";
import { getDayHours } from "@/lib/schedule";
import { getServiceWindows, type WindowConfig } from "@/lib/default-service";

type MiniAppt = {
  startsAt: string;
  endsAt: string;
  status: string;
};

type Service = { id: string; name: string; durationMin: number };

type Settings = {
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  defaultServiceByWeekday?: Record<string, string>;
  defaultServiceWindowsByWeekday?: Record<string, WindowConfig[]> | string;
  workScheduleByWeekday?: Record<string, { closed?: boolean; start?: string; end?: string }>;
};

const WEEKDAYS_SHORT = ["S", "T", "Q", "Q", "S", "S", "D"];
const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function getMonthGrid(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const dayOfWeek = first.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  start.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

type DayInfo =
  | { closed: true }
  | {
      closed: false;
      morningFree: number;
      afternoonFree: number;
      morningTotal: number;
      afternoonTotal: number;
    };

function dayInfo(
  d: Date,
  appts: MiniAppt[],
  services: Service[],
  settings: Settings | null
): DayInfo {
  if (!settings) return { closed: true };
  const hours = getDayHours(d, settings);
  if (!hours.open) return { closed: true };

  const windows = getServiceWindows(d.getDay(), hours, settings, services);
  if (windows.length === 0) return { closed: true };

  const dayStart = timeStringToMinutes(hours.start);
  const dayEnd = timeStringToMinutes(hours.end);
  const lunchStart = timeStringToMinutes(settings.lunchStart);
  const lunchEnd = timeStringToMinutes(settings.lunchEnd);

  // Compute morning/afternoon capacity by summing slot counts of each window
  // intersected with the corresponding range. Different windows can use
  // different slot sizes (the niche "20 min before 6pm, 15 min after" case).
  let morningTotal = 0;
  let afternoonTotal = 0;
  for (const w of windows) {
    const ws = Math.max(w.startMin, dayStart);
    const we = Math.min(w.endMin, dayEnd);
    const mEnd = Math.min(lunchStart, we);
    const mStart = Math.max(ws, dayStart);
    if (mEnd > mStart) {
      morningTotal += Math.floor((mEnd - mStart) / w.service.durationMin);
    }
    const aStart = Math.max(lunchEnd, ws);
    const aEnd = Math.min(we, dayEnd);
    if (aEnd > aStart) {
      afternoonTotal += Math.floor((aEnd - aStart) / w.service.durationMin);
    }
  }

  let morningUsed = 0;
  let afternoonUsed = 0;

  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const start = new Date(a.startsAt);
    if (!isSameDay(start, d)) continue;
    const startMin = start.getHours() * 60 + start.getMinutes();
    if (startMin < dayStart || startMin >= dayEnd) continue;

    // Use the booking's window slot size so a 15-min booking in a 20-min
    // window still counts as 1 slot (not 0).
    const w = windows.find((w) => startMin >= w.startMin && startMin < w.endMin);
    const slotMin = w?.service.durationMin ?? windows[0].service.durationMin;
    const end = new Date(a.endsAt);
    const durMs = end.getTime() - start.getTime();
    const durMin = durMs > 0 ? durMs / 60_000 : slotMin;
    const slots = Math.max(1, Math.ceil(durMin / slotMin));
    if (startMin < lunchStart) morningUsed += slots;
    else if (startMin >= lunchEnd) afternoonUsed += slots;
  }

  return {
    closed: false,
    morningFree: Math.max(0, morningTotal - morningUsed),
    afternoonFree: Math.max(0, afternoonTotal - afternoonUsed),
    morningTotal,
    afternoonTotal,
  };
}

type DotKind = "red" | "yellow" | "green";

function dotKind(info: DayInfo): DotKind {
  if (info.closed) return "red";
  const free = info.morningFree + info.afternoonFree;
  const total = info.morningTotal + info.afternoonTotal;
  if (free === 0) return "red";
  if (total > 0 && free / total <= 0.25) return "yellow";
  return "green";
}

export function MiniMonth({
  selected,
  onSelectDay,
  settings,
  services,
  // Increments whenever the parent dashboard refetches its appointments. We
  // listen to it so the mini-month dots/counts stay in sync after a booking
  // is created or cancelled — without it, the counts would only refresh on
  // a month-navigation click.
  refreshKey = 0,
}: {
  selected: Date;
  onSelectDay: (d: Date) => void;
  settings: Settings | null;
  services: Service[];
  refreshKey?: number;
}) {
  const [viewMonth, setViewMonth] = useState(
    new Date(selected.getFullYear(), selected.getMonth(), 1)
  );
  const [appointments, setAppointments] = useState<MiniAppt[]>([]);

  useEffect(() => {
    if (
      viewMonth.getFullYear() !== selected.getFullYear() ||
      viewMonth.getMonth() !== selected.getMonth()
    ) {
      setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    const start = new Date(viewMonth);
    start.setDate(start.getDate() - 7);
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7);

    fetch(
      `/api/appointments/search?dateFrom=${start.toISOString()}&dateTo=${end.toISOString()}&limit=500`
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then(setAppointments);
  }, [viewMonth, refreshKey]);

  const days = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);

  function shiftMonth(delta: number) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-card p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-ink-800">
          {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-ink-400"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const isSel = isSameDay(d, selected);
          const today = isToday(d);
          const info = dayInfo(d, appointments, services, settings);
          const dot = dotKind(info);

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "relative flex aspect-[1/1.1] min-h-[44px] flex-col items-stretch justify-between overflow-hidden rounded-md border p-1 text-left transition",
                isSel
                  ? "border-brand-500 bg-brand-500 text-white"
                  : inMonth
                    ? "border-ink-100 bg-card text-ink-800 hover:border-brand-200 hover:bg-brand-50/40"
                    : "border-transparent bg-ink-50/40 text-ink-300",
                !isSel && today && "ring-1 ring-brand-300"
              )}
            >
              {/* Top row: date + dot */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[11px] font-semibold leading-none sm:text-xs",
                    !inMonth && !isSel && "text-ink-300"
                  )}
                >
                  {d.getDate()}
                </span>
                {inMonth && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSel
                        ? "bg-card/90"
                        : dot === "red"
                          ? "bg-red-500"
                          : dot === "yellow"
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                    )}
                    title={
                      info.closed
                        ? "Fechado"
                        : dot === "red"
                          ? "Sem vagas"
                          : dot === "yellow"
                            ? "Quase cheio"
                            : "Vagas disponíveis"
                    }
                  />
                )}
              </div>

              {/* Bottom: n|x */}
              {inMonth && !info.closed && (
                <span
                  className={cn(
                    "text-[9px] font-medium leading-none tabular-nums sm:text-[10px]",
                    isSel ? "text-white/90" : "text-ink-500"
                  )}
                >
                  {info.morningFree}
                  <span className={cn("mx-0.5", isSel ? "text-white/60" : "text-ink-300")}>|</span>
                  {info.afternoonFree}
                </span>
              )}
              {inMonth && info.closed && (
                <span
                  className={cn(
                    "block w-full truncate text-[8px] font-medium uppercase leading-none sm:text-[9px]",
                    isSel ? "text-white/80" : "text-red-500/70"
                  )}
                >
                  fechado
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> vagas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> quase cheio
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> cheio/fechado
        </span>
      </div>
    </div>
  );
}
