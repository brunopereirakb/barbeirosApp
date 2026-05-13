"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, ChevronDown, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSidebar } from "./SidebarContext";

const PAGE_TITLES: Record<string, string> = {
  "/calendario": "Calendário",
  "/clientes": "Clientes",
  "/servicos": "Serviços",
  "/lista-espera": "Lista de espera",
  "/reservas": "Pesquisar reservas",
  "/mensagens": "Mensagens",
  "/estatisticas": "Estatísticas",
  "/definicoes": "Definições",
};

function getTitle(pathname: string): string {
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return label;
  }
  return "Schedule Hairdresser";
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { toggleMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  const name = session?.user?.name ?? "";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobile}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-sm font-semibold text-ink-900">{getTitle(pathname)}</h1>
      </div>

      {/* User dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-700 transition hover:bg-ink-100"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(name)}
          </div>
          <span className="hidden sm:block max-w-[140px] truncate">{name}</span>
          <ChevronDown size={14} className="text-ink-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-ink-200 bg-white py-1 shadow-lg">
            <div className="border-b border-ink-100 px-3 py-2">
              <p className="truncate text-xs font-medium text-ink-800">{name}</p>
              <p className="truncate text-xs text-ink-400">{session?.user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} />
              Terminar sessão
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
