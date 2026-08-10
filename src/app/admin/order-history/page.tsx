"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Clock, History, UtensilsCrossed, Package, Bike, CalendarDays, RotateCcw,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { capFirst } from "@/lib/utils";

type HistoryFilter = "all" | "dine-in" | "takeaway" | "delivery" | "preorder";
type ModifierEntry  = { name: string; price: number };
type OrderItem      = {
  name: string; qty: number; price: number; currency: string;
  product_id?: string; note?: string; modifiers?: ModifierEntry[];
};

const FILTER_TABS: Array<{ id: HistoryFilter; label: string; icon: React.ElementType }> = [
  { id: "all",      label: "Все",         icon: History         },
  { id: "dine-in",  label: "В заведении", icon: UtensilsCrossed },
  { id: "takeaway", label: "С собой",      icon: Package         },
  { id: "delivery", label: "Доставка",     icon: Bike            },
  { id: "preorder", label: "Предзаказы",   icon: CalendarDays    },
];

export default function OrderHistoryPage() {
  const [orders, setOrders]     = useState<DbOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<HistoryFilter>("all");

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from(DB_TABLES.orders)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .in("status", ["completed", "cancelled"])
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });
    setOrders((data as DbOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = orders.filter((o) => {
    if (filter === "all")      return true;
    if (filter === "dine-in")  return o.type === "dine-in";
    if (filter === "takeaway") return o.type === "takeaway" || o.type === "pickup";
    if (filter === "delivery") return o.type === "delivery";
    if (filter === "preorder") return o.order_type === "preorder";
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3 bg-background">
        <History size={16} className="text-muted-foreground shrink-0" />
        <h1 className="text-sm font-semibold flex-1">История заказов</h1>
        <span className="text-xs text-muted-foreground">Сегодня</span>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0 overflow-x-auto">
        {FILTER_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              filter === id
                ? "bg-violet-600 text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors shrink-0"
        >
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <Clock size={32} className="text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">Нет завершённых заказов</p>
          <p className="text-xs text-muted-foreground/60">за сегодняшний день</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((order) => {
            const items    = (order.items_json as OrderItem[]) ?? [];
            const isCanc   = order.status === "cancelled";
            const typeLabel =
              order.order_type === "preorder" ? "Предзаказ"
              : order.type === "dine-in"       ? "В зале"
              : order.type === "delivery"      ? "Доставка"
              : "С собой";
            const closedAt = order.closed_at ?? order.created_at;
            const timeStr  = new Date(closedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

            return (
              <div
                key={order.id}
                className={`rounded-xl border p-3 ${
                  isCanc
                    ? "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20"
                    : "border-border bg-card"
                }`}
              >
                {/* Order header */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isCanc
                      ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  }`}>
                    {isCanc ? "Отменён" : "Закрыт"}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {typeLabel}
                  </span>
                  {order.table_number && (
                    <span className="text-[10px] text-muted-foreground shrink-0">Стол {order.table_number}</span>
                  )}
                  {order.customer_name && (
                    <span className="text-[10px] text-muted-foreground truncate">{order.customer_name}</span>
                  )}
                  <span className="ml-auto text-xs font-mono text-muted-foreground/70 shrink-0">{timeStr}</span>
                </div>

                {/* Dish list */}
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic">Позиции не сохранены</p>
                  ) : items.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black tabular-nums text-amber-500 dark:text-amber-400 shrink-0">
                          {item.qty}×
                        </span>
                        <span className="text-base font-bold text-foreground leading-snug">
                          {capFirst(item.name)}
                        </span>
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-col gap-0.5 pl-8 mt-0.5">
                          {item.modifiers.map((m, mi) => (
                            <span key={mi} className="text-xs font-semibold text-violet-400">+ {m.name}</span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <p className="pl-8 mt-0.5 text-xs font-semibold text-amber-400">✎ {item.note}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer total */}
                {!isCanc && order.total_price > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Итого</span>
                    <span className="text-sm font-bold tabular-nums">
                      {order.total_price.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
