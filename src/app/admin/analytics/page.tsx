"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, ShoppingBag, CreditCard, Star, Tag, RefreshCw,
  Clock, Play, Printer, Archive, ChevronDown, X, CheckCircle2,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { LS, DbShift } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { RESTAURANT_ID } from "@/constants";

// ─── types ───────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month";

interface OrderRow {
  total_price: number;
  status: string;
  type: string;
  created_at: string;
  items_json: unknown;
}

interface ShiftOrderRow {
  id: string;
  total_price: number;
  status: string;
  type: string;
  created_at: string;
  payment_method: string | null;
  payment_details: Record<string, number> | null;
  paid_amount: number | null;
  prepayment_method: string | null;
}

type ShiftRow = DbShift;

interface ZReportData {
  totalRevenue: number;
  ordersCount: number;
  completedCount: number;
  typeRevenue: Record<string, number>;
  paymentBreakdown: Record<string, number>;
  prepayBreakdown: Record<string, number>;
  totalPrepay: number;
}

interface PromoProduct { id: string; name: LS; price: number; discount_label: string | null; }
interface Bar          { label: string; revenue: number; }
interface TopDish      { name: string; count: number; }
interface Breakdown    { label: string; count: number; pct: number; bg: string; }

// ─── static maps ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string }> = {
  pending:   { label: "Ожидает",   bg: "bg-amber-500"   },
  confirmed: { label: "Принят",    bg: "bg-blue-500"    },
  preparing: { label: "Готовится", bg: "bg-violet-500"  },
  ready:     { label: "Готов",     bg: "bg-emerald-400" },
  completed: { label: "Завершён",  bg: "bg-emerald-500" },
  cancelled: { label: "Отменён",   bg: "bg-red-500"     },
};

const TYPE_META: Record<string, { label: string; bg: string }> = {
  dine_in:  { label: "В зале",    bg: "bg-violet-500"  },
  pickup:   { label: "Самовывоз", bg: "bg-blue-500"    },
  delivery: { label: "Доставка",  bg: "bg-emerald-500" },
};

const PAYMENT_META: Record<string, { label: string; icon: string }> = {
  cash:     { label: "Наличные",         icon: "💵" },
  kaspi:    { label: "Kaspi",            icon: "🔴" },
  halyk:    { label: "Halyk",            icon: "🟢" },
  terminal: { label: "Карта (Терминал)", icon: "💳" },
};

const RU_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const PERIOD_LABEL: Record<Period, string> = { today: "Сегодня", week: "7 дней", month: "30 дней" };

// ─── helpers ─────────────────────────────────────────────────────────────────

function fromDate(p: Period): Date {
  const d = new Date();
  if (p === "today")  { d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")   { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  /* month */           d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
}

function prevFromDate(p: Period): Date {
  const d = new Date();
  if (p === "today")  { d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")   { d.setDate(d.getDate() - 13); d.setHours(0, 0, 0, 0); return d; }
  /* month */           d.setDate(d.getDate() - 59); d.setHours(0, 0, 0, 0); return d;
}

function buildBars(orders: OrderRow[], p: Period): Bar[] {
  const now = new Date();
  if (p === "today") {
    const h = now.getHours();
    const bars: Bar[] = Array.from({ length: h + 1 }, (_, i) => ({ label: `${i}:00`, revenue: 0 }));
    for (const o of orders) {
      const oh = new Date(o.created_at).getHours();
      if (oh <= h) bars[oh].revenue += o.total_price ?? 0;
    }
    return bars;
  }
  const dayCount = p === "week" ? 7 : 30;
  const todayMs = new Date(now).setHours(0, 0, 0, 0);
  const bars: Bar[] = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(todayMs);
    d.setDate(d.getDate() - (dayCount - 1 - i));
    return { label: p === "week" ? RU_DAYS[d.getDay()] : String(d.getDate()), revenue: 0 };
  });
  for (const o of orders) {
    const oMs = new Date(new Date(o.created_at).setHours(0, 0, 0, 0));
    const idx = dayCount - 1 - Math.round((todayMs - oMs.getTime()) / 86_400_000);
    if (idx >= 0 && idx < dayCount) bars[idx].revenue += o.total_price ?? 0;
  }
  return bars;
}

