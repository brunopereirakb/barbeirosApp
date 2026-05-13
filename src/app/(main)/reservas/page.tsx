"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, X, Filter, Calendar, User, Scissors, Clock } from "lucide-react";
import Link from "next/link";
import { cn, formatTime, durationLabel } from "@/lib/utils";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; name: string; phone: string | null; email: string | null };
  service: { id: string; name: string; durationMin: number };
};

type Service = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "", label: "Todos os estados" },
  { value: "confirmed", label: "Confirmada" },
  { value: "pending", label: "Pendente" },
  { value: "done", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "Não veio" },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-green-700",
  cancelled: "bg-ink-100 text-ink-500",
  no_show: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada", pending: "Pendente", done: "Concluída",
  cancelled: "Cancelada", no_show: "Não veio",
};

export default function ReservasPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices);
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (serviceId) params.set("serviceId", serviceId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const data = await fetch(`/api/appointments/search?${params}`).then((r) => r.json());
    setResults(data);
    setLoading(false);
  }, [q, status, serviceId, dateFrom, dateTo]);

  function clear() {
    setQ(""); setStatus(""); setServiceId(""); setDateFrom(""); setDateTo("");
    setResults([]); setSearched(false);
  }

  const hasFilters = q || status || serviceId || dateFrom || dateTo;

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-ink-200 bg-white px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Pesquisa de reservas</h1>
      </div>

      <div className="p-5 space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Pesquisar por nome, telefone ou email do cliente…"
              className="w-full rounded-lg border border-ink-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <button onClick={search} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            Pesquisar
          </button>
          {hasFilters && (
            <button onClick={clear} className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-500 hover:bg-ink-50">
              <X size={14} /> Limpar
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-ink-400" />
            <span className="text-xs font-medium text-ink-500">Filtros:</span>
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500">
            <option value="">Todos os serviços</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-ink-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500" />
            <span className="text-xs text-ink-400">até</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500" />
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-ink-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center text-sm text-ink-400">
            Nenhuma reserva encontrada.
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-ink-400">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
            {results.map((appt) => (
              <div key={appt.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[appt.status])}>
                        {STATUS_LABELS[appt.status]}
                      </span>
                      <span className="font-medium text-ink-900">{appt.client.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                      <span className="flex items-center gap-1"><Scissors size={13} className="text-ink-400" />{appt.service.name}</span>
                      <span className="flex items-center gap-1"><Clock size={13} className="text-ink-400" />{durationLabel(appt.service.durationMin)}</span>
                      {appt.client.phone && <span className="flex items-center gap-1"><User size={13} className="text-ink-400" />{appt.client.phone}</span>}
                    </div>
                    {appt.notes && <p className="text-xs italic text-ink-400">{appt.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-ink-800">
                      {new Date(appt.startsAt).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-ink-500">{formatTime(appt.startsAt)} – {formatTime(appt.endsAt)}</p>
                    <Link href={`/calendario?date=${appt.startsAt.slice(0, 10)}`} className="mt-1 inline-block text-xs text-brand-600 hover:underline">
                      Ver no calendário →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!searched && (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center text-sm text-ink-400">
            Use a pesquisa ou os filtros acima para encontrar reservas.
          </div>
        )}
      </div>
    </div>
  );
}
