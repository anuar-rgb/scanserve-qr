"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, RefreshCw, Search, UtensilsCrossed, Package, Bike,
  ShoppingBag, Clock, Calendar, CalendarDays, MessageSquare, ChevronDown, ChevronUp,
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

  const [orders, setOrders]         = useState<DbOrder[]>([]);
  const [preorderHistory, setPreorderHistory] = useState<DbOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<HistoryTab>("dine-in");
  const [search, setSearch]         = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const [completedRes, preorderRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("order_type", "preorder")
        .in("status", ["completed", "cancelled"])
        .order("preorder_date", { ascending: false })
        .limit(300),
    ]);
    setOrders((completedRes.data as DbOrder[]) ?? []);
    setPreorderHistory((preorderRes.data as DbOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
  const preorderOrders = preorderHistory.filter((o) => matchesSearch(o));

  const visibleOrders = activeTab === "preorder" ? preorderOrders
    : activeTab === "dine-in"  ? dineInOrders
    : activeTab === "takeaway" ? takeawayOrders
    : deliveryOrders;

  const totalByTab = {
    "dine-in":  orders.filter((o) => o.type === "dine-in").length,
    "takeaway": orders.filter((o) => o.type === "takeaway" || o.type === "pickup").length,
    "delivery": orders.filter((o) => o.type === "delivery").length,
    "preorder": preorderHistory.length,
  };

  function handleRefresh() {
    load();
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
              <HistoryCard key={order.id} order={order} showStatus={activeTab === "preorder"} />
            ))}
          </div>
        </div>
      )}
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
            ) : order.order_type === "preorder" && order.status !== "cancelled" ? (
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

