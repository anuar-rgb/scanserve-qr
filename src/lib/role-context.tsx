"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AdminRole = "owner" | "admin" | null;

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

export function useIsOwner(): boolean {
  const role = useRole();
  // null means still loading — default to showing everything (falls back once loaded)
  return role !== "admin";
}
