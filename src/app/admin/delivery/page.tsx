"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Phone, Clock, Package, CheckCircle2, Truck, Navigation, ChevronDown, History } from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { DbOrder } from "@/lib/db-types";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID } from "@/constants";

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

const ADMIN_ACTION: Record<DeliveryStatus, { label: string; next: DeliveryStatus } | null> = {
  new:        { label: "✓ Готов к выдаче", next: "ready" },
  ready:      null,
  accepted:   null,
  in_transit: null,
  delivered:  null,
};

const COURIER_ACTION: Record<DeliveryStatus, { label: string; next: DeliveryStatus } | null> = {
  new:        null,
  ready:      { label: "Принять заказ", next: "accepted"   },
  accepted:   { label: "В пути →",      next: "in_transit" },
  in_transit: { label: "Доставлен ✓",   next: "delivered"  },
  delivered:  null,
};

function fmtPrice(n: number) { return n.toLocaleString("ru-KZ") + " ₸"; }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

// ── Date helpers ────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isToday(isoStr: string) {
  const d = new Date(isoStr), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function localDayRange(isoDate: string) {
  return {
    from: new Date(isoDate + "T00:00:00").toISOString(),
    to:   new Date(isoDate + "T23:59:59.999").toISOString(),
  };
}

function buildDatePills() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = i === 0 ? "Сегодня" : i === 1 ? "Вчера"
      : d.toLocaleDateString("ru", { weekday: "short", day: "numeric" });
    return { iso, label };
  });
}

const DATE_PILLS = buildDatePills();

// ── useIsNewOrder ────────────────────────────────────────────────────────────

function useIsNewOrder(createdAt: string): boolean {
  const [isNew, setIsNew] = useState(() =>
    Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000,
  );
  useEffect(() => {
    const remaining = 5 * 60 * 1000 - (Date.now() - new Date(createdAt).getTime());
    if (remaining <= 0) { setIsNew(false); return; }
    const t = setTimeout(() => setIsNew(false), remaining);
    return () => clearTimeout(t);
  }, [createdAt]);
  return isNew;
}

// ── DeliveryOrderCard ────────────────────────────────────────────────────────

