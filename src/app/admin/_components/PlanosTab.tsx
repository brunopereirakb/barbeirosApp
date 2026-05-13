"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Loader2, Check, X, Code2, ToggleLeft, ToggleRight } from "lucide-react";
import type { AddonDef, PlanDef } from "../_types";

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">€</span>
      <input
        type="number" min="0" step="0.01" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-ink-300 py-2 pl-7 pr-3 text-sm outline-none focus:border-brand-500"
      />
    </div>
  );
}

function FeatureList({ features, onChange }: { features: string[]; onChange: (f: string[]) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="space-y-1.5">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={f}
            onChange={(e) => { const next = [...features]; next[i] = e.target.value; onChange(next); }}
            className="flex-1 rounded-lg border border-ink-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <button onClick={() => onChange(features.filter((_, j) => j !== i))} className="text-ink-400 hover:text-red-500"><X size={14} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { onChange([...features, input.trim()]); setInput(""); e.preventDefault(); } }}
          placeholder="Adicionar funcionalidade… (Enter para confirmar)"
          className="flex-1 rounded-lg border border-dashed border-ink-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <button onClick={() => { if (input.trim()) { onChange([...features, input.trim()]); setInput(""); } }} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50"><Plus size={14} /></button>
      </div>
    </div>
  );
}

