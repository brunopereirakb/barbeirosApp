"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark") return v;
  return "system";
}

export function effectiveDark(theme: Theme): boolean {
  if (typeof window === "undefined") return false;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", effectiveDark(theme));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  // Re-apply when the OS preference changes while "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    if (t === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  return { theme, setTheme };
}

// Inline script body — runs synchronously in <head> before paint to avoid a
// flash of the wrong theme. Plain string so we can pass it to dangerouslySet…
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var v = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = v === 'dark' || (v !== 'light' && sysDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`;
