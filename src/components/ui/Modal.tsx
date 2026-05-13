"use client";
import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Mobile keyboard fix: when the user focuses any input/textarea/select inside
  // the modal, scroll it to the center of the visible viewport. Combined with
  // `scroll-margin-block` on form fields, this keeps the active field readable
  // even when the on-screen keyboard covers half the screen.
  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;

    function isFormField(el: EventTarget | null): el is HTMLElement {
      if (!(el instanceof HTMLElement)) return false;
      const t = el.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
    }

    function onFocusIn(e: FocusEvent) {
      if (!isFormField(e.target)) return;
      // Defer to next frame so the virtual keyboard's viewport change settles.
      setTimeout(() => {
        e.target instanceof HTMLElement &&
          e.target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 150);
    }

    body.addEventListener("focusin", onFocusIn);
    return () => body.removeEventListener("focusin", onFocusIn);
  }, [open]);

  if (!open) return null;

  return (
    <div
      // items-start on mobile so the modal top stays visible when the keyboard
      // opens; centered on sm+ where there's room. `100dvh` is the dynamic
      // viewport height that shrinks with the keyboard on iOS/Android.
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      style={{ height: "100dvh" }}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full flex-col bg-card shadow-2xl sm:rounded-xl",
          // Full-bleed on mobile so we get every pixel; max sizes kick in on sm+.
          "h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-4xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-ink-200 px-5 py-3">
            <h2 className="text-base font-medium text-ink-800">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-100"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto overscroll-contain p-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
