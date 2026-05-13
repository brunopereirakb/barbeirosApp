"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatTime, durationLabel } from "@/lib/utils";

type Client = { id: string; name: string; phone: string | null };
type Service = { id: string; name: string; durationMin: number; category: string | null };

export function NewAppointmentModal({
  startsAt,
  onClose,
  onCreated,
}: {
  startsAt: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [time, setTime] = useState<string>(
    startsAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/clients").then((r) => r.json()).then(setClients),
      fetch("/api/services").then((r) => r.json()).then(setServices),
    ]);
  }, []);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

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
    const r = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName, phone: newClientPhone || null }),
    });
    const c: Client = await r.json();
    setClients([...clients, c]);
    setClientId(c.id);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
  }

  async function save() {
    if (!clientId || !serviceId) return;
    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(startsAt);
      start.setHours(h, m, 0, 0);

      await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          serviceId,
          startsAt: start.toISOString(),
          notes: notes || null,
          status: "confirmed",
        }),
      });
      onCreated();
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
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-ink-600">Cliente</label>
            <button
              onClick={() => setShowNewClient(!showNewClient)}
              className="text-xs text-brand-600 hover:underline"
            >
              {showNewClient ? "Escolher existente" : "+ Novo cliente"}
            </button>
          </div>
          {showNewClient ? (
            <div className="space-y-2 rounded-md border border-brand-200 bg-brand-50/30 p-3">
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nome"
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="+351912345678"
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <Button size="sm" onClick={createClient} disabled={!newClientName.trim()}>
                Criar e selecionar
              </Button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar cliente..."
                className="mb-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
              <div className="max-h-32 overflow-y-auto rounded-md border border-ink-200">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClientId(c.id)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                      clientId === c.id ? "bg-brand-50 font-medium text-brand-700" : ""
                    }`}
                  >
                    {c.name} {c.phone && <span className="text-xs text-ink-400">{c.phone}</span>}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="p-3 text-center text-xs text-ink-400">Nenhum cliente encontrado</div>
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

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !clientId || !serviceId}>
            {saving ? "A guardar..." : "Criar marcação"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
