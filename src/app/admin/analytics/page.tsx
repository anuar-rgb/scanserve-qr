"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, ShoppingBag, CreditCard, Star, Tag, RefreshCw,
  Clock, Play, Printer, Archive, ChevronDown, X, CheckCircle2, FileText, Users,
  DollarSign, BarChart2, TrendingDown,
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
  tips_amount: number | null;
  earned_bonuses: number | null;
  bonuses_deducted: number | null;
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
  opened_by: string | null;
  tips_amount: number | null;
  table_number: string | null;
}

interface StaffUser {
  id: string;
  display_name: string | null;
  username: string;
}

interface WaiterRevenue {
  waiterId: string;
  waiterName: string;
  cashAmount: number;
  cardAmount: number;
  totalAmount: number;
  ordersCount: number;
  commissionPct: number;
  commissionAmount: number;
}

interface WaiterPerfRow {
  waiterId: string;
  waiterName: string;
  cashTotal: number;
  cardTotal: number;
  revenueTotal: number;
  ordersTotal: number;
  shiftsCount: number;
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
  totalTips: number;
}

interface PromoProduct   { id: string; name: LS; price: number; discount_label: string | null; }
interface BonusProduct  { id: string; name: LS; price: number; bonus_percent: number; }
interface Bar            { label: string; revenue: number; }
interface TopDish        { name: string; count: number; }
interface Breakdown      { label: string; count: number; pct: number; bg: string; }
interface InvoiceRow     { supplier_name: string; total_amount: number; created_at: string; }
interface SupplierStat   { name: string; total: number; pct: number; }
interface VoidRow        { id: string; item_name: string; item_price: number; quantity: number; reason: string; voided_by_name: string | null; table_number: string | null; created_at: string; }

interface DailyPoint { date: string; label: string; revenue: number; cost: number; profit: number; }
interface DishProfit  {
  productId: string; name: string; sold: number;
  costPerPortion: number; totalRevenue: number; totalCost: number;
  netProfit: number; foodCostPct: number;
}
interface FoodCostSummary { totalCost: number; netProfit: number; foodCostPct: number; daily: DailyPoint[]; dishes: DishProfit[]; }

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

function normalizeOrderType(raw: string): string {
  if (raw === "dine-in") return "dine_in";
  if (raw === "takeaway") return "pickup";
  return raw;
}

