"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, Search, UtensilsCrossed, Package, Bike,
  ShoppingBag, Clock, Calendar, CalendarDays, MessageSquare,
  ChevronLeft, ChevronRight, X, Landmark, Phone, Copy, Bell, RotateCcw, Check,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";
import { capFirst } from "@/lib/utils";
import { useBranchRestaurantId } from "@/lib/branch-context";

type OrderItem = {
  name: string; qty: number; price: number; currency: string;
  original_price?: number; created_at?: string; note?: string;
  added_by?: string; added_by_role?: string; added_by_name?: string;
  modifiers?: { name: string; price: number }[];
};
type HistoryTab = "dine-in" | "takeaway" | "delivery" | "preorder";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ItemGroup<T> = { label: string; timeMs: number; items: T[]; addedByRole?: string; addedByName?: string };

function groupOrderItems<T extends { created_at?: string }>(
  items: T[],
  fallbackTimestamp: string,
): Array<ItemGroup<T>> {
  const withMs = items.map((it) => ({ it, ms: new Date(it.created_at || fallbackTimestamp).getTime() }));
  withMs.sort((a, b) => a.ms - b.ms);
  const groups: Array<ItemGroup<T>> = [];
  for (const { it, ms } of withMs) {
    const g = groups.find((gr) => ms - gr.timeMs < 2 * 60 * 1000);
    if (g) { g.items.push(it); }
    else {
      const d = new Date(ms);
      const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const ai = it as Record<string, unknown>;
      groups.push({
        label, timeMs: ms, items: [it],
        addedByRole: ai.added_by_role as string | undefined,
        addedByName: ai.added_by_name as string | undefined,
      });
    }
  }
  return groups;
}

