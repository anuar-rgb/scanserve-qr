"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, RefreshCw, Search, UtensilsCrossed, Package, Bike,
  ShoppingBag, Clock, Calendar, MessageSquare, ChevronDown, ChevronUp,
  CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { capFirst } from "@/lib/utils";
import { RESTAURANT_ID } from "@/constants";

type OrderItem = { name: string; qty: number; price: number; currency: string; original_price?: number; created_at?: string; note?: string };
type HistoryTab = "dine-in" | "takeaway" | "delivery" | "preorder";

function groupOrderItems<T extends { created_at?: string }>(
  items: T[],
  fallbackTimestamp: string,
): Array<{ label: string; timeMs: number; items: T[] }> {
  const withMs = items.map((it) => ({ it, ms: new Date(it.created_at || fallbackTimestamp).getTime() }));
  withMs.sort((a, b) => a.ms - b.ms);
  const groups: Array<{ label: string; timeMs: number; items: T[] }> = [];
  for (const { it, ms } of withMs) {
    const g = groups.find((gr) => ms - gr.timeMs < 2 * 60 * 1000);
    if (g) { g.items.push(it); }
    else {
      const d = new Date(ms);
      const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      groups.push({ label, timeMs: ms, items: [it] });
    }
  }
  return groups;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
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
  pending:   { label: "Ожидает",   cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"         },
  confirmed: { label: "Принят",    cls: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"             },
  preparing: { label: "Готовится", cls: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"     },
  ready:     { label: "Готов",     cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  completed: { label: "Завершён",  cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"               },
  cancelled: { label: "Отменён",   cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"                },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const { t } = useTranslations();

  const [orders, setOrders]                       = useState<DbOrder[]>([]);
  const [preorders, setPreorders]                 = useState<DbOrder[]>([]);
  const [upcomingPreorderCount, setUpcomingCount] = useState(0);
  const [loading, setLoading]                     = useState(true);
  const [calLoading, setCalLoading]               = useState(false);
  const [activeTab, setActiveTab]                 = useState<HistoryTab>("dine-in");
  const [search, setSearch]                       = useState("");

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());
  const [calYear, setCalYear]           = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth]         = useState(() => new Date().getMonth());

  // Fetch preorders for a specific calendar month from Supabase
  const loadPreordersForMonth = useCallback(async (year: number, month: number) => {
    if (!isConfigured) return;
    setCalLoading(true);
    const from   = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastD  = new Date(year, month + 1, 0).getDate();
    const to     = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("order_type", "preorder")
      .gte("preorder_date", from)
      .lte("preorder_date", to)
      .order("preorder_date", { ascending: true });
    setPreorders((data as DbOrder[]) ?? []);
    setCalLoading(false);
  }, []);

  // Fetch completed orders (tabs 1–3) + upcoming preorder count (badge)
  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const todayStr = getTodayStr();
    const [completedRes, countRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("order_type", "preorder")
        .gte("preorder_date", todayStr)
        .neq("status", "completed")
        .neq("status", "cancelled"),
    ]);
    setOrders((completedRes.data as DbOrder[]) ?? []);
    setUpcomingCount(countRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch month-specific preorders whenever the calendar month changes
  // or when the user switches to the preorder tab
  useEffect(() => {
    if (activeTab === "preorder") {
      loadPreordersForMonth(calYear, calMonth);
    }
  }, [calYear, calMonth, activeTab, loadPreordersForMonth]);

  const q = search.trim().toLowerCase();

  function matchesSearch(o: DbOrder): boolean {
    if (!q) return true;
    if (o.id.toLowerCase().includes(q)) return true;
    if (formatDateOnly(o.created_at).includes(q)) return true;
    if (o.table_number?.toLowerCase().includes(q)) return true;
    const pm = o.payment_method;
    if (pm && pm !== "mixed" && METHOD_META[pm]?.label.toLowerCase().includes(q)) return true;
    if (pm === "mixed" && o.payment_details) {
      for (const key of Object.keys(o.payment_details)) {
        if (METHOD_META[key]?.label.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  }

  const dineInOrders   = orders.filter((o) => o.type === "dine-in" && matchesSearch(o));
  const takeawayOrders = orders.filter((o) => (o.type === "takeaway" || o.type === "pickup") && matchesSearch(o));
  const deliveryOrders = orders.filter((o) => o.type === "delivery" && matchesSearch(o));

  const tabData: Record<"dine-in" | "takeaway" | "delivery", DbOrder[]> = {
    "dine-in":  dineInOrders,
    "takeaway": takeawayOrders,
    "delivery": deliveryOrders,
  };

  const visibleOrders = activeTab !== "preorder"
    ? tabData[activeTab as "dine-in" | "takeaway" | "delivery"]
    : [];

  const todayStr = getTodayStr();

  const totalByTab = {
    "dine-in":  orders.filter((o) => o.type === "dine-in").length,
    "takeaway": orders.filter((o) => o.type === "takeaway" || o.type === "pickup").length,
    "delivery": orders.filter((o) => o.type === "delivery").length,
    "preorder": upcomingPreorderCount,
  };

  function handleRefresh() {
    load();
    if (activeTab === "preorder") loadPreordersForMonth(calYear, calMonth);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ── */}
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">{t.admin.navOrders}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descOrders}</p>
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер чека, дата, имя…"
            className="h-9 pl-8 pr-3 w-52 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
          />
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="flex shrink-0 border-b border-border bg-background px-4 gap-1 pt-1">
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
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-900/10"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon size={14} />
              {label}
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeTab === id
                    ? "bg-violet-600 text-white"
                    : id === "preorder"
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" />
          Загрузка…
        </div>
      ) : activeTab === "preorder" ? (
        <PreorderCalendarView
          preorders={preorders}
          calLoading={calLoading}
          todayStr={todayStr}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          calYear={calYear}
          calMonth={calMonth}
          setCalYear={setCalYear}
          setCalMonth={setCalMonth}
        />
      ) : visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
          <ShoppingBag size={36} className="opacity-30" />
          <p className="text-sm">
            {q ? `Ничего не найдено по «${q}»` : "История заказов пуста"}
          </p>
          {q && (
            <button onClick={() => setSearch("")} className="text-xs text-violet-500 hover:underline">
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary row */}
          <div className="flex items-center gap-4 mb-5 text-xs text-muted-foreground">
            <span>
              {visibleOrders.length} заказ{visibleOrders.length === 1 ? "" : visibleOrders.length < 5 ? "а" : "ов"}
            </span>
            {visibleOrders.length > 0 && (
              <>
                <span>·</span>
                <span className="font-semibold text-foreground">
                  Итого: {visibleOrders.reduce((s, o) => s + (o.total_price ?? 0), 0).toLocaleString("ru-RU")} ₸
                </span>
              </>
            )}
            {q && (
              <>
                <span>·</span>
                <span>фильтр: «{q}»</span>
                <button onClick={() => setSearch("")} className="text-violet-500 hover:underline">× сбросить</button>
              </>
            )}
          </div>

          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <HistoryCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PreorderCalendarView ──────────────────────────────────────────────────────

function PreorderCalendarView({
  preorders,
  calLoading,
  todayStr,
  selectedDate,
  setSelectedDate,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
}: {
  preorders: DbOrder[];
  calLoading: boolean;
  todayStr: string;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  calYear: number;
  calMonth: number;
  setCalYear: (y: number) => void;
  setCalMonth: (m: number) => void;
}) {
  // Group by preorder_date
  const byDate: Record<string, DbOrder[]> = {};
  for (const o of preorders) {
    if (o.preorder_date) {
      if (!byDate[o.preorder_date]) byDate[o.preorder_date] = [];
      byDate[o.preorder_date].push(o);
    }
  }

  const firstDay   = new Date(calYear, calMonth, 1);
  const lastDay    = new Date(calYear, calMonth + 1, 0);
  const startDow   = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
  const totalDays  = lastDay.getDate();
  const totalCells = Math.ceil((startDow + totalDays) / 7) * 7;

  const monthLabel = firstDay.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  function prevMonth() {
    if (calMonth === 0) {
      const newYear = calYear - 1;
      setCalYear(newYear);
      setCalMonth(11);
      setSelectedDate(`${newYear}-12-01`);
    } else {
      const newMonth = calMonth - 1;
      setCalMonth(newMonth);
      setSelectedDate(`${calYear}-${String(newMonth + 1).padStart(2, "0")}-01`);
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      const newYear = calYear + 1;
      setCalYear(newYear);
      setCalMonth(0);
      setSelectedDate(`${newYear}-01-01`);
    } else {
      const newMonth = calMonth + 1;
      setCalMonth(newMonth);
      setSelectedDate(`${calYear}-${String(newMonth + 1).padStart(2, "0")}-01`);
    }
  }

  const selectedOrders = [...(byDate[selectedDate] ?? [])].sort((a, b) =>
    (a.preorder_time ?? "00:00").localeCompare(b.preorder_time ?? "00:00"),
  );

  const activeCount = preorders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex gap-8 items-start" style={{ maxWidth: 900 }}>

        {/* ── Calendar panel ── */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-border bg-card p-4">

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold capitalize">{monthLabel}</span>
                {calLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className={`grid grid-cols-7 gap-0.5 transition-opacity duration-150 ${calLoading ? "opacity-40 pointer-events-none" : ""}`}>
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - startDow + 1;
                if (dayNum < 1 || dayNum > totalDays) {
                  return <div key={idx} className="aspect-square" />;
                }
                const dateStr   = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayOrders = byDate[dateStr] ?? [];
                const hasOrders  = dayOrders.length > 0;
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasPending = dayOrders.some(
                  (o) => o.status !== "completed" && o.status !== "cancelled",
                );

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center justify-center aspect-square rounded-lg text-[13px] font-medium transition-colors ${
                      isSelected
                        ? "bg-violet-600 text-white"
                        : isToday
                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <span className="leading-none">{dayNum}</span>
                    {hasOrders && (
                      <span
                        className={`w-1 h-1 rounded-full mt-0.5 ${
                          isSelected ? "bg-white/70" :
                          hasPending ? "bg-amber-500"  :
                                       "bg-violet-400"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stats — scoped to this month */}
            <div className="mt-4 pt-4 border-t border-border flex gap-5 text-xs text-muted-foreground">
              <div>
                <span className="font-bold text-base text-foreground">{preorders.length}</span>
                <span className="ml-1">за месяц</span>
              </div>
              <div>
                <span className="font-bold text-base text-amber-600 dark:text-amber-400">{activeCount}</span>
                <span className="ml-1">активных</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Day detail ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-sm font-semibold">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru-RU", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </h2>
            {selectedDate === todayStr && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 animate-pulse">
                Сегодня
              </span>
            )}
            {selectedOrders.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedOrders.length} предзаказ{selectedOrders.length === 1 ? "" : selectedOrders.length < 5 ? "а" : "ов"}
              </span>
            )}
          </div>

          {calLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin opacity-40" />
              <p className="text-sm">Загрузка предзаказов…</p>
            </div>
          ) : selectedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <CalendarDays size={32} className="opacity-30" />
              <p className="text-sm">Предзаказов на эту дату нет</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedOrders.map((order) => (
                <PreorderDayCard
                  key={order.id}
                  order={order}
                  isActiveToday={
                    selectedDate === todayStr &&
                    order.status !== "completed" &&
                    order.status !== "cancelled"
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HistoryCard ───────────────────────────────────────────────────────────────

function HistoryCard({
  order,
  showStatus,
  isActiveToday,
}: {
  order: DbOrder;
  showStatus?: boolean;
  isActiveToday?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);

  const typeLabel =
    order.type === "dine-in"  ? "В заведении" :
    order.type === "delivery" ? "Доставка"    : "С собой";

  const typeIcon =
    order.type === "dine-in"  ? "🍽️" :
    order.type === "delivery" ? "🛵"  : "🛍️";

  const isPreorder = order.order_type === "preorder";

  return (
    <div className={`rounded-xl border overflow-hidden bg-card ${
      isActiveToday ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border"
    }`}>

      {/* ── Card header ── */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-accent/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Type badge */}
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-base">
          {typeIcon}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {shortId(order.id)}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {typeLabel}
            </span>
            {isPreorder && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Calendar size={9} />
                Предзаказ
              </span>
            )}
            {isActiveToday && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Активен сегодня
              </span>
            )}
            {showStatus && order.status && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PREORDER_STATUS[order.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                {PREORDER_STATUS[order.status]?.label ?? capFirst(order.status)}
              </span>
            )}
            {order.payment_method ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                ✓ Оплачено
              </span>
            ) : order.order_type === "preorder" ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Ожидает оплаты
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {/* Table / customer */}
            {order.table_number && (
              <span className="text-xs text-muted-foreground">
                {order.type === "dine-in" ? `Стол ${order.table_number}` : order.table_number}
              </span>
            )}
            {/* Created time */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={10} />
              {formatDateTime(order.created_at)}
            </div>
            {/* Preorder date */}
            {isPreorder && order.preorder_date && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Calendar size={10} />
                {[order.preorder_date, order.preorder_time?.slice(0, 5)].filter(Boolean).join(" · ")}
              </div>
            )}
            {/* Payment method badge */}
            {order.payment_method && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="text-[11px] leading-none">
                  {order.payment_method === "mixed" ? "💳" : (METHOD_META[order.payment_method]?.icon ?? "💳")}
                </span>
                {order.payment_method === "mixed"
                  ? "Смешанная"
                  : (METHOD_META[order.payment_method]?.label ?? capFirst(order.payment_method))}
              </span>
            )}
          </div>

          {/* Comment snippet — always visible even in collapsed state */}
          {order.customer_comments && (
            <div className="mt-1.5 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
              <MessageSquare size={10} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight line-clamp-2">
                {order.customer_comments}
              </p>
            </div>
          )}
        </div>

        {/* Total + expand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-base font-bold tabular-nums">
              {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
            </p>
            {items.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{items.length} позиц.</p>
            )}
          </div>
          <div className="text-muted-foreground">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">

          {/* Comments */}
          {order.customer_comments && (
            <div className="flex items-start gap-2">
              <MessageSquare size={13} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{order.customer_comments}</p>
            </div>
          )}

          {/* Items — grouped chronologically */}
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Состав заказа
              </p>
              {groupOrderItems(items, order.created_at).map((group, gi) => (
                <div key={gi}>
                  {gi === 0 ? (
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1">
                      Заказ · {group.label}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 my-2.5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">
                        Дозаказ — {group.label}
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
                        <div>
                          <span className="text-muted-foreground">
                            {capFirst(item.name)}
                            <span className="ml-1.5 text-muted-foreground/60">× {item.qty}</span>
                          </span>
                          {item.note && (
                            <p className="text-[11px] italic text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
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
                          <span className={`font-semibold tabular-nums ${item.original_price != null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
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

          {/* Total row */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Итого</p>
              {savedAmount > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                </p>
              )}
            </div>
            <p className="text-lg font-black tabular-nums">
              {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
            </p>
          </div>

          {/* Payment details */}
          {order.payment_method && (
            <div className="pt-2.5 border-t border-border space-y-1.5">
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
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── PreorderDayCard ───────────────────────────────────────────────────────────
// Non-collapsible card for the calendar day-detail panel. Shows everything
// immediately: status, comment, payment, and items list.

function PreorderDayCard({
  order,
  isActiveToday,
}: {
  order: DbOrder;
  isActiveToday?: boolean;
}) {
  const items: OrderItem[] = Array.isArray(order.items_json)
    ? (order.items_json as OrderItem[])
    : [];
  const savedAmount = items.reduce(
    (s, it) => (it.original_price != null ? s + (it.original_price - it.price) * it.qty : s),
    0,
  );
  const timeLabel = order.preorder_time?.slice(0, 5) ?? null;
  const isPaid    = !!order.payment_method;

  return (
    <div className={`rounded-xl border overflow-hidden bg-card ${
      isActiveToday ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border"
    }`}>

      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Time badge */}
        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
          {timeLabel ? (
            <>
              <span className="text-[13px] font-bold leading-tight">{timeLabel}</span>
              <span className="text-[8px] opacity-60">время</span>
            </>
          ) : (
            <Clock size={16} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {shortId(order.id)}
            </span>
            {order.status && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PREORDER_STATUS[order.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                {PREORDER_STATUS[order.status]?.label ?? capFirst(order.status)}
              </span>
            )}
            {isActiveToday && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Активен
              </span>
            )}
          </div>

          {/* Info row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
            {order.table_number && <span>{order.table_number}</span>}
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span>Заказ: {formatDateTime(order.created_at)}</span>
            </div>
          </div>

          {/* Payment row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isPaid ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-sm leading-none">
                  {order.payment_method === "mixed" ? "💳" : (METHOD_META[order.payment_method!]?.icon ?? "💳")}
                </span>
                <span className="font-medium text-foreground">
                  {order.payment_method === "mixed" ? "Смешанная" : (METHOD_META[order.payment_method!]?.label ?? capFirst(order.payment_method!))}
                </span>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  ✓ Оплачено
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Ожидает оплаты
              </span>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="text-right shrink-0">
          <p className="text-base font-bold tabular-nums">
            {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
          </p>
          {items.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{items.length} позиц.</p>
          )}
        </div>
      </div>

      {/* Comment — always visible */}
      {order.customer_comments && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
            <MessageSquare size={12} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-800 dark:text-amber-300 leading-snug">
              {order.customer_comments}
            </p>
          </div>
        </div>
      )}

      {/* Items list — always visible */}
      {items.length > 0 && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Состав заказа
          </p>
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {items.map((item, i) => (
              <div
                key={i}
                className={`flex justify-between items-start px-3 py-2 text-sm ${
                  i < items.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <span className="text-muted-foreground">
                    {capFirst(item.name)}
                    <span className="ml-1.5 text-muted-foreground/60">× {item.qty}</span>
                  </span>
                  {item.note && (
                    <p className="text-[11px] italic text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
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
                  <span className={`font-semibold tabular-nums ${item.original_price != null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total row */}
          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Итого</p>
              {savedAmount > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                </p>
              )}
            </div>
            <p className="text-lg font-black tabular-nums">
              {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
