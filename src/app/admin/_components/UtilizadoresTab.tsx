"use client";
import { useState } from "react";
import { Plus, Check, Loader2, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import type { UserRow, AddonDef } from "../_types";
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_LABELS, PAYMENT_COLORS, RENEWAL_LABELS } from "../_types";

interface SubForm {
  status: UserRow["subscription"]["status"];
  renewalType: UserRow["subscription"]["renewalType"];
  paymentStatus: UserRow["subscription"]["paymentStatus"];
  trialEndsAt: string;
  expiresAt: string;
  notes: string;
}

interface Props { users: UserRow[]; addonDefs: AddonDef[]; onRefresh: () => void }

function SubEditor({ userId, sub, onSave, onCancel }: {
  userId: string;
  sub: UserRow["subscription"];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubForm>({
    status: sub.status,
    renewalType: sub.renewalType,
    paymentStatus: sub.paymentStatus,
    trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.slice(0, 10) : "",
    expiresAt: sub.expiresAt ? sub.expiresAt.slice(0, 10) : "",
    notes: sub.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/users/${userId}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.status,
        renewalType: form.renewalType,
        paymentStatus: form.paymentStatus,
        trialEndsAt: form.trialEndsAt || null,
        expiresAt: form.expiresAt || null,
        notes: form.notes || null,
      }),
    });
    await onSave();
    setSaving(false);
  }

  const sel = "w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
  const inp = "w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-600">Estado</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubForm["status"] })} className={sel}>
            {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-600">Renovação</label>
          <select value={form.renewalType} onChange={(e) => setForm({ ...form, renewalType: e.target.value as SubForm["renewalType"] })} className={sel}>
            {(Object.keys(RENEWAL_LABELS) as Array<keyof typeof RENEWAL_LABELS>).map((r) => (
              <option key={r} value={r}>{RENEWAL_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-600">Pagamento</label>
          <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as SubForm["paymentStatus"] })} className={sel}>
            {(Object.keys(PAYMENT_LABELS) as Array<keyof typeof PAYMENT_LABELS>).map((p) => (
              <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-600">Fim do trial</label>
          <input type="date" value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} className={inp} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-600">Expiração</label>
          <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inp} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-600">Notas (interno)</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notas internas sobre este cliente…" className="w-full resize-none rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
        </button>
        <button onClick={onCancel} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">Cancelar</button>
      </div>
    </div>
  );
}

export function UtilizadoresTab({ users, addonDefs, onRefresh }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subEditId, setSubEditId] = useState<string | null>(null);

  async function toggleAddon(userId: string, addonKey: string, current: string[]) {
    setSaving(userId);
    const next = current.includes(addonKey) ? current.filter((a) => a !== addonKey) : [...current, addonKey];
    await fetch(`/api/admin/users/${userId}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addons: next }),
    });
    await onRefresh();
    setSaving(null);
  }

  async function toggleActive(userId: string, active: boolean) {
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await onRefresh();
    setSaving(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.ok) {
      setForm({ name: "", email: "", password: "" });
      setShowCreate(false);
      onRefresh();
    } else {
      const data = await res.json();
      setCreateError(data.error || "Erro ao criar utilizador");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{users.length} utilizador{users.length !== 1 ? "es" : ""}</p>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus size={15} /> Novo utilizador
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-ink-200 bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-ink-900">Novo utilizador</h3>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Nome do salão" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <input type="password" placeholder="Palavra-passe inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={creating} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {creating && <Loader2 size={14} className="animate-spin" />} Criar
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">Cancelar</button>
          </div>
        </form>
      )}

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-card p-10 text-center text-sm text-ink-400">Nenhum utilizador registado.</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const open = expanded === user.id;
            const sub = user.subscription;
            return (
              <div key={user.id} className={`rounded-xl border bg-card shadow-sm ${!user.active ? "opacity-60" : ""} border-ink-200`}>
                {/* Header row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">{user.name}</span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{sub.plan}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>{STATUS_LABELS[sub.status]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLORS[sub.paymentStatus]}`}>{PAYMENT_LABELS[sub.paymentStatus]}</span>
                      {sub.addons.length > 0 && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">+{sub.addons.length} add-on{sub.addons.length !== 1 ? "s" : ""}</span>}
                      {!user.active && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-400">Inativo</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-400">{user.email}</p>
                    {sub.notes && <p className="mt-0.5 text-xs italic text-ink-400">{sub.notes}</p>}
                  </div>
                  <button onClick={() => toggleActive(user.id, user.active)} disabled={saving === user.id} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${user.active ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-green-200 text-green-600 hover:bg-green-50"}`}>
                    {user.active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => setExpanded(open ? null : user.id)} className="text-ink-400 hover:text-ink-700">
                    {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Expanded panel */}
                {open && (
                  <div className="border-t border-ink-100 px-5 pb-5 pt-4 space-y-5">
                    {/* Subscription settings */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Subscrição</p>
                        {subEditId !== user.id && (
                          <button onClick={() => setSubEditId(user.id)} className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50">
                            <SlidersHorizontal size={12} /> Editar
                          </button>
                        )}
                      </div>

                      {subEditId === user.id ? (
                        <SubEditor
                          userId={user.id}
                          sub={sub}
                          onSave={async () => { await onRefresh(); setSubEditId(null); }}
                          onCancel={() => setSubEditId(null)}
                        />
                      ) : (
                        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                          <div><span className="text-ink-400">Renovação:</span> <span className="font-medium text-ink-700">{RENEWAL_LABELS[sub.renewalType]}</span></div>
                          <div><span className="text-ink-400">Trial até:</span> <span className="font-medium text-ink-700">{sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString("pt-PT") : "—"}</span></div>
                          <div><span className="text-ink-400">Expira em:</span> <span className="font-medium text-ink-700">{sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("pt-PT") : "Auto-renova"}</span></div>
                        </div>
                      )}
                    </div>

                    {/* Add-ons */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Add-ons</p>
                      {addonDefs.filter((d) => d.active).length === 0 ? (
                        <p className="text-sm text-ink-400">Nenhum add-on definido ainda.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {addonDefs.filter((d) => d.active).map((addon) => {
                            const isActive = sub.addons.includes(addon.key);
                            return (
                              <button key={addon.id} onClick={() => toggleAddon(user.id, addon.key, sub.addons)} disabled={saving === user.id} className={`flex items-start gap-2 rounded-lg border p-3 text-left transition ${isActive ? "border-brand-300 bg-brand-50" : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"}`}>
                                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${isActive ? "bg-brand-500 text-white" : "border border-ink-300"}`}>
                                  {isActive && <Check size={10} />}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-ink-800">{addon.name}</p>
                                  <p className="text-xs text-ink-400">{addon.price.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €/mês</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {saving === user.id && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-ink-400">
                          <Loader2 size={12} className="animate-spin" /> A guardar...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
