"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dashboard:leftWidth";
const MIN_WIDTH = 240;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 380;

/**
 * Two-column split with a draggable vertical divider. Persists the chosen
 * width to localStorage so it survives page reloads. On screens narrower than
 * the `md` Tailwind breakpoint (768px) we stack vertically and hide the
 * divider — the resize handle isn't useful on phones.
 */
export function ResizableSplit({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [leftWidth, setLeftWidth] = useState<number>(DEFAULT_WIDTH);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hover, setHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Restore saved width + watch for breakpoint changes
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const n = stored ? Number(stored) : NaN;
    if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) {
      setLeftWidth(n);
    }

    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - rect.left));
    setLeftWidth(next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.localStorage.setItem(STORAGE_KEY, String(leftWidth));
    },
    [leftWidth]
  );

  const onDoubleClick = useCallback(() => {
    setLeftWidth(DEFAULT_WIDTH);
    window.localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
  }, []);

  // Only pin a width on desktop; on mobile let the aside flow full-width.
  const leftStyle = isDesktop ? { width: leftWidth } : undefined;

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <aside
        className="flex shrink-0 flex-col gap-3 overflow-y-auto border-b border-ink-200 bg-ink-50/60 p-3 md:border-b-0 md:border-r"
        style={leftStyle}
      >
        {left}
      </aside>

      {/* Drag handle — desktop/tablet only */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Arrastar para redimensionar · duplo-clique para repor"
        className="hidden shrink-0 cursor-col-resize touch-none select-none items-center justify-center md:flex"
        style={{ width: 8, marginLeft: -1, marginRight: -1 }}
      >
        <span
          className={`block h-10 w-1 rounded-full transition ${
            hover || draggingRef.current ? "bg-brand-400" : "bg-ink-300"
          }`}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{right}</main>
    </div>
  );
}
