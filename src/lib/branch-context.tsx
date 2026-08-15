"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRole, useRestaurantId } from "@/lib/role-context";

export interface Branch {
  id: string;
  name: string;
  slug: string | null;
}

type BranchCtx = {
  branches: Branch[];
  selectedId: string | "all";
  setSelectedId: (id: string | "all") => void;
  isMultiBranch: boolean;
  // For queries: never returns "all" — returns primary restaurant when "all" is selected
  activeBranchRestaurantId: string | null;
};

const BranchContext = createContext<BranchCtx>({
  branches: [],
  selectedId: "",
  setSelectedId: () => {},
  isMultiBranch: false,
  activeBranchRestaurantId: null,
});

const STORAGE_KEY = "scanserve_branch";

function readCookieRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const m = document.cookie.match(/(?:^|;\s*)admin_restaurant_id=([^;]*)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const role = useRole();
  const primaryRestaurantId = useRestaurantId();
  const [branches, setBranches] = useState<Branch[]>([]);
  // Initialize selectedId from cookie immediately (same source as old RESTAURANT_ID constant)
  const [selectedId, setSelectedIdState] = useState<string | "all">(() => readCookieRestaurantId() ?? "");

  useEffect(() => {
    if (role !== "owner" || !primaryRestaurantId) return;

    const saved = sessionStorage.getItem(STORAGE_KEY);
    setSelectedIdState(saved ?? primaryRestaurantId);

    fetch("/api/admin/owner/branches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { branches?: Branch[] } | null) => {
        if (!d?.branches?.length) return;
        setBranches(d.branches);
        // If saved branch is stale (not in list), reset to primary
        if (saved && saved !== "all" && !d.branches.find((b) => b.id === saved)) {
          setSelectedIdState(primaryRestaurantId);
          sessionStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {});
  }, [role, primaryRestaurantId]);

  function setSelectedId(id: string | "all") {
    setSelectedIdState(id);
    sessionStorage.setItem(STORAGE_KEY, id);
    // Keep cookie in sync so API routes (which read admin_restaurant_id cookie) also see the new branch
    const cookieRid = (id === "all" || !id) ? primaryRestaurantId : id;
    if (cookieRid && typeof document !== "undefined") {
      document.cookie = `admin_restaurant_id=${encodeURIComponent(cookieRid)}; path=/; SameSite=Lax`;
    }
  }

  const isMultiBranch = branches.length > 1;

  const activeBranchRestaurantId =
    !selectedId || selectedId === "all" ? primaryRestaurantId : selectedId;

  return (
    <BranchContext.Provider
      value={{ branches, selectedId, setSelectedId, isMultiBranch, activeBranchRestaurantId }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchCtx {
  return useContext(BranchContext);
}

export function useBranchRestaurantId(): string | null {
  return useContext(BranchContext).activeBranchRestaurantId;
}

export function useIsAllBranches(): boolean {
  return useContext(BranchContext).selectedId === "all";
}
