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

// true = owner or manager (analytics, catalog, storefront, QR, profile)
// false = cashier / waiter / chef (POS only)
// null (loading) → default true to avoid flash
export function useIsOwner(): boolean {
  const role = useRole();
  return role !== "cashier" && role !== "waiter" && role !== "chef";
}

// true = owner only (profit overview, staff management, payment banks)
// null (loading) → default true to avoid flash
export function useIsStrictOwner(): boolean {
  const role = useRole();
  return role === "owner" || role === null;
}