function buildTopDishes(orders: OrderRow[]): TopDish[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const items = o.items_json as Array<{ name?: string; qty?: number }> | null;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const n = item?.name; if (!n) continue;
      map.set(n, (map.get(n) ?? 0) + (item.qty ?? 1));
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
}

function buildBreakdown(
  orders: OrderRow[],
  key: "status" | "type",
  meta: Record<string, { label: string; bg: string }>,
): Breakdown[] {
  const map = new Map<string, number>();
  for (const o of orders) map.set(o[key] ?? "other", (map.get(o[key] ?? "other") ?? 0) + 1);
  const total = orders.length || 1;
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({
    label: meta[k]?.label ?? k,
    count,
    pct: Math.round(count / total * 100),
    bg: meta[k]?.bg ?? "bg-zinc-400",
  }));
}

function buildPaymentBreakdown(orders: ShiftOrderRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if (o.payment_details && typeof o.payment_details === "object") {
      for (const [method, amount] of Object.entries(o.payment_details)) {
        if (typeof amount === "number") map[method] = (map[method] ?? 0) + amount;
      }
    } else if (o.payment_method) {
      const remaining = (o.total_price ?? 0) - (o.paid_amount ?? 0);
      if (remaining > 0) map[o.payment_method] = (map[o.payment_method] ?? 0) + remaining;
    }
  }
  return map;
}

function buildPrepayBreakdown(orders: ShiftOrderRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if ((o.paid_amount ?? 0) > 0 && o.prepayment_method) {
      map[o.prepayment_method] = (map[o.prepayment_method] ?? 0) + (o.paid_amount ?? 0);
    }
  }
  return map;
}

function computeZReport(orders: ShiftOrderRow[]): ZReportData {
  const completedOrders = orders.filter(o => o.status === "completed");
  const totalRevenue = completedOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const typeRevenue: Record<string, number> = {};
  for (const o of completedOrders) {
    typeRevenue[o.type] = (typeRevenue[o.type] ?? 0) + (o.total_price ?? 0);
  }
  const paymentBreakdown = buildPaymentBreakdown(orders);
  const prepayBreakdown  = buildPrepayBreakdown(orders);
  const totalPrepay      = Object.values(prepayBreakdown).reduce((s, v) => s + v, 0);
  return { totalRevenue, ordersCount: orders.length, completedCount: completedOrders.length,
    typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay };
}

