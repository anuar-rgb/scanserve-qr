"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRole } from "./role-context";
import { useShift } from "./shift-context";

type CheckinState =
  | { checked: true; at: string }
  | { checked: false; at: null };

type CheckinCtx = {
  isCheckedIn: boolean;
  checkedInAt: string | null;
  isLoading: boolean;
  checkin: (qrToken: string) => Promise<{ ok: boolean; error?: string }>;
  checkout: (qrToken: string) => Promise<{ ok: boolean; error?: string }>;
};

const CheckinContext = createContext<CheckinCtx>({
  isCheckedIn: false,
  checkedInAt: null,
  isLoading: true,
  checkin: async () => ({ ok: false }),
  checkout: async () => ({ ok: false }),
});

export function useCheckin() {
  return useContext(CheckinContext);
}

// Roles that must scan QR to start/end their work session
const GATED_ROLES = new Set([
  "waiter", "chef", "bartender", "hostess", "courier", "cleaner",
  "doorman", "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
]);

export function CheckinProvider({ children }: { children: ReactNode }) {
  const role = useRole();
  const { shift } = useShift();
  const isGated = role !== null && GATED_ROLES.has(role);

  const [state, setState] = useState<CheckinState | undefined>(undefined);

  const load = useCallback(() => {
    if (!isGated || !shift) {
      setState({ checked: false, at: null });
      return;
    }
    fetch("/api/admin/shift/my-checkin")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const c = d?.checkin as { checked_in_at: string; checked_out_at: string | null } | null;
        if (c && c.checked_in_at && !c.checked_out_at) {
          setState({ checked: true, at: c.checked_in_at });
        } else {
          setState({ checked: false, at: null });
        }
      })
      .catch(() => setState({ checked: false, at: null }));
  }, [isGated, shift?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function checkin(qrToken: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch("/api/admin/shift/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken }),
    });
    if (r.ok) {
      const d = await r.json() as { checkin?: { checked_in_at: string } };
      setState({ checked: true, at: d.checkin?.checked_in_at ?? new Date().toISOString() });
      return { ok: true };
    }
    const d = await r.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: d.error ?? "Ошибка входа" };
  }

  async function checkout(qrToken: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch("/api/admin/shift/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken }),
    });
    if (r.ok) {
      setState({ checked: false, at: null });
      return { ok: true };
    }
    const d = await r.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: d.error ?? "Ошибка выхода" };
  }

  return (
    <CheckinContext.Provider
      value={{
        isCheckedIn: state?.checked ?? false,
        checkedInAt: state?.at ?? null,
        isLoading: state === undefined,
        checkin,
        checkout,
      }}
    >
      {children}
    </CheckinContext.Provider>
  );
}
