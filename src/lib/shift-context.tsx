"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useRole } from "./role-context";

type ShiftData = { id: string; opened_at: string } | null;

type ShiftCtx = {
  shift: ShiftData;
  isLoading: boolean;
  openShift: () => Promise<void>;
  closeShift: () => Promise<void>;
};

const ShiftContext = createContext<ShiftCtx>({
  shift: null,
  isLoading: true,
  openShift: async () => {},
  closeShift: async () => {},
});

export function useShift() {
  return useContext(ShiftContext);
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  // undefined = still fetching, null = no open shift, object = open shift
  const [shift, setShift] = useState<ShiftData | undefined>(undefined);

  useEffect(() => {
    fetch("/api/admin/shift")
      .then((r) => r.json())
      .then((d) => setShift(d.shift ?? null))
      .catch(() => setShift(null));
  }, []);

  async function openShift() {
    const r = await fetch("/api/admin/shift", { method: "POST" });
    const d = await r.json();
    if (d.shift) setShift(d.shift);
  }

  async function closeShift() {
    await fetch("/api/admin/shift", { method: "DELETE" });
    setShift(null);
  }

  return (
    <ShiftContext.Provider
      value={{
        shift: shift ?? null,
        isLoading: shift === undefined,
        openShift,
        closeShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

// Full-screen gate — blocks non-owners when shift is closed
export function ShiftGate({ children }: { children: ReactNode }) {
  const { shift, isLoading, openShift } = useShift();
  const role = useRole();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  // Owner always passes through
  if (role === "owner") return <>{children}</>;

  // Waiting for role + shift to load
  if (role === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Shift is open — let through
  if (shift) return <>{children}</>;

  // Shift is closed — show wall
  async function handleOpen() {
    setOpening(true);
    await openShift();
    setOpening(false);
  }

  async function handleSignOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-xs text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
          <Lock size={28} className="text-zinc-400 dark:text-zinc-500" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Смена закрыта
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Откройте смену, чтобы начать работу
          </p>
        </div>

        <button
          onClick={handleOpen}
          disabled={opening}
          className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {opening ? "Открываем…" : "Открыть смену"}
        </button>

        <button
          onClick={handleSignOut}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
