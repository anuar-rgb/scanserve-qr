"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Clock, Calendar, ShoppingBag } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { RESTAURANT_ID } from "@/constants";

type OrderItem = { name: string; qty: number; price: number; currency: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatPreorderDate(d: string | null, t: string | null): string {
  if (!d) return "";
  const parts = [d];
  if (t) parts.push(t.slice(0, 5));
  return parts.join(" в ");
}

export default function OrdersPage() {
  const { t } = useTranslations();
  const [orders, setOrders]   = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders((data as DbOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const preorders = orders.filter((o) => o.order_type === "preorder");
  const regular   = orders.filter((o) => o.order_type !== "preorder");

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{t.admin.navOrders}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descOrders}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
        >
          <RefreshCw size={13} />
          Обновить
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" />
          Загрузка…
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
          <ShoppingBag size={36} className="opacity-30" />
          <p className="text-sm">{t.admin.ordersEmpty}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ── Preorders section ── */}
          {preorders.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Предзаказы ({preorders.length})
                </h2>
              </div>
              <div className="space-y-3">
                {preorders.map((o) => (
                  <OrderCard key={o.id} order={o} highlight />
                ))}
              </div>
            </section>
          )}

          {/* ── Regular orders section ── */}
          {regular.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={15} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Обычные заказы ({regular.length})
                </h2>
              </div>
              <div className="space-y-3">
                {regular.map((o) => (
                  <OrderCard key={o.id} order={o} highlight={false} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}

function OrderCard({ order, highlight }: { order: DbOrder; highlight: boolean }) {
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const isPreorder = order.order_type === "preorder";

  const typeLabel =
    order.type === "dine-in"  ? "В заведении" :
    order.type === "pickup"   ? "Самовывоз"   :
    order.type === "delivery" ? "Доставка"    : order.type;

  return (
    <div className={`rounded-xl border p-4 bg-card transition-colors ${
      highlight
        ? "border-amber-300 dark:border-amber-600/50 bg-amber-50/60 dark:bg-amber-900/10"
        : "border-border"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-muted-foreground">#{order.id}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {typeLabel}
          </span>
          {isPreorder ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Calendar size={10} />
              Предзаказ
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Clock size={10} />
              Как можно быстрее
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold">{(order.total_price ?? 0).toLocaleString("ru-RU")} ₸</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
      </div>

      {/* Preorder date/time highlight */}
      {isPreorder && (order.preorder_date || order.preorder_time) && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/40">
          <Calendar size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Дата и время выдачи
            </p>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
              {formatPreorderDate(order.preorder_date, order.preorder_time)}
            </p>
          </div>
        </div>
      )}

      {/* Table / address */}
      {order.table_number && (
        <p className="text-xs text-muted-foreground mb-2">
          Стол / место: <span className="font-semibold text-foreground">{order.table_number}</span>
        </p>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Состав</p>
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.name} × {item.qty}</span>
                <span className="font-medium">{(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer comments */}
      {order.customer_comments && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Пожелания</p>
          <p className="text-sm text-foreground">{order.customer_comments}</p>
        </div>
      )}
    </div>
  );
}
