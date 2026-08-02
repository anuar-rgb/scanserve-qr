"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Phone, Clock, Package, CheckCircle2, Truck, Navigation } from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { DbOrder } from "@/lib/db-types";

type DeliveryStatus = "new" | "ready" | "accepted" | "in_transit" | "delivered";

type DeliveryOrder = DbOrder & {
  delivery_status: DeliveryStatus | null;
  items_json: Array<{ name?: string; qty?: number; price?: number; dish?: { name?: string } }>;
};

const STATUS_CFG: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: string }> = {
  new:        { label: "Новый",          color: "#f97316", bg: "rgba(249,115,22,0.12)",  icon: "🟠" },
  ready:      { label: "Готов к выдаче", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "🟡" },
  accepted:   { label: "Принят",         color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: "🔵" },
  in_transit: { label: "В пути",         color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: "🛵" },
  delivered:  { label: "Доставлен",      color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: "✅" },
};

// Admin/manager action: marks order as ready for courier pickup
const ADMIN_ACTION: Record<DeliveryStatus, { label: string; next: DeliveryStatus } | null> = {
  new:        { label: "✓ Готов к выдаче", next: "ready" },
  ready:      null,
  accepted:   null,
  in_transit: null,
  delivered:  null,
};

// Courier action: progresses the order after pickup
const COURIER_ACTION: Record<DeliveryStatus, { label: string; next: DeliveryStatus } | null> = {
  new:        null,
  ready:      { label: "Принять заказ", next: "accepted"   },
  accepted:   { label: "В пути →",      next: "in_transit" },
  in_transit: { label: "Доставлен ✓",   next: "delivered"  },
  delivered:  null,
};

function fmtPrice(n: number) {
  return n.toLocaleString("ru-KZ") + " ₸";
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function getItemsText(items: DeliveryOrder["items_json"]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.slice(0, 3).map((it) => {
    const name = it?.name ?? (it?.dish as { name?: string })?.name ?? "Блюдо";
    const qty  = it?.qty ?? 1;
    return `${name} ×${qty}`;
  }).join(", ") + (items.length > 3 ? ` +${items.length - 3}` : "");
}

export default function DeliveryPage() {
  const role = useRole();
  const [orders, setOrders]   = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"active" | "delivered">("active");
  const [busy, setBusy]       = useState<string | null>(null);
  const prevIdsRef            = useRef<Set<string>>(new Set());
  const audioRef              = useRef<AudioContext | null>(null);

  function playBell() {
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio not available */ }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/delivery-orders");
    if (!res.ok) return;
    const json = await res.json() as { orders: DeliveryOrder[] };
    const fetched = json.orders ?? [];

    // Play sound if new orders appeared (status null or "new" = just arrived)
    const newIds = new Set(fetched.filter(o => !o.delivery_status || o.delivery_status === "new").map(o => o.id));
    const isFirst = prevIdsRef.current.size === 0 && loading;
    if (!isFirst) {
      for (const id of newIds) {
        if (!prevIdsRef.current.has(id)) { playBell(); break; }
      }
    }
    prevIdsRef.current = newIds;
    setOrders(fetched);
    setLoading(false);
  }, [loading]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  // Subscribe to push notifications
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then(async (sw) => {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      try {
        const sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
        await fetch("/api/admin/courier-push?action=subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      } catch { /* user denied or not supported */ }
    });
  }, []);

  async function updateStatus(orderId: string, deliveryStatus: DeliveryStatus) {
    setBusy(orderId);
    await fetch("/api/admin/delivery-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, deliveryStatus }),
    });
    await load();
    setBusy(null);
  }

  const displayed = orders.filter((o) =>
    filter === "active"
      ? o.delivery_status !== "delivered"
      : o.delivery_status === "delivered",
  );

  const activeCount = orders.filter(o => o.delivery_status !== "delivered").length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <Truck size={22} className="text-violet-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Доставки
            {activeCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold">
                {activeCount}
              </span>
            )}
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[
            { key: "active",    label: "Активные" },
            { key: "delivered", label: "Доставлены" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">
            Загрузка...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Truck size={36} className="text-zinc-300 dark:text-zinc-700" />
            <p className="text-zinc-400 dark:text-zinc-600 text-sm">
              {filter === "active" ? "Нет активных заказов доставки" : "Нет доставленных заказов"}
            </p>
          </div>
        ) : (
          displayed.map((order) => {
            const ds = (order.delivery_status ?? "new") as DeliveryStatus;
            const cfg = STATUS_CFG[ds];
            const isAdmin = role === "owner" || role === "manager" || role === "supervisor";
            const action = isAdmin ? ADMIN_ACTION[ds] : COURIER_ACTION[ds];
            const isBusy = busy === order.id;
            const items = Array.isArray(order.items_json) ? order.items_json as DeliveryOrder["items_json"] : [];
            const address2gis = order.delivery_address
              ? `https://2gis.kz/search/${encodeURIComponent(order.delivery_address)}`
              : null;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
              >
                {/* Status header */}
                <div
                  className="px-4 py-2.5 flex items-center justify-between"
                  style={{ background: cfg.bg }}
                >
                  <span className="text-sm font-semibold" style={{ color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Clock size={12} />
                    {fmtTime(order.created_at)}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Address */}
                  {order.delivery_address && (
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-violet-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-tight">
                          {order.delivery_address}
                          {order.customer_city && (
                            <span className="text-zinc-400 dark:text-zinc-600">, {order.customer_city}</span>
                          )}
                        </p>
                        {address2gis && (
                          <a
                            href={address2gis}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-violet-500 hover:text-violet-700"
                          >
                            <Navigation size={11} />
                            Открыть в 2GIS
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {order.customer_phone && (
                    <div className="flex items-center gap-3">
                      <Phone size={15} className="text-emerald-500 shrink-0" />
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {order.customer_name && <span className="font-medium">{order.customer_name} — </span>}
                          {order.customer_phone}
                        </span>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                        >
                          Позвонить
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  {items.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Package size={15} className="text-zinc-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {getItemsText(items)}
                      </p>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400 dark:text-zinc-600">{order.payment_method ?? "Оплата"}</span>
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {fmtPrice(order.total_price ?? 0)}
                    </span>
                  </div>

                  {/* Comments */}
                  {order.customer_comments && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                      💬 {order.customer_comments}
                    </p>
                  )}

                  {/* Action button */}
                  {action && (
                    <button
                      disabled={isBusy}
                      onClick={() => updateStatus(order.id, action.next)}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
                      style={{ background: STATUS_CFG[action.next].color }}
                    >
                      {isBusy ? "..." : action.label}
                    </button>
                  )}

                  {/* Courier hint when order is not ready yet */}
                  {!isAdmin && ds === "new" && (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-sm">
                      <Clock size={14} />
                      Ожидайте готовности заказа
                    </div>
                  )}

                  {/* Delivered badge */}
                  {ds === "delivered" && (
                    <div className="flex items-center justify-center gap-2 py-2 text-emerald-500">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-semibold">Доставлен — ожидает закрытия</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