function buildBreakdown(
  orders: OrderRow[],
  key: "status" | "type",
  meta: Record<string, { label: string; bg: string }>,
): Breakdown[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const raw = o[key] ?? "other";
    const k = key === "type" ? normalizeOrderType(raw) : raw;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
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

const CASH_METHODS = new Set(["cash"]);

function computeWaiterRevenues(
  orders: ShiftOrderRow[],
  staffMap: Map<string, string>,
  commMap?: Map<string, number>,
): WaiterRevenue[] {
  const map = new Map<string, WaiterRevenue>();
  for (const o of orders) {
    if (o.status !== "completed" || !o.opened_by) continue;
    const id = o.opened_by;
    if (!map.has(id)) {
      const pct = commMap?.get(id) ?? 0;
      map.set(id, { waiterId: id, waiterName: staffMap.get(id) ?? "Неизвестно", cashAmount: 0, cardAmount: 0, totalAmount: 0, ordersCount: 0, commissionPct: pct, commissionAmount: 0 });
    }
    const e = map.get(id)!;
    const total = o.total_price ?? 0;
    e.totalAmount += total;
    e.ordersCount += 1;
    if (o.payment_details && typeof o.payment_details === "object") {
      for (const [method, amount] of Object.entries(o.payment_details)) {
        if (typeof amount !== "number") continue;
        if (CASH_METHODS.has(method)) e.cashAmount += amount;
        else e.cardAmount += amount;
      }
    } else if (o.payment_method) {
      if (CASH_METHODS.has(o.payment_method)) e.cashAmount += total;
      else e.cardAmount += total;
    }
  }
  const result = [...map.values()];
  for (const w of result) {
    w.commissionAmount = Math.round(w.totalAmount * w.commissionPct) / 100;
  }
  return result.sort((a, b) => b.totalAmount - a.totalAmount);
}

function computeZReport(orders: ShiftOrderRow[]): ZReportData {
  const completedOrders = orders.filter(o => o.status === "completed");
  const totalRevenue = completedOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const typeRevenue: Record<string, number> = {};
  for (const o of completedOrders) {
    const t = normalizeOrderType(o.type);
    typeRevenue[t] = (typeRevenue[t] ?? 0) + (o.total_price ?? 0);
  }
  const paymentBreakdown = buildPaymentBreakdown(orders);
  const prepayBreakdown  = buildPrepayBreakdown(orders);
  const totalPrepay      = Object.values(prepayBreakdown).reduce((s, v) => s + v, 0);
  const totalTips        = orders.reduce((s, o) => s + (o.tips_amount ?? 0), 0);
  return { totalRevenue, ordersCount: orders.length, completedCount: completedOrders.length,
    typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay, totalTips };
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
  const { totalRevenue, ordersCount, completedCount, typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay, totalTips } = data;
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
    totalTips > 0 ? [
      sep,
      `<div style="font-size:11px;font-weight:bold;color:#7c3aed;margin-bottom:6px">💝 ЧАЕВЫЕ (к выдаче персоналу)</div>`,
      row("Итого чаевых", `${totalTips.toLocaleString("ru-RU")} ₸`),
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
  const [bonusProducts, setBonusProducts] = useState<BonusProduct[]>([]);
  const [bulkBonus, setBulkBonus]         = useState("");
  const [bulkSaving, setBulkSaving]       = useState(false);

  // ── invoices / expenses state ──
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);

  // ── voids / списания state ──
  const [voidRows, setVoidRows]       = useState<VoidRow[]>([]);

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

  // ── waiter revenue state ──
  const [waiterRevenues, setWaiterRevenues] = useState<WaiterRevenue[]>([]);
  const [waiterPerf, setWaiterPerf]         = useState<WaiterPerfRow[]>([]);
  const [waiterPerfLoading, setWaiterPerfLoading] = useState(false);

  // ── food cost state ──
  const [activeSection, setActiveSection] = useState<"analytics" | "foodcost">("analytics");
  const [foodCost,    setFoodCost]    = useState<FoodCostSummary | null>(null);
  const [fcLoading,   setFcLoading]   = useState(false);
  const [fcSort,      setFcSort]      = useState<"profit" | "revenue" | "foodcost">("profit");

  // ── analytics load ──
  const load = useCallback(async (p: Period) => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const from     = fromDate(p).toISOString();
    const prevFrom = prevFromDate(p).toISOString();
    const now      = new Date().toISOString();

    const [curRes, prevRes, revRes, promoRes, bonusRes, invRes, voidRes] = await Promise.all([
      supabase.from("orders")
        .select("total_price, status, type, created_at, items_json, tips_amount, earned_bonuses, bonuses_deducted")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", from).lte("created_at", now),
      supabase.from("orders")
        .select("total_price, tips_amount, status")
        .eq("restaurant_id", RESTAURANT_ID)
        .neq("status", "cancelled")
        .gte("created_at", prevFrom).lt("created_at", from),
      supabase.from("reviews")
        .select("rating").eq("restaurant_id", RESTAURANT_ID),
      supabase.from("products")
        .select("id, name, price, discount_label")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_promo", true).eq("is_archived", false).order("name->ru"),
      supabase.from("products")
        .select("id, name, price, bonus_percent")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_archived", false)
        .gt("bonus_percent", 0)
        .order("bonus_percent", { ascending: false }),
      supabase.from("invoices")
        .select("supplier_name, total_amount, created_at")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", from).lte("created_at", now),
      supabase.from("order_voids")
        .select("id, item_name, item_price, quantity, reason, voided_by_name, table_number, created_at")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", from).lte("created_at", now)
        .order("created_at", { ascending: false }),
    ]);

    setOrders((curRes.data ?? []) as OrderRow[]);
    setPrevOrders((prevRes.data ?? []) as OrderRow[]);
    const revs = (revRes.data ?? []) as { rating: number }[];
    setReviewCount(revs.length);
    setReviewAvg(revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : null);
    setPromoProducts((promoRes.data as PromoProduct[]) ?? []);
    setBonusProducts((bonusRes.data as BonusProduct[]) ?? []);
    setInvoiceRows((invRes.data ?? []) as InvoiceRow[]);
    setVoidRows((voidRes.data ?? []) as VoidRow[]);
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
      .select("id, total_price, status, type, created_at, payment_method, payment_details, paid_amount, prepayment_method, opened_by, tips_amount, table_number")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("created_at", shift.opened_at);
    if (shift.closed_at) q = q.lte("created_at", shift.closed_at);
    const { data } = await q.order("created_at");
    const rows = (data ?? []) as ShiftOrderRow[];
    setShiftOrders(rows);
    return rows;
  }, []);

  const loadWaiterPerf = useCallback(async (p: Period) => {
    if (!isConfigured) return;
    setWaiterPerfLoading(true);
    const from = fromDate(p).toISOString();
    const now  = new Date().toISOString();

    const { data: shiftsData } = await supabase
      .from("shifts")
      .select("id")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("opened_at", from)
      .lte("opened_at", now);

    const shiftIds = ((shiftsData ?? []) as { id: string }[]).map(s => s.id);
    if (shiftIds.length === 0) { setWaiterPerf([]); setWaiterPerfLoading(false); return; }

    const [revenuesRes, staffRes] = await Promise.all([
      supabase.from("waiter_shift_revenues")
        .select("waiter_id, cash_amount, card_amount, total_amount, orders_count")
        .in("shift_id", shiftIds),
      supabase.from("staff_users")
        .select("id, display_name, username")
        .eq("restaurant_id", RESTAURANT_ID),
    ]);

    const staffMap = new Map<string, string>();
    for (const s of (staffRes.data ?? []) as StaffUser[]) {
      staffMap.set(s.id, s.display_name || s.username);
    }

    const agg = new Map<string, WaiterPerfRow>();
    for (const r of (revenuesRes.data ?? []) as { waiter_id: string; cash_amount: number; card_amount: number; total_amount: number; orders_count: number }[]) {
      const id = r.waiter_id;
      if (!agg.has(id)) {
        agg.set(id, { waiterId: id, waiterName: staffMap.get(id) ?? "Неизвестно", cashTotal: 0, cardTotal: 0, revenueTotal: 0, ordersTotal: 0, shiftsCount: 0 });
      }
      const e = agg.get(id)!;
      e.cashTotal    += Number(r.cash_amount);
      e.cardTotal    += Number(r.card_amount);
      e.revenueTotal += Number(r.total_amount);
      e.ordersTotal  += Number(r.orders_count);
      e.shiftsCount  += 1;
    }
    setWaiterPerf([...agg.values()].sort((a, b) => b.revenueTotal - a.revenueTotal));
    setWaiterPerfLoading(false);
  }, []);

  // ── food cost load ──
  const loadFoodCost = useCallback(async (p: Period) => {
    if (!isConfigured) return;
    setFcLoading(true);

    const from = fromDate(p).toISOString();
    const now  = new Date().toISOString();

    // 1. Completed orders in period
    const { data: ordData } = await supabase
      .from("orders")
      .select("id, total_price, items_json, created_at")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("status", "completed")
      .gte("created_at", from).lte("created_at", now)
      .order("created_at");

    const completedOrders = (ordData ?? []) as {
      id: string; total_price: number; items_json: unknown; created_at: string;
    }[];

    // 2. Parse items_json → per-product sales map
    type SaleEntry = { name: string; qty: number; revenue: number };
    const productSales = new Map<string, SaleEntry>();

    for (const order of completedOrders) {
      const items = order.items_json as Array<{
        product_id?: string; name?: string; qty?: number; price?: number;
      }> | null;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item.product_id) continue;
        const qty = item.qty ?? 1;
        const price = item.price ?? 0;
        const existing = productSales.get(item.product_id);
        if (existing) {
          existing.qty += qty;
          existing.revenue += price * qty;
        } else {
          productSales.set(item.product_id, { name: item.name ?? "—", qty, revenue: price * qty });
        }
      }
    }

    const productIds = [...productSales.keys()];

    // 3. Recipe items + ingredient purchase prices
    const recipeMap = new Map<string, number>(); // product_id → cost per portion

    if (productIds.length > 0) {
      const { data: recData } = await supabase
        .from("recipe_items")
        .select("product_id, weight_gross, ingredients(purchase_price, unit)")
        .in("product_id", productIds);

      for (const ri of (recData ?? []) as unknown as {
        product_id: string; weight_gross: number;
        ingredients: { purchase_price: number; unit: string } | null;
      }[]) {
        const ing = ri.ingredients;
        if (!ing) continue;
        const deduction = ing.unit === "pcs" ? ri.weight_gross : ri.weight_gross / 1000;
        const cost = deduction * ing.purchase_price;
        recipeMap.set(ri.product_id, (recipeMap.get(ri.product_id) ?? 0) + cost);
      }
    }

    // 4. Build dish profitability
    const dishes: DishProfit[] = [];
    let totalRevenueFc = 0;
    let totalCostFc    = 0;

    for (const [pid, sales] of productSales) {
      const costPerPortion = recipeMap.get(pid) ?? 0;
      const totalRevDish  = sales.revenue;
      const totalCostDish = costPerPortion * sales.qty;
      const netProfitDish = totalRevDish - totalCostDish;
      const fcPct = totalRevDish > 0 ? (totalCostDish / totalRevDish) * 100 : 0;

      totalRevenueFc += totalRevDish;
      totalCostFc    += totalCostDish;

      dishes.push({
        productId: pid,
        name: sales.name,
        sold: sales.qty,
        costPerPortion,
        totalRevenue: totalRevDish,
        totalCost: totalCostDish,
        netProfit: netProfitDish,
        foodCostPct: fcPct,
      });
    }

    const netProfit   = totalRevenueFc - totalCostFc;
    const foodCostPct = totalRevenueFc > 0 ? (totalCostFc / totalRevenueFc) * 100 : 0;

    // 5. Daily series
    const dayCount = p === "today" ? 24 : p === "week" ? 7 : 30;
    const todayMs  = new Date().setHours(0, 0, 0, 0);

    const daily: DailyPoint[] = Array.from({ length: dayCount }, (_, i) => {
      if (p === "today") return { date: String(i), label: `${i}:00`, revenue: 0, cost: 0, profit: 0 };
      const d = new Date(todayMs);
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return {
        date: d.toISOString().slice(0, 10),
        label: p === "week" ? RU_DAYS[d.getDay()] : String(d.getDate()),
        revenue: 0, cost: 0, profit: 0,
      };
    });

    for (const order of completedOrders) {
      let idx: number;
      if (p === "today") {
        idx = new Date(order.created_at).getHours();
      } else {
        const oMs = new Date(new Date(order.created_at).setHours(0, 0, 0, 0)).getTime();
        idx = dayCount - 1 - Math.round((todayMs - oMs) / 86_400_000);
      }
      if (idx < 0 || idx >= dayCount) continue;

      daily[idx].revenue += order.total_price ?? 0;

      const items = order.items_json as Array<{ product_id?: string; qty?: number }> | null;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item.product_id) continue;
        daily[idx].cost += (recipeMap.get(item.product_id) ?? 0) * (item.qty ?? 1);
      }
    }
    for (const d of daily) d.profit = d.revenue - d.cost;

    dishes.sort((a, b) => b.netProfit - a.netProfit);

    setFoodCost({ totalCost: totalCostFc, netProfit, foodCostPct, daily, dishes });
    setFcLoading(false);
  }, []);

  useEffect(() => { load(period); loadWaiterPerf(period); loadFoodCost(period); }, [load, loadWaiterPerf, loadFoodCost, period]);
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
    const orders = await loadShiftOrders(activeShift);

    const { data: staffData } = await supabase
      .from("staff_users")
      .select("id, display_name, username, commission_pct")
      .eq("restaurant_id", RESTAURANT_ID);

    const staffMap = new Map<string, string>();
    const commMap = new Map<string, number>();
    for (const s of (staffData ?? []) as (StaffUser & { commission_pct?: number })[]) {
      staffMap.set(s.id, s.display_name || s.username);
      commMap.set(s.id, s.commission_pct ?? 0);
    }
    setWaiterRevenues(computeWaiterRevenues(orders, staffMap, commMap));
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

      // Save per-waiter revenue snapshot
      if (waiterRevenues.length > 0) {
        await supabase.from("waiter_shift_revenues").insert(
          waiterRevenues.map(w => ({
            shift_id: reportingShift.id,
            waiter_id: w.waiterId,
            cash_amount: w.cashAmount,
            card_amount: w.cardAmount,
            total_amount: w.totalAmount,
            orders_count: w.ordersCount,
            commission_amount: w.commissionAmount,
          }))
        );
      }

      setActiveShift(null);
      setReportingShift(closedShift);
      setPastShifts(prev => [closedShift, ...prev]);
      setZConfirmed(true);
    }
    setClosingShift(false);
  };

  // ── derived analytics ──
  // Exclude cancelled orders and fully-voided orders (status=completed, empty items, zero total)
  const countableOrders = orders.filter(o =>
    o.status !== "cancelled" &&
    !(o.total_price === 0 && Array.isArray(o.items_json) && o.items_json.length === 0)
  );
  const totalRevenue = countableOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const totalTips    = countableOrders.reduce((s, o) => s + (o.tips_amount ?? 0), 0);
  const totalOrders  = countableOrders.length;
  const avgCheck     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const prevRevenue  = prevOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const prevTotal    = prevOrders.length;
  const revDelta     = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : null;
  const ordDelta     = prevTotal   > 0 ? Math.round((totalOrders  - prevTotal)   / prevTotal   * 100) : null;
  const totalBonusesEarned   = countableOrders.reduce((s, o) => s + (o.earned_bonuses ?? 0), 0);
  const totalBonusesDeducted = countableOrders.reduce((s, o) => s + (o.bonuses_deducted ?? 0), 0);

  const bars     = buildBars(orders, period);
  const dishes   = buildTopDishes(orders);
  const statuses = buildBreakdown(orders, "status", STATUS_META);
  const types    = buildBreakdown(orders, "type",   TYPE_META);

  const maxBarRev = Math.max(...bars.map(b => b.revenue), 1);
  const maxDish   = dishes[0]?.count ?? 1;
  const deltaStr  = (v: number | null) => v === null ? "нет данных" : `${v >= 0 ? "+" : ""}${v}%`;

  const zReportData = computeZReport(shiftOrders);

  // ── food cost derived ──
  const sortedDishes = foodCost
    ? [...foodCost.dishes].sort((a, b) =>
        fcSort === "profit"   ? b.netProfit - a.netProfit :
        fcSort === "revenue"  ? b.totalRevenue - a.totalRevenue :
        b.foodCostPct - a.foodCostPct
      )
    : [];

  // ── expenses derived ──
  const totalExpenses  = invoiceRows.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const grossProfit    = totalRevenue - totalExpenses;
  const supplierStats: SupplierStat[] = (() => {
    const map = new Map<string, number>();
    for (const r of invoiceRows) map.set(r.supplier_name, (map.get(r.supplier_name) ?? 0) + (r.total_amount ?? 0));
    const total = totalExpenses || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, t]) => ({ name, total: t, pct: Math.round(t / total * 100) }));
  })();

  async function handleSetBulkBonus() {
    const val = parseFloat(bulkBonus);
    if (isNaN(val) || val < 0) return;
    const confirmed = window.confirm(
      `Вы уверены, что хотите установить бонус ${val}% для ВСЕХ блюд текущего ресторана?`
    );
    if (!confirmed) return;
    setBulkSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ bonus_percent: val })
      .eq("restaurant_id", RESTAURANT_ID);
    setBulkSaving(false);
    if (error) {
      alert("Ошибка: " + error.message);
      return;
    }
    // Refresh bonus products list
    const { data } = await supabase
      .from("products")
      .select("id, name, price, bonus_percent")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("is_archived", false)
      .gt("bonus_percent", 0)
      .order("bonus_percent", { ascending: false });
    setBonusProducts((data as BonusProduct[]) ?? []);
    setBulkBonus("");
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Z-Report Modal ── */}
      {showZReport && reportingShift && (
        <ZReportModal
          shift={reportingShift}
          data={zReportData}
          waiterRevenues={waiterRevenues}
          confirmed={zConfirmed}
          closing={closingShift}
          onConfirm={handleCloseShift}
          onPrint={() => reportingShift && openPrintWindow(reportingShift, zReportData)}
          onClose={() => setShowZReport(false)}
        />
      )}

      {/* ── header ── */}
      <header className="px-4 md:px-8 py-4 md:py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base md:text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navOverview}</h1>
          <p className="text-xs text-zinc-500 mt-0.5 hidden md:block">{t.admin.descOverview}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl text-xs">
            {(["today", "week", "month"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} disabled={loading}
                className={`px-2.5 md:px-3 py-1.5 rounded-lg font-medium transition-colors ${
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
            <span className="hidden md:inline">Обновить</span>
          </button>
        </div>
      </header>

      {/* ── Section tabs ── */}
      <div className="px-4 md:px-8 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-0.5">
        {([
          ["analytics", "Продажи",      "Продажи"],
          ["foodcost",  "Food Cost",     "Food Cost / Маржинальность"],
        ] as [string, string, string][]).map(([key, mobileLabel, label]) => (
          <button key={key}
            onClick={() => setActiveSection(key as "analytics" | "foodcost")}
            className={`px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeSection === key
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}>
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

      {activeSection === "analytics" && <div className="p-4 md:p-8 space-y-4 md:space-y-6">

        {/* ── Active shift control — only show Z-report when shift is open ── */}
        {activeShift && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Смена открыта</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    С {fmtTime(activeShift.opened_at)} · {formatShiftDuration(activeShift.opened_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenZReport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 text-sm font-semibold transition-colors border border-red-200 dark:border-red-500/20 shrink-0"
              >
                <Archive size={14} />
                Z-Отчёт · Закрыть смену
              </button>
            </div>
          </div>
        )}

        {/* ── metric cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

        {/* ── bonus stats card ── */}
        {(totalBonusesEarned > 0 || totalBonusesDeducted > 0) && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-500/5 p-5 flex items-center gap-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-xl shrink-0">
              🌟
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Бонусная программа за период</p>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-zinc-400">Начислено гостям</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{totalBonusesEarned.toLocaleString("ru-RU")} б</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Списано гостями</p>
                  <p className="text-xl font-black text-zinc-700 dark:text-zinc-300 tabular-nums">−{totalBonusesDeducted.toLocaleString("ru-RU")} б</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── tips card ── */}
        {totalTips > 0 && (
          <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-500/5 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-xl shrink-0">
              💝
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">Электронные чаевые за период</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{totalTips.toLocaleString("ru-RU")} ₸</p>
              <p className="text-xs text-zinc-400 mt-0.5">Собраны через гостевое меню · к выдаче персоналу</p>
            </div>
            {/* per-table breakdown */}
            {orders.filter(o => (o.tips_amount ?? 0) > 0).length > 0 && (
              <div className="shrink-0 text-right space-y-0.5 max-h-28 overflow-y-auto pr-1">
                {orders
                  .filter(o => (o.tips_amount ?? 0) > 0)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 10)
                  .map((o, i) => (
                    <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {new Date(o.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        +{(o.tips_amount ?? 0).toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── expenses + profit row ── */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <MetricCard loading={loading} icon={<FileText size={16} />} color="red"
            label={t.admin.expenses}
            value={totalExpenses > 0 ? `${(totalExpenses / 1000).toFixed(1)}K ₸` : "0 ₸"}
            delta={`${invoiceRows.length} накладных за период`} />
          <MetricCard loading={loading} icon={<TrendingUp size={16} />} color="emerald"
            label={t.admin.profit}
            value={`${(grossProfit / 1000).toFixed(1)}K ₸`}
            delta={totalRevenue > 0 ? `маржа ${Math.round((grossProfit / totalRevenue) * 100)}%` : "нет выручки"}
            deltaUp={grossProfit >= 0} />
        </div>

        {/* ── revenue vs expenses comparison ── */}
        {(totalRevenue > 0 || totalExpenses > 0) && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-5">{t.admin.revenueVsExpenses}</h2>
            <div className="space-y-3">
              {/* Revenue bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.admin.revenue}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {totalRevenue.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${totalRevenue > 0 || totalExpenses > 0 ? Math.round(totalRevenue / Math.max(totalRevenue, totalExpenses) * 100) : 0}%` }} />
                </div>
              </div>
              {/* Expenses bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.admin.expenses}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {totalExpenses.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-400 transition-all duration-500"
                    style={{ width: `${totalRevenue > 0 || totalExpenses > 0 ? Math.round(totalExpenses / Math.max(totalRevenue, totalExpenses) * 100) : 0}%` }} />
                </div>
              </div>
              {/* Profit bar */}
              {grossProfit !== 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${grossProfit >= 0 ? "bg-emerald-500" : "bg-orange-500"}`} />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.admin.profit}</span>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-500"}`}>
                      {grossProfit >= 0 ? "+" : ""}{grossProfit.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${grossProfit >= 0 ? "bg-emerald-500" : "bg-orange-500"}`}
                      style={{ width: `${Math.round(Math.abs(grossProfit) / Math.max(totalRevenue, totalExpenses, 1) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── supplier breakdown ── */}
        {supplierStats.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                <FileText size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.supplierBreakdown}</h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                  {supplierStats.length} поставщиков · {invoiceRows.length} накладных
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {supplierStats.map(s => (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[55%]">{s.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[11px] font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                        {s.total.toLocaleString("ru-RU")} ₸
                      </span>
                      <span className="text-[10px] text-zinc-400 w-8 text-right">{s.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── bar chart + top dishes ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-4 md:p-6">
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

          <div className="md:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-4 md:p-6">
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
        <div className="grid grid-cols-2 gap-3 md:gap-4">
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


        {/* ── Bonus & Promo products ── */}
        {(bonusProducts.length > 0 || promoProducts.length > 0) && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Star size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Блюда с бонусами</h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{bonusProducts.length} блюд</p>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {bonusProducts.map((p) => {
                const bonusAmount = Math.round(p.price * p.bonus_percent / 100);
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {p.name?.ru ?? p.name?.en ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        +{p.bonus_percent}%
                      </span>
                      <div className="text-right">
                        <p className="text-[11px] text-zinc-400 leading-none">+{bonusAmount.toLocaleString()} ₸</p>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">{p.price.toLocaleString()} ₸</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                              totalTips: 0,
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

        {/* ── Waiter Performance ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
              <Users size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Эффективность официантов</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{PERIOD_LABEL[period]}</p>
            </div>
          </div>
          {waiterPerfLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : waiterPerf.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-6">
              Нет данных за период — выручка официантов сохраняется при закрытии смены
            </p>
          ) : (
            <div className="space-y-3">
              {waiterPerf.map((w, i) => {
                const maxRev = waiterPerf[0].revenueTotal || 1;
                return (
                  <div key={w.waiterId} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-zinc-400 w-4 shrink-0 text-center">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                        {w.waiterName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{w.waiterName}</span>
                        <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-200 shrink-0 ml-2">
                          {w.revenueTotal.toLocaleString("ru-RU")} ₸
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${Math.round(w.revenueTotal / maxRev * 100)}%` }} />
                      </div>
                    </div>
                    <div className="hidden md:block shrink-0 text-right min-w-[100px]">
                      <div className="text-[9px] text-zinc-400 tabular-nums">💵 {w.cashTotal.toLocaleString("ru-RU")} ₸</div>
                      <div className="text-[9px] text-zinc-400 tabular-nums">💳 {w.cardTotal.toLocaleString("ru-RU")} ₸</div>
                      <div className="text-[9px] text-zinc-400">{w.ordersTotal} заказов · {w.shiftsCount} смен</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Voids / Списания ── */}
        {(() => {
          const totalVoidAmount = voidRows.reduce((s, v) => s + v.item_price * v.quantity, 0);
          const byReason = voidRows.reduce<Record<string, { count: number; amount: number }>>((acc, v) => {
            const r = v.reason;
            if (!acc[r]) acc[r] = { count: 0, amount: 0 };
            acc[r].count  += v.quantity;
            acc[r].amount += v.item_price * v.quantity;
            return acc;
          }, {});
          const reasonColors: Record<string, string> = {
            "Ошибка официанта": "bg-amber-500",
            "Брак кухни":       "bg-orange-500",
            "Отказ гостя":      "bg-red-500",
          };
          return (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                  <Archive size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Отчёт по списаниям</h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                    {voidRows.length > 0
                      ? `${voidRows.length} позиций · потери ${totalVoidAmount.toLocaleString("ru-RU")} ₸`
                      : PERIOD_LABEL[period]}
                  </p>
                </div>
                {voidRows.length > 0 && (
                  <span className="ml-auto text-lg font-black tabular-nums text-red-500">
                    −{totalVoidAmount.toLocaleString("ru-RU")} ₸
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />)}
                </div>
              ) : voidRows.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-6">
                  Списаний за период нет
                </p>
              ) : (
                <div className="space-y-5">
                  {/* Breakdown by reason */}
                  {Object.keys(byReason).length > 0 && (
                    <div className="space-y-2.5">
                      {Object.entries(byReason).sort((a, b) => b[1].amount - a[1].amount).map(([reason, stat]) => (
                        <div key={reason}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${reasonColors[reason] ?? "bg-zinc-400"}`} />
                              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{reason}</span>
                              <span className="text-[10px] text-zinc-400">({stat.count} шт)</span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-red-500">
                              −{stat.amount.toLocaleString("ru-RU")} ₸
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${reasonColors[reason] ?? "bg-zinc-400"}`}
                              style={{ width: `${Math.round(stat.amount / (totalVoidAmount || 1) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent void log */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600 mb-2">
                      Последние списания
                    </p>
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                      {voidRows.slice(0, 15).map(v => (
                        <div key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${reasonColors[v.reason] ?? "bg-zinc-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{v.item_name}</p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {v.reason}
                              {v.table_number ? ` · стол ${v.table_number}` : ""}
                              {v.voided_by_name ? ` · ${v.voided_by_name}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold text-red-500 tabular-nums">
                              −{(v.item_price * v.quantity).toLocaleString("ru-RU")} ₸
                            </p>
                            <p className="text-[9px] text-zinc-400">{v.quantity > 1 ? `×${v.quantity}` : ""} {new Date(v.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </div>}

      {/* ── Food Cost / Маржинальность tab ── */}
      {activeSection === "foodcost" && <div className="p-4 md:p-8 space-y-4 md:space-y-6">

        {fcLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}
          </div>
        ) : foodCost ? (
          <>
            {/* ── 4 metric cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <MetricCard loading={false} icon={<CreditCard size={16} />} color="violet"
                label="Выручка (оплачено)"
                value={`${(foodCost.dishes.reduce((s, d) => s + d.totalRevenue, 0) / 1000).toFixed(1)}K ₸`}
                delta={`${foodCost.dishes.reduce((s, d) => s + d.sold, 0)} порций с рецептурой`} />
              <MetricCard loading={false} icon={<DollarSign size={16} />} color="red"
                label="Себестоимость"
                value={`${(foodCost.totalCost / 1000).toFixed(1)}K ₸`}
                delta="по рецептуре блюд" />
              <MetricCard loading={false} icon={<TrendingUp size={16} />} color="emerald"
                label="Чистая прибыль"
                value={`${(foodCost.netProfit / 1000).toFixed(1)}K ₸`}
                delta={foodCost.dishes.reduce((s, d) => s + d.totalRevenue, 0) > 0
                  ? `маржа ${Math.round(foodCost.netProfit / foodCost.dishes.reduce((s, d) => s + d.totalRevenue, 0) * 100)}%`
                  : "—"}
                deltaUp={foodCost.netProfit >= 0} />
              <MetricCard loading={false} icon={<BarChart2 size={16} />} color="amber"
                label="Food Cost"
                value={`${foodCost.foodCostPct.toFixed(1)}%`}
                delta={foodCost.foodCostPct < 30 ? "отлично (< 30%)" : foodCost.foodCostPct < 40 ? "норма (30–40%)" : "высокий (> 40%)"}
                deltaUp={foodCost.foodCostPct < 35} />
            </div>

            {/* ── Revenue vs Profit line chart ── */}
            {foodCost.daily.some(d => d.revenue > 0) && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Выручка vs Чистая прибыль</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{PERIOD_LABEL[period]}</p>
                  </div>
                  <div className="flex items-center gap-5 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full bg-violet-500" />
                      Выручка
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded-full bg-emerald-500" />
                      Прибыль
                    </div>
                  </div>
                </div>
                <ProfitLineChart data={foodCost.daily} />
              </div>
            )}

            {/* ── Dish profitability table ── */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
              <div className="flex flex-wrap items-start justify-between mb-5 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <BarChart2 size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Рейтинг маржинальности</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {foodCost.dishes.length} позиций · {PERIOD_LABEL[period]}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs shrink-0">
                  {([
                    ["profit",   "По прибыли"],
                    ["revenue",  "По выручке"],
                    ["foodcost", "По FC%"],
                  ] as [typeof fcSort, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setFcSort(k)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        fcSort === k
                          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}>{l}</button>
                  ))}
                </div>
              </div>

              {sortedDishes.length === 0 ? (
                <div className="text-center py-10">
                  <TrendingDown size={28} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">
                    Нет блюд с рецептурой за период.
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">Добавьте рецептуру блюд в разделе «Склад».</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/60">
                        <th className="text-left pb-2.5 pr-2 font-semibold w-6">#</th>
                        <th className="text-left pb-2.5 font-semibold">Блюдо</th>
                        <th className="text-right pb-2.5 px-3 font-semibold">Продано</th>
                        <th className="text-right pb-2.5 px-3 font-semibold">Цена</th>
                        <th className="text-right pb-2.5 px-3 font-semibold">С/С порции</th>
                        <th className="text-right pb-2.5 px-3 font-semibold">Выручка</th>
                        <th className="text-right pb-2.5 px-3 font-semibold">Прибыль</th>
                        <th className="text-right pb-2.5 pl-3 font-semibold">FC%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/40">
                      {sortedDishes.map((d, i) => {
                        const avgPrice = d.sold > 0 ? Math.round(d.totalRevenue / d.sold) : 0;
                        const hasCost  = d.costPerPortion > 0;
                        const fcColor  = !hasCost ? "text-zinc-400"
                          : d.foodCostPct < 30 ? "text-emerald-600 dark:text-emerald-400"
                          : d.foodCostPct < 40 ? "text-amber-600 dark:text-amber-400"
                          : "text-red-500";
                        return (
                          <tr key={d.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group">
                            <td className="py-2.5 pr-2 font-bold text-zinc-300 dark:text-zinc-600">{i + 1}</td>
                            <td className="py-2.5 max-w-[200px]">
                              <span className="block truncate font-medium text-zinc-700 dark:text-zinc-300">{d.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-zinc-500">{d.sold}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-zinc-500">{avgPrice.toLocaleString("ru-RU")} ₸</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-zinc-500">
                              {hasCost ? `${Math.round(d.costPerPortion).toLocaleString("ru-RU")} ₸` : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                              {d.totalRevenue.toLocaleString("ru-RU")} ₸
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                              {d.netProfit >= 0 ? "+" : ""}{Math.round(d.netProfit).toLocaleString("ru-RU")} ₸
                            </td>
                            <td className={`py-2.5 pl-3 text-right tabular-nums font-bold ${fcColor}`}>
                              {hasCost ? `${Math.round(d.foodCostPct)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {sortedDishes.length > 0 && (
                      <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-800">
                        <tr className="font-bold text-zinc-800 dark:text-zinc-200">
                          <td colSpan={5} className="pt-2.5 text-xs text-zinc-500 font-semibold">Итого</td>
                          <td className="pt-2.5 px-3 text-right tabular-nums">
                            {sortedDishes.reduce((s, d) => s + d.totalRevenue, 0).toLocaleString("ru-RU")} ₸
                          </td>
                          <td className="pt-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{Math.round(sortedDishes.reduce((s, d) => s + d.netProfit, 0)).toLocaleString("ru-RU")} ₸
                          </td>
                          <td className={`pt-2.5 pl-3 text-right tabular-nums ${
                            foodCost.foodCostPct < 30 ? "text-emerald-600 dark:text-emerald-400"
                            : foodCost.foodCostPct < 40 ? "text-amber-600 dark:text-amber-400"
                            : "text-red-500"
                          }`}>
                            {foodCost.foodCostPct.toFixed(0)}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* ── FC% explanation ── */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/20 p-5">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <strong className="text-zinc-700 dark:text-zinc-300">Food Cost (FC%)</strong> — доля
                себестоимости ингредиентов в выручке. Норма для ресторана: <strong>25–35%</strong>.
                Себестоимость рассчитывается по рецептуре блюд и текущим ценам закупки ингредиентов.
                Блюда без рецептуры в таблице не отображаются.
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-zinc-400">
            <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Нет данных за период</p>
          </div>
        )}

      </div>}

      </div>
    </div>
  );
}

// ─── Z-Report Modal ───────────────────────────────────────────────────────────

function ZReportModal({ shift, data, waiterRevenues, confirmed, closing, onConfirm, onPrint, onClose }: {
  shift: ShiftRow;
  data: ZReportData;
  waiterRevenues: WaiterRevenue[];
  confirmed: boolean;
  closing: boolean;
  onConfirm: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const { totalRevenue, ordersCount, completedCount, typeRevenue, paymentBreakdown, prepayBreakdown, totalPrepay, totalTips } = data;

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

          {/* Tips block in Z-report */}
          {totalTips > 0 && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💝</span>
                <div>
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Чаевые за смену</p>
                  <p className="text-[10px] text-violet-500 dark:text-violet-400">К выдаче персоналу</p>
                </div>
              </div>
              <span className="text-xl font-black tabular-nums text-violet-700 dark:text-violet-300">
                {totalTips.toLocaleString("ru-RU")} ₸
              </span>
            </div>
          )}

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

          {/* Waiter cash section */}
          {waiterRevenues.length > 0 && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-3">Касса официантов</p>
              <div className="space-y-3">
                {waiterRevenues.map(w => (
                  <div key={w.waiterId} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                        {w.waiterName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="flex-1 min-w-0 text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate">{w.waiterName}</span>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-zinc-500 tabular-nums">
                        💵 {w.cashAmount.toLocaleString("ru-RU")} · 💳 {w.cardAmount.toLocaleString("ru-RU")} ₸
                      </div>
                      <div className="text-xs font-bold tabular-nums text-violet-700 dark:text-violet-300">
                        {w.totalAmount.toLocaleString("ru-RU")} ₸
                      </div>
                      {w.commissionPct > 0 && (
                        <div className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
                          {w.commissionPct}% = {w.commissionAmount.toLocaleString("ru-RU")} ₸
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
  color: "violet" | "blue" | "emerald" | "amber" | "red";
  label: string; value: string; delta: string; deltaUp?: boolean;
}) {
  const iconBg: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red:     "bg-red-500/10 text-red-600 dark:text-red-400",
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

// ─── ProfitLineChart ─────────────────────────────────────────────────────────

function ProfitLineChart({ data }: { data: DailyPoint[] }) {
  if (data.length < 2) return null;

  const W = 800, H = 140;
  const PAD = { x: 8, y: 12, b: 22 };
  const iW = W - PAD.x * 2;
  const iH = H - PAD.y - PAD.b;

  const allVals = data.flatMap(d => [d.revenue, d.profit]);
  const maxV = Math.max(...allVals, 1);
  const minV = Math.min(...allVals, 0);
  const range = maxV - minV || 1;

  const cx = (i: number) => PAD.x + (i / (data.length - 1)) * iW;
  const cy = (v: number) => PAD.y + (1 - (v - minV) / range) * iH;

  const makePath = (key: "revenue" | "profit") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)} ${cy(d[key]).toFixed(1)}`).join(" ");

  const showLabel = (i: number) => {
    if (data.length <= 9) return true;
    return i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 8) === 0;
  };

  const last = data[data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", height: H }}>
      <path d={makePath("revenue")} fill="none" stroke="#7c3aed" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d={makePath("profit")} fill="none" stroke="#10b981" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx(data.length - 1)} cy={cy(last.revenue)} r={4} fill="#7c3aed" />
      <circle cx={cx(data.length - 1)} cy={cy(last.profit)}  r={4} fill="#10b981" />
      {data.map((d, i) => showLabel(i) ? (
        <text key={i} x={cx(i)} y={H - 4} textAnchor="middle" fontSize={10}
          fill="#a1a1aa" fontFamily="sans-serif">
          {d.label}
        </text>
      ) : null)}
    </svg>
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
