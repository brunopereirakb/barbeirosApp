"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Plus, Trash2, Clock, FastForward, ArrowRight } from "lucide-react";
import { durationLabel, formatTime } from "@/lib/utils";

type Entry = {
  id: string;
  preferences: string;
  client: { id: string; name: string; phone: string | null };
  service: { id: string; name: string; durationMin: number };
  createdAt: string;
};

type Offer = {
  id: string;
  cascadeId: string;
  status: string;
  position: number;
  freedStartsAt: string;
  freedEndsAt: string;
  expiresAt: string;
  waitlistEntry: {
    client: { name: string };
    service: { name: string; durationMin: number };
  };
};

type Client = { id: string; name: string; phone: string | null };
type Service = { id: string; name: string; durationMin: number };

export default function WaitlistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [pendingDeclineId, setPendingDeclineId] = useState<string | null>(null);

  async function load() {
    const [e, o] = await Promise.all([
      fetch("/api/waitlist").then((r) => r.json()),
      fetch("/api/cascade").then((r) => r.json()),
    ]);
    setEntries(e);
    setOffers(o);
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  // Agrupar ofertas por cascadeId
  const cascades = offers.reduce<Record<string, Offer[]>>((acc, o) => {
    (acc[o.cascadeId] = acc[o.cascadeId] || []).push(o);
    return acc;
  }, {});

  async function remove(id: string) {
    if (!confirm("Remover esta entrada da lista de espera?")) return;
    await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
    void load();
  }

  async function forceAdvance(cascadeId: string) {
    if (!confirm("Forçar a passagem para o próximo cliente da cascata? (utilizar para testes)")) return;
    await fetch("/api/cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force-advance", cascadeId }),
    });
    void load();
  }

  async function acceptOffer(offerId: string) {
    if (!confirm("Marcar como ACEITE? (Como se o cliente tivesse respondido SIM)")) return;
    await fetch("/api/cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", offerId }),
    });
    void load();
  }

  async function declineOffer(offerId: string, removeFromWaitlist: boolean) {
    await fetch("/api/cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", offerId, removeFromWaitlist }),
    });
    setPendingDeclineId(null);
    void load();
  }

  const cascadeIds = Object.keys(cascades);

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-card px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Lista de espera</h1>
        <span className="text-xs text-ink-500">{entries.length} {entries.length === 1 ? "cliente" : "clientes"}</span>
        <div className="flex-1" />
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Adicionar à lista
        </Button>
      </div>

      <div className="space-y-6 p-5">
        {/* Cascatas em curso */}
        {cascadeIds.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-ink-700">Cascatas em curso</h2>
            <div className="space-y-3">
              {cascadeIds.map((cid) => {
                const list = cascades[cid].sort((a, b) => a.position - b.position);
                const slot = list[0];
                return (
                  <div key={cid} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm">
                        <strong>Vaga livre:</strong> {new Date(slot.freedStartsAt).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })} · {formatTime(slot.freedStartsAt)}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => forceAdvance(cid)}>
                        <FastForward size={14} /> Forçar avanço (teste)
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {list.map((o, i) => (
                        <div
                          key={o.id}
                          className={`flex items-center gap-3 rounded-md border bg-card p-2 ${
                            o.status === "pending" ? "border-amber-400 ring-1 ring-amber-200" : "border-ink-200"
                          }`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-[11px] text-ink-600">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-ink-800">{o.waitlistEntry.client.name}</div>
                            <div className="text-xs text-ink-500">
                              {o.waitlistEntry.service.name}
                              {o.status === "pending" && (
                                <> · expira {new Date(o.expiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</>
                              )}
                              {o.status === "queued" && <> · aguardar resposta do anterior</>}
                            </div>
                          </div>
                          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            o.status === "pending" ? "bg-amber-200 text-amber-900" : "bg-ink-100 text-ink-600"
                          }`}>
                            {o.status === "pending" ? "À espera de resposta" : "Em fila"}
                          </span>
                          {o.status === "pending" && pendingDeclineId !== o.id && (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => acceptOffer(o.id)}>Sim</Button>
                              <Button size="sm" variant="secondary" onClick={() => setPendingDeclineId(o.id)}>Não</Button>
                            </div>
                          )}
                          {o.status === "pending" && pendingDeclineId === o.id && (
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="font-medium text-ink-700">Quer continuar na lista?</span>
                              <div className="flex gap-1">
                                <button onClick={() => declineOffer(o.id, false)} className="rounded bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200">
                                  Sim, manter
                                </button>
                                <button onClick={() => declineOffer(o.id, true)} className="rounded bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100">
                                  Não, sair
                                </button>
                                <button onClick={() => setPendingDeclineId(null)} className="rounded px-2 py-1 text-ink-500 hover:bg-ink-100">
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Lista normal */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-700">Clientes em espera</h2>
          {entries.length === 0 ? (
            <div className="rounded-md border border-ink-200 bg-card p-8 text-center text-sm text-ink-500">
              Lista de espera vazia.
            </div>
          ) : (
            <div className="space-y-1.5">
              {entries.map((e) => {
                const prefs = JSON.parse(e.preferences || "{}") as { notes?: string; weekdays?: string[]; timeOfDay?: string };
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-md border border-ink-200 bg-card p-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink-800">{e.client.name}</div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {e.service.name} · {durationLabel(e.service.durationMin)}
                        {prefs.notes && ` · ${prefs.notes}`}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(e.id)}
                      className="rounded-md p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showNew && <NewWaitlistEntry onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); void load(); }} />}
    </div>
  );
}

function NewWaitlistEntry({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<"any" | "morning" | "afternoon">("any");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/clients").then((r) => r.json()).then(setClients),
      fetch("/api/services").then((r) => r.json()).then(setServices),
    ]);
  }, []);

  async function save() {
    if (!clientId || !serviceId) return;
    setSaving(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          serviceId,
          preferences: { timeOfDay, weekdays: ["any"], notes },
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Adicionar à lista de espera" size="md">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Cliente</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm">
            <option value="">— escolher —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Serviço pretendido</label>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm">
            <option value="">— escolher —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({durationLabel(s.durationMin)})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Período preferido</label>
          <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as "any" | "morning" | "afternoon")} className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm">
            <option value="any">Qualquer hora</option>
            <option value="morning">Manhã</option>
            <option value="afternoon">Tarde</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Ex: "qualquer tarde esta semana"'
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !clientId || !serviceId}>
            {saving ? "A guardar..." : "Adicionar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
