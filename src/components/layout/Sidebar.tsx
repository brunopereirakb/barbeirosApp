"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Calendar, Users, Tag, ListChecks, MessageSquare, BarChart3,
  Settings, Scissors, ShieldCheck, Search, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

const items = [
  { href: "/calendario", icon: Calendar, label: "Calendário" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/servicos", icon: Tag, label: "Serviços" },
  { href: "/lista-espera", icon: ListChecks, label: "Lista de espera" },
  { href: "/reservas", icon: Search, label: "Pesquisar reservas" },
  { href: "/mensagens", icon: MessageSquare, label: "Mensagens" },
  { href: "/estatisticas", icon: BarChart3, label: "Estatísticas" },
  { href: "/definicoes", icon: Settings, label: "Definições" },
];

function NavItem({
  href, icon: Icon, label, active, expanded, onClick,
}: {
  href: string; icon: React.ElementType; label: string;
  active: boolean; expanded: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={expanded ? undefined : label}
      className={cn(
        "flex items-center gap-3 rounded-lg transition-colors",
        expanded ? "w-full px-3 py-2" : "h-11 w-11 justify-center",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
      )}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && <span className="truncate text-sm font-medium">{label}</span>}
    </Link>
  );
}

function SidebarContent({
  expanded, pathname, isAdmin, onNavClick,
  showToggle, onToggle,
}: {
  expanded: boolean;
  pathname: string;
  isAdmin: boolean;
  onNavClick?: () => void;
  showToggle: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <Link
        href="/calendario"
        onClick={onNavClick}
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-ink-100 py-4 transition hover:opacity-80",
          expanded ? "px-4" : "justify-center px-0"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Scissors size={18} />
        </div>
        {expanded && (
          <span className="truncate text-sm font-semibold text-ink-900">Schedule HD</span>
        )}
      </Link>

      {/* Nav items */}
      <nav className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto py-3", expanded ? "px-3" : "items-center px-2.5")}>
        {items.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            expanded={expanded}
            onClick={onNavClick}
          />
        ))}

        {isAdmin && (
          <div className="mt-auto pt-2">
            <NavItem
              href="/admin"
              icon={ShieldCheck}
              label="Administração"
              active={pathname.startsWith("/admin")}
              expanded={expanded}
              onClick={onNavClick}
            />
          </div>
        )}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {showToggle && (
        <button
          onClick={onToggle}
          className={cn(
            "flex shrink-0 items-center border-t border-ink-100 py-3 text-ink-400 transition hover:text-ink-700",
            expanded ? "justify-end px-4 gap-2 text-xs" : "justify-center px-0"
          )}
        >
          {expanded ? (
            <><span>Recolher</span><ChevronLeft size={16} /></>
          ) : (
            <ChevronRight size={16} />
          )}
        </button>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { expanded, mobileOpen, toggleExpanded, closeMobile } = useSidebar();
  const isAdmin = session?.user?.role === "admin";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-ink-200 bg-white transition-[width] duration-200 ease-in-out overflow-hidden",
        expanded ? "w-52" : "w-16"
      )}>
        <SidebarContent
          expanded={expanded}
          pathname={pathname}
          isAdmin={isAdmin}
          showToggle
          onToggle={toggleExpanded}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Menu</span>
              <button
                onClick={closeMobile}
                className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 py-3">
              {items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  expanded
                  onClick={closeMobile}
                />
              ))}
              {isAdmin && (
                <NavItem
                  href="/admin"
                  icon={ShieldCheck}
                  label="Administração"
                  active={pathname.startsWith("/admin")}
                  expanded
                  onClick={closeMobile}
                />
              )}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
