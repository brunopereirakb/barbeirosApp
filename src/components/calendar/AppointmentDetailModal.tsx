"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatTime, durationLabel, formatDate } from "@/lib/utils";
import { Phone, MessageCircle, Check, X, ListChecks } from "lucide-react";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; code: number | null; name: string; phone: string | null };
  service: { id: string; name: string; durationMin: number };
};

type WaitlistMatch = {
  id: string;
  client: { id: string; name: string };
  service: { id: string; name: string; durationMin: number };
};

export function AppointmentDetailModal({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [matches, setMatches] = useState<WaitlistMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [cascadeStarted, setCascadeStarted] = useState(false);
  const [reminderState, setReminderState] = useState<"idle" | "sent" | "failed">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (showCancel) {
      void fetch(
        `/api/waitlist?slotStart=${encodeURIComponent(appointment.startsAt)}&slotEnd=${encodeURIComponent(appointment.endsAt)}`
      )
        .then((r) => r.json())
        .then((data: WaitlistMatch[]) => {
          setMatches(data);
          setSelectedIds(new Set(data.map((m) => m.id)));
        });
    }
  }, [showCancel, appointment.startsAt, appointment.endsAt]);

  async function changeStatus(status: Appointment["status"]) {
    setWorking(true);
    try {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onChanged();
    } finally {
      setWorking(false);
    }
  }

  async function sendReminder() {
    if (working) return;
    setWorking(true);
    setReminderState("idle");
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reminder", clientId: appointment.client.id, appointmentId: appointment.id }),
      });
      const data = await r.json().catch(() => ({}));
      setReminderState(r.ok && data.ok ? "sent" : "failed");
    } catch {
      setReminderState("failed");
    } finally {
      setWorking(false);
    }
  }

  async function cancelOnly() {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const r = await fetch(`/api/appointments/${appointment.id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error || `Não foi possível cancelar (${r.status})`);
        return;
      }
      onChanged();
    } finally {
      setWorking(false);
    }
  }

  async function cancelWithCascade() {
    if (working) return;
    if (selectedIds.size === 0) {
      await cancelOnly();
      return;
    }
    setWorking(true);
    setError("");
    try {
      const candidates = Array.from(selectedIds).join(",");
      const r = await fetch(
        `/api/appointments/${appointment.id}?cascade=true&candidates=${candidates}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error || `Não foi possível cancelar (${r.status})`);
        return;
      }
      setCascadeStarted(true);
      setTimeout(() => onChanged(), 1500);
    } finally {
      setWorking(false);
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  if (showCancel) {
    return (
      <Modal open onClose={onClose} title="Cancelar e notificar lista de espera" size="lg">
        {cascadeStarted ? (
          <div className="py-4 text-center">
            <Check className="mx-auto mb-2 text-brand-500" size={32} />
            <p className="text-sm text-ink-700">Cascata iniciada. Mensagem enviada ao primeiro cliente.</p>
            <p className="mt-1 text-xs text-ink-500">Acompanha em <a href="/lista-espera" className="text-brand-600 underline">Lista de espera</a></p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <strong>{appointment.client.name}</strong> · {formatTime(appointment.startsAt)} · {appointment.service.name}
              <br />
              Esta marcação será cancelada. Vais notificar a lista de espera abaixo em cascata: o primeiro recebe a oferta, e se não responder em X minutos passa ao seguinte.
            </div>

            {matches.length === 0 ? (
              <div className="rounded-md border border-ink-200 bg-ink-50 p-4 text-center text-sm text-ink-500">
                Não há clientes em lista de espera elegíveis para este horário.
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs font-medium text-ink-600">
                  {matches.length} {matches.length === 1 ? "cliente elegível" : "clientes elegíveis"} (ordem da fila):
                </p>
                <div className="space-y-1.5">
                  {matches.map((m, i) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-ink-200 bg-card p-3 hover:border-ink-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-ink-800">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[10px] text-ink-600">
                            {i + 1}
                          </span>
                          {m.client.name}
                        </div>
                        <div className="text-xs text-ink-500">{m.service.name} · {durationLabel(m.service.durationMin)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 pt-3">
              <Button variant="ghost" onClick={() => setShowCancel(false)}>
                Voltar
              </Button>
              <Button variant="secondary" onClick={cancelOnly} disabled={working}>
                Cancelar sem notificar
              </Button>
              <Button onClick={cancelWithCascade} disabled={working || selectedIds.size === 0}>
                {working ? "A iniciar..." : `Cancelar e notificar (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Detalhe da marcação" size="md">
      <div className="space-y-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <div className="text-base font-medium text-ink-900">{appointment.client.name}</div>
          {appointment.client.phone && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-600">
              <Phone size={12} /> {appointment.client.phone}
            </div>
          )}
        </div>

        <Row label="Serviço" value={appointment.service.name} />
        <Row label="Quando" value={`${formatDate(appointment.startsAt)} · ${formatTime(appointment.startsAt)}`} />
        <Row label="Duração" value={durationLabel(appointment.service.durationMin)} />
        <Row
          label="Estado"
          value={<StatusBadge status={appointment.status} />}
        />
        {appointment.notes && (
          <div className="rounded-md border border-ink-200 bg-card p-3">
            <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">Notas</div>
            <div className="text-sm text-ink-700">{appointment.notes}</div>
          </div>
        )}

        {reminderState === "sent" && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            ✓ Lembrete enviado.
          </p>
        )}
        {reminderState === "failed" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            Não foi possível enviar o lembrete.
          </p>
        )}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-3">
          {appointment.status !== "done" && (
            <Button size="sm" variant="secondary" onClick={() => changeStatus("done")} disabled={working}>
              <Check size={14} /> Marcar concluída
            </Button>
          )}
          {appointment.status !== "no_show" && appointment.status !== "done" && (
            <Button size="sm" variant="secondary" onClick={() => changeStatus("no_show")} disabled={working}>
              <X size={14} /> Não veio
            </Button>
          )}
          {appointment.client.phone && (
            <Button size="sm" variant="secondary" onClick={sendReminder} disabled={working}>
              <MessageCircle size={14} /> Enviar lembrete
            </Button>
          )}
          {appointment.status !== "cancelled" && appointment.status !== "done" && (
            <Button size="sm" variant="danger" onClick={() => setShowCancel(true)} disabled={working}>
              <ListChecks size={14} /> Cancelar e notificar fila
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-sm text-ink-800">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const map = {
    pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
    confirmed: { label: "Confirmada", cls: "bg-brand-100 text-brand-800" },
    done: { label: "Concluída", cls: "bg-ink-100 text-ink-700" },
    cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-700" },
    no_show: { label: "Não veio", cls: "bg-red-100 text-red-700" },
  } as const;
  const m = map[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}