function DeliveryOrderCard({
  order, role, busy, expandedIds, toggleExpand, updateStatus, filter,
}: {
  order: DeliveryOrder;
  role: string | null;
  busy: string | null;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  updateStatus: (orderId: string, deliveryStatus: DeliveryStatus) => Promise<void>;
  filter: "active" | "history";
}) {
  const isNew = useIsNewOrder(order.created_at);
  const ds      = (order.delivery_status ?? "new") as DeliveryStatus;
  const cfg     = STATUS_CFG[ds];
  const isAdmin = role === "owner" || role === "manager" || role === "supervisor";
  const action  = isAdmin ? ADMIN_ACTION[ds] : COURIER_ACTION[ds];
  const isBusy  = busy === order.id;
  const items   = Array.isArray(order.items_json) ? order.items_json as DeliveryOrder["items_json"] : [];
  const address2gis = order.delivery_address
    ? `https://2gis.kz/search/${encodeURIComponent(order.delivery_address)}`
    : null;
  const isExpanded = expandedIds.has(order.id);

  return (
    <div
      className={`w-full rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden transition-shadow ${
        isNew
          ? "border-orange-400 dark:border-orange-500 shadow-[0_0_0_3px_rgba(251,146,60,0.18)]"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {/* Status header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: cfg.bg }}>
        <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</span>
        <div className="flex items-center gap-2 ml-auto">
          {isNew && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white animate-pulse">
              Новый
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock size={12} />{fmtTime(order.created_at)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          {order.customer_phone && (
            <div className="flex items-center gap-3">
              <Phone size={14} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {order.customer_name ? <span className="font-medium">{order.customer_name} — </span> : null}
                  {order.customer_phone}
                </span>
                <a href={`tel:${order.customer_phone}`} className="shrink-0 text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Позвонить
                </a>
              </div>
            </div>
          )}
          {order.customer_city && (
            <div className="flex items-center gap-3">
              <MapPin size={14} className="text-violet-400 shrink-0" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{order.customer_city}</span>
            </div>
          )}
          {order.delivery_address && (
            <div className="flex items-start gap-3">
              <MapPin size={14} className="text-violet-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-tight">{order.delivery_address}</p>
                {address2gis && (
                  <a href={address2gis} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-0.5 text-xs text-violet-500 hover:text-violet-700">
                    <Navigation size={10} />Открыть в 2GIS
                  </a>
                )}
              </div>
            </div>
          )}
          {order.payment_method && (
            <div className="flex items-center gap-3">
              <span className="text-sm">🏦</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{order.payment_method}</span>
            </div>
          )}
        </div>

        {/* Items accordion */}
        {items.length > 0 && (() => {
          const itemsSubtotal = items.reduce((s, it) => s + (it?.price ?? 0) * (it?.qty ?? 1), 0);
          const tips = order.tips_amount ?? 0;
          const derivedFee = Math.round((order.total_price ?? 0) - itemsSubtotal - tips);
          const hiddenCount = items.length - 2;
          return (
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button type="button" onClick={() => toggleExpand(order.id)} className="w-full flex items-center gap-2 mb-2">
                <Package size={13} className="text-zinc-400" />
                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                  Состав · {items.length} позиц.
                </span>
                <ChevronDown size={14} className={`ml-auto text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {!isExpanded ? (
                <div className="space-y-1">
                  {items.slice(0, 2).map((it, idx) => (
                    <div key={idx} className="flex items-baseline gap-2">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">{it?.name ?? "Блюдо"} ×{it?.qty ?? 1}</span>
                    </div>
                  ))}
                  {hiddenCount > 0 && <p className="text-xs text-zinc-400 dark:text-zinc-600">+ ещё {hiddenCount}...</p>}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it, idx) => {
                    const qty = it?.qty ?? 1, price = it?.price ?? 0;
                    return (
                      <div key={idx} className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1 leading-snug">{it?.name ?? "Блюдо"} ×{qty}</span>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 shrink-0 tabular-nums">{fmtPrice(price * qty)}</span>
                      </div>
                    );
                  })}
                  {(derivedFee > 0 || tips > 0) && (
                    <div className="pt-2 mt-1 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-1">
                      {derivedFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">🚚 Доставка</span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">{fmtPrice(derivedFee)}</span>
                        </div>
                      )}
                      {tips > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">💝 Чаевые</span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">{fmtPrice(tips)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Итого</span>
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{fmtPrice(order.total_price ?? 0)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {order.customer_comments && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
            💬 {order.customer_comments}
          </p>
        )}

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

        {!((role === "owner" || role === "manager" || role === "supervisor")) && ds === "new" && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-sm">
            <Clock size={14} />Ожидайте готовности заказа
          </div>
        )}

        {ds === "delivered" && filter === "active" && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-500">
            <CheckCircle2 size={16} />
            <span className="text-sm font-semibold">Доставлен — ожидает закрытия</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DeliveryPage() {
  const role = useRole();

  // Active orders state
  const [orders, setOrders]   = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  // Tab state
  const [filter, setFilter] = useState<"active" | "history">("active");

  // History state
  const [historyDate, setHistoryDate]         = useState<string>(todayISO());
  const [historyOrders, setHistoryOrders]     = useState<DeliveryOrder[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  // Accordion
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const knownIdsRef = useRef<Set<string>>(new Set());
  const audioRef    = useRef<AudioContext | null>(null);

  const playBell = useCallback(() => {
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const ping = (freq: number, t: number) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
      };
      const t = ctx.currentTime;
      ping(880, t);
      ping(1108, t + 0.28);
    } catch { /* audio not available */ }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/delivery-orders");
    if (!res.ok) return;
    const json = await res.json() as { orders: DeliveryOrder[] };
    const fetched = json.orders ?? [];
    knownIdsRef.current = new Set(fetched.map(o => o.id));
    setOrders(fetched);
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async (date: string) => {
    setHistoryLoading(true);
    const { from, to } = localDayRange(date);
    const res = await fetch(`/api/admin/delivery-orders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) {
      const json = await res.json() as { orders: DeliveryOrder[] };
      setHistoryOrders(json.orders ?? []);
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (filter === "history") loadHistory(historyDate);
  }, [filter, historyDate, loadHistory]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then(async (sw) => {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      try {
        const sub = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
        await fetch("/api/admin/courier-push?action=subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      } catch { /* denied */ }
    });
  }, []);

  // Supabase Realtime — instant new-order notifications for all couriers
  useEffect(() => {
    if (!isConfigured) return;
    const channel = supabase
      .channel("delivery-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const order = payload.new as DeliveryOrder;
          if (order.type !== "delivery") return;
          if (knownIdsRef.current.has(order.id)) return; // already in list (race dedup)
          knownIdsRef.current.add(order.id);
          setOrders(prev => [order, ...prev]);
          playBell();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const updated = payload.new as DeliveryOrder;
          if (updated.type !== "delivery") return;
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [playBell]);

  async function updateStatus(orderId: string, deliveryStatus: DeliveryStatus) {
    setBusy(orderId);
    await fetch("/api/admin/delivery-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, deliveryStatus }),
    });
    await load();
    if (filter === "history" && historyDate === todayISO()) loadHistory(historyDate);
    setBusy(null);
  }

  const activeOrders   = orders.filter(o => o.delivery_status !== "delivered");
  const activeCount    = activeOrders.length;
  const todayCount     = orders.filter(o => o.delivery_status === "delivered" && isToday(o.created_at)).length;
  const displayedOrders = filter === "active" ? activeOrders : historyOrders;
  const isLoading       = filter === "active" ? loading : historyLoading;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
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

        {/* Tab buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
              filter === "active"
                ? "bg-violet-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => setFilter("history")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
              filter === "history"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <History size={13} />
            История
            {todayCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold ${
                filter === "history" ? "bg-white/25 text-white" : "bg-emerald-500 text-white"
              }`}>
                {todayCount}
              </span>
            )}
          </button>
        </div>

        {/* Date pills — shown only on История tab */}
        {filter === "history" && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
            {DATE_PILLS.map((pill) => (
              <button
                key={pill.iso}
                onClick={() => setHistoryDate(pill.iso)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  historyDate === pill.iso
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History summary banner */}
      {filter === "history" && !historyLoading && (
        <div className="mx-4 mb-1 px-4 py-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/10 flex items-center gap-2 shrink-0">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            {historyOrders.length > 0
              ? `${historyOrders.length} ${historyOrders.length === 1 ? "заказ доставлен" : historyOrders.length < 5 ? "заказа доставлено" : "заказов доставлено"}`
              : "Нет доставленных заказов"}
            {" · "}
            {DATE_PILLS.find(p => p.iso === historyDate)?.label ?? historyDate}
          </span>
        </div>
      )}

      {/* Orders list */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">Загрузка...</div>
        ) : displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            {filter === "active"
              ? <Truck size={36} className="text-zinc-300 dark:text-zinc-700" />
              : <History size={36} className="text-zinc-300 dark:text-zinc-700" />
            }
            <p className="text-zinc-400 dark:text-zinc-600 text-sm">
              {filter === "active" ? "Нет активных заказов доставки" : "Нет доставок за этот день"}
            </p>
          </div>
        ) : (
          displayedOrders.map(order => (
            <DeliveryOrderCard
              key={order.id}
              order={order}
              role={role}
              busy={busy}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              updateStatus={updateStatus}
              filter={filter}
            />
          ))
        )}
      </div>
    </div>
  );
}
