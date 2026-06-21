"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Lock, Clock, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "./role-context";
import { useCheckin } from "./checkin-context";
import dynamic from "next/dynamic";

const QrScannerModal = dynamic(() => import("@/components/admin/QrScannerModal"), { ssr: false });

type ShiftData = { id: string; opened_at: string } | null;

export type CloseShiftResult =
  | { blocked: true; tables: string[] }
  | { blocked: false; whatsappUrl?: string; noWhatsappSet?: boolean };

type ShiftCtx = {
  shift: ShiftData;
  isLoading: boolean;
  openShift: () => Promise<boolean>;
  closeShift: () => Promise<CloseShiftResult>;
};

const ShiftContext = createContext<ShiftCtx>({
  shift: null,
  isLoading: true,
  openShift: async () => false,
  closeShift: async () => ({ blocked: false }),
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

  async function closeShift(): Promise<CloseShiftResult> {
    const currentShift = shift;
    const r = await fetch("/api/admin/shift", { method: "DELETE" });
    if (r.status === 409) {
      const d = await r.json();
      return { blocked: true, tables: (d.tables as string[]) ?? [] };
    }
    if (!r.ok) return { blocked: false };

    setShift(null);

    if (!currentShift) return { blocked: false };

    try {
      const rep = await fetch(`/api/admin/shift/report?shiftId=${currentShift.id}`);
      if (!rep.ok) return { blocked: false };

      const data = await rep.json() as {
        reportWhatsapp: string | null;
        revenue: number;
        cash: number;
        kaspi: number;
        card: number;
        ordersCount: number;
        openedAt: string;
        closedAt: string | null;
      };

      if (!data.reportWhatsapp) return { blocked: false, noWhatsappSet: true };

      const fmt = (n: number) => n.toLocaleString("ru-RU");
      const fmtTime = (iso: string) => {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      };
      const dateStr = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      const openedAt = fmtTime(data.openedAt);
      const closedAt = data.closedAt ? fmtTime(data.closedAt) : fmtTime(new Date().toISOString());
      const avgCheck = data.ordersCount > 0 ? Math.round(data.revenue / data.ordersCount) : 0;

      const lines = [
        `📊 Отчёт смены — ${dateStr}`,
        `⏰ Смена: ${openedAt} – ${closedAt}`,
        "",
        `💰 Выручка: ${fmt(data.revenue)} ₸`,
        `📋 Чеков: ${data.ordersCount}`,
        `📊 Средний чек: ${fmt(avgCheck)} ₸`,
        "",
        `💵 Наличные: ${fmt(data.cash)} ₸`,
        `📱 Kaspi/QR: ${fmt(data.kaspi)} ₸`,
        `💳 Карта: ${fmt(data.card)} ₸`,
      ];

      const url = `https://api.whatsapp.com/send?phone=${data.reportWhatsapp}&text=${encodeURIComponent(lines.join("\n"))}`;
      return { blocked: false, whatsappUrl: url };
    } catch {
      return { blocked: false };
    }
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
    router.replace("/app/login");
  }

  // Manager and cashier can open the shift
  if (role === "manager" || role === "cashier") {
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

// Blocks waiter / chef until they scan the entrance QR
export function CheckinGate({ children }: { children: ReactNode }) {
  const role = useRole();
  const { isCheckedIn, isLoading, checkin } = useCheckin();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pending documents state
  const [pendingDocs, setPendingDocs] = useState<{ id: string; title: string; signToken: string | null }[] | null>(null);
  const [docsLoading, setDocsLoading] = useState(true);

  const NON_GATED = new Set(["owner", "manager", "cashier"]);
  const isGated = role !== null && !NON_GATED.has(role);

  useEffect(() => {
    if (!isGated) { setDocsLoading(false); return; }
    fetch("/api/admin/documents/my-pending")
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d: { docs?: { id: string; title: string; signToken: string | null }[] }) =>
        setPendingDocs(d.docs ?? []),
      )
      .catch(() => setPendingDocs([]))
      .finally(() => setDocsLoading(false));
  }, [isGated]);

  if (role === null || NON_GATED.has(role)) {
    return <>{children}</>;
  }

  if (isLoading || docsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Block access if there are unsigned required documents
  if (pendingDocs && pendingDocs.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-xs text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto">
            <Lock size={28} className="text-red-500 dark:text-red-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Доступ заблокирован
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Сначала подпишите обязательные документы, затем вернитесь для отметки прихода
            </p>
          </div>

          <div className="text-left space-y-2">
            {pendingDocs.map((doc) => (
              <a
                key={doc.id}
                href={doc.signToken ? `/shared/sign/${doc.signToken}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  doc.signToken
                    ? "border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 cursor-not-allowed"
                }`}
              >
                <span className="flex-1 truncate">{doc.title}</span>
                {doc.signToken && <span className="shrink-0 text-xs">→ Подписать</span>}
              </a>
            ))}
          </div>

          <p className="text-xs text-zinc-400">
            После подписания всех документов обновите эту страницу
          </p>
        </div>
      </div>
    );
  }

  if (isCheckedIn) return <>{children}</>;

  async function handleScan(token: string) {
    setScanning(false);
    setBusy(true);
    const result = await checkin(token);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Неверный QR-код");
    }
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-xs text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center mx-auto">
            <QrCode size={28} className="text-violet-600 dark:text-violet-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Отметьтесь на входе
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Отсканируйте QR-код у входа, чтобы начать работу
            </p>
          </div>

          <button
            onClick={() => setScanning(true)}
            disabled={busy}
            className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {busy ? "Проверяем…" : "Отсканировать QR у входа"}
          </button>
        </div>
      </div>

      {scanning && (
        <QrScannerModal
          title="Отметка прихода"
          hint="Наведите камеру на QR-код у входа в заведение"
          onScan={handleScan}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  );
}
