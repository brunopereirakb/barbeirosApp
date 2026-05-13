"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isSameDay, isToday } from "@/lib/utils";

type MiniAppt = { startsAt: string; status: string };

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

export function MiniMonth({
  selected,
  onSelectDay,
}: {
  selected: Date;
  onSelectDay: (d: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(
    new Date(selected.getFullYear(), selected.getMonth(), 1)
  );
  const [appointments, setAppointments] = useState<MiniAppt[]>([]);

  // Keep viewMonth in sync if parent moves the selected day to a different month
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
  const apptsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      const d = new Date(a.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [appointments]);

  function shiftMonth(delta: number) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-ink-800">
          {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
          aria-label="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="py-1 text-center text-[10px] font-medium uppercase text-ink-400"
          >
            {w}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const isSel = isSameDay(d, selected);
          const today = isToday(d);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const count = apptsByDay.get(key) || 0;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "relative flex h-7 w-7 items-center justify-center rounded text-xs transition",
                !inMonth && "text-ink-300",
                inMonth && !isSel && "text-ink-800 hover:bg-ink-100",
                isSel && "bg-brand-500 text-white",
                !isSel && today && "ring-1 ring-brand-300"
              )}
            >
              {d.getDate()}
              {!isSel && count > 0 && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
