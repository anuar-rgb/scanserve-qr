"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AdminRole = "owner" | "manager" | "cashier" | "waiter" | "chef" | null;

type RoleCtx = { role: AdminRole; id: string | null };

const RoleContext = createContext<RoleCtx>({ role: null, id: null });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role) setRole(d.role as AdminRole);
        if (d?.id)   setId(d.id as string);
      })
      .catch(() => {});
  }, []);

  return <RoleContext.Provider value={{ role, id }}>{children}</RoleContext.Provider>;
}

export function useRole(): AdminRole {
  return useContext(RoleContext).role;
}

export function useUserId(): string | null {
  return useContext(RoleContext).id;
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
