"use client";
import { useEffect, useMemo, useState } from "react";
import { cn, isSameDay, isToday, timeStringToMinutes } from "@/lib/utils";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  service: { id: string; name: string; durationMin: number };
};

type Settings = {
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
};

const WEEKDAY_LABELS = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function getMonthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = first.getDay(); // 0 = Sunday
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-first grid
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

function apptStartMin(a: Appointment): number {
  const s = new Date(a.startsAt);
  return s.getHours() * 60 + s.getMinutes();
}

export function MonthView({
  date,
  onSelectDay,
}: {
  date: Date;
  onSelectDay: (d: Date) => void;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setDate(start.getDate() - 7); // include trailing days of previous month
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7); // include leading days of next month

    fetch(
      `/api/appointments/search?dateFrom=${start.toISOString()}&dateTo=${end.toISOString()}&limit=500`
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then(setAppointments);

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((s) => s && setSettings(s));
  }, [date]);

  const days = useMemo(() => getMonthGrid(date), [date]);

  const dayStartMin = settings ? timeStringToMinutes(settings.workdayStart) : 9 * 60;
  const dayEndMin = settings ? timeStringToMinutes(settings.workdayEnd) : 19 * 60;
  const lunchStartMin = settings ? timeStringToMinutes(settings.lunchStart) : 12 * 60 + 30;
  const lunchEndMin = settings ? timeStringToMinutes(settings.lunchEnd) : 14 * 60;

  const morningCapSlots = Math.max(0, Math.floor((lunchStartMin - dayStartMin) / 30));
  const afternoonCapSlots = Math.max(0, Math.floor((dayEndMin - lunchEndMin) / 30));

  function dayInfo(d: Date) {
    const isClosed = d.getDay() === 0; // Sunday closed by default
    const apptsToday = appointments.filter(
      (a) => a.status !== "cancelled" && isSameDay(new Date(a.startsAt), d)
    );

    let morningUsed = 0;
    let afternoonUsed = 0;
    for (const a of apptsToday) {
      const m = apptStartMin(a);
      const slots = Math.max(1, Math.ceil(a.service.durationMin / 30));
      if (m < lunchStartMin) morningUsed += slots;
      else if (m >= lunchEndMin) afternoonUsed += slots;
    }

    const morningFree = isClosed ? 0 : Math.max(0, morningCapSlots - morningUsed);
    const afternoonFree = isClosed ? 0 : Math.max(0, afternoonCapSlots - afternoonUsed);
    const fullyBooked = !isClosed && morningFree === 0 && afternoonFree === 0;

    return {
      isClosed,
      morningFree,
      afternoonFree,
      hasBookings: apptsToday.length > 0,
      fullyBooked,
    };
  }

  function shiftMonth(delta: number) {
    const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
    onSelectDay(next);
  }

  const monthLabel = `${MONTH_LABELS[date.getMonth()]} de ${date.getFullYear()}`;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Month nav */}
      <div className="flex shrink-0 items-center justify-between border-b border-ink-200 px-4 py-3">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <h2 className="text-base font-medium text-ink-900 sm:text-lg">{monthLabel}</h2>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid shrink-0 grid-cols-7 border-b border-ink-200 bg-ink-50">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-ink-500"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 divide-x divide-y divide-ink-100 overflow-hidden">
        {days.map((d) => {
          const info = dayInfo(d);
          const inMonth = d.getMonth() === date.getMonth();
          const today = isToday(d);

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "relative flex flex-col items-center justify-start gap-1 p-1.5 text-left transition hover:bg-brand-50/40 sm:p-2",
                !inMonth && "bg-ink-50/40 text-ink-300"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center text-sm font-medium sm:text-base",
                    today && "rounded-full bg-ink-200 text-ink-900",
                    inMonth && !today && "text-ink-800",
                    !inMonth && "text-ink-300"
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex items-center gap-1">
                  {info.isClosed && (
                    <span
                      className="h-2 w-2 rounded-full bg-red-500"
                      title="Encerrado"
                    />
                  )}
                  {!info.isClosed && info.fullyBooked && (
                    <span
                      className="h-2 w-2 rounded-full bg-red-500"
                      title="Sem vagas"
                    />
                  )}
                  {!info.isClosed && !info.fullyBooked && info.hasBookings && (
                    <span
                      className="h-2 w-2 rounded-full bg-amber-400"
                      title="Algumas vagas"
                    />
                  )}
                </span>
              </div>

              {inMonth && !info.isClosed && (
                <span className="mt-auto self-start text-[11px] font-medium text-ink-500 sm:text-xs">
                  {info.morningFree} <span className="text-ink-300">|</span> {info.afternoonFree}
                </span>
              )}
              {inMonth && info.isClosed && (
                <span className="mt-auto self-start text-[11px] font-medium text-red-500/80 sm:text-xs">
                  encerrado
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
