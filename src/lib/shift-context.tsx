"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ShiftData = { id: string; opened_at: string } | null;

export type CloseShiftResult =
  | { blocked: true; tables: string[] }
  | { blocked: false; whatsappUrl?: string; noWhatsappSet?: boolean };

type ShiftCtx = {
  shift: ShiftData;
  isLoading: boolean;
  qrCheckinEnabled: boolean;
  openShift: () => Promise<boolean>;
  closeShift: () => Promise<CloseShiftResult>;
};

const ShiftContext = createContext<ShiftCtx>({
  shift: null,
  isLoading: true,
  qrCheckinEnabled: true,
  openShift: async () => false,
  closeShift: async () => ({ blocked: false }),
});

export function useShift() {
  return useContext(ShiftContext);
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [shift, setShift] = useState<ShiftData | undefined>(undefined);
  const [qrCheckinEnabled, setQrCheckinEnabled] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/admin/shift")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setShift(d?.shift ?? null);
        setQrCheckinEnabled(d?.qrCheckinEnabled ?? true);
      })
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
        qrCheckinEnabled,
        openShift,
        closeShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

// Shift gate disabled — passes through unconditionally
export function ShiftGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Checkin gate disabled — passes through unconditionally
export function CheckinGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
