"use client";
import { Users, Activity, Package, CalendarClock, TrendingUp, AlertTriangle, FlaskConical, TrendingDown } from "lucide-react";
import type { UserRow, AddonDef, PlanDef } from "../_types";
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_COLORS, PAYMENT_LABELS } from "../_types";

function nextBillingDate(start: string): Date {
  const day = new Date(start).getDate();
  const today = new Date();
  let next = new Date(today.getFullYear(), today.getMonth(), day);
  if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, day);
  return next;
}

function daysUntil(d: Date | string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
}

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function StatCard({ icon: Icon, label, value, sub, warn }: { icon: React.ElementType; label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${warn ? "border-orange-200" : "border-ink-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${warn ? "bg-orange-50 text-orange-500" : "bg-brand-50 text-brand-600"}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-ink-500">{label}</p>
          <p className="text-xl font-semibold text-ink-900">{value}</p>
          {sub && <p className="text-xs text-ink-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

interface Props { users: UserRow[]; addonDefs: AddonDef[]; planDefs: PlanDef[] }

export function ResumoTab({ users, addonDefs, planDefs }: Props) {
  const active = users.filter((u) => u.active && u.subscription.status === "active");
  const trials = users.filter((u) => u.subscription.status === "trial");
  const overdue = users.filter((u) => u.subscription.paymentStatus === "overdue");
  const expiringSoon = users.filter((u) => {
    const exp = u.subscription.expiresAt;
    if (!exp) return false;
    const d = daysUntil(exp);
    return d >= 0 && d <= 30;
  });

  const mrr = active.reduce((sum, u) => {
    const plan = planDefs.find((p) => p.key === u.subscription.plan);
    const addonTotal = u.subscription.addons.reduce((s, k) => s + (addonDefs.find((a) => a.key === k)?.price ?? 0), 0);
    return sum + (plan?.price ?? 0) + addonTotal;
  }, 0);
  const arr = mrr * 12;

  const expirationRate = users.length > 0
    ? Math.round((expiringSoon.length / users.length) * 100)
    : 0;

  const renewalsSoon = users.filter((u) => {
    const d = daysUntil(nextBillingDate(u.subscription.createdAt));
    return d >= 0 && d <= 30;
  }).length;

  // Status breakdown
  const statusCounts = (["active", "trial", "paused", "expired", "cancelled"] as const).map((s) => ({
    status: s,
    count: users.filter((u) => u.subscription.status === s).length,
  })).filter((s) => s.count > 0);

  const addonCounts = addonDefs.map((def) => ({
    def,
    count: users.filter((u) => u.subscription.addons.includes(def.key)).length,
  }));

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Activity} label="Utilizadores ativos" value={active.length} sub={`${users.length} total`} />
        <StatCard icon={TrendingUp} label="MRR" value={fmt(mrr)} sub="receita mensal recorrente" />
        <StatCard icon={TrendingUp} label="ARR" value={fmt(arr)} sub="receita anual estimada" />
        <StatCard icon={FlaskConical} label="Em trial" value={trials.length} sub={trials.length ? `${trials.filter((u) => u.subscription.trialEndsAt && daysUntil(u.subscription.trialEndsAt) <= 7).length} expiram em 7d` : undefined} />
        <StatCard icon={TrendingDown} label="Taxa de expiração" value={`${expirationRate}%`} sub={`${expiringSoon.length} vencem em 30 dias`} warn={expirationRate > 20} />
        <StatCard icon={AlertTriangle} label="Pagamentos em atraso" value={overdue.length} warn={overdue.length > 0} />
        <StatCard icon={CalendarClock} label="Renovações (30d)" value={renewalsSoon} />
        <StatCard icon={Package} label="Add-ons ativos" value={users.reduce((n, u) => n + u.subscription.addons.length, 0)} />
      </div>

      {/* Status breakdown */}
      {statusCounts.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-ink-900">Estado das subscrições</h2>
          <div className="flex flex-wrap gap-2">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${STATUS_COLORS[status]}`}>
                <span>{STATUS_LABELS[status]}</span>
                <span className="rounded-full bg-white/60 px-1.5 text-xs font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerts */}
      {(overdue.length > 0 || expiringSoon.length > 0 || trials.filter((u) => u.subscription.trialEndsAt && daysUntil(u.subscription.trialEndsAt) <= 7).length > 0) && (
        <section>
          <h2 className="mb-3 font-semibold text-ink-900">Alertas</h2>
          <div className="space-y-2">
            {overdue.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span><span className="font-medium">{u.name}</span> — pagamento em atraso</span>
              </div>
            ))}
            {expiringSoon.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                <CalendarClock size={16} className="shrink-0 text-orange-500" />
                <span><span className="font-medium">{u.name}</span> — subscrição expira em {daysUntil(u.subscription.expiresAt!)} dia(s) ({new Date(u.subscription.expiresAt!).toLocaleDateString("pt-PT")})</span>
              </div>
            ))}
            {trials.filter((u) => u.subscription.trialEndsAt && daysUntil(u.subscription.trialEndsAt) <= 7).map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <FlaskConical size={16} className="shrink-0 text-blue-500" />
                <span><span className="font-medium">{u.name}</span> — trial expira em {daysUntil(u.subscription.trialEndsAt!)} dia(s)</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Billing table */}
      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Faturação por cliente</h2>
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Add-ons</th>
                <th className="px-4 py-3 font-medium">Mensal</th>
                <th className="px-4 py-3 font-medium">Renovação</th>
                <th className="px-4 py-3 font-medium">Expira</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400">Nenhum utilizador.</td></tr>
              )}
              {users.map((user) => {
                const billing = nextBillingDate(user.subscription.createdAt);
                const days = daysUntil(billing);
                const planDef = planDefs.find((p) => p.key === user.subscription.plan);
                const addonTotal = user.subscription.addons.reduce((s, k) => s + (addonDefs.find((a) => a.key === k)?.price ?? 0), 0);
                const monthly = (planDef?.price ?? 0) + addonTotal;
                return (
                  <tr key={user.id} className={`hover:bg-ink-50 ${!user.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{user.name}</p>
                      <p className="text-xs text-ink-400">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {planDef?.name ?? user.subscription.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600">
                      {user.subscription.addons.length === 0
                        ? <span className="text-ink-400">—</span>
                        : user.subscription.addons.map((k) => addonDefs.find((a) => a.key === k)?.name ?? k).join(", ")}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-800">{fmt(monthly)}</td>
                    <td className="px-4 py-3 text-xs">
                      <p className="text-ink-700">{billing.toLocaleDateString("pt-PT")}</p>
                      <p className={days <= 7 ? "font-medium text-orange-500" : "text-ink-400"}>em {days}d</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {user.subscription.expiresAt
                        ? <span className={daysUntil(user.subscription.expiresAt) <= 30 ? "font-medium text-orange-500" : ""}>{new Date(user.subscription.expiresAt).toLocaleDateString("pt-PT")}</span>
                        : <span className="text-ink-300">Auto</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[user.subscription.status]}`}>
                        {STATUS_LABELS[user.subscription.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLORS[user.subscription.paymentStatus]}`}>
                        {PAYMENT_LABELS[user.subscription.paymentStatus]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add-on breakdown */}
      {addonDefs.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-ink-900">Add-ons em uso</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {addonCounts.map(({ def, count }) => (
              <div key={def.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-ink-800">{def.name}</p>
                <p className="mt-1 text-2xl font-semibold text-ink-900">{count}</p>
                <p className="text-xs text-ink-400">{count === 1 ? "utilizador" : "utilizadores"} · {fmt(def.price)}/mês</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
