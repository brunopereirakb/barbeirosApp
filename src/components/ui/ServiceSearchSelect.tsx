"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; durationMin: number };

/**
 * Searchable service picker. Drop-in replacement for a `<select>` over the
 * service list — shows the current pick as a chip-like button and opens an
 * inline popover with a search field, sized for many services. Used in
 * /definições wherever the user has to pick a service.
 *
 * When `allowEmpty` is true an explicit "— sem serviço —" row appears at the
 * top of the popover; otherwise picking is required.
 */
export function ServiceSearchSelect({
  services,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "— sem serviço —",
  placeholder = "Escolher serviço",
  className,
  disabled = false,
}: {
  services: Service[];
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  const current = services.find((s) => s.id === value);
  const label = current
    ? `${current.name} (${current.durationMin} min)`
    : allowEmpty && !value
      ? emptyLabel
      : placeholder;

  const filtered = services.filter((s) => {
    if (!query.trim()) return true;
    return s.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md border px-3 py-2 text-left text-sm transition",
          disabled
            ? "cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400"
            : "border-ink-300 bg-card text-ink-800 hover:border-ink-400",
          !current && allowEmpty && !disabled && "text-ink-400"
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown size={13} className={cn("shrink-0 text-ink-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-ink-200 bg-card shadow-lg"
        >
          <div className="border-b border-ink-100 p-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar serviço…"
                className="w-full rounded-md border border-ink-200 bg-card py-1.5 pl-7 pr-2 text-sm outline-none focus:border-brand-400"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {allowEmpty && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-ink-50",
                    !value && "bg-brand-50/60"
                  )}
                >
                  <X size={13} className="text-ink-400" />
                  <span className="flex-1 text-ink-600">{emptyLabel}</span>
                  {!value && <Check size={13} className="text-brand-600" />}
                </button>
                <div className="border-t border-ink-100" />
              </>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-ink-400">Nenhum serviço encontrado</p>
            ) : (
              filtered.map((s) => {
                const isSel = value === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-ink-50",
                      isSel && "bg-brand-50/60"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-ink-800">{s.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-500">
                      {s.durationMin} min
                    </span>
                    {isSel && <Check size={13} className="shrink-0 text-brand-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
