"use client";
import { Phone } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; name: string; phone: string | null };
  service: { id: string; name: string; durationMin: number };
};

const STATUS_STYLES: Record<Appointment["status"], { row: string; time: string; label?: string }> = {
  confirmed: { row: "border-l-brand-500", time: "text-ink-900" },
  pending: { row: "border-l-amber-500", time: "text-amber-700", label: "pendente" },
  done: { row: "border-l-ink-300 opacity-60", time: "text-ink-500", label: "concluída" },
  cancelled: { row: "border-l-ink-200 opacity-40 line-through", time: "text-ink-400" },
  no_show: { row: "border-l-red-500", time: "text-red-700", label: "não veio" },
};

export function ListView({
  appointments,
  date,
  onSelectAppointment,
}: {
  appointments: Appointment[];
  date: Date;
  onSelectAppointment: (a: Appointment) => void;
}) {
  const sorted = [...appointments]
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-ink-200 px-4 py-3 sm:px-6">
        <h2 className="text-base font-medium text-ink-900 sm:text-lg">
          {date.toLocaleDateString("pt-PT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h2>
        <p className="text-xs text-ink-500">
          {sorted.length} {sorted.length === 1 ? "marcação" : "marcações"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-ink-400">
          Sem marcações neste dia
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {sorted.map((a) => {
            const style = STATUS_STYLES[a.status];
            return (
              <li key={a.id}>
                <button
                  onClick={() => onSelectAppointment(a)}
                  className={cn(
                    "flex w-full items-center gap-3 border-l-4 px-3 py-2.5 text-left transition hover:bg-ink-50 sm:gap-4 sm:px-6 sm:py-3",
                    style.row
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 font-mono text-sm font-medium tabular-nums sm:text-base",
                      style.time
                    )}
                  >
                    {formatTime(a.startsAt)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-medium text-ink-900 sm:text-[15px]">
                        {a.client.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-ink-400">
                        #{a.client.id.slice(-6)}
                      </span>
                      {style.label && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            a.status === "pending" && "bg-amber-100 text-amber-700",
                            a.status === "no_show" && "bg-red-100 text-red-700",
                            a.status === "done" && "bg-ink-100 text-ink-500"
                          )}
                        >
                          {style.label}
                        </span>
                      )}
                    </span>
                    {a.client.phone && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                        <Phone size={11} className="opacity-60" />
                        {a.client.phone}
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm text-ink-700 sm:text-[15px]">
                      {a.service.name}
                    </span>
                    <span className="block text-[11px] text-ink-400">
                      {a.service.durationMin} min
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
