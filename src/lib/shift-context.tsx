"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "./role-context";

type ShiftData = { id: string; opened_at: string } | null;

type ShiftCtx = {
  shift: ShiftData;
  isLoading: boolean;
  openShift: () => Promise<boolean>;
  closeShift: () => Promise<void>;
};

const ShiftContext = createContext<ShiftCtx>({
  shift: null,
  isLoading: true,
  openShift: async () => false,
  closeShift: async () => {},
});

export function useShift() {
  return useContext(ShiftContext);
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [shift, setShift] = useState<ShiftData | undefined>(undefined);

  useEffect(() => {
    fetch("/api/admin/shift")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setShift(d?.shift ?? null))
      .catch(() => setShift(null));
  }, []);

  async function openShift(): Promise<boolean> {
    try {
      const r = await fetch("/api/admin/shift", { method: "POST" });
      const d = r.ok ? await r.json() : null;
      if (d?.shift) {
        setShift(d.shift);
        return true;
      }
      return false;
    } catch {
      return false;
    }
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

  // Owner always passes through without a shift check
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

  async function handleSignOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  // Manager can open the shift
  if (role === "manager") {
    async function handleOpen() {
      setOpening(true);
      const ok = await openShift();
      if (ok) {
        toast.success("Смена открыта");
      } else {
        toast.error("Не удалось открыть смену — попробуйте ещё раз");
      }
      setOpening(false);
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-xs text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
            <Clock size={28} className="text-violet-500" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Смена не открыта
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Откройте смену, чтобы сотрудники смогли начать работу
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

  // Waiter / cashier / chef — cannot open a shift, must wait for manager
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
            Обратитесь к менеджеру для открытия смены
          </p>
        </div>

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
