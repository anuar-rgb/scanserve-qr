"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AdminRole = "owner" | "manager" | "cashier" | "waiter" | "chef" | null;

const RoleContext = createContext<AdminRole>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.role) setRole(d.role as AdminRole); })
      .catch(() => {});
  }, []);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): AdminRole {
  return useContext(RoleContext);
}

// true  = owner or manager (sees analytics + full sidebar)
// false = cashier / waiter / chef (POS only)
// null  = still loading → default true to avoid flash of hidden content
export function useIsOwner(): boolean {
  const role = useRole();
  return role !== "cashier" && role !== "waiter" && role !== "chef";
}
