"use client";
import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Loader2, CalendarClock, Check, X, AlertTriangle, Ban, Clock } from "lucide-react";
import { getDayHours } from "@/lib/schedule";
import { timeStringToMinutes, isSameDay } from "@/lib/utils";

type Client = { id: string; name: string };
type Service = { id: string; name: string; durationMin: number; category: string | null };

type ExistingAppt = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  client: { name: string };
  service: { name: string };
};

type ScheduleSettings = {
  workdayStart: string;
  workdayEnd: string;
  workScheduleByWeekday?: Record<string, { closed?: boolean; start?: string; end?: string }>;
};

type OccurrenceStatus =
  | { kind: "available" }
  | { kind: "closed" }
  | { kind: "booked"; with: { clientName: string; serviceName: string; startsAt: string } };

const FREQ_OPTIONS = [
  { value: "7", label: "Semanal (a cada 7 dias)" },
  { value: "14", label: "Quinzenal (a cada 14 dias)" },
  { value: "21", label: "A cada 3 semanas" },
  { value: "28", label: "A cada 4 semanas" },
  { value: "30", label: "Mensal (aproximado)" },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

type Range = { start: Date; end: Date };

function findAvailableSlots(
  date: Date,
  blockedRanges: Range[],
  settings: ScheduleSettings,
  slotMin: number
): Date[] {
  const hours = getDayHours(date, settings);
  if (!hours.open) return [];

  const dayStartMin = timeStringToMinutes(hours.start);
  const dayEndMin = timeStringToMinutes(hours.end);

  const slots: Date[] = [];
  for (let m = dayStartMin; m + slotMin <= dayEndMin; m += slotMin) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(m / 60), m % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + slotMin * 60_000);

    const overlap = blockedRanges.find((r) => slotStart < r.end && slotEnd > r.start);
    if (!overlap) slots.push(slotStart);
  }
  return slots;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: Date;
}