export function PlanosTab() {
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [addons, setAddons] = useState<AddonDef[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<Partial<PlanDef>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  const [editingAddon, setEditingAddon] = useState<string | null>(null);
  const [addonDraft, setAddonDraft] = useState<Partial<AddonDef>>({});
  const [savingAddon, setSavingAddon] = useState(false);

  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", description: "", price: 0, features: [] as string[] });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanError, setNewPlanError] = useState("");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const [p, a] = await Promise.all([
      fetch("/api/admin/plans").then((r) => r.json()),
      fetch("/api/admin/addons").then((r) => r.json()),
    ]);
    setPlans(p);
    setAddons(a);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setNewPlanError("");
    setCreatingPlan(true);
    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlan),
    });
    setCreatingPlan(false);
    if (res.ok) {
      setNewPlan({ name: "", description: "", price: 0, features: [] });
      setShowNewPlan(false);
      fetch_();
    } else {
      const d = await res.json();
      setNewPlanError(d.error || "Erro ao criar plano");
    }
  }

  async function savePlan(id: string) {
    setSavingPlan(true);
    await fetch(`/api/admin/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planDraft),
    });
    await fetch_();
    setEditingPlan(null);
    setSavingPlan(false);
  }

  async function saveAddon(id: string) {
    setSavingAddon(true);
    await fetch(`/api/admin/addons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addonDraft),
    });
    await fetch_();
    setEditingAddon(null);
    setSavingAddon(false);
  }

  async function toggleAddonActive(addon: AddonDef) {
    await fetch(`/api/admin/addons/${addon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !addon.active }),
    });
    fetch_();
  }

  if (loading) return <div className="flex justify-center py-12 text-ink-400"><Loader2 size={22} className="animate-spin" /></div>;

  return (
    <div className="space-y-10">
      {/* Plans */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Planos</h2>
          {!showNewPlan && (
            <button onClick={() => setShowNewPlan(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
              <Plus size={15} /> Novo plano
            </button>
          )}
        </div>

        {showNewPlan && (
          <form onSubmit={createPlan} className="mb-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-ink-900">Novo plano</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-600">Nome</label>
                <input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} required placeholder="Ex: Plano Pro" className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-600">Preço / mês</label>
                <PriceInput value={newPlan.price} onChange={(v) => setNewPlan({ ...newPlan, price: v })} />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-ink-600">Descrição</label>
                <input value={newPlan.description} onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })} placeholder="Breve descrição" className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-ink-600">Funcionalidades incluídas</label>
                <FeatureList features={newPlan.features} onChange={(f) => setNewPlan({ ...newPlan, features: f })} />
              </div>
            </div>
            {newPlanError && <p className="mt-2 text-sm text-red-600">{newPlanError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={creatingPlan} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {creatingPlan && <Loader2 size={14} className="animate-spin" />} Criar plano
              </button>
              <button type="button" onClick={() => { setShowNewPlan(false); setNewPlanError(""); }} className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">Cancelar</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {plans.map((plan) => {
            const editing = editingPlan === plan.id;
            const draft = editing ? planDraft : plan;
            return (
              <div key={plan.id} className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {editing ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Nome</label><input value={draft.name ?? ""} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
                          <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Preço / mês</label><PriceInput value={draft.price ?? 0} onChange={(v) => setPlanDraft({ ...planDraft, price: v })} /></div>
                        </div>
                        <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Descrição</label><input value={draft.description ?? ""} onChange={(e) => setPlanDraft({ ...planDraft, description: e.target.value })} className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
                        <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Funcionalidades incluídas</label><FeatureList features={draft.features ?? []} onChange={(f) => setPlanDraft({ ...planDraft, features: f })} /></div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-ink-900">{plan.name}</span>
                          <span className="rounded-full font-mono bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{plan.key}</span>
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                            {plan.price === 0 ? "Grátis" : `${plan.price.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €/mês`}
                          </span>
                        </div>
                        {plan.description && <p className="text-sm text-ink-500">{plan.description}</p>}
                        {plan.features.length > 0 && (
                          <ul className="space-y-1">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-ink-600"><Check size={13} className="shrink-0 text-green-500" />{f}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {editing ? (
                      <>
                        <button onClick={() => savePlan(plan.id)} disabled={savingPlan} className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                          {savingPlan ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
                        </button>
                        <button onClick={() => setEditingPlan(null)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">Cancelar</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditingPlan(plan.id); setPlanDraft({ name: plan.name, description: plan.description ?? "", price: plan.price, features: [...plan.features] }); }} className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
                        <Pencil size={12} /> Editar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-ons */}
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Add-ons</h2>
        </div>
        <p className="mb-4 flex items-center gap-1.5 text-xs text-ink-400">
          <Code2 size={13} />
          Add-ons são definidos em código. Para adicionar um novo, registe-o em
          <code className="rounded bg-ink-100 px-1 font-mono">src/lib/addon-registry.ts</code>
          e implemente a funcionalidade.
        </p>

        <div className="space-y-2">
          {addons.map((addon) => {
            const editing = editingAddon === addon.id;
            const draft = editing ? addonDraft : addon;
            return (
              <div key={addon.id} className={`rounded-xl border border-ink-200 bg-white p-4 shadow-sm ${!addon.active ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  {editing ? (
                    <div className="grid flex-1 grid-cols-3 gap-3">
                      <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Nome</label><input value={draft.name ?? ""} onChange={(e) => setAddonDraft({ ...addonDraft, name: e.target.value })} className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
                      <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Descrição</label><input value={draft.description ?? ""} onChange={(e) => setAddonDraft({ ...addonDraft, description: e.target.value })} className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" /></div>
                      <div className="space-y-1"><label className="text-xs font-medium text-ink-600">Preço / mês</label><PriceInput value={draft.price ?? 0} onChange={(v) => setAddonDraft({ ...addonDraft, price: v })} /></div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-900">{addon.name}</span>
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-500">{addon.key}</span>
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                          {addon.price.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €/mês
                        </span>
                        {!addon.active && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-400">Inativo</span>}
                      </div>
                      {addon.description && <p className="mt-0.5 text-xs text-ink-400">{addon.description}</p>}
                      {addon.implementedIn && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-ink-300">
                          <Code2 size={11} /> {addon.implementedIn}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex shrink-0 items-center gap-1.5">
                    {editing ? (
                      <>
                        <button onClick={() => saveAddon(addon.id)} disabled={savingAddon} className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                          {savingAddon ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
                        </button>
                        <button onClick={() => setEditingAddon(null)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleAddonActive(addon)}
                          title={addon.active ? "Desativar add-on" : "Ativar add-on"}
                          className={`rounded-lg p-1.5 transition ${addon.active ? "text-green-600 hover:bg-red-50 hover:text-red-500" : "text-ink-400 hover:bg-green-50 hover:text-green-600"}`}
                        >
                          {addon.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => { setEditingAddon(addon.id); setAddonDraft({ name: addon.name, description: addon.description ?? "", price: addon.price }); }}
                          className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
