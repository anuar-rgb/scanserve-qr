"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AdminRole =
  | "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "chef"
  | "bartender" | "hostess" | "courier" | "cleaner" | "doorman"
  | "sommelier" | "senior_waiter" | "runner" | "storekeeper" | "accountant"
  | null;

type RoleCtx = { role: AdminRole; id: string | null; displayName: string | null };

const RoleContext = createContext<RoleCtx>({ role: null, id: null, displayName: null });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole]               = useState<AdminRole>(null);
  const [id, setId]                   = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role)         setRole(d.role as AdminRole);
        if (d?.id)           setId(d.id as string);
        if (d?.display_name) setDisplayName(d.display_name as string);
      })
      .catch(() => {});
  }, []);

  return <RoleContext.Provider value={{ role, id, displayName }}>{children}</RoleContext.Provider>;
}

export function useRole(): AdminRole {
  return useContext(RoleContext).role;
}

export function useUserId(): string | null {
  return useContext(RoleContext).id;
}

export function useDisplayName(): string | null {
  return useContext(RoleContext).displayName;
}

const OWNER_ROLES = new Set(["owner", "manager", "supervisor"]);

// true = owner or manager (analytics, catalog, storefront, QR, profile)
// false = all other roles (POS only)
// null (loading) → default true to avoid flash
export function useIsOwner(): boolean {
  const role = useRole();
  if (role === null) return true;
  return OWNER_ROLES.has(role);
}

// true = owner only (profit overview, staff management, payment banks)
// null (loading) → default true to avoid flash
export function useIsStrictOwner(): boolean {
  const role = useRole();
  return role === "owner" || role === null;
}