function formatAddedByLabel(role?: string, name?: string): string {
  if (!role) return "";
  if (role === "owner")   return " (Владелец)";
  if (role === "manager") return " (Администратор)";
  if (role === "cashier") return " (Кассир)";
  if (role === "waiter")  return name ? ` (Официант: ${name})` : " (Официант)";
  if (role === "chef")    return name ? ` (Повар: ${name})` : " (Повар)";
  return "";
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function shortId(id: string): string {
  return id.startsWith("ORD-") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

const METHOD_META: Record<string, { label: string; icon: string }> = {
  cash:     { label: "Наличные",         icon: "💵" },
  kaspi:    { label: "Kaspi",            icon: "🔴" },
  halyk:    { label: "Halyk",            icon: "🟢" },
  terminal: { label: "Карта (Терминал)", icon: "💳" },
};

const PREORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Ожидает",   cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"       },
  confirmed: { label: "Принят",    cls: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"           },
  preparing: { label: "Готовится", cls: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"   },
  ready:     { label: "Готов",     cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"},
  completed: { label: "Завершён",  cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"             },
  cancelled: { label: "Отменён",   cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"              },
};

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_NAMES_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const PAGE_SIZE = 48;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const { t } = useTranslations();
  const restaurantId = useBranchRestaurantId() ?? "";
  const today = toLocalDateStr(new Date());

  const [selectedDate, setSelectedDate]   = useState(today);
  const [weekOffset, setWeekOffset]       = useState(0);
  const [orders, setOrders]               = useState<DbOrder[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<HistoryTab>("dine-in");
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);

  const load = useCallback(async (date: string) => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    setPage(0);

    const startLocal = new Date(`${date}T00:00:00`);
    const endLocal   = new Date(startLocal.getTime() + 86_400_000);
    const startISO   = startLocal.toISOString();
    const endISO     = endLocal.toISOString();

    const [completedRes, preorderRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "completed")
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "preorder")
        .in("status", ["completed", "cancelled"])
        .eq("preorder_date", date)
        .order("preorder_date", { ascending: false }),
    ]);

    const completed = (completedRes.data as DbOrder[]) ?? [];
    const preorders = (preorderRes.data as DbOrder[]) ?? [];
    // Deduplicate: preorder completed orders may appear in both results
    const preorderIds = new Set(preorders.map((o) => o.id));
    const nonPreorderCompleted = completed.filter((o) => !preorderIds.has(o.id));

    setOrders([...nonPreorderCompleted, ...preorders]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(selectedDate); }, [load, selectedDate]);

  const q = search.trim().toLowerCase();

  function matchesSearch(o: DbOrder): boolean {
    if (!q) return true;
    if (o.id.toLowerCase().includes(q)) return true;
    if (o.table_number?.toLowerCase().includes(q)) return true;
    const pm = o.payment_method;
    if (pm && pm !== "mixed" && METHOD_META[pm]?.label.toLowerCase().includes(q)) return true;
    return false;
  }

  const preorderOrders = orders.filter((o) => o.order_type === "preorder" && matchesSearch(o));
  const completed      = orders.filter((o) => o.order_type !== "preorder");
  const dineInOrders   = completed.filter((o) => o.type === "dine-in"                               && matchesSearch(o));
  const takeawayOrders = completed.filter((o) => (o.type === "takeaway" || o.type === "pickup")     && matchesSearch(o));
  const deliveryOrders = completed.filter((o) => o.type === "delivery"                              && matchesSearch(o));

  const visibleOrders =
    activeTab === "preorder" ? preorderOrders :
    activeTab === "dine-in"  ? dineInOrders :
    activeTab === "takeaway" ? takeawayOrders :
    deliveryOrders;

  const totalPages = Math.ceil(visibleOrders.length / PAGE_SIZE);
  const pageOrders = visibleOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalByTab = {
    "dine-in":  completed.filter((o) => o.type === "dine-in").length,
    "takeaway": completed.filter((o) => o.type === "takeaway" || o.type === "pickup").length,
    "delivery": completed.filter((o) => o.type === "delivery").length,
    "preorder": orders.filter((o) => o.order_type === "preorder").length,
  };

  // Build 7-day strip for current weekOffset
  const dayStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - weekOffset * 7 - (6 - i));
    return {
      date:    toLocalDateStr(d),
      day:     d.getDate(),
      weekday: DAY_NAMES[d.getDay()],
      month:   MONTH_NAMES_SHORT[d.getMonth()],
      isToday: toLocalDateStr(d) === today,
    };
  });

  const selDateObj  = new Date(`${selectedDate}T12:00:00`);
  const selLabel    = `${selDateObj.getDate()} ${MONTH_NAMES_SHORT[selDateObj.getMonth()]}`;
  const dayRevenue  = visibleOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);

  function selectDate(date: string) {
    setSelectedDate(date);
    setPage(0);
    setSelectedOrder(null);
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <header className="px-6 py-3.5 border-b border-border shrink-0 flex items-center gap-3">
          <h1 className="text-base font-semibold flex-1 min-w-0">{t.admin.navOrders}</h1>

          <div className="relative shrink-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Стол, способ оплаты…"
              className="h-8 pl-8 pr-3 w-44 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>

          <button
            onClick={() => load(selectedDate)}
            disabled={loading}
            title="Обновить"
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Calendar strip */}
        <div className="px-4 py-2.5 border-b border-border shrink-0 bg-muted/20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              title="Предыдущая неделя"
              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0 text-muted-foreground"
            >
              <ChevronLeft size={13} />
            </button>

            <div className="flex gap-1 flex-1">
              {dayStrip.map(({ date, day, weekday, month, isToday }) => {
                const isSelected = date === selectedDate;
                return (
                  <button
                    key={date}
                    onClick={() => selectDate(date)}
                    className={`flex flex-col items-center flex-1 py-1.5 rounded-xl transition-all ${
                      isSelected
                        ? "bg-violet-600 text-white shadow-sm"
                        : isToday
                        ? "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                        : "hover:bg-accent border border-transparent text-foreground"
                    }`}
                  >
                    <span className="text-[9px] font-medium leading-none mb-0.5 opacity-60">{weekday}</span>
                    <span className="text-sm font-bold leading-tight">{day}</span>
                    <span className="text-[8px] opacity-50 leading-none mt-0.5">{month}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              title="Следующая неделя"
              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30 shrink-0 text-muted-foreground"
            >
              <ChevronRight size={13} />
            </button>

            {/* Jump to any date */}
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => { if (e.target.value) selectDate(e.target.value); }}
              className="h-7 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 shrink-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-border bg-background px-3 gap-0 pt-0.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {([
            { id: "dine-in",  icon: UtensilsCrossed, label: "В заведении" },
            { id: "takeaway", icon: Package,          label: "С собой"     },
            { id: "delivery", icon: Bike,             label: "Доставка"    },
            { id: "preorder", icon: CalendarDays,     label: "Предзаказы"  },
          ] as const).map(({ id, icon: Icon, label }) => {
            const count = totalByTab[id];
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setPage(0); setSelectedOrder(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 whitespace-nowrap ${
                  activeTab === id
                    ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-900/10"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon size={12} />
                {label}
                {count > 0 && (
                  <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    activeTab === id ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin" />
            Загрузка…
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2.5 text-muted-foreground">
            <ShoppingBag size={30} className="opacity-20" />
            <p className="text-sm font-medium">
              {q ? `Ничего по «${q}»` : `Нет заказов за ${selLabel}`}
            </p>
            {q && (
              <button onClick={() => setSearch("")} className="text-xs text-violet-500 hover:underline">
                Сбросить фильтр
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto admin-scroll p-4">

            {/* Day summary */}
            <div className="flex items-center gap-2.5 mb-3 text-xs">
              <span className="font-semibold text-foreground">{selLabel}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground">
                {visibleOrders.length} заказ{visibleOrders.length === 1 ? "" : visibleOrders.length < 5 ? "а" : "ов"}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {dayRevenue.toLocaleString("ru-RU")} ₸
              </span>
              {q && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground">«{q}»</span>
                  <button onClick={() => setSearch("")} className="text-violet-500 hover:underline">× сбросить</button>
                </>
              )}
            </div>

            {/* Compact grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))" }}>
              {pageOrders.map((order) => (
                <CompactCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrder?.id === order.id}
                  onClick={() => setSelectedOrder((prev) => prev?.id === order.id ? null : order)}
                  showStatus={activeTab === "preorder"}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={11} /> Назад
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  Вперёд <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <OrderDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefresh={() => load(selectedDate)}
        readOnly
      />
    </div>
  );
}

// ── CompactCard ───────────────────────────────────────────────────────────────

function CompactCard({
  order, isSelected, onClick, showStatus,
}: {
  order: DbOrder; isSelected: boolean; onClick: () => void; showStatus?: boolean;
}) {
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];

  const typeIcon =
    order.type === "dine-in"  ? "🍽️" :
    order.type === "delivery" ? "🛵"  : "🛍️";

  const pmIcon =
    !order.payment_method              ? null :
    order.payment_method === "mixed"   ? "💳" :
    (METHOD_META[order.payment_method]?.icon ?? "💳");

  const tableLabel = order.type === "dine-in" && order.table_number
    ? `Стол ${order.table_number}`
    : order.table_number ?? null;

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl border p-3 transition-all hover:border-violet-400 active:scale-[0.98] ${
        isSelected
          ? "border-violet-500 ring-1 ring-violet-500/60 bg-violet-50/40 dark:bg-violet-900/10"
          : "border-border bg-card hover:bg-accent/25"
      }`}
    >
      {/* Row 1: type icon + table/ID + time */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm leading-none shrink-0">{typeIcon}</span>
          <span className="text-xs font-semibold truncate">
            {tableLabel ?? shortId(order.id)}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums font-medium">
          {formatTime(order.created_at)}
        </span>
      </div>

      {/* Row 2: sub-ID + badges */}
      <div className="flex items-center gap-1 mb-2 min-h-[16px]">
        {tableLabel && (
          <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
            {shortId(order.id)}
          </span>
        )}
        {showStatus && order.status && (
          <span className={`text-[9px] font-semibold px-1.5 py-px rounded-full shrink-0 ${PREORDER_STATUS[order.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
            {PREORDER_STATUS[order.status]?.label ?? capFirst(order.status)}
          </span>
        )}
        {items.length > 0 && (
          <span className="text-[9px] text-muted-foreground/40 ml-auto shrink-0">
            {items.length} поз.
          </span>
        )}
      </div>

      {/* Row 3: total + payment icon */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold tabular-nums leading-none">
          {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
        </span>
        <div className="shrink-0">
          {pmIcon
            ? <span className="text-sm leading-none">{pmIcon}</span>
            : <span className="text-[9px] font-semibold text-amber-500">Ожид.</span>
          }
        </div>
      </div>
    </button>
  );
}

// ── OrderDrawer ───────────────────────────────────────────────────────────────

function OrderDrawer({ order, onClose, onRefresh, readOnly }: { order: DbOrder | null; onClose: () => void; onRefresh?: () => void; readOnly?: boolean }) {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [notifying, setNotifying] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  const [showRefund, setShowRefund] = useState(false);
  const [checkedRefundIdx, setCheckedRefundIdx] = useState<Set<number>>(new Set());
  const [refundSaving, setRefundSaving] = useState(false);
  const [bonusMap, setBonusMap] = useState<Record<string, number>>({});

  // These must be before the early return to avoid a hooks-order violation
  const items: OrderItem[] = Array.isArray(order?.items_json) ? (order!.items_json as OrderItem[]) : [];
  const bonusesDeducted = order?.bonuses_deducted ?? 0;
  const earnedBonuses   = order?.earned_bonuses ?? 0;

  useEffect(() => {
    if (!showRefund || !order) return;
    const ids = [...new Set(items.filter((it) => (it as unknown as { product_id?: string }).product_id).map((it) => (it as unknown as { product_id: string }).product_id))];
    if (!ids.length) return;
    supabase.from("products").select("id, bonus_percent").in("id", ids).then(({ data }) => {
      const map: Record<string, number> = {};
      for (const p of data ?? []) { if (p.bonus_percent) map[p.id] = Number(p.bonus_percent); }
      setBonusMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRefund]);

  const { refundReturnBonuses, refundReverseEarned } = useMemo(() => {
    if (!order) return { refundReturnBonuses: 0, refundReverseEarned: 0 };
    const bonusesAccrued = order.bonuses_accrued ?? false;
    const totalPrice     = order.total_price ?? 0;
    if (refundMode === "full") {
      return {
        refundReturnBonuses: bonusesDeducted,
        refundReverseEarned: bonusesAccrued ? earnedBonuses : 0,
      };
    }
    const selected = [...checkedRefundIdx].map((i) => items[i] as { product_id?: string; price: number; qty: number }).filter(Boolean);
    const refundAmt = selected.reduce((s, it) => s + it.price * it.qty, 0);
    const ret = totalPrice > 0 ? Math.round((refundAmt / totalPrice) * bonusesDeducted) : 0;
    let rev = 0;
    if (bonusesAccrued) {
      for (const item of selected) {
        if (!item.product_id || !bonusMap[item.product_id]) continue;
        rev += Math.round(item.qty * item.price * bonusMap[item.product_id] / 100);
      }
    }
    return { refundReturnBonuses: ret, refundReverseEarned: rev };
  }, [refundMode, checkedRefundIdx, bonusMap, items, bonusesDeducted, earnedBonuses, order?.bonuses_accrued, order?.total_price]);

  if (!order) return null;

  const savedAmount = items.reduce(
    (s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s,
    0,
  );
  const itemsSubtotal      = items.reduce((s, it) => s + it.price * it.qty, 0);
  const tipsAmt            = order.tips_amount ?? 0;
  const promoDiscount      = order.promo_discount ?? 0;
  const derivedDeliveryFee = order.type === "delivery"
    ? Math.max(0, (order.total_price ?? 0) - itemsSubtotal - tipsAmt + bonusesDeducted + promoDiscount)
    : 0;

  const isPreorder = order.order_type === "preorder";
  const typeLabel  =
    order.type === "dine-in"  ? "В заведении" :
    order.type === "delivery" ? "Доставка"    : "С собой";
  const hasCustomerInfo = !!(order.customer_name || order.customer_phone || order.delivery_address);

  const canNotify = (order.type === "takeaway" || order.type === "delivery" || order.type === "pickup") &&
    order.status === "preparing" &&
    !!(order.guest_id || order.customer_phone);

  const canRefund = order.status === "completed" && !order.refund_status;

  const refundNetChange = refundReturnBonuses - refundReverseEarned;

  async function handleRefundConfirm() {
    if (refundSaving) return;
    if (refundMode === "partial" && checkedRefundIdx.size === 0) {
      toast.error("Выберите хотя бы одну позицию для возврата");
      return;
    }
    setRefundSaving(true);
    const refundItems = refundMode === "partial"
      ? [...checkedRefundIdx].map((i) => {
          const it = items[i] as { product_id?: string; name: string; qty: number; price: number };
          return { product_id: it.product_id, name: it.name, qty: it.qty, price: it.price };
        })
      : undefined;

    const res = await fetch("/api/admin/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order!.id, restaurantId: restaurantId, refundType: refundMode, refundItems }),
    });
    setRefundSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      toast.error(d.error === "already_refunded" ? "Заказ уже возвращён" : "Ошибка оформления возврата");
      return;
    }
    toast.success("Возврат оформлен");
    setShowRefund(false);
    onRefresh?.();
    onClose();
  }

  async function handleNotify() {
    if (notifying) return;
    setNotifying(true);
    try {
      const res  = await fetch("/api/admin/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order!.id }),
      });
      const data = await res.json() as { pushSent?: boolean; phone?: string | null; name?: string | null };
      if (data.pushSent) toast.success("Push-уведомление отправлено гостю");
      const phone = data.phone ?? order!.customer_phone;
      if (phone) {
        const displayName = data.name ?? order!.customer_name ?? "";
        const text = `Здравствуйте${displayName ? `, ${displayName}` : ""}! Ваш заказ ${shortId(order!.id)} готов к выдаче. Ждём вас! С уважением, ${process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "ScanServe"}.`;
        window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(text)}`, "_blank");
        if (!data.pushSent) toast.success("Открыт WhatsApp для уведомления гостя");
      } else if (!data.pushSent) {
        toast.error("Нет данных для связи с гостем");
      }
      setNotifyDone(true);
    } catch {
      toast.error("Ошибка при отправке уведомления");
    } finally {
      setNotifying(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/15 dark:bg-black/35" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-40 flex flex-col w-[380px] border-l border-border bg-background shadow-2xl">

        {/* Drawer header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{shortId(order.id)}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span>{typeLabel}</span>
              {order.table_number && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{order.type === "dine-in" ? `Стол ${order.table_number}` : order.table_number}</span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1">
                <Clock size={9} />
                {formatTime(order.created_at)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto admin-scroll p-4 space-y-4">

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {isPreorder && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Calendar size={9} /> Предзаказ
              </span>
            )}
            {isPreorder && order.preorder_date && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {[order.preorder_date, order.preorder_time?.slice(0, 5)].filter(Boolean).join(" · ")}
              </span>
            )}
            {order.payment_method ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                ✓ Оплачено
              </span>
            ) : order.order_type === "preorder" && order.status !== "cancelled" ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Ожидает оплаты
              </span>
            ) : null}
            {order.status && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PREORDER_STATUS[order.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                {PREORDER_STATUS[order.status]?.label ?? capFirst(order.status)}
              </span>
            )}
          </div>

          {/* Notify guest */}
          {!readOnly && canNotify && (
            <button
              onClick={() => void handleNotify()}
              disabled={notifying || notifyDone}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                notifyDone
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 cursor-default"
                  : "bg-violet-600 hover:bg-violet-700 active:scale-95 text-white disabled:opacity-60"
              }`}
            >
              <Bell size={15} />
              {notifyDone ? "Уведомление отправлено" : notifying ? "Отправка…" : "Уведомить о готовности"}
            </button>
          )}

          {/* Close delivery check — manager action after courier delivers */}
          {!readOnly && order.type === "delivery" && (order as DbOrder & { delivery_status?: string }).delivery_status === "delivered" && order.status !== "closed" && (
            <button
              onClick={async () => {
                const res = await fetch("/api/admin/delivery-orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: order.id }),
                });
                if (res.ok) { toast.success("Чек закрыт"); onClose(); }
                else toast.error("Ошибка");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
            >
              ✓ Закрыть чек (доставлено)
            </button>
          )}

          {/* Customer info — for takeaway / delivery orders */}
          {hasCustomerInfo && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Клиент</p>
              {order.customer_name && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">Имя:</span>
                  <span className="font-medium">{order.customer_name}</span>
                </div>
              )}
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={11} className="text-muted-foreground shrink-0" />
                  <button
                    onClick={() => void navigator.clipboard.writeText(order.customer_phone!)}
                    className="flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {order.customer_phone}
                    <Copy size={10} className="text-muted-foreground shrink-0" />
                  </button>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 mt-0.5">Адрес:</span>
                  <span className="font-medium leading-snug">{order.delivery_address}{order.customer_city ? `, ${order.customer_city}` : ""}</span>
                </div>
              )}
            </div>
          )}

          {/* Comment */}
          {order.customer_comments && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
              <MessageSquare size={12} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">{order.customer_comments}</p>
            </div>
          )}

          {/* Items grouped chronologically */}
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Состав заказа
              </p>
              {groupOrderItems(items, order.created_at).map((group, gi) => (
                <div key={gi}>
                  {gi === 0 ? (
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">
                      Заказ · {group.label}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 my-2.5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">
                        Дозаказ — {group.label}{formatAddedByLabel(group.addedByRole, group.addedByName)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="rounded-xl border border-border overflow-hidden bg-card mb-2">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        className={`flex justify-between items-start px-3 py-2 text-sm ${
                          i < group.items.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-foreground">{capFirst(item.name)}</span>
                          <span className="ml-1.5 text-muted-foreground/60 text-xs">× {item.qty}</span>
                          {item.modifiers?.map((mod, mi) => (
                            <p key={mi} className="text-sm font-medium text-violet-500 dark:text-violet-400 mt-0.5 leading-tight">
                              + {mod.name} <span className="text-xs font-normal text-muted-foreground/60">(+{mod.price} ₸)</span>
                            </p>
                          ))}
                          {item.note && (
                            <p className="text-sm font-semibold text-amber-500 dark:text-amber-400 mt-0.5 leading-tight">
                              ✎ {item.note}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          {item.original_price != null && (
                            <span className="text-[11px] text-muted-foreground/50 line-through tabular-nums">
                              {(item.original_price * item.qty).toLocaleString("ru-RU")} {item.currency}
                            </span>
                          )}
                          <span className={`text-sm font-semibold tabular-nums ${item.original_price != null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                            {(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer footer: financial summary + payment */}
        <div className="border-t border-border px-5 py-4 space-y-3 shrink-0">

          {/* Financial breakdown */}
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1.5">
            {savedAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Скидка на блюда</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">−{savedAmount.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            {derivedDeliveryFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">🚚 Доставка</span>
                <span className="text-xs text-muted-foreground tabular-nums font-semibold">+{derivedDeliveryFee.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            {bonusesDeducted > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">🌟 Оплата бонусами</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">−{bonusesDeducted.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-600 dark:text-violet-400">🏷️ {order.promo_code ?? "Промокод"}</span>
                <span className="text-xs text-violet-600 dark:text-violet-400 tabular-nums font-semibold">−{promoDiscount.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            {tipsAmt > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-600 dark:text-violet-400">💝 Чаевые</span>
                <span className="text-xs text-violet-600 dark:text-violet-400 tabular-nums font-semibold">+{tipsAmt.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
              <span className="text-sm font-bold">Итого</span>
              <span className="text-xl font-black tabular-nums">{(order.total_price ?? 0).toLocaleString("ru-RU")} ₸</span>
            </div>
            {earnedBonuses > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                  ⭐ Начислено бонусов
                </span>
                <span className="text-xs text-amber-500 dark:text-amber-400 tabular-nums font-semibold">+{earnedBonuses.toLocaleString("ru-RU")} б</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          {order.payment_method && (
            <div className="pt-1 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Оплата</p>
              {order.payment_method !== "mixed" ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base leading-none">{METHOD_META[order.payment_method]?.icon ?? "💳"}</span>
                  <span className="font-medium">{METHOD_META[order.payment_method]?.label ?? capFirst(order.payment_method)}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {order.payment_details && Object.entries(order.payment_details).map(([key, amount]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{METHOD_META[key]?.icon ?? "💳"}</span>
                        <span className="text-muted-foreground">{METHOD_META[key]?.label ?? capFirst(key)}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{(amount as number).toLocaleString("ru-RU")} ₸</span>
                    </div>
                  ))}
                </div>
              )}
              {(order.payment_method === "remote-payment" || order.payment_method === "card-transfer") && order.payment_bank && (
                <div className="flex items-center gap-2 text-sm">
                  <Landmark size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Банк:</span>
                  <span className="font-semibold">{order.payment_bank === "kaspi" ? "Kaspi.kz" : order.payment_bank === "halyk" ? "Halyk Bank" : order.payment_bank}</span>
                </div>
              )}
              {order.payment_method === "remote-payment" && order.payment_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Счёт на:</span>
                  <button
                    onClick={() => void navigator.clipboard.writeText(order.payment_phone!)}
                    className="flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {order.payment_phone}
                    <Copy size={10} className="text-muted-foreground shrink-0" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Refund section */}
          {canRefund && (
            <div className="pt-3 border-t border-border">
              {!showRefund ? (
                <button
                  onClick={() => setShowRefund(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  <RotateCcw size={14} />
                  Оформить возврат
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Возврат</p>
                    <button onClick={() => setShowRefund(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                      <X size={13} />
                    </button>
                  </div>
                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    {(["full", "partial"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => { setRefundMode(m); setCheckedRefundIdx(new Set()); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${refundMode === m ? "bg-red-600 text-white" : "bg-accent hover:bg-accent/80"}`}
                      >
                        {m === "full" ? "Полный" : "Частичный"}
                      </button>
                    ))}
                  </div>
                  {/* Item list (partial) */}
                  {refundMode === "partial" && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {items.map((item, i) => {
                        const it = item as { product_id?: string; name: string; qty: number; price: number };
                        const checked = checkedRefundIdx.has(i);
                        const bp = it.product_id ? (bonusMap[it.product_id] ?? 0) : 0;
                        const ib = bp > 0 ? Math.round(it.qty * it.price * bp / 100) : 0;
                        return (
                          <button
                            key={i}
                            onClick={() => setCheckedRefundIdx((prev) => { const n = new Set(prev); if (checked) n.delete(i); else n.add(i); return n; })}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${checked ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-border hover:bg-accent/50"}`}
                          >
                            <div className={`w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center border-2 ${checked ? "bg-red-500 border-red-500" : "border-muted-foreground/40"}`}>
                              {checked && <Check size={8} className="text-white" />}
                            </div>
                            <span className="flex-1 truncate font-medium">{it.name}</span>
                            <span className="text-muted-foreground shrink-0">{it.qty}×</span>
                            <span className="font-semibold tabular-nums shrink-0">{(it.price * it.qty).toLocaleString("ru-RU")} ₸</span>
                            {ib > 0 && <span className="text-amber-600 dark:text-amber-400 shrink-0">{ib}б</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Bonus hint */}
                  {!!order.guest_id && (refundReturnBonuses > 0 || refundReverseEarned > 0) && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs space-y-0.5">
                      {refundReturnBonuses > 0 && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-300">
                          <span>Вернётся клиенту</span><span className="font-bold">+{refundReturnBonuses} б</span>
                        </div>
                      )}
                      {refundReverseEarned > 0 && (
                        <div className="flex justify-between text-red-600 dark:text-red-400">
                          <span>Аннулируется кешбэк</span><span className="font-bold">−{refundReverseEarned} б</span>
                        </div>
                      )}
                      {refundReturnBonuses > 0 && refundReverseEarned > 0 && (
                        <div className="flex justify-between font-bold pt-1 border-t border-amber-200 dark:border-amber-700">
                          <span>Итого к балансу</span>
                          <span className={refundNetChange >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {refundNetChange > 0 ? "+" : ""}{refundNetChange} б
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleRefundConfirm}
                    disabled={refundSaving || (refundMode === "partial" && checkedRefundIdx.size === 0)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {refundSaving ? <><Loader2 size={13} className="animate-spin" /> Оформление…</> : <><RotateCcw size={13} /> Подтвердить возврат</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {order.refund_status && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw size={14} />
                <span>Возвращён ({order.refund_status === "full" ? "полный" : "частичный"})</span>
                {order.refund_bonuses_ret != null && order.refund_bonuses_ret > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">· +{order.refund_bonuses_ret} б гостю</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
