"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Clock, History, UtensilsCrossed, Package, Bike, CalendarDays, RotateCcw,
  X, Phone, MessageSquare,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { DB_TABLES } from "@/constants";
import { useBranchRestaurantId } from "@/lib/branch-context";
import { capFirst } from "@/lib/utils";

type HistoryFilter = "all" | "dine-in" | "takeaway" | "delivery" | "preorder";
type ModifierEntry  = { name: string; price: number };
type OrderItem      = {
  name: string; qty: number; price: number; currency: string;
  product_id?: string; note?: string; modifiers?: ModifierEntry[];
  original_price?: number;
};

const FILTER_TABS: Array<{ id: HistoryFilter; label: string; icon: React.ElementType }> = [
  { id: "all",      label: "Все",         icon: History         },
  { id: "dine-in",  label: "В заведении", icon: UtensilsCrossed },
  { id: "takeaway", label: "С собой",      icon: Package         },
  { id: "delivery", label: "Доставка",     icon: Bike            },
  { id: "preorder", label: "Предзаказы",   icon: CalendarDays    },
];

const METHOD_META: Record<string, { label: string; icon: string }> = {
  cash:     { label: "Наличные",         icon: "💵" },
  kaspi:    { label: "Kaspi",            icon: "🔴" },
  halyk:    { label: "Halyk",            icon: "🟢" },
  terminal: { label: "Карта (Терминал)", icon: "💳" },
  card:     { label: "Карта",            icon: "💳" },
  mixed:    { label: "Смешанная",        icon: "💳" },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function shortId(id: string) {
  return id.startsWith("ORD-") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

// ── Detail bottom sheet ────────────────────────────────────────────────────────

function OrderDetailSheet({ order, onClose }: { order: DbOrder; onClose: () => void }) {
  const items = (order.items_json as OrderItem[]) ?? [];
  const bonusesDeducted = order.bonuses_deducted ?? 0;
  const earnedBonuses   = order.earned_bonuses ?? 0;
  const tipsAmt         = order.tips_amount ?? 0;
  const promoDiscount   = order.promo_discount ?? 0;
  const itemsSubtotal   = items.reduce((s, it) => s + it.price * it.qty, 0);
  const derivedDeliveryFee = order.type === "delivery"
    ? Math.max(0, (order.total_price ?? 0) - itemsSubtotal - tipsAmt + bonusesDeducted + promoDiscount)
    : 0;
  const savedAmount = items.reduce(
    (s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s,
    0,
  );

  const isCanc = order.status === "cancelled";
  const typeLabel =
    order.order_type === "preorder" ? "Предзаказ"
    : order.type === "dine-in"      ? "В зале"
    : order.type === "delivery"     ? "Доставка"
    : "С собой";

  const hasCustomerInfo = !!(order.customer_name || order.customer_phone || order.delivery_address);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl max-h-[88dvh] flex flex-col shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{shortId(order.id)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {typeLabel}
              {order.table_number ? ` · Стол ${order.table_number}` : ""}
              {" · "}{formatTime(order.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isCanc
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : order.refund_status
                ? "bg-muted text-muted-foreground"
                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            }`}>
              {isCanc ? "Отменён" : order.refund_status ? "Возвращён" : "Закрыт"}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Customer info */}
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
                  <span className="font-semibold text-violet-600 dark:text-violet-400">{order.customer_phone}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 mt-0.5">Адрес:</span>
                  <span className="font-medium leading-snug">{order.delivery_address}</span>
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

          {/* Items */}
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Состав заказа</p>
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-start px-3 py-2.5 text-sm ${
                      i < items.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold tabular-nums text-amber-500 dark:text-amber-400 shrink-0">{item.qty}×</span>
                        <span className="font-medium text-foreground leading-snug">{capFirst(item.name)}</span>
                      </div>
                      {item.modifiers?.map((m, mi) => (
                        <p key={mi} className="text-xs font-medium text-violet-500 dark:text-violet-400 mt-0.5 pl-5 leading-tight">
                          + {m.name}{m.price > 0 ? <span className="text-muted-foreground/60 font-normal"> (+{m.price} ₸)</span> : null}
                        </p>
                      ))}
                      {item.note && (
                        <p className="pl-5 mt-0.5 text-xs font-semibold text-amber-500 dark:text-amber-400">✎ {item.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      {item.original_price != null && (
                        <span className="text-[11px] text-muted-foreground/50 line-through tabular-nums">
                          {(item.original_price * item.qty).toLocaleString("ru-RU")} ₸
                        </span>
                      )}
                      <span className={`text-sm font-semibold tabular-nums ${item.original_price != null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <span className="text-xs text-amber-500 dark:text-amber-400">⭐ Начислено бонусов</span>
                <span className="text-xs text-amber-500 dark:text-amber-400 tabular-nums font-semibold">+{earnedBonuses.toLocaleString("ru-RU")} б</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          {order.payment_method && (
            <div className="space-y-1.5">
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

          {/* Refund status badge */}
          {order.refund_status && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <RotateCcw size={13} />
              <span>Возвращён ({order.refund_status === "full" ? "полный" : "частичный"})</span>
              {!!order.refund_bonuses_ret && order.refund_bonuses_ret > 0 && (
                <span className="text-amber-600 dark:text-amber-400">· +{order.refund_bonuses_ret} б гостю</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [orders, setOrders]         = useState<DbOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<HistoryFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from(DB_TABLES.orders)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("status", ["completed", "cancelled"])
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });
    setOrders((data as DbOrder[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

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
            const pmIcon = order.payment_method ? (METHOD_META[order.payment_method]?.icon ?? "💳") : null;

            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`w-full text-left rounded-xl border p-3 transition-all active:scale-[0.98] ${
                  isCanc
                    ? "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20"
                    : "border-border bg-card hover:border-violet-300 dark:hover:border-violet-700"
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
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {pmIcon && <span className="text-xs leading-none">{pmIcon}</span>}
                    <span className="text-xs font-mono text-muted-foreground/70">{timeStr}</span>
                  </div>
                </div>

                {/* Dish list with prices */}
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic">Позиции не сохранены</p>
                  ) : items.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-base font-black tabular-nums text-amber-500 dark:text-amber-400 shrink-0">
                            {item.qty}×
                          </span>
                          <span className="text-sm font-bold text-foreground leading-snug truncate">
                            {capFirst(item.name)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                          {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                        </span>
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-col gap-0.5 pl-7 mt-0.5">
                          {item.modifiers.map((m, mi) => (
                            <span key={mi} className="text-xs font-semibold text-violet-400">+ {m.name}</span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <p className="pl-7 mt-0.5 text-xs font-semibold text-amber-400">✎ {item.note}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                {!isCanc && order.total_price > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Итого{order.refund_status ? " · Возвращён" : ""}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {order.total_price.toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────────── */}
      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
