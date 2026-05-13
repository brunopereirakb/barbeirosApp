"use client";
import { Plus, Coffee, Phone, Check, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { cn, formatTime, minutesToTimeString, timeStringToMinutes } from "@/lib/utils";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; name: string; phone: string | null };
  service: { id: string; name: string; durationMin: number };
};

type Service = {
  id: string;
  name: string;
  durationMin: number;
};

type Settings = {
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  defaultServiceByWeekday?: Record<string, string>;
};

type SlotItem =
  | { type: "lunch"; startMin: number; endMin: number }
  | { type: "slot"; startMin: number; durMin: number; appt: Appointment | null };

function apptMinutes(a: Appointment) {
  const s = new Date(a.startsAt);
  const e = new Date(a.endsAt);
  return {
    start: s.getHours() * 60 + s.getMinutes(),
    end: e.getHours() * 60 + e.getMinutes(),
  };
}

function buildSlotItems(
  settings: Settings,
  slotMin: number,
  appointments: Appointment[]
): SlotItem[] {
  const dayStart = timeStringToMinutes(settings.workdayStart);
  const dayEnd = timeStringToMinutes(settings.workdayEnd);
  const lunchStart = timeStringToMinutes(settings.lunchStart);
  const lunchEnd = timeStringToMinutes(settings.lunchEnd);

  const active = appointments.filter((a) => a.status !== "cancelled");

  const items: SlotItem[] = [];
  let cursor = dayStart;
  let lunchEmitted = false;

  while (cursor + slotMin <= dayEnd) {
    // Insert lunch break once we reach it
    if (!lunchEmitted && cursor >= lunchStart && cursor < lunchEnd) {
      items.push({ type: "lunch", startMin: lunchStart, endMin: lunchEnd });
      cursor = lunchEnd;
      lunchEmitted = true;
      continue;
    }
    if (!lunchEmitted && cursor < lunchStart && cursor + slotMin > lunchStart) {
      // Slot would cross into lunch — push a short residual slot label, then lunch
      items.push({ type: "lunch", startMin: lunchStart, endMin: lunchEnd });
      cursor = lunchEnd;
      lunchEmitted = true;
      continue;
    }

    // Find appt starting inside this slot's [cursor, cursor + slotMin)
    const appt = active.find((a) => {
      const m = apptMinutes(a).start;
      return m >= cursor && m < cursor + slotMin;
    });

    if (appt) {
      items.push({ type: "slot", startMin: cursor, durMin: slotMin, appt });
      // Advance to next slot boundary at or after appt end (keeps the grid aligned)
      const { end } = apptMinutes(appt);
      let next = cursor + slotMin;
      while (next < end) next += slotMin;
      cursor = next;
    } else {
      items.push({ type: "slot", startMin: cursor, durMin: slotMin, appt: null });
      cursor += slotMin;
    }
  }

  return items;
}

export function SlotList({
  date,
  appointments,
  settings,
  services,
  onCreateAt,
  onSelectAppointment,
}: {
  date: Date;
  appointments: Appointment[];
  settings: Settings;
  services: Service[];
  onCreateAt: (d: Date) => void;
  onSelectAppointment: (a: Appointment) => void;
}) {
  const weekday = String(date.getDay()); // 0=Sun .. 6=Sat
  const defaultServiceId = settings.defaultServiceByWeekday?.[weekday];
  const defaultService = defaultServiceId
    ? services.find((s) => s.id === defaultServiceId)
    : undefined;

  // If no default service set for this weekday, prompt the user to configure it.
  if (!defaultService) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <SettingsIcon size={28} className="text-ink-300" />
        <div>
          <p className="text-sm font-medium text-ink-800">
            Sem serviço padrão definido para este dia da semana
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Define qual é o serviço habitual de cada dia em Definições para gerar
            automaticamente os horários disponíveis.
          </p>
        </div>
        <Link
          href="/definicoes"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          Definir serviços padrão
        </Link>
      </div>
    );
  }

  const items = buildSlotItems(settings, defaultService.durationMin, appointments);
  const slotsOnly = items.filter((i) => i.type === "slot") as Extract<SlotItem, { type: "slot" }>[];
  const free = slotsOnly.filter((s) => !s.appt).length;
  const filled = slotsOnly.filter((s) => s.appt).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-baseline justify-between border-b border-ink-200 px-4 py-2.5">
        <div>
          <h3 className="text-sm font-medium text-ink-900 sm:text-base">
            Horários · {defaultService.name}
          </h3>
          <p className="text-[11px] text-ink-500">
            {defaultService.durationMin} min por slot · {free} livres · {filled} ocupados
          </p>
        </div>
      </div>

      {/* Scrollable slot list */}
      <ul className="flex-1 divide-y divide-ink-100 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.type === "lunch") {
            return (
              <li
                key={`lunch-${idx}`}
                className="flex items-center gap-3 bg-amber-50/70 px-4 py-2 text-xs font-medium text-amber-800"
              >
                <span className="font-mono tabular-nums text-amber-700">
                  {minutesToTimeString(item.startMin)}
                </span>
                <Coffee size={13} />
                <span>Almoço · até {minutesToTimeString(item.endMin)}</span>
              </li>
            );
          }

          const start = minutesToTimeString(item.startMin);
          if (item.appt) {
            const a = item.appt;
            return (
              <li key={`slot-${idx}`}>
                <button
                  onClick={() => onSelectAppointment(a)}
                  className={cn(
                    "flex w-full items-center gap-3 border-l-4 px-4 py-2 text-left transition hover:bg-ink-50",
                    a.status === "confirmed" && "border-l-brand-500",
                    a.status === "pending" && "border-l-amber-500",
                    a.status === "done" && "border-l-ink-300 opacity-60",
                    a.status === "no_show" && "border-l-red-500"
                  )}
                >
                  <span className="w-12 shrink-0 font-mono text-sm font-medium tabular-nums text-ink-900">
                    {start}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-sm font-medium text-ink-900">
                        {a.client.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-ink-400">
                        #{a.client.id.slice(-6)}
                      </span>
                      {a.status === "pending" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                          pendente
                        </span>
                      )}
                      {a.status === "done" && (
                        <span className="flex items-center gap-0.5 text-[10px] text-ink-500">
                          <Check size={10} /> concluída
                        </span>
                      )}
                      {a.status === "no_show" && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-700">
                          não veio
                        </span>
                      )}
                    </span>
                    {a.client.phone && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                        <Phone size={10} className="opacity-60" />
                        {a.client.phone}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-600">
                    <span className="block">{a.service.name}</span>
                    <span className="block text-[10px] text-ink-400">
                      {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li key={`slot-${idx}`}>
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setHours(Math.floor(item.startMin / 60), item.startMin % 60, 0, 0);
                  onCreateAt(d);
                }}
                className="group flex w-full items-center gap-3 border-l-4 border-l-transparent px-4 py-2 text-left transition hover:border-l-brand-300 hover:bg-brand-50/40"
              >
                <span className="w-12 shrink-0 font-mono text-sm tabular-nums text-ink-400 group-hover:text-ink-700">
                  {start}
                </span>
                <span className="flex-1 text-xs text-ink-400 group-hover:text-ink-600">
                  livre
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-300 group-hover:bg-brand-100 group-hover:text-brand-700">
                  <Plus size={14} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
