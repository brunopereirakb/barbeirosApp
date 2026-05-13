"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

export function DayNoteCard({ date }: { date: Date }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSaved = useRef<string>("");

  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/day-notes?date=${date.toISOString()}`)
      .then((r) => (r.ok ? r.json() : { text: "" }))
      .catch(() => ({ text: "" }))
      .then((data: { text: string }) => {
        setText(data.text || "");
        lastSaved.current = data.text || "";
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  useEffect(() => {
    if (!loaded) return;
    if (text === lastSaved.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/day-notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: date.toISOString(), text }),
        });
        lastSaved.current = text;
        setSavedTick((t) => t + 1);
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, loaded]);

  return (
    <div className="rounded-lg border border-ink-200 bg-card p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-500">
          <Pencil size={11} /> Notas do dia
        </span>
        <span className="text-[10px] text-ink-400">
          {!loaded ? "" : saving ? "a guardar…" : savedTick > 0 ? "guardado ✓" : ""}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Notas para este dia (ex. fechar mais cedo, formação, etc.)"
        className="h-24 w-full resize-none rounded border border-ink-200 bg-card px-2 py-1.5 text-xs text-ink-800 outline-none transition focus:border-brand-400"
      />
    </div>
  );
}
