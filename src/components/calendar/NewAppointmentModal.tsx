"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UserPlus } from "lucide-react";
import { durationLabel } from "@/lib/utils";

type Client = { id: string; code: number | null; name: string; phone: string | null };
type Service = { id: string; name: string; durationMin: number; category: string | null };

export function NewAppointmentModal({
  startsAt,
  defaultServiceId,
  onClose,
  onCreated,
}: {
  startsAt: Date;
  /**
   * Pre-selected service id when the modal is opened by clicking on an empty
   * slot — usually the salon's default service for that weekday.
   */
  defaultServiceId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientBirthday, setNewClientBirthday] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ?? "");
  const [time, setTime] = useState<string>(
    startsAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Tracks an "overlap" 409 response so the user can confirm and retry.
  const [overlapConflict, setOverlapConflict] = useState<{
    message: string;
  } | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/clients").then((r) => r.json()).then(setClients),
      fetch("/api/services").then((r) => r.json()).then(setServices),
    ]);
  }, []);

  const filteredClients = clients.filter((c) => {
    const q = search.trim();
    if (!q) return true;
    const lo = q.toLowerCase();
    if (c.name.toLowerCase().includes(lo)) return true;
    if (c.phone && c.phone.toLowerCase().includes(lo)) return true;
    if (c.code != null && String(c.code).includes(q)) return true;
    return false;
  });

  // Agrupar serviços por categoria
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const k = s.category || "outros";
    (acc[k] = acc[k] || []).push(s);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    corte: "Cortes",
    coloracao: "Coloração",
    barba: "Barba",
    rapido: "Serviços rápidos",
    outros: "Outros",
  };

  async function createClient() {
    if (!newClientName.trim()) return;
    setClientError("");
    setCreatingClient(true);
    try {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone || null,
          birthday: newClientBirthday || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setClientError(data.error || "Não foi possível criar o cliente");
        return;
      }
      const c: Client = data;
      setClients([...clients, c]);
      setClientId(c.id);
      setShowNewClient(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientBirthday("");
    } finally {
      setCreatingClient(false);
    }
  }

  async function save(allowOverlap = false) {
    if (!clientId || !serviceId) return;
    setError("");
    if (!allowOverlap) setOverlapConflict(null);
    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(startsAt);
      start.setHours(h, m, 0, 0);

      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          serviceId,
          startsAt: start.toISOString(),
          notes: notes || null,
          status: "confirmed",
          allowOverlap: allowOverlap || undefined,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        if (r.status === 409 && data.message) {
          // Surface the conflict with a "confirmar mesmo assim" affordance
          // instead of just a plain error string.
          setOverlapConflict({ message: data.message });
        } else {
          setError(data.error || `Não foi possível criar a marcação (${r.status})`);
        }
        return;
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova marcação" size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={300}
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Data</label>
            <input
              type="text"
              value={startsAt.toLocaleDateString("pt-PT")}
              readOnly
              className="w-full rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Cliente */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Cliente</label>
          {showNewClient ? (
            <div className="space-y-2 rounded-md border border-brand-300 bg-brand-50/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-800">
                  Novo cliente
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClient(false);
                    setClientError("");
                  }}
                  className="text-xs text-brand-700 hover:underline"
                >
                  Escolher existente
                </button>
              </div>
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nome *"
                autoFocus
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="Telefone (ex. +351912345678)"
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-ink-600">
                  Aniversário (opcional)
                </label>
                <input
                  type="date"
                  value={newClientBirthday}
                  onChange={(e) => setNewClientBirthday(e.target.value)}
                  className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                />
              </div>
              {clientError && (
                <p className="text-xs text-red-600">{clientError}</p>
              )}
              <Button
                size="sm"
                onClick={createClient}
                disabled={!newClientName.trim() || creatingClient}
              >
                {creatingClient ? "A criar…" : "Criar e selecionar"}
              </Button>
            </div>
          ) : (
            <>
              {/* Prominent + Novo cliente CTA */}
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-brand-300 bg-brand-50/40 px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
              >
                <UserPlus size={16} />
                Novo cliente
              </button>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por código, nome ou telefone…"
                className="mb-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <div className="max-h-32 overflow-y-auto rounded-md border border-ink-200">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClientId(c.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                      clientId === c.id ? "bg-brand-50 font-medium text-brand-700" : ""
                    }`}
                  >
                    <span className="w-10 shrink-0 font-mono text-xs text-ink-400">
                      {c.code != null ? `#${c.code}` : ""}
                    </span>
                    <span className="text-ink-300">—</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-ink-300">—</span>
                    <span className="shrink-0 text-xs text-ink-500">
                      {c.phone || "—"}
                    </span>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="p-3 text-center text-xs text-ink-400">
                    Nenhum cliente encontrado
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Serviço */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Serviço</label>
          <div className="space-y-2">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">
                  {categoryLabels[cat] || cat}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setServiceId(s.id)}
                      className={`rounded-md border px-2.5 py-2 text-left text-xs ${
                        serviceId === s.id
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-ink-200 hover:border-ink-300"
                      }`}
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[10px] text-ink-500">{durationLabel(s.durationMin)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Algum detalhe sobre esta marcação..."
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {overlapConflict && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <p className="font-medium">Conflito de horário</p>
            <p className="mt-0.5 text-xs">{overlapConflict.message}</p>
            <p className="mt-1.5 text-xs">
              Podes ajustar a hora/serviço ou confirmar mesmo assim — a marcação
              ficará sobreposta à existente.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {overlapConflict ? (
            <Button
              variant="danger"
              onClick={() => void save(true)}
              disabled={saving || !clientId || !serviceId}
            >
              {saving ? "A guardar..." : "Confirmar mesmo assim"}
            </Button>
          ) : (
            <Button onClick={() => void save(false)} disabled={saving || !clientId || !serviceId}>
              {saving ? "A guardar..." : "Criar marcação"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