function formatShiftDuration(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function openPrintWindow(shift: ShiftRow, data: ZReportData) {
  const { totalRevenue, ordersCount, completedCount, typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay } = data;
  const closedTime = shift.closed_at ? fmtTime(shift.closed_at) : fmtTime(new Date().toISOString());
  const row = (l: string, v: string) =>
    `<div style="display:flex;justify-content:space-between;margin:3px 0"><span>${l}</span><strong>${v}</strong></div>`;
  const sep = `<hr style="border:none;border-top:1px dashed #999;margin:10px 0">`;

  const html = [
    `<div style="text-align:center;padding-bottom:10px;border-bottom:2px solid #000">`,
    `<h2 style="margin:0;letter-spacing:2px">Z-ОТЧЁТ</h2>`,
    `<p style="margin:4px 0;font-size:13px">${fmtDate(shift.opened_at)}</p>`,
    `<p style="margin:0;font-size:13px">${fmtTime(shift.opened_at)} — ${closedTime}</p>`,
    `</div>`,
    sep,
    `<div style="text-align:center;margin:10px 0">`,
    `<div style="font-size:11px;color:#666">ОБЩАЯ ВЫРУЧКА</div>`,
    `<div style="font-size:24px;font-weight:bold">${totalRevenue.toLocaleString("ru-RU")} ₸</div>`,
    `<div style="font-size:11px;color:#666">Заказов: ${ordersCount} · Завершено: ${completedCount}</div>`,
    `</div>`,
    sep,
    `<div style="font-size:11px;font-weight:bold;color:#666;margin-bottom:6px">ПО ТИПУ ЗАКАЗА</div>`,
    ...Object.entries(typeRevenue).map(([t, a]) => row(TYPE_META[t]?.label ?? t, `${a.toLocaleString("ru-RU")} ₸`)),
    Object.keys(typeRevenue).length === 0 ? `<div style="color:#999;font-size:12px">Нет завершённых заказов</div>` : "",
    sep,
    `<div style="font-size:11px;font-weight:bold;color:#666;margin-bottom:6px">ПО СПОСОБУ ОПЛАТЫ</div>`,
    ...Object.entries(paymentBreakdown).map(([m, a]) => row(`${PAYMENT_META[m]?.label ?? m}`, `${a.toLocaleString("ru-RU")} ₸`)),
    Object.keys(paymentBreakdown).length === 0 ? `<div style="color:#999;font-size:12px">Нет данных об оплате</div>` : "",
    totalPrepay > 0 ? [
      sep,
      `<div style="font-size:11px;font-weight:bold;color:#b45309;margin-bottom:6px">ПРЕДОПЛАТЫ</div>`,
      ...Object.entries(prepayBreakdown).map(([m, a]) => row(PAYMENT_META[m]?.label ?? m, `${a.toLocaleString("ru-RU")} ₸`)),
      row("Итого предоплат", `${totalPrepay.toLocaleString("ru-RU")} ₸`),
    ].join("") : "",
    sep,
    `<div style="text-align:center;font-size:11px;color:#999">ScanServe QR · ${new Date().toLocaleString("ru-RU")}</div>`,
  ].join("");

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Z-Отчёт</title>
    <style>body{font-family:monospace;padding:20px;font-size:14px;max-width:380px;margin:0 auto}
    @media print{body{padding:10px}}</style>
    </head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslations();
  const [period, setPeriod]           = useState<Period>("week");
  const [loading, setLoading]         = useState(true);
  const [orders, setOrders]           = useState<OrderRow[]>([]);
  const [prevOrders, setPrevOrders]   = useState<OrderRow[]>([]);
  const [reviewAvg, setReviewAvg]     = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [promoProducts, setPromoProducts] = useState<PromoProduct[]>([]);

  // ── shift state ──
  const [activeShift, setActiveShift]     = useState<ShiftRow | null | undefined>(undefined);
  const [reportingShift, setReportingShift] = useState<ShiftRow | null>(null);
  const [shiftOrders, setShiftOrders]     = useState<ShiftOrderRow[]>([]);
  const [pastShifts, setPastShifts]       = useState<ShiftRow[]>([]);
  const [showZReport, setShowZReport]     = useState(false);
  const [zConfirmed, setZConfirmed]       = useState(false);
  const [closingShift, setClosingShift]   = useState(false);
  const [openingShift, setOpeningShift]   = useState(false);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  // ── analytics load ──
  const load = useCallback(async (p: Period) => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const from     = fromDate(p).toISOString();
    const prevFrom = prevFromDate(p).toISOString();
    const now      = new Date().toISOString();

    const [curRes, prevRes, revRes, promoRes] = await Promise.all([
      supabase.from("orders")
        .select("total_price, status, type, created_at, items_json")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", from).lte("created_at", now),
      supabase.from("orders")
        .select("total_price")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", prevFrom).lt("created_at", from),
      supabase.from("reviews")
        .select("rating").eq("restaurant_id", RESTAURANT_ID),
      supabase.from("products")
        .select("id, name, price, discount_label")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_promo", true).eq("is_archived", false).order("name->ru"),
    ]);

    setOrders((curRes.data ?? []) as OrderRow[]);
    setPrevOrders((prevRes.data ?? []) as OrderRow[]);
    const revs = (revRes.data ?? []) as { rating: number }[];
    setReviewCount(revs.length);
    setReviewAvg(revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : null);
    setPromoProducts((promoRes.data as PromoProduct[]) ?? []);
    setLoading(false);
  }, []);

  // ── shifts load ──
  const loadShifts = useCallback(async () => {
    if (!isConfigured) { setActiveShift(null); return; }
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("opened_at", { ascending: false })
      .limit(30);
    const all = (data ?? []) as ShiftRow[];
    setActiveShift(all.find(s => s.status === "open") ?? null);
    setPastShifts(all.filter(s => s.status === "closed"));
  }, []);

  const loadShiftOrders = useCallback(async (shift: ShiftRow): Promise<ShiftOrderRow[]> => {
    if (!isConfigured) return [];
    let q = supabase
      .from("orders")
      .select("id, total_price, status, type, created_at, payment_method, payment_details, paid_amount, prepayment_method")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("created_at", shift.opened_at);
    if (shift.closed_at) q = q.lte("created_at", shift.closed_at);
    const { data } = await q.order("created_at");
    const rows = (data ?? []) as ShiftOrderRow[];
    setShiftOrders(rows);
    return rows;
  }, []);

  useEffect(() => { load(period); }, [load, period]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  // ── shift actions ──

  const handleOpenShift = async () => {
    if (!isConfigured || openingShift) return;
    setOpeningShift(true);
    const { data, error } = await supabase
      .from("shifts")
      .insert({ restaurant_id: RESTAURANT_ID, status: "open" })
      .select()
      .single();
    if (!error && data) setActiveShift(data as ShiftRow);
    setOpeningShift(false);
  };

  const handleOpenZReport = async () => {
    if (!activeShift) return;
    setReportingShift(activeShift);
    await loadShiftOrders(activeShift);
    setZConfirmed(false);
    setShowZReport(true);
  };

  const handleCloseShift = async () => {
    if (!reportingShift || closingShift) return;
    setClosingShift(true);

    const data = computeZReport(shiftOrders);
    const closedAt = new Date().toISOString();

    const { error } = await supabase
      .from("shifts")
      .update({
        status: "closed",
        closed_at: closedAt,
        total_revenue: data.totalRevenue,
        orders_count: data.ordersCount,
        revenue_by_type: data.typeRevenue,
        revenue_by_payment: data.paymentBreakdown,
        prepayments_total: data.totalPrepay > 0 ? data.totalPrepay : null,
      })
      .eq("id", reportingShift.id);

    if (!error) {
      const closedShift: ShiftRow = {
        ...reportingShift,
        status: "closed",
        closed_at: closedAt,
        total_revenue: data.totalRevenue,
        orders_count: data.ordersCount,
        revenue_by_type: data.typeRevenue,
        revenue_by_payment: data.paymentBreakdown,
        prepayments_total: data.totalPrepay > 0 ? data.totalPrepay : null,
        created_at: reportingShift.created_at,
      };
      setActiveShift(null);
      setReportingShift(closedShift);
      setPastShifts(prev => [closedShift, ...prev]);
      setZConfirmed(true);
    }
    setClosingShift(false);
  };

  // ── derived analytics ──
  const totalRevenue = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const totalOrders  = orders.length;
  const avgCheck     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const prevRevenue  = prevOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const prevTotal    = prevOrders.length;
  const revDelta     = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : null;
  const ordDelta     = prevTotal   > 0 ? Math.round((totalOrders  - prevTotal)   / prevTotal   * 100) : null;

  const bars     = buildBars(orders, period);
  const dishes   = buildTopDishes(orders);
  const statuses = buildBreakdown(orders, "status", STATUS_META);
  const types    = buildBreakdown(orders, "type",   TYPE_META);

  const maxBarRev = Math.max(...bars.map(b => b.revenue), 1);
  const maxDish   = dishes[0]?.count ?? 1;
  const deltaStr  = (v: number | null) => v === null ? "нет данных" : `${v >= 0 ? "+" : ""}${v}%`;

  const zReportData = computeZReport(shiftOrders);

  return (
    <div className="flex flex-col h-full">

      {/* ── Z-Report Modal ── */}
      {showZReport && reportingShift && (
        <ZReportModal
          shift={reportingShift}
          data={zReportData}
          confirmed={zConfirmed}
          closing={closingShift}
          onConfirm={handleCloseShift}
          onPrint={() => reportingShift && openPrintWindow(reportingShift, zReportData)}
          onClose={() => setShowZReport(false)}
        />
      )}

      {/* ── header ── */}
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navOverview}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descOverview}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl text-xs">
            {(["today", "week", "month"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} disabled={loading}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  period === p
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <button onClick={() => load(period)} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* ── Shift Control Panel ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeShift
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
              }`}>
                <Clock size={18} />
              </div>
              <div>
                {activeShift === undefined ? (
                  <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                ) : activeShift ? (
                  <>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Смена открыта · <span className="text-emerald-600 dark:text-emerald-400">{formatShiftDuration(activeShift.opened_at)}</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Открыта {fmtDate(activeShift.opened_at)} в {fmtTime(activeShift.opened_at)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Смена закрыта</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Нет активной кассовой смены</p>
                  </>
                )}
              </div>
            </div>
            <div>
              {activeShift === undefined ? null : activeShift ? (
                <button
                  onClick={handleOpenZReport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  <Printer size={14} />
                  Закрыть смену (Z-Отчёт)
                </button>
              ) : (
                <button
                  onClick={handleOpenShift}
                  disabled={openingShift}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                  {openingShift
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Play size={14} />}
                  Открыть смену
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── metric cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard loading={loading} icon={<CreditCard size={16} />} color="violet"
            label={t.admin.revenue}
            value={`${(totalRevenue / 1000).toFixed(1)}K ₸`}
            delta={deltaStr(revDelta)} deltaUp={revDelta !== null ? revDelta >= 0 : undefined} />
          <MetricCard loading={loading} icon={<ShoppingBag size={16} />} color="blue"
            label={t.admin.orders}
            value={String(totalOrders)}
            delta={deltaStr(ordDelta)} deltaUp={ordDelta !== null ? ordDelta >= 0 : undefined} />
          <MetricCard loading={loading} icon={<TrendingUp size={16} />} color="emerald"
            label={t.admin.avgCheck}
            value={`${avgCheck.toLocaleString("ru-RU")} ₸`}
            delta="средний чек" />
          <MetricCard loading={loading} icon={<Star size={16} />} color="amber"
            label={t.admin.totalReviews}
            value={reviewAvg !== null ? `${reviewAvg.toFixed(1)} / 5` : "—"}
            delta={reviewCount > 0 ? `${reviewCount} отзывов` : "нет отзывов"} />
        </div>

        {/* ── bar chart + top dishes ── */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {period === "today" ? "Выручка по часам" : period === "week" ? "Выручка по дням" : "Выручка за 30 дней"}
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{PERIOD_LABEL[period]}</p>
            </div>
            {loading ? (
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {Array.from({ length: period === "today" ? 10 : period === "week" ? 7 : 15 }, (_, i) => (
                  <div key={i} className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-t animate-pulse"
                    style={{ height: `${25 + (i * 17 + 30) % 70}%` }} />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-end gap-1" style={{ height: 120 }}>
                  {bars.map((bar, i) => {
                    const px = Math.round((bar.revenue / maxBarRev) * 112);
                    const isLatest = period !== "today" && i === bars.length - 1;
                    return (
                      <div key={i} className="flex-1 min-w-0"
                        style={{ height: Math.max(px, bar.revenue > 0 ? 4 : 1), borderRadius: "3px 3px 0 0",
                          background: isLatest ? "#7c3aed" : "var(--bar-color, #c4b5fd)" }}
                        title={bar.revenue > 0 ? `${bar.revenue.toLocaleString("ru-RU")} ₸` : undefined} />
                    );
                  })}
                </div>
                <div className="flex gap-1 mt-1">
                  {bars.map((bar, i) => {
                    const show = period === "month" ? i % 5 === 0 || i === bars.length - 1 : true;
                    return (
                      <div key={i} className="flex-1 min-w-0 text-center">
                        {show && (
                          <span className="text-[9px] text-zinc-500 dark:text-zinc-500 font-medium leading-none">
                            {bar.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{t.admin.topDishes}</h2>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" style={{ width: `${75 - i * 12}%` }} />
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : dishes.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-8">Нет данных за период</p>
            ) : (
              <div className="space-y-3">
                {dishes.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{d.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0 ml-2">{d.count} шт</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round(d.count / maxDish * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── status + type breakdown ── */}
        <div className="grid grid-cols-2 gap-4">
          <BreakdownCard title="Статусы заказов" items={statuses} loading={loading} />
          <BreakdownCard title="Тип заказов"     items={types}    loading={loading} />
        </div>

        {/* ── promo products ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <Tag size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Акционные блюда</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                {promoProducts.length > 0 ? `${promoProducts.length} блюд со скидкой` : "Нет активных акций"}
              </p>
            </div>
          </div>
          {promoProducts.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-4">
              Включите «Акцию» в карточке блюда, чтобы увидеть их здесь
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {promoProducts.map((p) => {
                const pct = parseInt(p.discount_label ?? "", 10);
                const discounted = !isNaN(pct) && pct > 0 && pct < 100
                  ? Math.round(p.price * (1 - pct / 100)) : null;
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {p.name?.ru ?? p.name?.en ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {discounted !== null && (
                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">−{pct}%</span>
                      )}
                      <div className="text-right">
                        {discounted !== null && (
                          <p className="text-[11px] text-zinc-400 line-through leading-none">{p.price.toLocaleString()} ₸</p>
                        )}
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                          {(discounted ?? p.price).toLocaleString()} ₸
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Shifts Archive ── */}
        {pastShifts.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-zinc-500/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                <Archive size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Архив смен (Z-отчёты)</h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{pastShifts.length} закрытых смен</p>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {pastShifts.map(shift => {
                const isExpanded = expandedShiftId === shift.id;
                return (
                  <div key={shift.id}>
                    <button
                      className="w-full flex items-center justify-between py-3 text-left group"
                      onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {fmtDate(shift.opened_at)}
                          <span className="font-normal text-zinc-400 ml-2">
                            {fmtTime(shift.opened_at)}
                            {shift.closed_at && ` — ${fmtTime(shift.closed_at)}`}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">{shift.orders_count ?? 0} заказов</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                          {(shift.total_revenue ?? 0).toLocaleString("ru-RU")} ₸
                        </span>
                        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="pb-3 space-y-2">
                        {/* By type */}
                        {shift.revenue_by_type && Object.keys(shift.revenue_by_type).length > 0 && (
                          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">По типу заказа</p>
                            <div className="space-y-1.5">
                              {Object.entries(shift.revenue_by_type).map(([type, amount]) => (
                                <div key={type} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${TYPE_META[type]?.bg ?? "bg-zinc-400"}`} />
                                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{TYPE_META[type]?.label ?? type}</span>
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {(amount as number).toLocaleString("ru-RU")} ₸
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* By payment */}
                        {shift.revenue_by_payment && Object.keys(shift.revenue_by_payment).length > 0 && (
                          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">По способу оплаты</p>
                            <div className="space-y-1.5">
                              {Object.entries(shift.revenue_by_payment).map(([method, amount]) => (
                                <div key={method} className="flex items-center justify-between">
                                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                    {PAYMENT_META[method]?.icon} {PAYMENT_META[method]?.label ?? method}
                                  </span>
                                  <span className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {(amount as number).toLocaleString("ru-RU")} ₸
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Prepayments */}
                        {(shift.prepayments_total ?? 0) > 0 && (
                          <div className="rounded-xl border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Предоплаты</span>
                            <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
                              {(shift.prepayments_total ?? 0).toLocaleString("ru-RU")} ₸
                            </span>
                          </div>
                        )}
                        {/* Print archived report */}
                        <button
                          onClick={() => {
                            const archiveData: ZReportData = {
                              totalRevenue: shift.total_revenue ?? 0,
                              ordersCount: shift.orders_count ?? 0,
                              completedCount: shift.orders_count ?? 0,
                              typeRevenue: shift.revenue_by_type ?? {},
                              paymentBreakdown: shift.revenue_by_payment ?? {},
                              prepayBreakdown: {},
                              totalPrepay: shift.prepayments_total ?? 0,
                            };
                            openPrintWindow(shift, archiveData);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          <Printer size={12} />
                          Распечатать Z-отчёт
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Z-Report Modal ───────────────────────────────────────────────────────────

function ZReportModal({ shift, data, confirmed, closing, onConfirm, onPrint, onClose }: {
  shift: ShiftRow;
  data: ZReportData;
  confirmed: boolean;
  closing: boolean;
  onConfirm: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const { totalRevenue, ordersCount, completedCount, typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Z-Отчёт</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {fmtDate(shift.opened_at)} · {fmtTime(shift.opened_at)}
              {confirmed && shift.closed_at ? ` — ${fmtTime(shift.closed_at)}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Total Revenue */}
          <div className="rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 p-4 text-center">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">
              Общая выручка
            </p>
            <p className="text-3xl font-black tabular-nums text-violet-700 dark:text-violet-300">
              {totalRevenue.toLocaleString("ru-RU")} ₸
            </p>
            <p className="text-[11px] text-violet-500/70 dark:text-violet-400/60 mt-1">
              {ordersCount} заказов · {completedCount} завершённых
            </p>
          </div>

          {/* By order type */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">По типу заказа</p>
            {Object.keys(typeRevenue).length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-2">Нет завершённых заказов</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(typeRevenue).map(([type, amount]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${TYPE_META[type]?.bg ?? "bg-zinc-400"}`} />
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">{TYPE_META[type]?.label ?? type}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      {amount.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By payment method */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">По способу оплаты</p>
            {Object.keys(paymentBreakdown).length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-2">Нет данных об оплате</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(paymentBreakdown).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {PAYMENT_META[method]?.icon} {PAYMENT_META[method]?.label ?? method}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      {amount.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prepayments */}
          {totalPrepay > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">Предоплаты</p>
              <div className="space-y-2">
                {Object.entries(prepayBreakdown).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      {PAYMENT_META[method]?.icon} {PAYMENT_META[method]?.label ?? method}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {amount.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-500/20">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Итого предоплат</span>
                  <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {totalPrepay.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!confirmed ? (
            <button
              onClick={onConfirm}
              disabled={closing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold transition-colors">
              {closing
                ? <RefreshCw size={14} className="animate-spin" />
                : <CheckCircle2 size={14} />}
              Подтвердить Z-отчёт и закрыть смену
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Смена успешно закрыта</span>
              </div>
              <button
                onClick={onPrint}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <Printer size={14} />
                Распечатать / Сохранить PDF
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MetricCard({ loading, icon, color, label, value, delta, deltaUp }: {
  loading: boolean; icon: React.ReactNode;
  color: "violet" | "blue" | "emerald" | "amber";
  label: string; value: string; delta: string; deltaUp?: boolean;
}) {
  const iconBg: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg[color]}`}>{icon}</div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
      {loading
        ? <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mt-1" />
        : <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">{value}</p>}
      <p className={`text-[11px] font-medium mt-1 ${
        deltaUp === true  ? "text-emerald-600 dark:text-emerald-400" :
        deltaUp === false ? "text-red-500 dark:text-red-400" :
                            "text-zinc-400 dark:text-zinc-600"
      }`}>{loading ? "…" : delta}</p>
    </div>
  );
}

function BreakdownCard({ title, items, loading }: {
  title: string; items: Breakdown[]; loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{title}</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0" />
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse flex-1" />
              <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-4">Нет данных</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.bg}`} />
              <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300">{s.label}</span>
              <span className="text-xs tabular-nums text-zinc-500">{s.count}</span>
              <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.bg}`} style={{ width: `${s.pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-zinc-400 w-8 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
