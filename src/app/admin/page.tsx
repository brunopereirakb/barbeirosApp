"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Scissors, LogOut, LayoutDashboard, Users, Package } from "lucide-react";
import { ResumoTab } from "./_components/ResumoTab";
import { UtilizadoresTab } from "./_components/UtilizadoresTab";
import { PlanosTab } from "./_components/PlanosTab";
import type { UserRow, AddonDef, PlanDef } from "./_types";

type Tab = "resumo" | "utilizadores" | "planos";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "resumo", label: "Resumo", icon: LayoutDashboard },
  { id: "utilizadores", label: "Utilizadores", icon: Users },
  { id: "planos", label: "Planos & Add-ons", icon: Package },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("resumo");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addonDefs, setAddonDefs] = useState<AddonDef[]>([]);
  const [planDefs, setPlanDefs] = useState<PlanDef[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [u, a, p] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/addons").then((r) => r.json()),
      fetch("/api/admin/plans").then((r) => r.json()),
    ]);
    setUsers(u);
    setAddonDefs(a);
    setPlanDefs(p);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-card px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Scissors size={16} />
          </div>
          <span className="font-semibold text-ink-900">Administração</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={15} /> Terminar sessão
        </button>
      </header>

      {/* Tab nav */}
      <nav className="border-b border-ink-200 bg-card px-6">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === id
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {tab === "resumo" && <ResumoTab users={users} addonDefs={addonDefs} planDefs={planDefs} />}
            {tab === "utilizadores" && <UtilizadoresTab users={users} addonDefs={addonDefs} onRefresh={fetchData} />}
            {tab === "planos" && <PlanosTab />}
          </>
        )}
      </main>
    </div>
  );
}
