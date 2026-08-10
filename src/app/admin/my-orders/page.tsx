"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Clock, History, UtensilsCrossed, Package, Bike, RotateCcw, User,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { capFirst } from "@/lib/utils";
import { useUserId } from "@/lib/role-context";

type ModifierEntry = { name: string; price: number };
type OrderItem     = {
  name: string; qty: number; price: number; currency: string;
  product_id?: string; note?: string; modifiers?: ModifierEntry[];
};

export default function MyOrdersPage() {
  const userId              = useUserId();
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured || !userId) { setLoading(false); return; }
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from(DB_TABLES.orders)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("opened_by", userId)
      .in("status", ["completed", "cancelled"])
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });
    setOrders((data as DbOrder[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [load, userId]);

  const totalRevenue = orders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + (o.total_price ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3 bg-background">
        <History size={16} className="text-muted-foreground shrink-0" />
        <h1 className="text-sm font-semibold flex-1">Мои заказы</h1>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Сегодня · {orders.length} чек{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw size={11} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {orders.length > 0 && !loading && (
        <div className="px-4 py-2.5 border-b border-border/60 shrink-0 flex items-center gap-4 bg-muted/30">
          <div className="flex items-center gap-1.5">
            <User size={12} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Закрытых чеков:</span>
            <span className="text-xs font-bold text-foreground">{orders.filter(o => o.status === "completed").length}</span>
          </div>
          {totalRevenue > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Выручка:</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {totalRevenue.toLocaleString("ru-RU")} ₸
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-violet-500" />
        </div>
      ) : !userId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <User size={32} className="text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">Сессия не найдена</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <Clock size={32} className="text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">Нет закрытых заказов</p>
          <p className="text-xs text-muted-foreground/60">за сегодняшний день</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orders.map((order) => {
            const items    = (order.items_json as OrderItem[]) ?? [];
            const isCanc   = order.status === "cancelled";
            const typeIcon =
              order.type === "dine-in"  ? <UtensilsCrossed size={11} /> :
              order.type === "delivery" ? <Bike size={11} />             :
                                          <Package size={11} />;
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
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {typeIcon}
                    {typeLabel}
                  </span>
                  {order.table_number && (
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                      Стол {order.table_number}
                    </span>
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
                        <span className="ml-auto text-xs font-semibold text-muted-foreground shrink-0 tabular-nums">
                          {(item.qty * item.price).toLocaleString("ru-RU")} ₸
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

                {/* Footer */}
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
