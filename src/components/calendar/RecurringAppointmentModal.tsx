"use client";
import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Loader2, CalendarClock, Check, X } from "lucide-react";

type Client = { id: string; name: string };
type Service = { id: string; name: string; durationMin: number; category: string | null };

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
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

interface Props { onClose: () => void; onCreated: () => void; defaultDate?: Date }

export function RecurringAppointmentModal({ onClose, onCreated, defaultDate }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState(() => (defaultDate ?? new Date()).toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [freqDays, setFreqDays] = useState("7");
  const [endDate, setEndDate] = useState(() => {
    const d = defaultDate ?? new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]).then(([c, s]) => { setClients(c); setServices(s); });
  }, []);

  // Generate all occurrence dates
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

  const selectedCount = occurrences.length - deselected.size;

  function toggleDate(i: number) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function handleCreate() {
    if (!clientId || !serviceId || selectedCount === 0) return;
    setError("");
    setSaving(true);
    const appointments = occurrences
      .filter((_, i) => !deselected.has(i))
      .map((d) => ({ clientId, serviceId, startsAt: d.toISOString() }));

    const res = await fetch("/api/appointments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointments }),
    });
    setSaving(false);
    if (res.ok) {
      onCreated();
    } else {
      const d = await res.json();
      setError(d.error || "Erro ao criar marcações");
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedService = services.find((s) => s.id === serviceId);

  const inputCls = "w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <Modal open onClose={onClose} title="Marcação recorrente" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Client */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Cliente</label>
            {selectedClient ? (
              <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
                <span className="flex-1 text-sm font-medium text-brand-800">{selectedClient.name}</span>
                <button onClick={() => { setClientId(""); setClientSearch(""); }} className="text-brand-400 hover:text-brand-700"><X size={14} /></button>
              </div>
            ) : (
              <div className="space-y-1">
                <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Pesquisar cliente…" className={inputCls} />
                {clientSearch && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-sm">
                    {filteredClients.slice(0, 8).map((c) => (
                      <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(""); }} className="flex w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-brand-50">
                        {c.name}
                      </button>
                    ))}
                    {filteredClients.length === 0 && <p className="px-3 py-2 text-xs text-ink-400">Nenhum cliente encontrado</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Serviço</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={inputCls}>
              <option value="">— escolher serviço —</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {selectedService && <p className="text-xs text-ink-400">{selectedService.durationMin} min</p>}
          </div>

          {/* Start date + time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Data de início</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Hora</label>
            <input type="time" step="300" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Frequência</label>
            <select value={freqDays} onChange={(e) => setFreqDays(e.target.value)} className={inputCls}>
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* End date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-600">Repetir até</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Preview */}
        {occurrences.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-600">
                <CalendarClock size={13} className="mr-1 inline" />
                Pré-visualização — {selectedCount} de {occurrences.length} marcações selecionadas
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeselected(new Set())} className="text-xs text-brand-600 hover:underline">Selecionar todas</button>
                <button onClick={() => setDeselected(new Set(occurrences.map((_, i) => i)))} className="text-xs text-ink-500 hover:underline">Limpar todas</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50">
              {occurrences.map((d, i) => {
                const selected = !deselected.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleDate(i)}
                    className={`flex w-full items-center gap-3 border-b border-ink-100 px-3 py-2 text-left text-sm last:border-0 transition ${selected ? "bg-white" : "bg-ink-100 opacity-50"}`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${selected ? "bg-brand-500 text-white" : "border border-ink-300"}`}>
                      {selected && <Check size={10} />}
                    </div>
                    <span className={selected ? "text-ink-800" : "text-ink-400 line-through"}>{fmtDate(d)}</span>
                    <span className="text-ink-400">{time}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <button onClick={onClose} className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={saving || !clientId || !serviceId || selectedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Criar {selectedCount > 0 ? `${selectedCount} ` : ""}marcação{selectedCount !== 1 ? "ões" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
