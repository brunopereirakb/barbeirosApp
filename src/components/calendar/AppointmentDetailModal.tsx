"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatTime, durationLabel, formatDate } from "@/lib/utils";
import { Phone, MessageCircle, Check, X, ListChecks, Pencil, Save, AlertCircle } from "lucide-react";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  noteForClient: string | null;
  client: {
    id: string;
    code: number | null;
    name: string;
    phone: string | null;
    notes: string | null;
  };
  service: { id: string; name: string; durationMin: number };
};

type Service = { id: string; name: string; durationMin: number };

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

  // Inline edit state — pre-filled from the current appointment.
  const [editing, setEditing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const startDate = new Date(appointment.startsAt);
  const [editDate, setEditDate] = useState(() =>
    `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`
  );
  const [editTime, setEditTime] = useState(() =>
    `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
  );
  const [editServiceId, setEditServiceId] = useState(appointment.service.id);
  const [editNotes, setEditNotes] = useState(appointment.notes ?? "");
  const [editNoteForClient, setEditNoteForClient] = useState(appointment.noteForClient ?? "");
  const [overlapConflict, setOverlapConflict] = useState<string | null>(null);

  useEffect(() => {
    if (editing && services.length === 0) {
      void fetch("/api/services")
        .then((r) => r.json())
        .then(setServices)
        .catch(() => {});
    }
  }, [editing, services.length]);

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

  async function saveEdit(allowOverlap = false) {
    if (working) return;
    setError("");
    setOverlapConflict(null);
    setWorking(true);
    try {
      const [h, m] = editTime.split(":").map(Number);
      const [y, mo, d] = editDate.split("-").map(Number);
      const newStart = new Date(y, mo - 1, d, h, m, 0, 0);
      const r = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: newStart.toISOString(),
          serviceId: editServiceId,
          notes: editNotes || null,
          noteForClient: editNoteForClient || null,
          allowOverlap: allowOverlap || undefined,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        if (r.status === 409 && data.message) {
          setOverlapConflict(data.message);
        } else {
          setError(data.error || `Não foi possível guardar (${r.status})`);
        }
        return;
      }
      onChanged();
    } finally {
      setWorking(false);
    }
  }

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

  const selectedEditService = services.find((s) => s.id === editServiceId);

  return (
    <Modal open onClose={onClose} title="Detalhe da marcação" size="md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded-lg bg-ink-50 p-3">
          <div className="min-w-0">
            <div className="truncate text-base font-medium text-ink-900">{appointment.client.name}</div>
            {appointment.client.phone && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-600">
                <Phone size={12} /> {appointment.client.phone}
              </div>
            )}
          </div>
          {!editing && appointment.status !== "cancelled" && appointment.status !== "done" && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Editar marcação"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-200 hover:text-ink-700"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {/* Nota pessoal do cliente — vinda do registo dele. Deve ser sempre
            destacada porque pode incluir condições físicas ou avisos
            importantes para qualquer marcação. */}
        {appointment.client.notes?.trim() && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Nota do cliente
              </p>
              <p className="whitespace-pre-wrap text-xs">{appointment.client.notes}</p>
            </div>
          </div>
        )}

        {editing ? (
          <div className="space-y-3 rounded-md border border-brand-200 bg-brand-50/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-600">
                Data
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-ink-600">
                Hora
                <input
                  type="time"
                  step={300}
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs text-ink-600">
              Serviço
              <select
                value={editServiceId}
                onChange={(e) => setEditServiceId(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm"
              >
                {services.length === 0 && (
                  <option value={appointment.service.id}>
                    {appointment.service.name} · {durationLabel(appointment.service.durationMin)}
                  </option>
                )}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {durationLabel(s.durationMin)}
                  </option>
                ))}
              </select>
              {selectedEditService && selectedEditService.id !== appointment.service.id && (
                <span className="mt-0.5 block text-[11px] text-amber-700">
                  Mudar serviço recalcula o fim da marcação ({durationLabel(selectedEditService.durationMin)}).
                </span>
              )}
            </label>
            <label className="block text-xs text-ink-600">
              Nota interna
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Detalhe que fica só para ti"
                className="mt-0.5 w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-ink-600">
              Mensagem para o cliente
              <textarea
                value={editNoteForClient}
                onChange={(e) => setEditNoteForClient(e.target.value)}
                rows={2}
                placeholder="Ex.: chegar 5 min antes, traga corte de referência…"
                className="mt-0.5 w-full rounded-md border border-ink-300 px-2 py-1.5 text-sm"
              />
              <span className="mt-0.5 block text-[10px] text-ink-400">
                Enviada no lembrete por WhatsApp.
              </span>
            </label>

            {overlapConflict && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">Conflito de horário</p>
                <p className="mt-0.5">{overlapConflict}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setOverlapConflict(null);
                  setError("");
                }}
                disabled={working}
              >
                Cancelar
              </Button>
              {overlapConflict ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void saveEdit(true)}
                  disabled={working}
                >
                  Confirmar mesmo assim
                </Button>
              ) : (
                <Button size="sm" onClick={() => void saveEdit(false)} disabled={working}>
                  <Save size={14} /> Guardar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <Row label="Serviço" value={appointment.service.name} />
            <Row label="Quando" value={`${formatDate(appointment.startsAt)} · ${formatTime(appointment.startsAt)}`} />
            <Row label="Duração" value={durationLabel(appointment.service.durationMin)} />
            <Row
              label="Estado"
              value={<StatusBadge status={appointment.status} />}
            />
            {appointment.notes && (
              <div className="rounded-md border border-ink-200 bg-card p-3">
                <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">Nota interna</div>
                <div className="whitespace-pre-wrap text-sm text-ink-700">{appointment.notes}</div>
              </div>
            )}
            {appointment.noteForClient && (
              <div className="rounded-md border border-brand-200 bg-brand-50/50 p-3">
                <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-brand-700">
                  <MessageCircle size={10} /> Mensagem para o cliente
                </div>
                <div className="whitespace-pre-wrap text-sm text-ink-800">{appointment.noteForClient}</div>
              </div>
            )}
          </>
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

        {!editing && (
          <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-3">
            {appointment.status === "pending" && (
              <Button size="sm" onClick={() => changeStatus("confirmed")} disabled={working}>
                <Check size={14} /> Confirmar
              </Button>
            )}
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
        )}
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
