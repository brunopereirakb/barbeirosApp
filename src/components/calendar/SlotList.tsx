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
  UserX,
} from "lucide-react";
import Link from "next/link";
import { cn, formatTime, minutesToTimeString, timeStringToMinutes } from "@/lib/utils";
import { getDayHours } from "@/lib/schedule";
import { getServiceWindows, type ServiceWindow } from "@/lib/default-service";
import type { WindowConfig } from "@/lib/default-service";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; code: number | null; name: string; phone: string | null };
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
  defaultServiceWindowsByWeekday?: Record<string, WindowConfig[]> | string;
  workScheduleByWeekday?: Record<string, { closed?: boolean; start?: string; end?: string }>;
};

type SlotKind = "regular" | "lunch" | "before" | "after";

type SlotItem = {
  startMin: number;
  durMin: number;
  /**
   * Multiple appointments can start within the same slot window when the
   * barber explicitly overlaps bookings (e.g. squeezing a quick service
   * during lunch). All of them are rendered so nothing is hidden.
   */
  appts: Appointment[];
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
  windows: ServiceWindow[],
  appointments: Appointment[],
  hours: { start: string; end: string }
): SlotItem[] {
  if (windows.length === 0) return [];

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

  // Resolve which slotMin (and the next boundary, if any) applies at a given
  // minute. Before working hours uses the first window's slot size, after the
  // last window's, and inside-hours follows the configured per-window sizes.
  function slotAt(min: number): { slotMin: number; nextBoundary: number | null } {
    if (min < dayStart) {
      return { slotMin: windows[0].service.durationMin, nextBoundary: dayStart };
    }
    if (min >= dayEnd) {
      return { slotMin: windows[windows.length - 1].service.durationMin, nextBoundary: null };
    }
    const w = windows.find((w) => min >= w.startMin && min < w.endMin);
    if (w) return { slotMin: w.service.durationMin, nextBoundary: w.endMin };
    // Gap between windows — pick the next window's slotMin so the cursor
    // can advance past the gap cleanly.
    const upcoming = windows.find((w) => w.startMin > min);
    return { slotMin: upcoming?.service.durationMin ?? 15, nextBoundary: upcoming?.startMin ?? null };
  }

  const items: SlotItem[] = [];
  let cursor = earliest;

  while (cursor < latest) {
    const { slotMin, nextBoundary } = slotAt(cursor);
    // Truncate the slot to the next window boundary instead of skipping
    // past it — otherwise the leftover gap (e.g. 18:00–18:15 when a
    // 20-min default meets a 18:15+ 15-min override) would silently
    // disappear from the list.
    const effectiveSlotMin =
      nextBoundary !== null && cursor + slotMin > nextBoundary
        ? nextBoundary - cursor
        : slotMin;
    if (effectiveSlotMin <= 0) break;
    if (cursor + effectiveSlotMin > latest) break;

    const kind = classify(cursor, dayStart, dayEnd, lunchStart, lunchEnd);
    const slotEnd = cursor + effectiveSlotMin;
    const startingHere = active.filter((a) => {
      const m = apptMinutes(a).start;
      return m >= cursor && m < slotEnd;
    });

    items.push({ startMin: cursor, durMin: effectiveSlotMin, appts: startingHere, kind });

    if (startingHere.length > 0) {
      const maxEnd = Math.max(...startingHere.map((a) => apptMinutes(a).end));
      let next = cursor + effectiveSlotMin;
      while (next < maxEnd) {
        const step = slotAt(next).slotMin;
        if (step <= 0) break;
        next += step;
      }
      cursor = next;
    } else {
      cursor += effectiveSlotMin;
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
  onQuickAction,
}: {
  date: Date;
  appointments: Appointment[];
  settings: Settings;
  services: Service[];
  onCreateAt: (d: Date) => void;
  onSelectAppointment: (a: Appointment) => void;
  /**
   * Fast inline status changes (mark done / no-show) without opening the
   * detail modal. Optional; if not provided the action buttons are hidden.
   */
  onQuickAction?: (a: Appointment, status: "done" | "no_show" | "confirmed") => void;
}) {
  const [showBefore, setShowBefore] = useState(false);
  const [showAfter, setShowAfter] = useState(false);

  const hours = getDayHours(date, settings);
  const windows = useMemo(
    () => getServiceWindows(date.getDay(), hours, settings, services),
    [date, hours, settings, services]
  );
  const hasService = windows.length > 0;

  const items = useMemo(() => {
    if (!hours.open || !hasService) return [];
    return buildSlotItems(settings, windows, appointments, hours);
  }, [settings, windows, hasService, appointments, hours]);

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

  if (!hasService) {
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

  const beforeApptCount = beforeItems.filter((i) => i.appts.length > 0).length;
  const afterApptCount = afterItems.filter((i) => i.appts.length > 0).length;
  // Auto-expand if there's an appointment off-hours — never hide a booking
  const beforeExpanded = showBefore || beforeApptCount > 0;
  const afterExpanded = showAfter || afterApptCount > 0;

  // Count free/filled across regular slots only (lunch is special). A slot
  // with multiple overlapping bookings still counts as a single filled slot.
  const regularItems = items.filter((i) => i.kind === "regular");
  const free = regularItems.filter((i) => i.appts.length === 0).length;
  const filled = regularItems.filter((i) => i.appts.length > 0).length;

  function clickEmpty(startMin: number) {
    const d = new Date(date);
    d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    onCreateAt(d);
  }

  // Header label: when a single service covers the whole day, show its name
  // ("Horários · Corte"). Days split across multiple service windows just say
  // "Horários do dia" — the individual service for each slot is already shown
  // on the slot row itself, so listing every service in the header would just
  // be visual noise.
  const uniqueServiceNames = Array.from(new Set(windows.map((w) => w.service.name)));
  const uniqueSlotMins = Array.from(new Set(windows.map((w) => w.service.durationMin)));
  const headerTitle =
    uniqueServiceNames.length === 1
      ? `Horários · ${uniqueServiceNames[0]}`
      : "Horários do dia";
  const headerSlotLabel = uniqueSlotMins.join("/") + " min por slot";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-baseline justify-between border-b border-ink-200 px-4 py-2.5">
        <div>
          <h3 className="text-sm font-medium text-ink-900 sm:text-base">
            {headerTitle}
          </h3>
          <p className="text-[11px] text-ink-500">
            {headerSlotLabel} · {free} livres · {filled} ocupados
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
              onQuickAction={onQuickAction}
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
            onQuickAction={onQuickAction}
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
              onQuickAction={onQuickAction}
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
  onQuickAction,
}: {
  item: SlotItem;
  onCreateEmpty: () => void;
  onSelectAppt: (a: Appointment) => void;
  onQuickAction?: (a: Appointment, status: "done" | "no_show" | "confirmed") => void;
}) {
  const start = minutesToTimeString(item.startMin);

  if (item.appts.length > 0) {
    return (
      <li>
        {item.appts.map((a, idx) => (
          <ApptRow
            key={a.id}
            a={a}
            // Only the first overlapping booking in the slot prints the
            // time label; the rest get an indent + "↳" so the eye groups
            // them visually as concurrent.
            timeLabel={idx === 0 ? start : null}
            kind={item.kind}
            onSelect={() => onSelectAppt(a)}
            onQuickAction={onQuickAction}
            isOverlap={idx > 0}
          />
        ))}
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

function ApptRow({
  a,
  timeLabel,
  kind,
  onSelect,
  onQuickAction,
  isOverlap,
}: {
  a: Appointment;
  timeLabel: string | null;
  kind: SlotKind;
  onSelect: () => void;
  onQuickAction?: (a: Appointment, status: "done" | "no_show" | "confirmed") => void;
  isOverlap: boolean;
}) {
  const canQuickDone = a.status === "confirmed" || a.status === "pending";
  const canQuickNoShow = a.status === "confirmed" || a.status === "pending";
  const canConfirm = a.status === "pending";

  // Action button clicks must not bubble to the row-level onClick that opens
  // the detail modal — otherwise marking done would also open the modal.
  function actionStop<T extends React.MouseEvent>(fn: () => void) {
    return (e: T) => {
      e.stopPropagation();
      fn();
    };
  }

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 border-l-4 px-4 py-2 text-left transition hover:bg-ink-50",
        a.status === "confirmed" && "border-l-brand-500",
        a.status === "pending" && "border-l-amber-500",
        a.status === "done" && "border-l-ink-300 opacity-60",
        a.status === "no_show" && "border-l-red-500",
        kind === "lunch" && "bg-amber-50/40",
        (kind === "before" || kind === "after") && "bg-ink-50/30",
        // Indent overlap rows so they read as "concurrent with the above"
        isOverlap && "border-t border-dashed border-ink-100"
      )}
    >
      <span className="w-12 shrink-0 font-mono text-sm font-medium tabular-nums text-ink-900">
        {isOverlap ? <span className="text-ink-300">↳ {formatTime(a.startsAt)}</span> : timeLabel}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-medium text-ink-900">
            {a.client.name}
          </span>
          {a.client.code != null && (
            <span className="font-mono text-[11px] text-ink-500">
              #{a.client.code}
            </span>
          )}
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
          {isOverlap && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-purple-700">
              sobreposta
            </span>
          )}
          {kind === "lunch" && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
              almoço
            </span>
          )}
          {(kind === "before" || kind === "after") && (
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
      <span className="hidden shrink-0 text-right text-xs text-ink-600 sm:block">
        <span className="block">{a.service.name}</span>
        <span className="block text-[10px] text-ink-400">
          {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
        </span>
      </span>
      {onQuickAction && (canQuickDone || canQuickNoShow || canConfirm) && (
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {canConfirm && (
            <button
              type="button"
              title="Confirmar marcação"
              onClick={actionStop(() => onQuickAction(a, "confirmed"))}
              className="flex h-7 w-7 items-center justify-center rounded text-amber-600 hover:bg-amber-100"
            >
              <Check size={14} />
            </button>
          )}
          {canQuickDone && (
            <button
              type="button"
              title="Marcar concluída"
              onClick={actionStop(() => onQuickAction(a, "done"))}
              className="flex h-7 w-7 items-center justify-center rounded text-brand-600 hover:bg-brand-100"
            >
              <Check size={14} />
            </button>
          )}
          {canQuickNoShow && (
            <button
              type="button"
              title="Não veio"
              onClick={actionStop(() => onQuickAction(a, "no_show"))}
              className="flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-100"
            >
              <UserX size={14} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}