export function RecurringAppointmentModal({ onClose, onCreated, defaultDate }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState(() =>
    (defaultDate ?? new Date()).toISOString().slice(0, 10)
  );
  const [time, setTime] = useState("10:00");
  const [freqDays, setFreqDays] = useState("7");
  const [endDate, setEndDate] = useState(() => {
    const d = defaultDate ?? new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Map<number, Date>>(new Map());
  const [pickerOpenIndex, setPickerOpenIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [existingAppts, setExistingAppts] = useState<ExistingAppt[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([c, s, set]) => {
      setClients(c);
      setServices(s);
      setSettings(set);
    });
  }, []);

  // Generate all occurrence dates (the base pattern, before any per-row overrides)
  const occurrences = useMemo(() => {
    if (!startDate || !endDate || !freqDays) return [];
    const [h, m] = time.split(":").map(Number);
    const start = new Date(startDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const step = parseInt(freqDays, 10);
    const dates: Date[] = [];
    let cur = new Date(start);
    while (cur <= end && dates.length < 100) {
      dates.push(new Date(cur));
      cur = addDays(cur, step);
    }
    return dates;
  }, [startDate, endDate, time, freqDays]);

  // Reset per-row overrides whenever the base pattern changes — indices would no longer line up.
  useEffect(() => {
    setOverrides(new Map());
    setPickerOpenIndex(null);
  }, [startDate, endDate, time, freqDays]);

  // Effective list: per-row override wins over the base pattern.
  const effectiveOccurrences = useMemo(
    () => occurrences.map((d, i) => overrides.get(i) ?? d),
    [occurrences, overrides]
  );

  const selectedService = services.find((s) => s.id === serviceId);

  // Fetch existing appointments in the planned date range. We key off the base pattern
  // dates so we don't re-fetch every time the user retimes a single row.
  useEffect(() => {
    if (occurrences.length === 0) {
      setExistingAppts([]);
      return;
    }
    const minDate = occurrences[0];
    const maxDate = occurrences[occurrences.length - 1];
    const fetchEnd = new Date(maxDate);
    fetchEnd.setDate(fetchEnd.getDate() + 1);

    fetch(
      `/api/appointments/search?dateFrom=${minDate.toISOString()}&dateTo=${fetchEnd.toISOString()}&limit=500`
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then(setExistingAppts);
  }, [occurrences]);

  // Per-occurrence availability (uses effective occurrences so overrides take effect)
  const statuses = useMemo<OccurrenceStatus[]>(() => {
    if (!selectedService) {
      return effectiveOccurrences.map(() => ({ kind: "available" as const }));
    }
    return effectiveOccurrences.map((occ) => {
      const occEnd = new Date(occ.getTime() + selectedService.durationMin * 60_000);

      // Closed by work schedule
      if (settings) {
        const hours = getDayHours(occ, settings);
        if (!hours.open) return { kind: "closed" as const };
      }

      // Overlap with existing booking
      const overlap = existingAppts.find((e) => {
        if (e.status === "cancelled") return false;
        const eStart = new Date(e.startsAt);
        const eEnd = new Date(e.endsAt);
        return occ < eEnd && occEnd > eStart;
      });
      if (overlap) {
        return {
          kind: "booked" as const,
          with: {
            clientName: overlap.client.name,
            serviceName: overlap.service.name,
            startsAt: overlap.startsAt,
          },
        };
      }

      return { kind: "available" as const };
    });
  }, [effectiveOccurrences, existingAppts, settings, selectedService]);

  // Auto-deselect any occurrence the user can't pick (closed / booked).
  // We only ever ADD to deselected here — never undo user choices on available rows.
  useEffect(() => {
    setDeselected((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (let i = 0; i < statuses.length; i++) {
        if (statuses[i].kind !== "available" && !next.has(i)) {
          next.add(i);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [statuses]);

  const conflictCount = statuses.filter((s) => s.kind !== "available").length;
  const availableCount = statuses.length - conflictCount;
  const selectedCount = statuses.filter((s, i) => s.kind === "available" && !deselected.has(i)).length;

  // Slot options shown when the per-row "Mudar horário" picker is open.
  // Blocks against existing server-side appts AND other selected occurrences in this batch.
  const pickerSlots = useMemo<Date[]>(() => {
    if (pickerOpenIndex === null || !selectedService || !settings) return [];
    const day = effectiveOccurrences[pickerOpenIndex];
    if (!day) return [];

    const dur = selectedService.durationMin;
    const blocked: Range[] = [];

    // Existing server-side appointments on this day
    for (const e of existingAppts) {
      if (e.status === "cancelled") continue;
      const s = new Date(e.startsAt);
      if (!isSameDay(s, day)) continue;
      blocked.push({ start: s, end: new Date(e.endsAt) });
    }

    // Other in-batch occurrences on this day (skip the one we're retiming)
    for (let i = 0; i < effectiveOccurrences.length; i++) {
      if (i === pickerOpenIndex) continue;
      if (deselected.has(i)) continue;
      if (statuses[i] && statuses[i].kind !== "available") continue;
      const occ = effectiveOccurrences[i];
      if (!isSameDay(occ, day)) continue;
      blocked.push({ start: occ, end: new Date(occ.getTime() + dur * 60_000) });
    }

    return findAvailableSlots(day, blocked, settings, dur);
  }, [pickerOpenIndex, effectiveOccurrences, deselected, statuses, existingAppts, settings, selectedService]);

  function applyOverride(index: number, newDate: Date) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(index, newDate);
      return next;
    });
    setDeselected((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setPickerOpenIndex(null);
  }

  function clearOverride(index: number) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }

  function toggleDate(i: number) {
    if (statuses[i] && statuses[i].kind !== "available") return; // can't pick conflicts
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAllAvailable() {
    setDeselected((prev) => {
      const next = new Set(prev);
      for (let i = 0; i < statuses.length; i++) {
        if (statuses[i].kind === "available") next.delete(i);
      }
      return next;
    });
  }

  function clearAll() {
    // Keep the auto-deselected conflicts; just deselect everything else too.
    setDeselected(new Set(occurrences.map((_, i) => i)));
  }

  async function handleCreate() {
    if (!clientId || !serviceId || selectedCount === 0) return;
    setError("");
    setSaving(true);
    const appointments = effectiveOccurrences
      .filter((_, i) => statuses[i].kind === "available" && !deselected.has(i))
      .map((d) => ({ clientId, serviceId, startsAt: d.toISOString() }));

    const res = await fetch("/api/appointments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointments, skipConflicts: true }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // The server may also have detected last-second conflicts (someone booked while we were filling
      // out the form). Surface that to the user instead of silently swallowing it.
      if (data.skipped > 0) {
        setError(
          `${data.created} marcações criadas. ${data.skipped} ignoradas por conflito (outra reserva entretanto).`
        );
        // Give the user a moment to read before closing
        setTimeout(onCreated, 1500);
      } else {
        onCreated();
      }
    } else {
      setError(data.error || "Erro ao criar marcações");
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const selectedClient = clients.find((c) => c.id === clientId);

  const inputCls =
    "w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <Modal open onClose={onClose} title="Marcação recorrente" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Client */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Cliente</label>
            {selectedClient ? (
              <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
                <span className="flex-1 text-sm font-medium text-brand-800">
                  {selectedClient.name}
                </span>
                <button
                  onClick={() => {
                    setClientId("");
                    setClientSearch("");
                  }}
                  className="text-brand-400 hover:text-brand-700"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Pesquisar cliente…"
                  className={inputCls}
                />
                {clientSearch && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-ink-200 bg-card shadow-sm">
                    {filteredClients.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClientId(c.id);
                          setClientSearch("");
                        }}
                        className="flex w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-brand-50"
                      >
                        {c.name}
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="px-3 py-2 text-xs text-ink-400">Nenhum cliente encontrado</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Serviço</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={inputCls}
            >
              <option value="">— escolher serviço —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedService && (
              <p className="text-xs text-ink-400">{selectedService.durationMin} min</p>
            )}
          </div>

          {/* Start date + time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Data de início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Hora</label>
            <input
              type="time"
              step="300"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Frequência</label>
            <select
              value={freqDays}
              onChange={(e) => setFreqDays(e.target.value)}
              className={inputCls}
            >
              {FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* End date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Repetir até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Preview */}
        {occurrences.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-600">
                <CalendarClock size={13} className="mr-1 inline" />
                {selectedCount} de {availableCount} disponíveis selecionadas
                {conflictCount > 0 && (
                  <span className="ml-1 text-amber-700">· {conflictCount} com conflito</span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAllAvailable}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Selecionar disponíveis
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs text-ink-500 hover:underline"
                >
                  Limpar todas
                </button>
              </div>
            </div>

            {/* Legend if any conflict exists */}
            {conflictCount > 0 && !selectedService && (
              <p className="text-[11px] text-ink-500">
                Escolhe um serviço para validar disponibilidade.
              </p>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50">
              {occurrences.map((_base, i) => {
                const effective = effectiveOccurrences[i];
                const status = statuses[i] ?? { kind: "available" as const };
                const isAvailable = status.kind === "available";
                const selected = isAvailable && !deselected.has(i);
                const isOverridden = overrides.has(i);
                const pickerOpen = pickerOpenIndex === i;
                // The "Mudar horário" affordance is only useful when (a) it's a booked
                // conflict that we can shift, and (b) a service is chosen so we know
                // which durations to fit. Closed days can't be retimed in place.
                const canPick = selectedService !== undefined && status.kind === "booked";

                return (
                  <div key={i} className="border-b border-ink-100 last:border-0">
                    <div
                      onClick={() => toggleDate(i)}
                      role="button"
                      tabIndex={isAvailable ? 0 : -1}
                      onKeyDown={(e) => {
                        if (!isAvailable) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDate(i);
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2 text-sm transition ${
                        status.kind === "booked" && !isOverridden
                          ? "cursor-default bg-red-50/60"
                          : status.kind === "closed"
                            ? "cursor-default bg-ink-100/70"
                            : selected
                              ? "cursor-pointer bg-card hover:bg-brand-50/40"
                              : "cursor-pointer bg-card/60 hover:bg-ink-100"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          status.kind === "booked" && !isOverridden
                            ? "bg-red-200 text-red-700"
                            : status.kind === "closed"
                              ? "bg-ink-300 text-white"
                              : selected
                                ? "bg-brand-500 text-white"
                                : "border border-ink-300"
                        }`}
                      >
                        {status.kind === "booked" && !isOverridden ? (
                          <AlertTriangle size={10} />
                        ) : status.kind === "closed" ? (
                          <Ban size={10} />
                        ) : selected ? (
                          <Check size={10} />
                        ) : null}
                      </div>

                      <span
                        className={
                          status.kind === "booked"
                            ? "text-red-800"
                            : status.kind === "closed"
                              ? "text-ink-500 line-through"
                              : selected
                                ? "text-ink-800"
                                : "text-ink-400 line-through"
                        }
                      >
                        {fmtDate(effective)}
                      </span>

                      <span
                        className={
                          isOverridden
                            ? "font-medium text-brand-700"
                            : status.kind === "available"
                              ? "text-ink-400"
                              : "text-ink-500"
                        }
                      >
                        {fmtTime(effective)}
                        {isOverridden && (
                          <span className="ml-1 text-[10px] uppercase tracking-wide text-brand-500">
                            alterado
                          </span>
                        )}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        {status.kind === "booked" && (
                          <span className="truncate text-[11px] text-red-700">
                            Já ocupado: {status.with.clientName} · {status.with.serviceName} ·{" "}
                            {fmtTime(status.with.startsAt)}
                          </span>
                        )}
                        {status.kind === "closed" && (
                          <span className="text-[11px] text-ink-500">Dia fechado</span>
                        )}
                        {canPick && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickerOpenIndex(pickerOpen ? null : i);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          >
                            <Clock size={11} />
                            {pickerOpen ? "Cancelar" : "Outro horário"}
                          </button>
                        )}
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearOverride(i);
                            }}
                            title="Voltar à hora original"
                            className="inline-flex items-center rounded-md border border-ink-200 bg-card px-1.5 py-0.5 text-[11px] text-ink-500 hover:bg-ink-50"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>

                    {pickerOpen && (
                      <div className="border-t border-ink-100 bg-card px-3 py-2">
                        {pickerSlots.length === 0 ? (
                          <p className="text-[11px] text-ink-500">
                            Sem horários livres neste dia.
                          </p>
                        ) : (
                          <>
                            <p className="mb-1.5 text-[11px] font-medium text-ink-600">
                              Escolher novo horário neste dia:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {pickerSlots.map((slot) => (
                                <button
                                  key={slot.toISOString()}
                                  type="button"
                                  onClick={() => applyOverride(i, slot)}
                                  className="rounded-md border border-ink-200 bg-card px-2 py-1 text-[11px] font-mono tabular-nums text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                                >
                                  {fmtTime(slot)}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !clientId || !serviceId || selectedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Criar {selectedCount > 0 ? `${selectedCount} ` : ""}marcação
            {selectedCount !== 1 ? "ões" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
