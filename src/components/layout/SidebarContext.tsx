"use client";
import { createContext, useContext, useState, useEffect } from "react";

interface SidebarCtx {
  expanded: boolean;
  mobileOpen: boolean;
  toggleExpanded: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const Ctx = createContext<SidebarCtx>({
  expanded: false,
  mobileOpen: false,
  toggleExpanded: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist expanded preference in localStorage (client-only)
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-expanded");
    if (stored === "true") setExpanded(true);
  }, []);

  function toggleExpanded() {
    setExpanded((v) => {
      localStorage.setItem("sidebar-expanded", String(!v));
      return !v;
    });
  }

  return (
    <Ctx.Provider value={{
      expanded,
      mobileOpen,
      toggleExpanded,
      toggleMobile: () => setMobileOpen((v) => !v),
      closeMobile: () => setMobileOpen(false),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSidebar = () => useContext(Ctx);
