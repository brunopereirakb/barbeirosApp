"use client";
import { useEffect, useState } from "react";
import { Users, Calendar, AlertTriangle, Heart } from "lucide-react";

export default function StatsPage() {
  const [stats, setStats] = useState<{
    totalClients: number;
    appointmentsThisWeek: number;
    appointmentsThisMonth: number;
    noShowRate: number;
    newClientsThisMonth: number;
    upcomingBirthdays: { id: string; name: string; date: string }[];
  } | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      const [clients, appts] = await Promise.all([
        fetch("/api/clients").then((r) => r.json()),
        fetch(
          `/api/appointments?dateFrom=${dayStart.toISOString()}&dateTo=${dayEnd.toISOString()}`
        ).then((r) => r.json()),
      ]);

      const now = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      // Para já: stats simples baseadas no que conseguimos calcular client-side
      // Em produção isto seria um endpoint dedicado /api/stats
      const newClientsThisMonth = clients.filter((c: { customerSince: string }) =>
        new Date(c.customerSince) > monthAgo
      ).length;

      const upcomingBirthdays = clients
        .filter((c: { birthday: string | null }) => c.birthday)
        .map((c: { id: string; name: string; birthday: string }) => {
          const b = new Date(c.birthday);
          const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
          if (next < now) next.setFullYear(now.getFullYear() + 1);
          const days = Math.floor((next.getTime() - now.getTime()) / 86400000);
          return { id: c.id, name: c.name, date: next.toLocaleDateString("pt-PT", { day: "numeric", month: "long" }), days };
        })
        .filter((b: { days: number }) => b.days <= 30)
        .sort((a: { days: number }, b: { days: number }) => a.days - b.days)
        .slice(0, 5);

      setStats({
        totalClients: clients.length,
        appointmentsThisWeek: appts.length, // só hoje aqui — endpoint dedicado seria melhor
        appointmentsThisMonth: appts.length,
        noShowRate: 0,
        newClientsThisMonth,
        upcomingBirthdays,
      });
    }
    void load();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-card px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Estatísticas</h1>
      </div>

      <div className="p-5">
        {!stats ? (
          <div className="text-sm text-ink-500">A carregar...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <BigStat icon={Users} value={stats.totalClients} label="Clientes totais" />
              <BigStat icon={Calendar} value={stats.appointmentsThisWeek} label="Marcações hoje" />
              <BigStat icon={Heart} value={stats.newClientsThisMonth} label="Novos clientes (mês)" />
              <BigStat icon={AlertTriangle} value={`${stats.noShowRate}%`} label="Taxa não-veio" />
            </div>

            {stats.upcomingBirthdays.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-ink-700">Próximos aniversários (30 dias)</h2>
                <div className="space-y-1.5">
                  {stats.upcomingBirthdays.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-md border border-ink-200 bg-card px-3 py-2">
                      <span className="text-sm text-ink-800">{b.name}</span>
                      <span className="text-xs text-ink-500">{b.date}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="rounded-md border border-ink-200 bg-ink-50 p-4 text-xs text-ink-600">
              <strong>Estatísticas mais detalhadas em desenvolvimento</strong> — gráficos de evolução semanal/mensal,
              clientes mais frequentes, serviços mais procurados, picos de horários, etc.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, value, label }: { icon: React.ElementType; value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-card p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <Icon size={18} />
      </div>
      <div className="text-2xl font-medium text-ink-900">{value}</div>
      <div className="mt-0.5 text-xs text-ink-500">{label}</div>
    </div>
  );
}
