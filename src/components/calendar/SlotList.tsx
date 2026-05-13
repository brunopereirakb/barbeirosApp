"use client";
import { useMemo, useState } from "react";
import {
  Plus,
  Coffee,
  Phone,
  Check,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { cn, formatTime, minutesToTimeString, timeStringToMinutes } from "@/lib/utils";
import { getDayHours } from "@/lib/schedule";

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
  workScheduleByWeekday?: Record<string, { closed?: boolean; start?: string; end?: string }>;
};

type SlotKind = "regular" | "lunch" | "before" | "after";

type SlotItem = {
  startMin: number;
  durMin: number;
  appt: Appointment | null;
  kind: SlotKind;
};

const DEFAULT_EARLIEST_MIN = 6 * 60; // 06:00
const DEFAULT_LATEST_MIN = 23 * 60; // 23:00

function apptMinutes(a: Appointment) {
  const s = new Date(a.startsAt);
  const e = new Date(a.endsAt);
  return {
    start: s.getHours() * 60 + s.getMinutes(),
    end: e.getHours() * 60 + e.getMinutes(),
  };
}

function classify(
  startMin: number,
  dayStart: number,
  dayEnd: number,
  lunchStart: number,
  lunchEnd: number
): SlotKind {
  if (startMin < dayStart) return "before";
  if (startMin >= dayEnd) return "after";
  if (startMin >= lunchStart && startMin < lunchEnd) return "lunch";
  return "regular";
}

