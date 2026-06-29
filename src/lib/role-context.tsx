"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AdminRole =
  | "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "chef"
  | "bartender" | "hostess" | "courier" | "cleaner" | "doorman"
  | "sommelier" | "senior_waiter" | "runner" | "storekeeper" | "accountant"
  | null;

export type PlanId = "starter" | "standard" | "annual" | null;

type RoleCtx = { role: AdminRole; id: string | null; displayName: string | null; restaurantId: string | null; planId: PlanId };

const RoleContext = createContext<RoleCtx>({ role: null, id: null, displayName: null, restaurantId: null, planId: null });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole]               = useState<AdminRole>(null);
  const [id, setId]                   = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [planId, setPlanId]           = useState<PlanId>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role)          setRole(d.role as AdminRole);
        if (d?.id)            setId(d.id as string);
        if (d?.display_name)  setDisplayName(d.display_name as string);
        if (d?.restaurant_id) setRestaurantId(d.restaurant_id as string);
        if (d?.plan_id)       setPlanId(d.plan_id as PlanId);
      })
      .catch(() => {});
  }, []);

  return <RoleContext.Provider value={{ role, id, displayName, restaurantId, planId }}>{children}</RoleContext.Provider>;
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

export function useRestaurantId(): string | null {
  return useContext(RoleContext).restaurantId;
}

export function usePlanId(): PlanId {
  return useContext(RoleContext).planId;
}

const OWNER_ROLES = new Set(["owner", "manager", "supervisor"]);

export function useIsOwner(): boolean {
  const role = useRole();
  if (role === null) return true;
  return OWNER_ROLES.has(role);
}

export function useIsStrictOwner(): boolean {
  const role = useRole();
  return role === "owner" || role === null;
}

const STANDARD_FEATURES = new Set(["crm", "promotions", "bonuses"]);

export function useFeatureLocked(feature: string): boolean {
  const planId = usePlanId();
  if (planId === null) return false;
  if (planId === "standard" || planId === "annual") return false;
  return STANDARD_FEATURES.has(feature);
}
