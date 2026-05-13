"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isSameDay, isToday, timeStringToMinutes } from "@/lib/utils";
import { getDayHours } from "@/lib/schedule";

type MiniAppt = {
  startsAt: string;
  status: string;
  service?: { durationMin: number };
};

type Service = { id: string; name: string; durationMin: number };

type Settings = {
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  defaultServiceByWeekday?: Record<string, string>;
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

  const sid = settings.defaultServiceByWeekday?.[String(d.getDay())];
  const svc = sid ? services.find((s) => s.id === sid) : undefined;
  if (!svc) return { closed: true };

  const slotMin = svc.durationMin;
  const dayStart = timeStringToMinutes(hours.start);
  const dayEnd = timeStringToMinutes(hours.end);
  const lunchStart = timeStringToMinutes(settings.lunchStart);
  const lunchEnd = timeStringToMinutes(settings.lunchEnd);

  const morningTotal = Math.max(0, Math.floor((lunchStart - dayStart) / slotMin));
  const afternoonTotal = Math.max(0, Math.floor((dayEnd - lunchEnd) / slotMin));

  let morningUsed = 0;
  let afternoonUsed = 0;

  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const start = new Date(a.startsAt);
    if (!isSameDay(start, d)) continue;
    const startMin = start.getHours() * 60 + start.getMinutes();
    const dur = a.service?.durationMin ?? slotMin;
    const slots = Math.max(1, Math.ceil(dur / slotMin));
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
}: {
  selected: Date;
  onSelectDay: (d: Date) => void;
  settings: Settings | null;
  services: Service[];
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
  }, [viewMonth]);

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