function buildSlotItems(
  settings: Settings,
  slotMin: number,
  appointments: Appointment[],
  hours: { start: string; end: string }
): SlotItem[] {
  const dayStart = timeStringToMinutes(hours.start);
  const dayEnd = timeStringToMinutes(hours.end);
  const lunchStart = timeStringToMinutes(settings.lunchStart);
  const lunchEnd = timeStringToMinutes(settings.lunchEnd);

  const active = appointments.filter((a) => a.status !== "cancelled");

  // Extend the visible window so off-hours appointments still appear when expanded
  let earliest = DEFAULT_EARLIEST_MIN;
  let latest = DEFAULT_LATEST_MIN;
  for (const a of active) {
    const { start, end } = apptMinutes(a);
    if (start < earliest) earliest = Math.floor(start / 60) * 60;
    if (end > latest) latest = Math.ceil(end / 60) * 60;
  }

  const items: SlotItem[] = [];
  let cursor = earliest;

  while (cursor + slotMin <= latest) {
    const kind = classify(cursor, dayStart, dayEnd, lunchStart, lunchEnd);

    const appt = active.find((a) => {
      const m = apptMinutes(a).start;
      return m >= cursor && m < cursor + slotMin;
    });

    items.push({ startMin: cursor, durMin: slotMin, appt: appt ?? null, kind });

    if (appt) {
      const { end } = apptMinutes(appt);
      let next = cursor + slotMin;
      while (next < end) next += slotMin;
      cursor = next;
    } else {
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
  const [showBefore, setShowBefore] = useState(false);
  const [showAfter, setShowAfter] = useState(false);

  const weekday = String(date.getDay());
  const hours = getDayHours(date, settings);
  const defaultServiceId = settings.defaultServiceByWeekday?.[weekday];
  const defaultService = defaultServiceId
    ? services.find((s) => s.id === defaultServiceId)
    : undefined;

  const items = useMemo(() => {
    if (!hours.open || !defaultService) return [];
    return buildSlotItems(settings, defaultService.durationMin, appointments, hours);
  }, [settings, defaultService, appointments, hours]);

  // Closed day per work schedule
  if (!hours.open) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          ✕
        </div>
        <div>
          <p className="text-sm font-medium text-ink-800">Encerrado neste dia</p>
          <p className="mt-1 text-xs text-ink-500">
            Este dia da semana está marcado como fechado nas Definições.
          </p>
        </div>
        <Link
          href="/definicoes"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
        >
          Alterar horário de trabalho
        </Link>
      </div>
    );
  }

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

  const beforeItems = items.filter((i) => i.kind === "before");
  const middleItems = items.filter((i) => i.kind === "regular" || i.kind === "lunch");
  const afterItems = items.filter((i) => i.kind === "after");

  const beforeApptCount = beforeItems.filter((i) => i.appt).length;
  const afterApptCount = afterItems.filter((i) => i.appt).length;
  // Auto-expand if there's an appointment off-hours — never hide a booking
  const beforeExpanded = showBefore || beforeApptCount > 0;
  const afterExpanded = showAfter || afterApptCount > 0;

  // Count free/filled across regular slots only (lunch is special)
  const regularItems = items.filter((i) => i.kind === "regular");
  const free = regularItems.filter((i) => !i.appt).length;
  const filled = regularItems.filter((i) => i.appt).length;

  function clickEmpty(startMin: number) {
    const d = new Date(date);
    d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    onCreateAt(d);
  }

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
        {/* Before-hours: toggle row or expanded slots */}
        {beforeItems.length > 0 && !beforeExpanded && (
          <li>
            <button
              onClick={() => setShowBefore(true)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs text-ink-500 transition hover:bg-ink-50"
            >
              <ChevronDown size={14} className="text-ink-400" />
              Mostrar {beforeItems.length} horários antes das {hours.start}
            </button>
          </li>
        )}
        {beforeExpanded &&
          beforeItems.map((item, idx) => (
            <SlotRow
              key={`b-${idx}`}
              item={item}
              onCreateEmpty={() => clickEmpty(item.startMin)}
              onSelectAppt={onSelectAppointment}
            />
          ))}
        {beforeExpanded && beforeItems.length > 0 && beforeApptCount === 0 && (
          <li>
            <button
              onClick={() => setShowBefore(false)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs text-ink-500 transition hover:bg-ink-50"
            >
              <ChevronUp size={14} className="text-ink-400" />
              Ocultar antes das {hours.start}
            </button>
          </li>
        )}

        {/* Regular workday + lunch slots, always visible */}
        {middleItems.map((item, idx) => (
          <SlotRow
            key={`m-${idx}`}
            item={item}
            onCreateEmpty={() => clickEmpty(item.startMin)}
            onSelectAppt={onSelectAppointment}
          />
        ))}

        {/* After-hours */}
        {afterExpanded &&
          afterItems.map((item, idx) => (
            <SlotRow
              key={`a-${idx}`}
              item={item}
              onCreateEmpty={() => clickEmpty(item.startMin)}
              onSelectAppt={onSelectAppointment}
            />
          ))}
        {afterItems.length > 0 && !afterExpanded && (
          <li>
            <button
              onClick={() => setShowAfter(true)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs text-ink-500 transition hover:bg-ink-50"
            >
              <ChevronDown size={14} className="text-ink-400" />
              Mostrar {afterItems.length} horários depois das {hours.end}
            </button>
          </li>
        )}
        {afterExpanded && afterItems.length > 0 && afterApptCount === 0 && (
          <li>
            <button
              onClick={() => setShowAfter(false)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs text-ink-500 transition hover:bg-ink-50"
            >
              <ChevronUp size={14} className="text-ink-400" />
              Ocultar depois das {hours.end}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function SlotRow({
  item,
  onCreateEmpty,
  onSelectAppt,
}: {
  item: SlotItem;
  onCreateEmpty: () => void;
  onSelectAppt: (a: Appointment) => void;
}) {
  const start = minutesToTimeString(item.startMin);

  if (item.appt) {
    const a = item.appt;
    return (
      <li>
        <button
          onClick={() => onSelectAppt(a)}
          className={cn(
            "flex w-full items-center gap-3 border-l-4 px-4 py-2 text-left transition hover:bg-ink-50",
            a.status === "confirmed" && "border-l-brand-500",
            a.status === "pending" && "border-l-amber-500",
            a.status === "done" && "border-l-ink-300 opacity-60",
            a.status === "no_show" && "border-l-red-500",
            // Tint background slightly for lunch/before/after bookings to keep context
            item.kind === "lunch" && "bg-amber-50/40",
            (item.kind === "before" || item.kind === "after") && "bg-ink-50/30"
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
              {item.kind === "lunch" && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                  almoço
                </span>
              )}
              {item.kind === "before" && (
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-600">
                  fora de horário
                </span>
              )}
              {item.kind === "after" && (
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-600">
                  fora de horário
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

  // Empty slot — style + label depend on kind
  return (
    <li>
      <button
        onClick={onCreateEmpty}
        className={cn(
          "group flex w-full items-center gap-3 border-l-4 px-4 py-2 text-left transition",
          item.kind === "regular" &&
            "border-l-transparent hover:border-l-brand-300 hover:bg-brand-50/40",
          item.kind === "lunch" &&
            "border-l-transparent bg-amber-50/70 hover:bg-amber-100/70",
          (item.kind === "before" || item.kind === "after") &&
            "border-l-transparent bg-ink-50/40 hover:bg-ink-100/60"
        )}
      >
        <span
          className={cn(
            "w-12 shrink-0 font-mono text-sm tabular-nums",
            item.kind === "lunch" ? "text-amber-700" : "text-ink-400 group-hover:text-ink-700"
          )}
        >
          {start}
        </span>
        <span className="flex-1 text-xs">
          {item.kind === "regular" && (
            <span className="text-ink-400 group-hover:text-ink-600">livre</span>
          )}
          {item.kind === "lunch" && (
            <span className="flex items-center gap-1 text-amber-800">
              <Coffee size={11} /> Almoço · marcar mesmo assim
            </span>
          )}
          {item.kind === "before" && (
            <span className="text-ink-500">Antes do horário</span>
          )}
          {item.kind === "after" && (
            <span className="text-ink-500">Depois do horário</span>
          )}
        </span>
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded transition",
            item.kind === "regular" &&
              "text-ink-300 group-hover:bg-brand-100 group-hover:text-brand-700",
            item.kind === "lunch" &&
              "text-amber-500 group-hover:bg-amber-200/80 group-hover:text-amber-800",
            (item.kind === "before" || item.kind === "after") &&
              "text-ink-300 group-hover:bg-ink-200 group-hover:text-ink-700"
          )}
        >
          <Plus size={14} />
        </span>
      </button>
    </li>
  );
}
