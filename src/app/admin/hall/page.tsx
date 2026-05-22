"use client";

import React, { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Plus, Clock, Calendar, X, Copy, Edit2, Users,
  Check, ChevronLeft, ChevronRight, Printer, ShoppingCart, Settings, Trash2, Lock,
  ArrowLeft, Search, Minus, UtensilsCrossed, Package, Bike, CheckCircle2, MessageSquare,
  Percent, ArrowLeftRight, ChevronDown, ChevronUp, Move, CalendarDays, User, UserCog, MapPin, Phone,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder, DbRestaurant, DbRestaurantTable, DbCategory, DbProduct, DbModifier } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { capFirst } from "@/lib/utils";
import { toast } from "sonner";
import { useUserId, useRole, useDisplayName } from "@/lib/role-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = "free" | "occupied" | "preorder";
type ModifierEntry = { name: string; price: number };
type OrderItem = { name: string; qty: number; price: number; currency: string; original_price?: number; created_at?: string; note?: string; added_by?: string; added_by_role?: string; added_by_name?: string; modifiers?: ModifierEntry[] };
type CartItem  = { cartKey: string; productId: string; name: string; price: number; qty: number; addedAt: string; note?: string; modifiers?: ModifierEntry[] };

interface TableWithStatus {
  table: DbRestaurantTable;
  status: TableStatus;
  order: DbOrder | null;
  orders: DbOrder[];
  preorderOrder: DbOrder | null;
  elapsed: number;
}

// ── Resize ────────────────────────────────────────────────────────────────────

function usePanelResize(key: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState<number>(() => {
    try { const v = localStorage.getItem(key); return v ? parseInt(v, 10) : defaultWidth; } catch { return defaultWidth; }
  });
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (me: MouseEvent) => setWidth(Math.max(min, Math.min(max, startW + startX - me.clientX)));
    const onUp   = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width, min, max]);
  useEffect(() => { try { localStorage.setItem(key, String(width)); } catch {} }, [key, width]);
  return { width, startResize };
}

function ResizeHandle({ onMouseDown, className = "" }: { onMouseDown: React.MouseEventHandler<HTMLDivElement>; className?: string }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`group relative w-2 shrink-0 cursor-col-resize z-10 hover:bg-violet-400/10 transition-colors ${className}`}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-violet-400 transition-colors" />
    </div>
  );
}

// ── Audio ─────────────────────────────────────────────────────────────────────

function playNewOrderSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* audio context unavailable */ }
}

// ── Print stub ────────────────────────────────────────────────────────────────

function handlePrint(order: DbOrder) {
  const items = (Array.isArray(order.items_json) ? order.items_json : []) as OrderItem[];
  const time  = new Date(order.created_at).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  const tableLabel = order.type === "dine-in" ? `Стол ${order.table_number ?? "—"}` : order.type === "delivery" ? "Доставка" : "С собой";

  const rows = items.map((it) => `
    <tr>
      <td class="name">${capFirst(it.name)}<br/>${it.note ? `<span class="note">✎ ${it.note}</span>` : ""}</td>
      <td class="qty">× ${it.qty}</td>
      <td class="price">${(it.price * it.qty).toLocaleString("ru-RU")} ₸</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Чек</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 14px; padding: 16px; max-width: 380px; margin: auto; }
    h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
    .sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 12px; }
    .divider { border-top: 2px dashed #000; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 5px 2px; font-size: 13px; }
    td.name { width: 55%; font-weight: bold; }
    td.qty  { width: 12%; text-align: center; color: #333; }
    td.price{ width: 33%; text-align: right; font-weight: bold; }
    .note { display: block; font-size: 13px; font-weight: bold; font-style: italic; color: #000; background: #ffe; border-left: 3px solid #f90; padding: 2px 6px; margin-top: 3px; }
    .total-row td { font-size: 16px; font-weight: bold; padding-top: 8px; border-top: 2px solid #000; }
    .footer { text-align: center; font-size: 11px; color: #777; margin-top: 12px; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
  <h1>🍽️ Кухонный чек</h1>
  <div class="sub">${tableLabel} &nbsp;·&nbsp; ${time}</div>
  <div class="divider"></div>
  <table>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">Итого</td>
        <td>${(order.total_price ?? 0).toLocaleString("ru-RU")} ₸</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">ID: ${order.id.slice(0, 8).toUpperCase()}</div>
  <script>window.onload = () => { window.print(); }<\/script>
  </body></html>`;

  const w = window.open("", "_blank", "width=420,height=600");
  if (w) { w.document.write(html); w.document.close(); }
  else    { toast.error("Заблокировано браузером — разрешите всплывающие окна"); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getElapsed(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatOrderTime(createdAt: string): string {
  const d = new Date(createdAt);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const time = `${hh}:${mm}`;
  const isToday = d.toISOString().slice(0, 10) === todayISO();
  if (isToday) return time;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month} · ${time}`;
}

function productName(p: DbProduct): string {
  return capFirst(p.name.ru || p.name.en || p.name.kz || "");
}

const METHOD_META: Record<string, { label: string; icon: string }> = {
  cash:              { label: "Наличные",         icon: "💵" },
  kaspi:             { label: "Kaspi",            icon: "🔴" },
  halyk:             { label: "Halyk",            icon: "🟢" },
  terminal:          { label: "Карта (Терминал)", icon: "💳" },
  "card-transfer":   { label: "Перевод на карту", icon: "🏦" },
  "remote-payment":  { label: "Удалённая оплата", icon: "📲" },
  "pay-at-restaurant": { label: "В заведении",   icon: "🏧" },
};

const PREORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Ожидает",   cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"         },
  confirmed: { label: "Принят",    cls: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"             },
  preparing: { label: "Готовится", cls: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"     },
  ready:     { label: "Готов",     cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  completed: { label: "Завершён",  cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"               },
  cancelled: { label: "Отменён",   cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"                },
};

function shortPreorderId(id: string): string {
  return id.startsWith("ORD-") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

// Extracts opening time in minutes-since-midnight from a free-form string like "10:00 – 22:00"
function parseOpeningTime(wh: string | null): number | null {
  if (!wh) return null;
  const m = wh.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveTab = "dine-in" | "takeaway" | "delivery" | "preorder";

export default function HallPage() {
  const [tables, setTables]         = useState<DbRestaurantTable[]>([]);
  const [orders, setOrders]         = useState<DbOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [selected, setSelected]     = useState<string | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [editTable, setEditTable]   = useState<DbRestaurantTable | null>(null);
  const [activeTab, setActiveTab]   = useState<ActiveTab>("dine-in");
  const [tableCreatingOrder, setTableCreatingOrder] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const role                        = useRole();
  const userId                      = useUserId();
  const isWaiter                    = role === "waiter";
  const [waiterNewOrderPicker, setWaiterNewOrderPicker] = useState(false);
  const [waiterAutoOrder, setWaiterAutoOrder]           = useState(false);
  const knownOrderIds               = useRef(new Set<string>());
  const [waiterNames, setWaiterNames] = useState<Record<string, string>>({});
  const [activeShift,   setActiveShift]   = useState<{ id: string; opened_at: string } | null | undefined>(undefined);
  const [shiftCheckins, setShiftCheckins] = useState<{ staff_user_id: string; checked_in_at: string }[]>([]);
  const [myCheckin,     setMyCheckin]     = useState(false);
  const [checkingIn,    setCheckingIn]    = useState(false);
  const [openingShift,  setOpeningShift]  = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [preorders, setPreorders]             = useState<DbOrder[]>([]);
  const [calLoading, setCalLoading]           = useState(false);
  const [calSelectedDate, setCalSelectedDate] = useState<string>(() => todayISO());
  const [calYear, setCalYear]                 = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth]               = useState(() => new Date().getMonth());
  const [restaurant, setRestaurant]           = useState<DbRestaurant | null>(null);
  const [activatedPreorderIds, setActivatedPreorderIds] = useState<Set<string>>(new Set());
  const restaurantRef        = useRef<DbRestaurant | null>(null);
  const preordersRef         = useRef<DbOrder[]>([]);
  const activationCheckedRef = useRef(new Set<string>());

  const handleOrderClosed = useCallback((orderId: string) => {
    knownOrderIds.current.delete(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const [tablesRes, ordersRes] = await Promise.all([
      supabase
        .from(DB_TABLES.restaurantTables)
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_active", true)
        .order("label"),
      supabase
        .from(DB_TABLES.orders)
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (tablesRes.error) {
      console.error("[HallPage] tables fetch error:", tablesRes.error);
      toast.error(`Ошибка загрузки столов: ${tablesRes.error.message}`);
      setLoading(false);
      return;
    }

    const newOrders = (ordersRes.data as DbOrder[]) ?? [];

    if (knownOrderIds.current.size > 0) {
      const incoming = newOrders.filter((o) => !knownOrderIds.current.has(o.id));
      if (incoming.length > 0) {
        playNewOrderSound();
        const o = incoming[0];
        const label = o.type === "delivery"
          ? "Доставка"
          : o.type === "dine-in"
          ? `Стол ${o.table_number ?? "—"}`
          : "С собой";
        toast.success(`Новый заказ · ${label}`, { duration: 6000 });
      }
    }

    knownOrderIds.current = new Set(newOrders.map((o) => o.id));
    setTables((tablesRes.data as DbRestaurantTable[]) ?? []);
    setOrders(newOrders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (!isConfigured) return;

    const channel = supabase
      .channel(`hall-pos-${RESTAURANT_ID}`)
      // INSERT: immediately update local state from payload — no round-trip needed
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DB_TABLES.orders, filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const newOrder = payload.new as DbOrder;
          if (newOrder.status !== "pending" || knownOrderIds.current.has(newOrder.id)) return;
          playNewOrderSound();
          const label =
            newOrder.type === "delivery"   ? "Доставка" :
            newOrder.type === "dine-in"    ? `Стол ${newOrder.table_number ?? "—"}` :
            "С собой";
          toast.success(`Новый заказ · ${label}`, { duration: 6000 });
          // Full re-fetch ensures all columns (incl. customer_phone, delivery_address)
          // are loaded — realtime payload may omit recently-added columns.
          load();
        }
      )
      // UPDATE: completed orders are removed from state instantly; other changes trigger full re-fetch
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DB_TABLES.orders, filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const updated = payload.new as DbOrder;
          if (updated.status === "completed") {
            knownOrderIds.current.delete(updated.id);
            setOrders((prev) => prev.filter((o) => o.id !== updated.id));
          } else {
            load();
          }
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: DB_TABLES.orders }, () => load())
      .on("postgres_changes", { event: "*",      schema: "public", table: DB_TABLES.restaurantTables }, () => load())
      .subscribe((s) => setRealtimeOk(s === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const loadPreordersForMonth = useCallback(async (year: number, month: number) => {
    if (!isConfigured) return;
    setCalLoading(true);
    const from  = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastD = new Date(year, month + 1, 0).getDate();
    const to    = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("order_type", "preorder")
      .neq("status", "completed")
      .neq("status", "cancelled")
      .gte("preorder_date", from)
      .lte("preorder_date", to)
      .order("preorder_date", { ascending: true });
    setPreorders((data as DbOrder[]) ?? []);
    setCalLoading(false);
  }, []);

  useEffect(() => {
    loadPreordersForMonth(calYear, calMonth);
  }, [calYear, calMonth, loadPreordersForMonth]);

  useEffect(() => {
    if (!isConfigured) return;
    const from  = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
    const lastD = new Date(calYear, calMonth + 1, 0).getDate();
    const to    = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
    const channel = supabase
      .channel(`hall-preorders-${calYear}-${calMonth}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        (payload) => {
          const rec = (payload.new ?? payload.old) as DbOrder;
          if (rec.order_type !== "preorder") return;
          if (payload.eventType === "INSERT") {
            if (!rec.preorder_date || rec.preorder_date < from || rec.preorder_date > to) return;
            setPreorders((prev) =>
              [...prev, rec].sort((a, b) => (a.preorder_date ?? "").localeCompare(b.preorder_date ?? "")),
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as DbOrder;
            if (updated.status === "completed" || updated.status === "cancelled") {
              setPreorders((prev) => prev.filter((o) => o.id !== updated.id));
            } else {
              setPreorders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as DbOrder;
            setPreorders((prev) => prev.filter((o) => o.id !== deleted.id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [calYear, calMonth]);

  // Fetch restaurant once on mount (needed for working_hours / opening time)
  useEffect(() => {
    if (!isConfigured) return;
    supabase.from(DB_TABLES.restaurants).select("*").eq("id", RESTAURANT_ID).single()
      .then(({ data }) => { if (data) setRestaurant(data as DbRestaurant); });
  }, []);

  // Fetch staff names once on mount for waiter attribution display
  useEffect(() => {
    fetch("/api/admin/staff")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { staff?: { id: string; display_name: string | null; username: string }[] } | null) => {
        if (!d?.staff) return;
        const map: Record<string, string> = {};
        for (const u of d.staff) {
          map[u.id] = u.display_name || u.username || "Сотрудник";
        }
        setWaiterNames(map);
      })
      .catch(() => {});
  }, []);

  // Fetch active shift + check-ins on mount
  useEffect(() => {
    fetch("/api/admin/shift")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { shift?: { id: string; opened_at: string } | null; checkins?: { staff_user_id: string; checked_in_at: string }[] } | null) => {
        setActiveShift(d?.shift ?? null);
        setShiftCheckins(d?.checkins ?? []);
      })
      .catch(() => setActiveShift(null));
  }, []);

  // Sync myCheckin once userId and shift are loaded
  useEffect(() => {
    if (userId && activeShift !== undefined) {
      setMyCheckin(shiftCheckins.some((c) => c.staff_user_id === userId));
    }
  }, [userId, shiftCheckins, activeShift]);

  // Keep refs in sync for the activation interval (avoids stale closures)
  useEffect(() => { restaurantRef.current = restaurant; }, [restaurant]);
  useEffect(() => { preordersRef.current  = preorders;  }, [preorders]);

  // Auto-activate today's preorders once the restaurant opening time is reached.
  // Runs on mount and re-checks every 60 s. Uses refs to avoid stale closures.
  useEffect(() => {
    async function tryActivate() {
      if (!isConfigured) return;
      const rest    = restaurantRef.current;
      const porders = preordersRef.current;
      if (!rest) return;

      const openingMins = parseOpeningTime(rest.working_hours);
      if (openingMins === null) return;

      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins < openingMins) return;

      const todayStr  = todayISO();
      const toActivate = porders.filter(
        (o) =>
          o.preorder_date === todayStr &&
          o.status !== "completed" &&
          o.status !== "cancelled" &&
          !activationCheckedRef.current.has(o.id),
      );
      if (toActivate.length === 0) return;

      const ids = toActivate.map((o) => o.id);
      const { error } = await supabase
        .from(DB_TABLES.orders)
        .update({ order_type: "asap" })
        .in("id", ids);
      if (error) { console.error("[activateTodayPreorders]", error); return; }

      ids.forEach((id) => activationCheckedRef.current.add(id));
      setPreorders((prev) => prev.filter((o) => !ids.includes(o.id)));
      setActivatedPreorderIds((prev) => new Set([...prev, ...ids]));
      // Add to live orders only if not already present (realtime load() will also fire)
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const newOnes = toActivate
          .map((o) => ({ ...o, order_type: "asap" as const }))
          .filter((o) => !existingIds.has(o.id));
        return [...newOnes, ...prev];
      });

      playNewOrderSound();
      const n = ids.length;
      const suffix = n === 1 ? "" : n < 5 ? "а" : "ов";
      const verbSuffix = n === 1 ? "" : n < 5 ? "ы" : "ы";
      toast.success(
        `${n} предзаказ${suffix} активирован${verbSuffix} — переведены в активные вкладки`,
        { duration: 10_000 },
      );
    }

    tryActivate();
    const interval = setInterval(tryActivate, 60_000);
    return () => clearInterval(interval);
  }, []); // empty — reads latest values via refs

  async function deleteTable(tws: TableWithStatus) {
    if (tws.status !== "free") {
      toast.error("Нельзя удалить занятый стол — сначала закройте заказ");
      return;
    }
    if (!confirm(`Удалить стол «${tws.table.label}»?`)) return;
    const { data: deleted, error } = await supabase
      .from(DB_TABLES.restaurantTables)
      .delete()
      .eq("id", tws.table.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select("id");
    if (error) {
      console.error("[deleteTable] error:", error);
      toast.error(`Ошибка удаления: ${error.message}`);
      return;
    }
    if (!deleted || deleted.length === 0) {
      // RLS silently blocked the DELETE — no error, but 0 rows affected
      console.error("[deleteTable] 0 rows deleted — add DELETE policy on restaurant_tables in Supabase Dashboard");
      toast.error("Нет доступа. Добавьте политику DELETE для таблицы restaurant_tables в Supabase");
      return;
    }
    setTables((prev) => prev.filter((t) => t.id !== tws.table.id));
    if (selected === tws.table.id) setSelected(null);
    toast.success(`Стол ${tws.table.label} удалён`);
  }

  function enterEditMode() {
    setEditMode(true);
    setSelected(null);
  }

  function exitEditMode() {
    setEditMode(false);
  }

  const today = todayISO();
  const tablesWithStatus: TableWithStatus[] = tables.map((table) => {
    const baseLabel = table.label;
    const tableOrders = orders.filter(
      (o) => o.type === "dine-in" && (o.table_number === baseLabel || o.table_number?.startsWith(baseLabel + "."))
    );
    const order = tableOrders.find((o) => o.table_number === baseLabel) ?? tableOrders[0] ?? null;
    const preorderOrder = tableOrders.length === 0
      ? (orders.find(
          (o) => o.order_type === "preorder" && o.table_number === baseLabel && o.preorder_date === today
        ) ?? null)
      : null;
    const status: TableStatus = tableOrders.length > 0 ? "occupied" : preorderOrder ? "preorder" : "free";
    return { table, status, order, orders: tableOrders, preorderOrder, elapsed: order ? getElapsed(order.created_at) : 0 };
  });

  // For waiters: show only their own occupied tables
  const displayedTables = isWaiter
    ? tablesWithStatus.filter((tws) => tws.status === "occupied" && tws.order?.opened_by === userId)
    : tablesWithStatus;

  const occupiedCount  = tablesWithStatus.filter((t) => t.status === "occupied").length;
  const freeCount      = tablesWithStatus.filter((t) => t.status === "free").length;
  const preorderCount  = tablesWithStatus.filter((t) => t.status === "preorder").length;
  const selectedData   = selected ? tablesWithStatus.find((t) => t.table.id === selected) ?? null : null;
  const { width: tablePanelW, startResize: startTableResize } = usePanelResize("hall:tablePanel", 500, 280, 720);

  // Active order = instant order OR preorder scheduled for today
  const isActiveOrder = (o: DbOrder) => o.order_type !== "preorder" || o.preorder_date === today;

  const takeawayOrders = orders
    .filter((o) => o.type !== "dine-in" && o.type !== "delivery" && isActiveOrder(o))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const deliveryOrders = orders
    .filter((o) => o.type === "delivery" && isActiveOrder(o))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // For the dine-in floor plan: badges showing preorders on calSelectedDate
  const preordersByTableLabel: Record<string, number> = {};
  for (const po of preorders) {
    if (po.preorder_date === calSelectedDate && po.table_number &&
        po.status !== "completed" && po.status !== "cancelled") {
      preordersByTableLabel[po.table_number] = (preordersByTableLabel[po.table_number] ?? 0) + 1;
    }
  }

  const upcomingPreorderCount = preorders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled" && o.preorder_date && o.preorder_date >= today,
  ).length;

  const activeWaiters = shiftCheckins.map((c) => ({
    id: c.staff_user_id,
    name: waiterNames[c.staff_user_id] ?? "Сотрудник",
  }));

  async function openShift() {
    setOpeningShift(true);
    try {
      const r = await fetch("/api/admin/shift", { method: "POST" });
      const d = r.ok ? await r.json() : null;
      if (d?.shift) { setActiveShift(d.shift); toast.success("Смена открыта"); }
      else toast.error("Ошибка при открытии смены");
    } catch { toast.error("Ошибка при открытии смены"); }
    setOpeningShift(false);
  }

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      const r = await fetch("/api/admin/shift/checkin", { method: "POST" });
      const d = r.ok ? await r.json() : null;
      if (d?.checkin) {
        setShiftCheckins((prev) => {
          const exists = prev.some((c) => c.staff_user_id === d.checkin.staff_user_id);
          return exists ? prev : [...prev, d.checkin];
        });
        toast.success("Смена начата! Удачной работы 👋");
      } else {
        // Analytics recording failed — let waiter work anyway (checkin is non-blocking)
        toast.error("Аналитика входа недоступна, но смена начата");
      }
    } catch {
      // Same — don't block on network error
    }
    setMyCheckin(true);
    setCheckingIn(false);
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-4 sm:px-6 py-3 border-b border-border shrink-0 flex items-center gap-3 bg-background">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${realtimeOk ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {realtimeOk ? "Realtime" : "Подключение…"}
            </span>
            {activeTab === "dine-in" && (
              <span className="text-xs text-muted-foreground">
                {occupiedCount} занято · {freeCount} своб.
                {preorderCount > 0 && ` · ${preorderCount} пред.`}
              </span>
            )}
          </div>
        </div>

        {isWaiter && activeTab === "dine-in" && (
          <button
            onClick={() => setWaiterNewOrderPicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Новый заказ</span>
          </button>
        )}

        {!isWaiter && activeTab === "dine-in" && editMode && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Добавить стол</span>
          </button>
        )}

        {!isWaiter && activeTab === "dine-in" && (
          <button
            onClick={editMode ? exitEditMode : enterEditMode}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              editMode
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "border border-border hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings size={12} className={editMode ? "animate-spin" : ""} style={{ animationDuration: "3s" }} />
            <span className="hidden sm:inline">{editMode ? "Готово" : "Редактировать зал"}</span>
          </button>
        )}
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-border bg-background px-4 gap-1 pt-1">
        {([
          { id: "dine-in",  icon: UtensilsCrossed, label: "В заведении", count: occupiedCount },
          { id: "takeaway", icon: Package,          label: "С собой",     count: takeawayOrders.length,  waiterHide: true },
          { id: "delivery", icon: Bike,             label: "Доставка",    count: deliveryOrders.length,  waiterHide: true },
          { id: "preorder", icon: CalendarDays,     label: "Предзаказы",  count: upcomingPreorderCount,  waiterHide: true },
        ] as Array<{ id: ActiveTab; icon: React.ElementType; label: string; count: number; waiterHide?: boolean }>)
        .filter((t) => !(isWaiter && t.waiterHide))
        .map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); if (id !== "dine-in") setEditMode(false); }}
            className={`relative flex items-center gap-1.5 px-2 sm:px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-900/10"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
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
        ))}
      </div>

      {/* ── Waiter shift overlay ─────────────────────────────────────────────── */}
      {isWaiter && activeShift !== undefined && !myCheckin && (
        <div className="absolute inset-0 z-40 bg-background flex flex-col items-center justify-center gap-6 p-8 text-center">
          {activeShift === null ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Lock size={28} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold mb-1">Смена не открыта</p>
                <p className="text-sm text-muted-foreground">Обратитесь к менеджеру для открытия смены</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Clock size={28} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-base font-semibold mb-1">Начните свою смену</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Нажмите кнопку — время входа зафиксируется для аналитики
                </p>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors"
              >
                {checkingIn ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Начать смену
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Manager: no shift banner ─────────────────────────────────────────── */}
      {!isWaiter && activeShift === null && (
        <div className="mx-4 mt-3 shrink-0 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center gap-3">
          <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Смена не открыта</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Официанты не смогут начать работу</p>
          </div>
          <button
            onClick={openShift}
            disabled={openingShift}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 transition-colors shrink-0"
          >
            {openingShift ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Открыть смену
          </button>
        </div>
      )}

      {/* ── Edit mode banner ────────────────────────────────────────────────── */}
      {!isWaiter && activeTab === "dine-in" && editMode && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-700/50 shrink-0 flex items-center gap-2">
          <Settings size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Режим редактирования · Занятые столы защищены от изменений · Нажмите «Готово» чтобы вернуться к работе
          </p>
        </div>
      )}

      {/* ── В заведении ─────────────────────────────────────────────────────── */}
      {activeTab === "dine-in" && (
        <>
          {/* Legend */}
          {!isWaiter && (
            <div className="px-6 py-2 flex items-center gap-4 text-xs border-b border-border bg-muted/20 shrink-0">
              <LegendDot color="emerald" label="Свободен" />
              <LegendDot color="red"     label="Занят"    />
              <LegendDot color="amber"   label="Предзаказ" />
            </div>
          )}

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Table grid — hidden while creating a new order, or when panel is open on mobile */}
            {!tableCreatingOrder && !(isMobile && selectedData) && (
              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
                    <Loader2 size={16} className="animate-spin" /> Загрузка…
                  </div>
                ) : displayedTables.length === 0 ? (
                  isWaiter ? (
                    <WaiterEmptyDineIn onNew={() => setWaiterNewOrderPicker(true)} />
                  ) : (
                    <EmptyState onAdd={() => { setEditMode(true); setAddOpen(true); }} />
                  )
                ) : (
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: isWaiter
                      ? "repeat(auto-fill, minmax(80px, 1fr))"
                      : "repeat(auto-fill, minmax(140px, 1fr))" }}
                  >
                    {displayedTables.map((tws) => (
                      <TableCard
                        key={tws.table.id}
                        tws={tws}
                        isSelected={!editMode && selected === tws.table.id}
                        editMode={editMode}
                        compact={isWaiter}
                        waiterNames={waiterNames}
                        onClick={() => {
                          if (editMode) return;
                          const next = selected === tws.table.id ? null : tws.table.id;
                          setSelected(next);
                          if (!next) setTableCreatingOrder(false);
                        }}
                        onEdit={() => {
                          if (tws.status !== "free") {
                            toast.error("Нельзя редактировать занятый стол");
                            return;
                          }
                          setEditTable(tws.table);
                        }}
                        onDelete={() => deleteTable(tws)}
                        preorderCount={preordersByTableLabel[tws.table.label] ?? 0}
                        isActivatedPreorder={tws.order ? activatedPreorderIds.has(tws.order.id) : false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!editMode && selectedData && (
              <>
                {!tableCreatingOrder && !isMobile && <ResizeHandle onMouseDown={startTableResize} />}
                <TablePanel
                  key={selectedData.table.id}
                  data={selectedData}
                  width={tableCreatingOrder || isMobile ? undefined : tablePanelW}
                  fullWidth={isMobile}
                  autoOrder={waiterAutoOrder}
                  waiterNames={waiterNames}
                  activeWaiters={activeWaiters}
                  onClose={() => { setSelected(null); setTableCreatingOrder(false); setWaiterAutoOrder(false); }}
                  onRefresh={load}
                  onOrderClosed={(id) => { handleOrderClosed(id); setTableCreatingOrder(false); setWaiterAutoOrder(false); }}
                  onOrderTransferred={(orderId, newTableNumber) => {
                    setOrders((prev) =>
                      prev.map((o) => (o.id === orderId ? { ...o, table_number: newTableNumber } : o))
                    );
                    setSelected(null);
                    setTableCreatingOrder(false);
                    setWaiterAutoOrder(false);
                  }}
                  allTables={tablesWithStatus}
                  onEnterOrderMode={() => setTableCreatingOrder(true)}
                  onExitOrderMode={() => { setTableCreatingOrder(false); setWaiterAutoOrder(false); }}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ── С собой ─────────────────────────────────────────────────────────── */}
      {activeTab === "takeaway" && (
        <PickupDeliveryGrid
          orders={takeawayOrders}
          loading={loading}
          orderType="takeaway"
          onRefresh={load}
          onOrderClosed={handleOrderClosed}
          allTables={tablesWithStatus}
          activatedPreorderIds={activatedPreorderIds}
          waiterNames={waiterNames}
          activeWaiters={activeWaiters}
        />
      )}

      {/* ── Доставка ────────────────────────────────────────────────────────── */}
      {activeTab === "delivery" && (
        <PickupDeliveryGrid
          orders={deliveryOrders}
          loading={loading}
          orderType="delivery"
          onRefresh={load}
          onOrderClosed={handleOrderClosed}
          allTables={tablesWithStatus}
          activatedPreorderIds={activatedPreorderIds}
          waiterNames={waiterNames}
          activeWaiters={activeWaiters}
        />
      )}

      {/* ── Предзаказы ─────────────────────────────────────────────────────────── */}
      {activeTab === "preorder" && (
        <PreorderCalendarView
          preorders={preorders}
          calLoading={calLoading}
          todayStr={today}
          selectedDate={calSelectedDate}
          setSelectedDate={setCalSelectedDate}
          calYear={calYear}
          calMonth={calMonth}
          setCalYear={(y) => setCalYear(y)}
          setCalMonth={(m) => setCalMonth(m)}
        />
      )}

      {/* Modals */}
      {(addOpen || editTable) && (
        <TableFormModal
          key={editTable?.id ?? "new"}
          table={editTable}
          onClose={() => { setAddOpen(false); setEditTable(null); }}
          onSaved={() => { setAddOpen(false); setEditTable(null); load(); }}
        />
      )}

      {waiterNewOrderPicker && (
        <WaiterTablePickerModal
          allTables={tablesWithStatus}
          currentUserId={userId}
          onClose={() => setWaiterNewOrderPicker(false)}
          onSelect={(table) => {
            setWaiterNewOrderPicker(false);
            setSelected(table.id);
            setWaiterAutoOrder(true);
            setTableCreatingOrder(true);
          }}
        />
      )}
    </div>
  );
}

// ── LegendDot ─────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: "emerald" | "red" | "amber"; label: string }) {
  const cls = color === "emerald" ? "bg-emerald-500" : color === "red" ? "bg-red-500" : "bg-amber-400";
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <div className={`w-2 h-2 rounded-full ${cls}`} />
      {label}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <span className="text-5xl select-none">🪑</span>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Столов пока нет</p>
        <p className="text-xs mt-1">Откройте режим редактирования, чтобы создать план зала</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
      >
        <Plus size={13} />
        Добавить первый стол
      </button>
    </div>
  );
}

// ── WaiterEmptyDineIn ─────────────────────────────────────────────────────────

function WaiterEmptyDineIn({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <span className="text-5xl select-none">🪑</span>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Нет активных столов</p>
        <p className="text-xs mt-1 max-w-[220px] mx-auto">
          У вас нет активных столов. Нажмите Плюс, чтобы открыть новый стол.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
      >
        <Plus size={13} />
        Новый заказ
      </button>
    </div>
  );
}

// ── WaiterTablePickerModal ────────────────────────────────────────────────────

function WaiterTablePickerModal({
  allTables,
  currentUserId,
  onClose,
  onSelect,
}: {
  allTables: TableWithStatus[];
  currentUserId: string | null;
  onClose: () => void;
  onSelect: (table: DbRestaurantTable) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl border border-border flex flex-col overflow-hidden"
          style={{ maxHeight: "80vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <p className="font-semibold text-sm">Выбрать стол</p>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {allTables.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Столы не настроены</p>
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
                {allTables.map((tws) => {
                  const isFree     = tws.status === "free";
                  const isOccupied = tws.status === "occupied";
                  const isPreorder = tws.status === "preorder";
                  return (
                    <button
                      key={tws.table.id}
                      disabled={!isFree}
                      onClick={() => isFree && onSelect(tws.table)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border py-3 px-2 transition-all active:scale-95 ${
                        isFree
                          ? "border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 cursor-pointer hover:shadow-sm"
                          : "border-zinc-200 dark:border-zinc-700/40 bg-zinc-50 dark:bg-zinc-800/30 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight text-center break-words w-full">{tws.table.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tws.table.seats} мест</p>
                      {isFree && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {isOccupied && (
                        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          Занят
                        </span>
                      )}
                      {isPreorder && (
                        <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          Бронь
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── TableCard ─────────────────────────────────────────────────────────────────

function TableCard({
  tws,
  isSelected,
  editMode,
  compact = false,
  waiterNames = {},
  onClick,
  onEdit,
  onDelete,
  preorderCount = 0,
  isActivatedPreorder = false,
}: {
  tws: TableWithStatus;
  isSelected: boolean;
  editMode: boolean;
  compact?: boolean;
  waiterNames?: Record<string, string>;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  preorderCount?: number;
  isActivatedPreorder?: boolean;
}) {
  const { table, status, order, preorderOrder, elapsed } = tws;
  const isLocked = status !== "free";

  const palette = {
    free: {
      card:   "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/40",
      dot:    "bg-emerald-500",
      number: "text-foreground",
      badge:  "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
    },
    occupied: {
      card:   "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-700/40",
      dot:    "bg-red-500",
      number: "text-foreground",
      badge:  "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
    },
    preorder: {
      card:   "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/40",
      dot:    "bg-amber-400",
      number: "text-foreground",
      badge:  "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
    },
  }[status];

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`
          relative flex flex-col items-center justify-center rounded-xl border select-none py-2.5 px-1
          transition-all duration-150 cursor-pointer active:scale-95
          ${palette.card}
          ${isSelected ? "ring-2 ring-violet-500 ring-offset-1 shadow-md" : "hover:shadow-sm"}
        `}
      >
        <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${palette.dot} ${status === "occupied" ? "animate-pulse" : ""}`} />
        <p className="text-xs font-bold leading-tight text-foreground text-center w-full px-1 break-words line-clamp-2">{table.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{table.seats} мест</p>
        {status === "occupied" && (
          <div className="flex items-center gap-0.5 mt-1">
            <Clock size={9} className="text-red-500 shrink-0" />
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{formatElapsed(elapsed)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col rounded-xl border-2 select-none
        transition-all duration-150
        ${palette.card}
        ${!editMode ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
        ${isActivatedPreorder ? "ring-2 ring-violet-500 ring-offset-2 shadow-lg animate-pulse" : isSelected ? "ring-2 ring-violet-500 ring-offset-2 shadow-md" : ""}
        ${editMode && isLocked ? "opacity-60" : ""}
      `}
    >
      {/* Status dot */}
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${palette.dot} ${status === "occupied" ? "animate-pulse" : ""}`} />

      {/* "Новый предзаказ" badge for just-activated preorders */}
      {isActivatedPreorder && !editMode && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-600 text-white text-[9px] font-bold shadow-sm z-10">
          🔔 Новый предзаказ
        </div>
      )}

      {/* Lock badge in edit mode for occupied tables */}
      {editMode && isLocked && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-white text-[10px] font-medium">
          <Lock size={9} />
          Занят
        </div>
      )}

      {/* Card body */}
      <div className="p-4 pb-3 flex-1">
        {/* Table number */}
        <p className="text-4xl font-black leading-none text-foreground mb-1.5 mt-1">
          {table.label}
        </p>

        {/* Seats */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
          <Users size={11} />
          {table.seats} мест
        </div>

        {/* Status content */}
        {status === "occupied" && order && (
          <div className="space-y-1">
            <p className="text-xl font-black text-foreground">
              {tws.orders.reduce((s, o) => s + (o.total_price ?? 0), 0).toLocaleString("ru-RU")} ₸
            </p>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {formatElapsed(elapsed)}
              </span>
            </div>
            {Array.isArray(order.items_json) && (order.items_json as OrderItem[]).length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {tws.orders.reduce((s, o) => s + (Array.isArray(o.items_json) ? (o.items_json as OrderItem[]).length : 0), 0)} позиц.
              </p>
            )}
            {tws.orders.length > 1 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                {tws.orders.length} счёта
              </span>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <User size={9} className="text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">
                {order.opened_by ? (waiterNames[order.opened_by] ?? "Сотрудник") : "Администратор"}
              </span>
            </div>
          </div>
        )}

        {status === "preorder" && preorderOrder && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Calendar size={11} className="text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {[preorderOrder.preorder_date, preorderOrder.preorder_time?.slice(0, 5)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        )}

        {status === "free" && (
          <div className="flex flex-col gap-1">
            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              Свободен
            </span>
            {preorderCount > 0 && (
              <div className="flex items-center gap-1">
                <CalendarDays size={10} className="text-violet-500 shrink-0" />
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold">
                  {preorderCount} предзак.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit mode controls */}
      {editMode && (
        <div className="border-t border-black/5 dark:border-white/5 px-3 py-2 flex items-center justify-end gap-1">
          {isLocked ? (
            <span className="text-[10px] text-muted-foreground italic">Закройте заказ</span>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Редактировать"
              >
                <Edit2 size={11} />
                Изменить
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Удалить"
              >
                <Trash2 size={11} />
                Удалить
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── OrderSlotCard ─────────────────────────────────────────────────────────────

function OrderSlotCard({
  order,
  index,
  isSelected,
  onClick,
  onPay,
  isActivatedPreorder = false,
}: {
  order: DbOrder;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onPay: () => void;
  isActivatedPreorder?: boolean;
}) {
  const isWaiter   = useRole() === "waiter";
  const elapsed = getElapsed(order.created_at);
  const shortId = order.id.startsWith("ORD-") ? order.id : `#${order.id.slice(0, 8)}`;
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const queueNum = String(index).padStart(2, "0");
  const isOverdue = elapsed >= 30;
  const prepaid    = order.paid_amount ?? 0;
  const balanceDue = Math.max(0, (order.total_price ?? 0) - prepaid);

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col rounded-xl border-2 select-none cursor-pointer
        transition-all duration-150
        bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/40
        hover:shadow-md hover:-translate-y-0.5
        ${isActivatedPreorder ? "ring-2 ring-violet-500 ring-offset-2 shadow-lg animate-pulse" : isSelected ? "ring-2 ring-violet-500 ring-offset-2 shadow-md" : ""}
      `}
    >
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-pulse ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />

      {/* Badge for just-activated preorders */}
      {isActivatedPreorder && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-600 text-white text-[9px] font-bold shadow-sm z-10">
          🔔 Новый предзаказ
        </div>
      )}

      <div className="p-4 pb-3 flex-1">
        {/* Queue number + order ID */}
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-4xl font-black tabular-nums leading-none ${isOverdue ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`}>
            {queueNum}
          </span>
          <p className="text-[10px] font-mono text-muted-foreground/60 mb-0.5 pr-4">{shortId}</p>
        </div>

        {order.table_number && (
          <p className="text-sm font-bold text-foreground truncate mb-1">{order.table_number}</p>
        )}
        <p className="text-lg font-black text-foreground">
          {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Clock size={11} className="text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {formatElapsed(elapsed)}
          </span>
        </div>
        {items.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">{items.length} позиц.</p>
        )}
      </div>

      {!isWaiter && (
        <div className="border-t border-amber-200/60 dark:border-amber-700/30 px-3 py-2">
          <button
            onClick={(e) => { e.stopPropagation(); onPay(); }}
            className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-colors"
          >
            <CheckCircle2 size={11} />
            {prepaid > 0
              ? `Остаток: ${balanceDue.toLocaleString("ru-RU")} ₸`
              : "Оплатить"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── VoidItemModal ─────────────────────────────────────────────────────────────

type VoidType = "input_error" | "waste";
const VOID_REASONS = ["Перепутал стол", "Брак кухни", "Отказ гостя"] as const;

function VoidItemModal({
  item, maxQty, onConfirm, onClose,
}: {
  item: OrderItem;
  maxQty: number;
  onConfirm: (qty: number, reason: string, voidType: VoidType) => Promise<void>;
  onClose: () => void;
}) {
  const [qty, setQty]           = useState(1);
  const [voidType, setVoidType] = useState<VoidType>("input_error");
  const [reason, setReason]     = useState<string>(VOID_REASONS[0]);
  const [busy, setBusy]         = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await onConfirm(qty, reason, voidType);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl p-5 shadow-2xl w-80 mx-4 border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 size={14} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Удалить позицию</p>
            <p className="text-xs text-muted-foreground truncate">{capFirst(item.name)}</p>
          </div>
        </div>

        {maxQty > 1 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground font-medium">Количество:</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 transition-colors">
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 transition-colors">
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Тип отмены:</p>
          <button onClick={() => setVoidType("input_error")}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${voidType === "input_error" ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20" : "border-border hover:bg-accent"}`}>
            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${voidType === "input_error" ? "border-amber-500 bg-amber-500" : "border-border"}`}>
              {voidType === "input_error" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Ошибка ввода</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Без списания продуктов</p>
            </div>
          </button>
          <button onClick={() => setVoidType("waste")}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${voidType === "waste" ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" : "border-border hover:bg-accent"}`}>
            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${voidType === "waste" ? "border-red-500 bg-red-500" : "border-border"}`}>
              {voidType === "waste" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Косяк / Списание</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Продукты списываются со склада</p>
            </div>
          </button>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Причина:</p>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-violet-400">
            {VOID_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
            Отмена
          </button>
          <button onClick={handleConfirm} disabled={busy}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${voidType === "waste" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}>
            {busy ? "…" : `Удалить${qty > 1 ? ` ×${qty}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OrderSlotPanel ────────────────────────────────────────────────────────────

function OrderSlotPanel({
  order,
  onClose,
  onRefresh,
  onOrderClosed,
  allTables,
  width,
  waiterNames = {},
  activeWaiters = [],
}: {
  order: DbOrder;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  allTables: TableWithStatus[];
  width?: number;
  waiterNames?: Record<string, string>;
  activeWaiters?: { id: string; name: string }[];
}) {
  const isWaiter   = useRole() === "waiter";
  const userId     = useUserId();
  const displayName = useDisplayName();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedId, setCopiedId]                 = useState(false);
  const [showMenuPicker, setShowMenuPicker]     = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showTypeModal, setShowTypeModal]       = useState(false);
  const [editingNoteIdx, setEditingNoteIdx]     = useState<number | null>(null);
  const [noteInput, setNoteInput]               = useState("");
  const [savingNote, setSavingNote]             = useState(false);
  const [voidingItem, setVoidingItem]           = useState<{ idx: number; item: OrderItem } | null>(null);
  const [selectedItemIdx, setSelectedItemIdx]   = useState<number | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigning, setReassigning]             = useState(false);

  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);
  const total      = order.total_price ?? 0;
  const prepaid    = order.paid_amount ?? 0;
  const balanceDue = Math.max(0, total - prepaid);
  const elapsed  = getElapsed(order.created_at);
  const typeLabel = order.type === "delivery" ? "Доставка" : "С собой";
  const typeIcon  = order.type === "delivery" ? "🛵" : "🛍️";

  async function copyId(id: string) {
    try { await navigator.clipboard.writeText(id); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  async function saveNote(idx: number, note: string) {
    setSavingNote(true);
    const updated = items.map((it, i) => i === idx ? { ...it, note: note.trim() || undefined } : it);
    const { data, error } = await supabase
      .from(DB_TABLES.orders)
      .update({ items_json: updated })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select("id");
    setSavingNote(false);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    if (!data || data.length === 0) { toast.error("Не сохранено — проверьте RLS"); return; }
    setEditingNoteIdx(null);
    onRefresh();
  }

  async function voidItem(idx: number, qty: number, reason: string, voidType: string) {
    const item = items[idx];
    await fetch("/api/admin/voids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: order.id,
        item_name: item.name,
        item_price: item.price,
        quantity: qty,
        reason,
        void_type: voidType,
        voided_by: userId ?? undefined,
        voided_by_name: displayName ?? undefined,
        table_number: order.table_number ?? order.type,
      }),
    }).catch(() => {/* non-blocking */});
    const updated = qty >= item.qty
      ? items.filter((_, i) => i !== idx)
      : items.map((it, i) => i === idx ? { ...it, qty: it.qty - qty } : it);
    const newTotal = updated.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: updated, total_price: newTotal }).eq("id", order.id).eq("restaurant_id", RESTAURANT_ID);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    toast.success(`Удалено: ${capFirst(item.name)}${qty > 1 ? ` ×${qty}` : ""}`);
    setVoidingItem(null);
    setSelectedItemIdx(null);
    onRefresh();
  }

  async function handleReassign(newWaiterId: string | null) {
    setReassigning(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ opened_by: newWaiterId })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID);
    setReassigning(false);
    if (error) { toast.error("Ошибка при переназначении"); return; }
    toast.success("Официант переназначен");
    setShowReassignModal(false);
    onRefresh();
  }

  return (
    <aside className="shrink-0 flex flex-col bg-background overflow-hidden" style={{ width: width ?? 500 }}>
      {/* Reassign waiter modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReassignModal(false)}>
          <div className="bg-card rounded-2xl p-5 shadow-xl w-72 mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-0.5">Переназначить официанта</p>
            <p className="text-xs text-muted-foreground mb-4">{typeLabel}</p>
            <div className="space-y-1 mb-3">
              {activeWaiters.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleReassign(w.id)}
                  disabled={reassigning}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    order.opened_by === w.id
                      ? "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <User size={13} className="shrink-0 text-muted-foreground" />
                  {w.name}
                  {order.opened_by === w.id && <Check size={12} className="ml-auto text-violet-600" />}
                </button>
              ))}
              <button
                onClick={() => handleReassign(null)}
                disabled={reassigning}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                <X size={13} className="shrink-0" />
                Убрать назначение
              </button>
            </div>
            <button
              onClick={() => setShowReassignModal(false)}
              className="w-full py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors border border-border"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span>{typeIcon}</span>
            <p className="font-semibold text-sm">{typeLabel}</p>
          </div>
          {order.table_number && <p className="text-[11px] text-muted-foreground mt-0.5">{order.table_number}</p>}
          {!isWaiter && (
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User size={9} className="shrink-0" />
                <span className="font-medium">
                  {order.opened_by ? (waiterNames[order.opened_by] ?? "Сотрудник") : "Администратор"}
                </span>
              </p>
              {activeWaiters.length > 0 && (
                <button
                  onClick={() => setShowReassignModal(true)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-violet-600 transition-colors"
                  title="Переназначить официанта"
                >
                  <UserCog size={10} />
                </button>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          <div className="flex items-center justify-between">
            <button onClick={() => copyId(order.id)} className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors" title="Скопировать ID">
              <span className="max-w-[140px] truncate">#{order.id}</span>
              {copiedId ? <Check size={11} className="text-emerald-500 shrink-0" /> : <Copy size={11} className="shrink-0" />}
            </button>
            {!isWaiter && (
              <button onClick={() => handlePrint(order)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Printer size={12} /> Чек
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Время ожидания</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-base font-black text-amber-800 dark:text-amber-200 tabular-nums">{formatOrderTime(order.created_at)}</p>
                <p className="text-xs font-semibold text-amber-500/80 tabular-nums">{formatElapsed(elapsed)}</p>
              </div>
            </div>
          </div>

          {/* Delivery / Pickup info block */}
          <div className={`px-4 py-3 rounded-xl border ${
            order.type === "delivery"
              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700/40"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700/40"
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${
              order.type === "delivery" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
            }`}>
              {order.type === "delivery" ? "🚚 Доставка" : "🛍️ С собой"}
            </p>
            <div className="space-y-1.5">
              {order.customer_name && (
                <div className="flex items-center gap-2">
                  <User size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold">{order.customer_name}</span>
                </div>
              )}
              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-muted-foreground shrink-0" />
                  <a href={`tel:${order.customer_phone}`} className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
                    {order.customer_phone}
                  </a>
                </div>
              )}
              {order.customer_city && (
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{order.customer_city}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm leading-snug">{order.delivery_address}</span>
                </div>
              )}
              {order.payment_method && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/60 mt-1">
                  <span className="text-[12px] leading-none">{METHOD_META[order.payment_method]?.icon ?? "💳"}</span>
                  <span className="text-sm text-muted-foreground">{METHOD_META[order.payment_method]?.label ?? order.payment_method}</span>
                </div>
              )}
            </div>
          </div>

          {order.customer_comments && (
            <div className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Пожелания</p>
              <p className="text-sm leading-snug">{order.customer_comments}</p>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Состав · {items.length} позиц.</p>
              {groupOrderItems(items.map((it, i) => ({ ...it, _idx: i })), order.created_at).map((group, gi) => (
                <div key={gi}>
                  {gi === 0 ? (
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">Заказ · {group.label}</p>
                  ) : (
                    <div className="flex items-center gap-2 my-2.5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">
                        Дозаказ в {group.label}{formatAddedByLabel(group.addedByRole, group.addedByName)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="rounded-xl border border-border overflow-hidden mb-1">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => { setSelectedItemIdx(prev => prev === item._idx ? null : item._idx); if (editingNoteIdx !== null && editingNoteIdx !== item._idx) setEditingNoteIdx(null); }}
                        className={`px-3 py-2 text-sm cursor-pointer transition-colors ${selectedItemIdx === item._idx ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-accent/50"} ${i < group.items.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-start gap-1.5 flex-wrap">
                              <span className="text-muted-foreground break-words">
                                {capFirst(item.name)}
                                <span className="ml-1 text-muted-foreground/60">× {item.qty}</span>
                              </span>
                            </div>
                            {item.modifiers?.map((mod, mi) => (
                              <p key={mi} className="text-[11px] text-violet-500 dark:text-violet-400 leading-tight mt-0.5">+ {mod.name} <span className="text-muted-foreground/50">(+{mod.price} ₸)</span></p>
                            ))}
                            {item.note && editingNoteIdx !== item._idx && (
                              <p className="text-[11px] italic text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
                                ✎ {item.note}
                              </p>
                            )}
                            {editingNoteIdx === item._idx && (
                              <div className="mt-1.5 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={noteInput}
                                  onChange={e => setNoteInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") { void saveNote(item._idx, noteInput); }
                                    if (e.key === "Escape") { setEditingNoteIdx(null); }
                                  }}
                                  placeholder="Пожелание к блюду…"
                                  className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded-md border border-violet-400 bg-background focus:outline-none"
                                />
                                <button
                                  onClick={() => { void saveNote(item._idx, noteInput); }}
                                  disabled={savingNote}
                                  className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                >
                                  {savingNote ? "…" : "OK"}
                                </button>
                                <button
                                  onClick={() => setEditingNoteIdx(null)}
                                  className="shrink-0 text-[10px] px-1.5 py-1 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
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
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedItemIdx !== null && !isWaiter && (() => {
            const selItem = items[selectedItemIdx];
            if (!selItem) return null;
            return (
              <div className="rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10 p-2.5">
                <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium mb-2 truncate px-0.5">
                  {capFirst(selItem.name)} ×{selItem.qty}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setEditingNoteIdx(selectedItemIdx); setNoteInput(selItem.note ?? ""); }}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-background text-[11px] text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors"
                  >
                    <MessageSquare size={11} />
                    {selItem.note ? "Изменить заметку" : "Добавить заметку"}
                  </button>
                  <button
                    onClick={() => setVoidingItem({ idx: selectedItemIdx, item: selItem })}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-red-200 dark:border-red-800 bg-background text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={11} />
                    Удалить / Списать
                  </button>
                </div>
              </div>
            );
          })()}

          <div>
            <button
              onClick={() => setShowMenuPicker(true)}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border hover:border-violet-400 hover:text-violet-600 text-xs text-muted-foreground transition-colors"
            >
              <Plus size={12} /> Выбрать из меню
            </button>
            {showMenuPicker && (
              <MenuPickerModal
                orderId={order.id}
                existingItems={items}
                orderCreatedAt={order.created_at}
                onDone={() => { setShowMenuPicker(false); onRefresh(); }}
                onClose={() => setShowMenuPicker(false)}
              />
            )}
          </div>

          {!isWaiter && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-border hover:border-violet-400 hover:text-violet-600 text-muted-foreground transition-colors"
                >
                  <Percent size={14} />
                  <span className="text-[10px] font-medium">Скидка</span>
                </button>
                <button
                  onClick={() => setShowTypeModal(true)}
                  className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-border hover:border-violet-400 hover:text-violet-600 text-muted-foreground transition-colors"
                >
                  <ArrowLeftRight size={14} />
                  <span className="text-[10px] font-medium">Изменить тип</span>
                </button>
              </div>
              {showDiscountModal && (
                <DiscountModal
                  orderId={order.id}
                  existingItems={items}
                  onDone={() => { setShowDiscountModal(false); onRefresh(); }}
                  onClose={() => setShowDiscountModal(false)}
                />
              )}
              {showTypeModal && (
                <ChangeOrderTypeModal
                  orderId={order.id}
                  currentType={order.type}
                  allTables={allTables}
                  onDone={() => { setShowTypeModal(false); onRefresh(); onClose(); }}
                  onClose={() => setShowTypeModal(false)}
                />
              )}
            </>
          )}

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Итого</span>
              <span className={`text-xs font-semibold tabular-nums ${prepaid > 0 ? "text-muted-foreground/50 line-through" : ""}`}>
                {total.toLocaleString("ru-RU")} ₸
              </span>
            </div>
            {savedAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Скидка</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">
                  −{savedAmount.toLocaleString("ru-RU")} ₸
                </span>
              </div>
            )}
            {prepaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  {order.prepayment_method && METHOD_META[order.prepayment_method]
                    ? <>{METHOD_META[order.prepayment_method].icon} Предоплата <span className="text-muted-foreground/60">({METHOD_META[order.prepayment_method].label})</span></>
                    : "Предоплата"
                  }
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums font-semibold">
                  −{prepaid.toLocaleString("ru-RU")} ₸
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
              <span className="text-sm font-bold">{prepaid > 0 ? "Остаток" : "К оплате"}</span>
              <span className={`text-2xl font-black tabular-nums ${prepaid > 0 ? "text-violet-600 dark:text-violet-400" : ""}`}>
                {(prepaid > 0 ? balanceDue : total).toLocaleString("ru-RU")} ₸
              </span>
            </div>
          </div>

          {!isWaiter && (
            <button onClick={() => setShowPaymentModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
              <Check size={15} />
              {prepaid > 0 ? `Оплатить остаток: ${balanceDue.toLocaleString("ru-RU")} ₸` : "Оплатить"}
            </button>
          )}

        </div>
      </div>
      {!isWaiter && showPaymentModal && (
        <PaymentModal
          order={order}
          onDone={() => { setShowPaymentModal(false); onOrderClosed(order.id); onClose(); onRefresh(); }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
      {voidingItem && (
        <VoidItemModal
          item={voidingItem.item}
          maxQty={voidingItem.item.qty}
          onConfirm={(qty, reason, voidType) => voidItem(voidingItem.idx, qty, reason, voidType)}
          onClose={() => setVoidingItem(null)}
        />
      )}
    </aside>
  );
}

// ── PickupDeliveryGrid ────────────────────────────────────────────────────────

function PickupDeliveryGrid({
  orders,
  loading,
  orderType,
  onRefresh,
  onOrderClosed,
  allTables,
  activatedPreorderIds,
  waiterNames = {},
  activeWaiters = [],
}: {
  orders: DbOrder[];
  loading: boolean;
  orderType: "takeaway" | "delivery";
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  allTables: TableWithStatus[];
  activatedPreorderIds?: Set<string>;
  waiterNames?: Record<string, string>;
  activeWaiters?: { id: string; name: string }[];
}) {
  const [selected, setSelected]     = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [payingOrder, setPayingOrder] = useState<DbOrder | null>(null);
  const { width: slotPanelW, startResize: startSlotResize } = usePanelResize("hall:orderSlotPanel", 500, 280, 720);

  const selectedOrder = selected ? orders.find((o) => o.id === selected) ?? null : null;
  const emptyIcon = orderType === "delivery" ? "🛵" : "🛍️";
  const emptyText = orderType === "delivery" ? "Нет активных заказов на доставку" : "Нет активных заказов с собой";

  if (creating) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <OrderPanel
          orderType={orderType}
          onBack={() => setCreating(false)}
          onDone={() => { setCreating(false); onRefresh(); }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin" /> Загрузка…
          </div>
        ) : (
          <>
            <button
              onClick={() => setCreating(true)}
              className="mb-5 w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 text-sm font-semibold text-violet-600 dark:text-violet-400 transition-colors"
            >
              <Plus size={16} />
              Новый заказ
            </button>

            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                <span className="text-5xl select-none">{emptyIcon}</span>
                <p className="text-sm">{emptyText}</p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                {orders.map((order, i) => (
                  <OrderSlotCard
                    key={order.id}
                    order={order}
                    index={i + 1}
                    isSelected={selected === order.id}
                    onClick={() => setSelected(selected === order.id ? null : order.id)}
                    onPay={() => setPayingOrder(order)}
                    isActivatedPreorder={activatedPreorderIds?.has(order.id) ?? false}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedOrder && (
        <>
          <ResizeHandle onMouseDown={startSlotResize} />
          <OrderSlotPanel
            key={selectedOrder.id}
            order={selectedOrder}
            width={slotPanelW}
            onClose={() => setSelected(null)}
            onRefresh={onRefresh}
            onOrderClosed={onOrderClosed}
            allTables={allTables}
            waiterNames={waiterNames}
            activeWaiters={activeWaiters}
          />
        </>
      )}

      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          onDone={() => {
            const id = payingOrder.id;
            setPayingOrder(null);
            onOrderClosed(id);
            if (selected === id) setSelected(null);
            onRefresh();
          }}
          onClose={() => setPayingOrder(null)}
        />
      )}
    </div>
  );
}

// ── PaymentModal ──────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { id: "cash",     label: "Наличные",        icon: "💵" },
  { id: "kaspi",    label: "Kaspi",            icon: "🔴" },
  { id: "halyk",    label: "Halyk",            icon: "🟢" },
  { id: "terminal", label: "Карта (Терминал)", icon: "💳" },
] as const;

type PaymentMethodId = typeof PAYMENT_METHODS[number]["id"];
type AmountsMap = Record<PaymentMethodId, string>;

const EMPTY_AMOUNTS: AmountsMap = { cash: "", kaspi: "", halyk: "", terminal: "" };

function PaymentModal({
  order,
  tableName,
  onDone,
  onClose,
}: {
  order: DbOrder;
  tableName?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [mixed, setMixed]               = useState(false);
  const [singleMethod, setSingleMethod] = useState<PaymentMethodId | null>(null);
  const [amounts, setAmounts]           = useState<AmountsMap>(EMPTY_AMOUNTS);
  const [saving, setSaving]             = useState(false);

  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);
  const total      = order.total_price ?? 0;
  const prepaid    = order.paid_amount ?? 0;
  const balanceDue = Math.max(0, total - prepaid);

  const totalEntered = PAYMENT_METHODS.reduce((s, m) => s + (parseFloat(amounts[m.id]) || 0), 0);
  const remaining    = balanceDue - totalEntered;
  const isOverpaid   = totalEntered > balanceDue + 0.01;
  const isExact      = Math.abs(remaining) < 0.01;
  const canConfirm   = mixed ? (isExact && !isOverpaid) : singleMethod !== null;

  function setAmount(id: PaymentMethodId, value: string) {
    const clean = value.replace(/[^\d.]/g, "").replace(/(\.\d*)\.+/g, "$1");
    setAmounts(prev => ({ ...prev, [id]: clean }));
  }

  function fillRemainder(id: PaymentMethodId) {
    const others = PAYMENT_METHODS.filter(m => m.id !== id).reduce((s, m) => s + (parseFloat(amounts[m.id]) || 0), 0);
    const rem = balanceDue - others;
    if (rem > 0) setAmounts(prev => ({ ...prev, [id]: String(Math.round(rem)) }));
  }

  async function confirm() {
    if (!canConfirm || saving) return;
    setSaving(true);

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      closed_at: new Date().toISOString(),
    };

    if (mixed) {
      const details: Record<string, number> = {};
      for (const m of PAYMENT_METHODS) {
        const v = parseFloat(amounts[m.id]) || 0;
        if (v > 0) details[m.id] = v;
      }
      updatePayload.payment_method  = "mixed";
      updatePayload.payment_details = details;
    } else {
      updatePayload.payment_method  = singleMethod;
      updatePayload.payment_details = null;
    }

    const { data, error } = await supabase
      .from(DB_TABLES.orders)
      .update(updatePayload)
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select("id");
    setSaving(false);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    if (!data || data.length === 0) { toast.error("Заказ не обновлён — проверьте RLS в Supabase"); return; }
    toast.success("Оплата принята!");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-[400px] max-w-[95vw] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Завершение заказа</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Total */}
        <div className="px-5 pt-5 pb-4 text-center">
          {tableName && <p className="text-xs text-muted-foreground mb-1.5">Стол {tableName}</p>}
          {prepaid > 0 ? (
            <>
              <p className="text-3xl font-black tabular-nums leading-none text-muted-foreground/50 line-through">
                {total.toLocaleString("ru-RU")} ₸
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center justify-center gap-1">
                {order.prepayment_method && METHOD_META[order.prepayment_method] && (
                  <span className="leading-none">{METHOD_META[order.prepayment_method].icon}</span>
                )}
                Предоплата −{prepaid.toLocaleString("ru-RU")} ₸
                {order.prepayment_method && METHOD_META[order.prepayment_method] && (
                  <span className="text-[11px] font-normal text-muted-foreground">({METHOD_META[order.prepayment_method].label})</span>
                )}
              </p>
              <p className="text-5xl font-black tabular-nums leading-none mt-2">
                {balanceDue.toLocaleString("ru-RU")} ₸
              </p>
              {savedAmount > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                  Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">К оплате сейчас</p>
            </>
          ) : (
            <>
              <p className="text-5xl font-black tabular-nums leading-none">{total.toLocaleString("ru-RU")} ₸</p>
              {savedAmount > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                  Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">К оплате</p>
            </>
          )}
        </div>

        {/* Mode toggle */}
        <div className="px-5 pb-3">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            <button
              onClick={() => { setMixed(false); setSingleMethod(null); setAmounts(EMPTY_AMOUNTS); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!mixed ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Один способ
            </button>
            <button
              onClick={() => { setMixed(true); setSingleMethod(null); setAmounts(EMPTY_AMOUNTS); }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mixed ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Смешанная оплата
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 space-y-3">
          {!mixed ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Способ оплаты</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSingleMethod(m.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 text-sm font-semibold transition-all ${
                      singleMethod === m.id
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 scale-[1.02]"
                        : "border-border hover:border-violet-300 hover:bg-accent/60 text-foreground"
                    }`}
                  >
                    <span className="text-xl leading-none">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Распределите сумму</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <span className="text-lg leading-none shrink-0 w-6 text-center">{m.icon}</span>
                    <span className="text-sm font-medium w-32 shrink-0">{m.label}</span>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={amounts[m.id]}
                        onChange={e => setAmount(m.id, e.target.value)}
                        className="w-full pr-6 pl-2.5 py-2 text-sm font-semibold rounded-lg border border-border bg-background focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 tabular-nums text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">₸</span>
                    </div>
                    <button
                      onClick={() => fillRemainder(m.id)}
                      title="Заполнить остаток"
                      className="shrink-0 text-[9px] font-bold px-1.5 py-1.5 rounded-md bg-accent hover:bg-violet-100 dark:hover:bg-violet-900/30 text-muted-foreground hover:text-violet-600 transition-colors leading-none"
                    >
                      ↙ ост.
                    </button>
                  </div>
                ))}
              </div>

              {/* Remainder indicator */}
              <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                isOverpaid
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  : isExact
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}>
                <span>
                  {isOverpaid ? "Введено лишнее" : isExact ? "Сумма совпадает ✓" : "Осталось оплатить"}
                </span>
                {!isExact && (
                  <span className="tabular-nums">{Math.abs(remaining).toLocaleString("ru-RU")} ₸</span>
                )}
              </div>
            </>
          )}

          <button
            onClick={confirm}
            disabled={!canConfirm || saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Сохранение…</>
              : <><Check size={15} /> Подтвердить оплату</>}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── TablePanel ────────────────────────────────────────────────────────────────

function TablePanel({
  data,
  onClose,
  onRefresh,
  onOrderClosed,
  onOrderTransferred,
  allTables,
  width,
  fullWidth,
  autoOrder,
  waiterNames = {},
  activeWaiters = [],
  onEnterOrderMode,
  onExitOrderMode,
}: {
  data: TableWithStatus;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  onOrderTransferred: (orderId: string, newTableNumber: string) => void;
  allTables: TableWithStatus[];
  width?: number;
  fullWidth?: boolean;
  autoOrder?: boolean;
  waiterNames?: Record<string, string>;
  activeWaiters?: { id: string; name: string }[];
  onEnterOrderMode?: () => void;
  onExitOrderMode?: () => void;
}) {
  const isWaiter    = useRole() === "waiter";
  const userId      = useUserId();
  const displayName = useDisplayName();
  const { table, status, order, preorderOrder, elapsed } = data;
  const [panelMode, setPanelMode]                 = useState<"info" | "order">(() =>
    (data.status === "free" && autoOrder) ? "order" : "info"
  );
  const [showPaymentModal, setShowPaymentModal]   = useState(false);
  const [copiedId, setCopiedId]                   = useState(false);
  const [changingTable, setChangingTable]         = useState(false);
  const [showMenuPicker, setShowMenuPicker]       = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showTypeModal, setShowTypeModal]         = useState(false);
  const [editingNoteIdx, setEditingNoteIdx]       = useState<number | null>(null);
  const [noteInput, setNoteInput]                 = useState("");
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigning, setReassigning]             = useState(false);
  const [savingNote, setSavingNote]               = useState(false);
  const [voidingItem, setVoidingItem]             = useState<{ idx: number; item: OrderItem } | null>(null);
  const [selectedItemIdx, setSelectedItemIdx]     = useState<number | null>(null);
  const [viewingOrderId, setViewingOrderId]       = useState<string | null>(null);
  const [subOrderLabel, setSubOrderLabel]         = useState<string | null>(null);

  const allTableOrders = data.orders.length > 0 ? data.orders : (order ? [order] : []);
  const activeOrder = allTableOrders.find((o) => o.id === viewingOrderId) ?? order ?? preorderOrder;

  // When auto-order is triggered (waiter picked a free table), notify parent to hide grid
  useEffect(() => {
    if (autoOrder && data.status === "free") {
      onEnterOrderMode?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNewSubOrder() {
    const existingLabels = new Set(data.orders.map((o) => o.table_number));
    let i = 1;
    while (existingLabels.has(`${data.table.label}.${i}`)) i++;
    setSubOrderLabel(`${data.table.label}.${i}`);
    setPanelMode("order");
    onEnterOrderMode?.();
  }
  const items: OrderItem[] = Array.isArray(activeOrder?.items_json)
    ? (activeOrder!.items_json as OrderItem[])
    : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);
  const prepaid    = activeOrder?.paid_amount ?? 0;
  const balanceDue = Math.max(0, (activeOrder?.total_price ?? 0) - prepaid);
  const prepayMeta = activeOrder?.prepayment_method ? METHOD_META[activeOrder.prepayment_method] : null;

  // ── Order creation mode ──────────────────────────────────────────────────────
  if (panelMode === "order") {
    return (
      <aside className="flex-1 border-l border-border flex flex-col bg-background overflow-hidden">
        <OrderPanel
          table={table}
          tableLabel={subOrderLabel ?? undefined}
          onBack={() => { setPanelMode("info"); setSubOrderLabel(null); onExitOrderMode?.(); }}
          onDone={() => { setPanelMode("info"); setSubOrderLabel(null); onExitOrderMode?.(); onRefresh(); }}
        />
      </aside>
    );
  }

  // ── Info mode ────────────────────────────────────────────────────────────────

  async function changeTable(targetLabel: string) {
    if (!order || !targetLabel) return;
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ table_number: targetLabel })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID);
    if (error) { toast.error(`Ошибка переноса: ${error.message}`); return; }
    toast.success(`Заказ перенесён: стол ${table.label} → стол ${targetLabel}`);
    setChangingTable(false);
    onOrderTransferred(order.id, targetLabel);
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function saveNote(idx: number, note: string) {
    if (!activeOrder) return;
    setSavingNote(true);
    const updated = items.map((it, i) => i === idx ? { ...it, note: note.trim() || undefined } : it);
    const { data, error } = await supabase
      .from(DB_TABLES.orders)
      .update({ items_json: updated })
      .eq("id", activeOrder.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select("id");
    setSavingNote(false);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    if (!data || data.length === 0) { toast.error("Не сохранено — проверьте RLS"); return; }
    setEditingNoteIdx(null);
    onRefresh();
  }

  async function voidItem(idx: number, qty: number, reason: string, voidType: string) {
    if (!activeOrder) return;
    const item = items[idx];
    await fetch("/api/admin/voids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: activeOrder.id,
        item_name: item.name,
        item_price: item.price,
        quantity: qty,
        reason,
        void_type: voidType,
        voided_by: userId ?? undefined,
        voided_by_name: displayName ?? undefined,
        table_number: table.label,
      }),
    }).catch(() => {/* non-blocking */});
    const updated = qty >= item.qty
      ? items.filter((_, i) => i !== idx)
      : items.map((it, i) => i === idx ? { ...it, qty: it.qty - qty } : it);
    const newTotal = updated.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: updated, total_price: newTotal }).eq("id", activeOrder.id).eq("restaurant_id", RESTAURANT_ID);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    toast.success(`Удалено: ${capFirst(item.name)}${qty > 1 ? ` ×${qty}` : ""}`);
    setVoidingItem(null);
    setSelectedItemIdx(null);
    onRefresh();
  }

  async function handleReassign(newWaiterId: string | null) {
    if (!activeOrder) return;
    setReassigning(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ opened_by: newWaiterId })
      .eq("id", activeOrder.id)
      .eq("restaurant_id", RESTAURANT_ID);
    setReassigning(false);
    if (error) { toast.error("Ошибка при переназначении"); return; }
    toast.success("Официант переназначен");
    setShowReassignModal(false);
    onRefresh();
  }

  return (
    <aside
      className={fullWidth ? "flex-1 flex flex-col bg-background overflow-hidden" : "shrink-0 flex flex-col bg-background overflow-hidden"}
      style={fullWidth ? undefined : { width: width ?? 500 }}
    >

      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <p className="font-semibold text-sm">Стол {table.label}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users size={10} />
            {table.seats} мест ·{" "}
            <span className={
              status === "occupied" ? "text-red-500" :
              status === "preorder" ? "text-amber-500" : "text-emerald-600"
            }>
              {status === "free" ? "Свободен" : status === "occupied" ? "Занят" : "Предзаказ"}
            </span>
          </p>
          {!isWaiter && status === "occupied" && (
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User size={9} className="shrink-0" />
                Официант:{" "}
                <span className="font-medium">
                  {activeOrder?.opened_by
                    ? (waiterNames[activeOrder.opened_by] ?? "Сотрудник")
                    : "Администратор"}
                </span>
              </p>
              {activeWaiters.length > 0 && (
                <button
                  onClick={() => setShowReassignModal(true)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-violet-600 transition-colors"
                  title="Переназначить официанта"
                >
                  <UserCog size={10} />
                </button>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Reassign waiter modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReassignModal(false)}>
          <div className="bg-card rounded-2xl p-5 shadow-xl w-72 mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-0.5">Переназначить официанта</p>
            <p className="text-xs text-muted-foreground mb-4">Стол {table.label}</p>
            <div className="space-y-1 mb-3">
              {activeWaiters.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleReassign(w.id)}
                  disabled={reassigning}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    activeOrder?.opened_by === w.id
                      ? "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <User size={13} className="shrink-0 text-muted-foreground" />
                  {w.name}
                  {activeOrder?.opened_by === w.id && <Check size={12} className="ml-auto text-violet-600" />}
                </button>
              ))}
              <button
                onClick={() => handleReassign(null)}
                disabled={reassigning}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                <X size={13} className="shrink-0" />
                Убрать назначение
              </button>
            </div>
            <button
              onClick={() => setShowReassignModal(false)}
              className="w-full py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors border border-border"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Sub-table tab switcher (shown only when multiple active orders) */}
      {allTableOrders.length > 1 && (
        <div className="px-5 py-2.5 border-b border-border shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Счета за столом</p>
          <div className="flex gap-1.5 flex-wrap">
            {allTableOrders.map((o) => {
              const isActive = viewingOrderId ? viewingOrderId === o.id : o.id === (order?.id ?? allTableOrders[0]?.id);
              return (
                <button
                  key={o.id}
                  onClick={() => setViewingOrderId(o.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    isActive
                      ? "bg-violet-600 text-white border-violet-600"
                      : "border-border text-muted-foreground hover:border-violet-400 hover:text-violet-600"
                  }`}
                >
                  {o.table_number} · {(o.total_price ?? 0).toLocaleString("ru-RU")} ₸
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Free table ── */}
        {status === "free" && (
          <div className="p-5 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mt-4">
              <span className="text-2xl">🟢</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Стол свободен</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto">
                Гости заказывают через QR, или кассир открывает заказ вручную
              </p>
            </div>
            <button
              onClick={() => { setPanelMode("order"); onEnterOrderMode?.(); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
            >
              <ShoppingCart size={14} /> Принять заказ
            </button>
          </div>
        )}

        {/* ── Occupied / Preorder ── */}
        {(status === "occupied" || status === "preorder") && activeOrder && (
          <div className="p-5 space-y-5">

            {/* Order header row */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => copyId(activeOrder.id)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Скопировать ID"
              >
                <span className="max-w-[140px] truncate">#{activeOrder.id}</span>
                {copiedId
                  ? <Check size={11} className="text-emerald-500 shrink-0" />
                  : <Copy size={11} className="shrink-0" />
                }
              </button>
              {!isWaiter && (
                <button
                  onClick={() => handlePrint(activeOrder)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  title="Печать чека"
                >
                  <Printer size={12} />
                  Чек
                </button>
              )}
            </div>

            {/* Time / preorder badge */}
            {status === "occupied" && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Clock size={15} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Время за столом</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-base font-black text-red-800 dark:text-red-200 tabular-nums">
                      {formatOrderTime(activeOrder.created_at)}
                    </p>
                    <p className="text-xs font-semibold text-red-500/80 tabular-nums">
                      {formatElapsed(elapsed)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === "preorder" && activeOrder.preorder_date && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Calendar size={15} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Предзаказ на</p>
                  <p className="text-base font-black text-amber-800 dark:text-amber-200">
                    {[activeOrder.preorder_date, activeOrder.preorder_time?.slice(0, 5)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* Guest comments */}
            {activeOrder.customer_comments && (
              <div className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Пожелания</p>
                <p className="text-sm leading-snug">{activeOrder.customer_comments}</p>
              </div>
            )}

            {/* Items list */}
            {items.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Состав · {items.length} позиц.
                </p>
                {groupOrderItems(items.map((it, i) => ({ ...it, _idx: i })), activeOrder.created_at).map((group, gi) => (
                  <div key={gi}>
                    {gi === 0 ? (
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">Заказ · {group.label}</p>
                    ) : (
                      <div className="flex items-center gap-2 my-2.5">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">
                          Дозаказ в {group.label}{formatAddedByLabel(group.addedByRole, group.addedByName)}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className="rounded-xl border border-border overflow-hidden mb-1">
                      {group.items.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => { setSelectedItemIdx(prev => prev === item._idx ? null : item._idx); if (editingNoteIdx !== null && editingNoteIdx !== item._idx) setEditingNoteIdx(null); }}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors ${selectedItemIdx === item._idx ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-accent/50"} ${i < group.items.length - 1 ? "border-b border-border" : ""}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-start gap-1.5 flex-wrap">
                                <span className="text-muted-foreground break-words">
                                  {capFirst(item.name)}
                                  <span className="ml-1 text-muted-foreground/60">× {item.qty}</span>
                                </span>
                              </div>
                              {item.modifiers?.map((mod, mi) => (
                                <p key={mi} className="text-[11px] text-violet-500 dark:text-violet-400 leading-tight mt-0.5">+ {mod.name} <span className="text-muted-foreground/50">(+{mod.price} ₸)</span></p>
                              ))}
                              {item.note && editingNoteIdx !== item._idx && (
                                <p className="text-[11px] italic text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
                                  ✎ {item.note}
                                </p>
                              )}
                              {editingNoteIdx === item._idx && (
                                <div className="mt-1.5 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    value={noteInput}
                                    onChange={e => setNoteInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { void saveNote(item._idx, noteInput); }
                                      if (e.key === "Escape") { setEditingNoteIdx(null); }
                                    }}
                                    placeholder="Пожелание к блюду…"
                                    className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded-md border border-violet-400 bg-background focus:outline-none"
                                  />
                                  <button
                                    onClick={() => { void saveNote(item._idx, noteInput); }}
                                    disabled={savingNote}
                                    className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                  >
                                    {savingNote ? "…" : "OK"}
                                  </button>
                                  <button
                                    onClick={() => setEditingNoteIdx(null)}
                                    className="shrink-0 text-[10px] px-1.5 py-1 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
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
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedItemIdx !== null && !isWaiter && (() => {
              const selItem = items[selectedItemIdx];
              if (!selItem) return null;
              return (
                <div className="rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10 p-2.5">
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium mb-2 truncate px-0.5">
                    {capFirst(selItem.name)} ×{selItem.qty}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setEditingNoteIdx(selectedItemIdx); setNoteInput(selItem.note ?? ""); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-background text-[11px] text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors"
                    >
                      <MessageSquare size={11} />
                      {selItem.note ? "Изменить заметку" : "Добавить заметку"}
                    </button>
                    <button
                      onClick={() => setVoidingItem({ idx: selectedItemIdx, item: selItem })}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-red-200 dark:border-red-800 bg-background text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={11} />
                      Удалить / Списать
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Add from menu + action buttons */}
            {status === "occupied" && activeOrder && (
              <>
                <div>
                  <button
                    onClick={() => setShowMenuPicker(true)}
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border hover:border-violet-400 hover:text-violet-600 text-xs text-muted-foreground transition-colors"
                  >
                    <Plus size={12} />
                    Выбрать из меню
                  </button>
                  {showMenuPicker && (
                    <MenuPickerModal
                      orderId={activeOrder.id}
                      existingItems={items}
                      orderCreatedAt={activeOrder.created_at}
                      onDone={() => { setShowMenuPicker(false); onRefresh(); }}
                      onClose={() => setShowMenuPicker(false)}
                    />
                  )}
                </div>

                {!isWaiter && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setShowDiscountModal(true)}
                        className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-border hover:border-violet-400 hover:text-violet-600 text-muted-foreground transition-colors"
                      >
                        <Percent size={14} />
                        <span className="text-[10px] font-medium">Скидка</span>
                      </button>
                      <button
                        onClick={() => setShowTypeModal(true)}
                        className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-border hover:border-violet-400 hover:text-violet-600 text-muted-foreground transition-colors"
                      >
                        <ArrowLeftRight size={14} />
                        <span className="text-[10px] font-medium">Тип заказа</span>
                      </button>
                      <button
                        onClick={() => setChangingTable(true)}
                        className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-border hover:border-violet-400 hover:text-violet-600 text-muted-foreground transition-colors"
                      >
                        <Move size={14} />
                        <span className="text-[10px] font-medium">Перенести</span>
                      </button>
                    </div>

                    {changingTable && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Выберите стол для переноса:
                        </p>
                        <div className="grid grid-cols-4 gap-1 max-h-44 overflow-y-auto admin-scroll">
                          {allTables
                            .filter((tws) => tws.table.id !== table.id)
                            .map((tws) => {
                              const isFree = tws.status === "free";
                              return (
                                <button
                                  key={tws.table.id}
                                  onClick={() => changeTable(tws.table.label)}
                                  disabled={!isFree}
                                  title={isFree ? `Перенести на стол ${tws.table.label}` : "Стол занят"}
                                  className={`h-10 rounded-lg text-xs font-bold border transition-colors ${
                                    isFree
                                      ? "border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                      : "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                                  }`}
                                >
                                  {tws.table.label}
                                </button>
                              );
                            })}
                        </div>
                        <button
                          onClick={() => setChangingTable(false)}
                          className="w-full h-8 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
                        >
                          Отмена
                        </button>
                      </div>
                    )}

                    {showDiscountModal && (
                      <DiscountModal
                        orderId={activeOrder.id}
                        existingItems={items}
                        onDone={() => { setShowDiscountModal(false); onRefresh(); }}
                        onClose={() => setShowDiscountModal(false)}
                      />
                    )}
                    {showTypeModal && (
                      <ChangeOrderTypeModal
                        orderId={activeOrder.id}
                        currentType="dine-in"
                        allTables={allTables}
                        onDone={() => { setShowTypeModal(false); onRefresh(); onClose(); }}
                        onClose={() => setShowTypeModal(false)}
                      />
                    )}
                  </>
                )}

                {data.orders.length < 5 && (
                  <button
                    onClick={openNewSubOrder}
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border hover:border-violet-400 hover:text-violet-600 text-xs text-muted-foreground transition-colors"
                  >
                    <Plus size={12} />
                    Открыть новый счёт за этим столом
                  </button>
                )}
              </>
            )}

            {/* Total */}
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Итого</span>
                <span className={`text-xs font-semibold tabular-nums ${prepaid > 0 ? "text-muted-foreground/50 line-through" : ""}`}>
                  {(activeOrder.total_price ?? 0).toLocaleString("ru-RU")} ₸
                </span>
              </div>
              {savedAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Скидка</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">
                    −{savedAmount.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
              )}
              {prepaid > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    {prepayMeta
                      ? <>{prepayMeta.icon} Предоплата <span className="text-muted-foreground/60">({prepayMeta.label})</span></>
                      : "Предоплата"
                    }
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums font-semibold">
                    −{prepaid.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                <span className="text-sm font-bold">{prepaid > 0 ? "Остаток" : "К оплате"}</span>
                <span className={`text-2xl font-black tabular-nums ${prepaid > 0 ? "text-violet-600 dark:text-violet-400" : ""}`}>
                  {(prepaid > 0 ? balanceDue : (activeOrder.total_price ?? 0)).toLocaleString("ru-RU")} ₸
                </span>
              </div>
            </div>

            {/* Close order */}
            {!isWaiter && status === "occupied" && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                <Check size={15} />
                {prepaid > 0 ? `Оплатить остаток: ${balanceDue.toLocaleString("ru-RU")} ₸` : "Оплатить"}
              </button>
            )}

          </div>
        )}
      </div>
      {!isWaiter && showPaymentModal && order && (
        <PaymentModal
          order={order}
          tableName={table.label}
          onDone={() => { setShowPaymentModal(false); onOrderClosed(order.id); onClose(); onRefresh(); }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
      {voidingItem && (
        <VoidItemModal
          item={voidingItem.item}
          maxQty={voidingItem.item.qty}
          onConfirm={(qty, reason, voidType) => voidItem(voidingItem.idx, qty, reason, voidType)}
          onClose={() => setVoidingItem(null)}
        />
      )}
    </aside>
  );
}

// Groups any items with an optional created_at by time, with 2-min tolerance.
// Items missing created_at fall back to fallbackTimestamp (e.g. order.created_at).
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

// Convenience wrapper for CartItem (uses addedAt as created_at).
function groupCartByTime(items: CartItem[]): Array<{ label: string; timeMs: number; items: CartItem[] }> {
  return groupOrderItems(items.map((ci) => ({ ...ci, created_at: ci.addedAt })), new Date().toISOString());
}

// ── PosMenuBrowser ────────────────────────────────────────────────────────────
// Shared POS catalog browser used by both OrderPanel (creation) and
// MenuPickerModal (add-to-existing). Renders as a fragment filling
// whatever flex-col container the caller provides.

function PosMenuBrowser({
  mode,
  panelTitle = "Выбрать из меню",
  onBack,
  extraHeader,
  existingItems,
  orderCreatedAt,
  addedByRole,
  addedByName,
  confirmLabel,
  onConfirm,
}: {
  mode: "panel" | "modal";
  panelTitle?: string;
  onBack: () => void;
  extraHeader?: ReactNode;
  existingItems?: OrderItem[];
  orderCreatedAt?: string;
  addedByRole?: string;
  addedByName?: string;
  confirmLabel: string;
  onConfirm: (items: OrderItem[]) => Promise<void>;
}) {
  const [categories, setCategories]      = useState<DbCategory[]>([]);
  const [products, setProducts]          = useState<DbProduct[]>([]);
  const [dbModifiers, setDbModifiers]    = useState<DbModifier[]>([]);
  const [catLoading, setCatLoading]      = useState(true);
  const [currentCatId, setCurrentCatId]     = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [cart, setCart]                     = useState<Map<string, CartItem>>(new Map());
  const [confirming, setConfirming]         = useState(false);
  const [openIngredients, setOpenIngredients]                = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId]   = useState<string | null>(null);
  const [noteInput, setNoteInput]           = useState("");
  const [localExisting, setLocalExisting]   = useState<OrderItem[]>(existingItems ?? []);
  const [pendingProduct, setPendingProduct] = useState<DbProduct | null>(null);
  const [selectedMods, setSelectedMods]     = useState<Set<string>>(new Set());
  const { width: cartW, startResize: startCartResize }       = usePanelResize("hall:cartPanel", 360, 260, 520);

  function toggleIngredients(id: string) {
    setOpenIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function decrementExisting(idx: number) {
    setLocalExisting((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      if (item.qty <= 1) return prev.filter((_, i) => i !== idx);
      return prev.map((it, i) => i === idx ? { ...it, qty: it.qty - 1 } : it);
    });
  }

  useEffect(() => {
    async function fetchCatalog() {
      const [catsRes, prodsRes, modsRes] = await Promise.all([
        supabase.from(DB_TABLES.categories).select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index"),
        supabase.from(DB_TABLES.products).select("*").eq("restaurant_id", RESTAURANT_ID).eq("is_archived", false).order("order_index"),
        supabase.from("modifiers").select("*").eq("restaurant_id", RESTAURANT_ID).eq("is_active", true).order("order_index"),
      ]);
      setCategories((catsRes.data as DbCategory[]) ?? []);
      setProducts((prodsRes.data as DbProduct[]) ?? []);
      setDbModifiers((modsRes.data as DbModifier[]) ?? []);
      setCatLoading(false);
    }
    fetchCatalog();
  }, []);

  function effPrice(product: DbProduct): number {
    if (!product.is_promo || !product.discount_label) return product.price;
    const pct = parseInt(product.discount_label, 10);
    if (isNaN(pct) || pct <= 0 || pct >= 100) return product.price;
    return Math.round(product.price * (1 - pct / 100));
  }

  function catModifiersFor(product: DbProduct): DbModifier[] {
    return dbModifiers.filter(
      m => m.product_id === product.id ||
           (m.product_id === null && m.category_id === product.category_id)
    );
  }

  function addToCart(product: DbProduct) {
    const mods = catModifiersFor(product);
    if (mods.length > 0) {
      setPendingProduct(product);
      setSelectedMods(new Set());
      return;
    }
    commitToCart(product, []);
  }

  function commitToCart(product: DbProduct, chosenMods: DbModifier[]) {
    const name      = productName(product);
    const basePrice = effPrice(product);
    const modPrice  = chosenMods.reduce((s, m) => s + m.price, 0);
    const price     = basePrice + modPrice;
    const modEntries: ModifierEntry[] = chosenMods.map(m => ({ name: m.name, price: m.price }));
    const cartKey = chosenMods.length > 0
      ? `${product.id}:${chosenMods.map(m => m.id).sort().join(",")}`
      : product.id;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(cartKey);
      next.set(cartKey, existing
        ? { ...existing, qty: existing.qty + 1 }
        : { cartKey, productId: product.id, name, price, qty: 1, addedAt: new Date().toISOString(), modifiers: modEntries.length > 0 ? modEntries : undefined }
      );
      return next;
    });
    setPendingProduct(null);
    setSelectedMods(new Set());
  }

  function incrementCart(cartKey: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(cartKey);
      if (!existing) return prev;
      next.set(cartKey, { ...existing, qty: existing.qty + 1 });
      return next;
    });
  }

  function decrementCart(cartKey: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(cartKey);
      if (!existing) return prev;
      if (existing.qty <= 1) next.delete(cartKey);
      else next.set(cartKey, { ...existing, qty: existing.qty - 1 });
      return next;
    });
  }

  function setNoteForItem(cartKey: string, note: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const item = next.get(cartKey);
      if (!item) return prev;
      next.set(cartKey, { ...item, note: note.trim() || undefined });
      return next;
    });
  }

  const cartItems = Array.from(cart.values());
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const existingTotal = localExisting.reduce((s, i) => s + i.price * i.qty, 0);
  const existingGroups = localExisting.length
    ? groupOrderItems(localExisting, orderCreatedAt ?? new Date().toISOString())
    : [];
  const newGroups = groupCartByTime(cartItems);

  const trimmed      = search.trim().toLowerCase();
  const isSearching  = trimmed.length > 0;
  const showProducts = isSearching || currentCatId !== null;
  const currentCat   = categories.find((c) => c.id === currentCatId);

  const visibleProducts = products.filter((p) => {
    if (!p.is_available) return false;
    if (isSearching) {
      return (
        p.name.ru.toLowerCase().includes(trimmed) ||
        p.name.en.toLowerCase().includes(trimmed) ||
        p.name.kz.toLowerCase().includes(trimmed)
      );
    }
    return p.category_id === currentCatId;
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  async function handleConfirm() {
    if (localExisting.length === 0 && cartItems.length === 0) return;
    setConfirming(true);
    const newItems: OrderItem[] = cartItems.map((ci) => {
      const prod = productMap.get(ci.productId);
      const item: OrderItem = { name: ci.name, qty: ci.qty, price: ci.price, currency: "₸", created_at: ci.addedAt };
      if (prod && prod.is_promo && prod.discount_label) item.original_price = prod.price;
      if (ci.note) item.note = ci.note;
      if (ci.modifiers?.length) item.modifiers = ci.modifiers;
      if (addedByRole) item.added_by_role = addedByRole;
      if (addedByName) item.added_by_name = addedByName;
      return item;
    });
    await onConfirm([...localExisting, ...newItems]);
    setConfirming(false);
  }

  const headerTitle = (mode === "modal" && showProducts && !isSearching && currentCat)
    ? (currentCat.name.ru || currentCat.name.en)
    : panelTitle;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        {mode === "panel" && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 text-xs font-medium"
          >
            <ArrowLeft size={14} />
            К столам
          </button>
        )}
        {mode === "modal" && showProducts && !isSearching && (
          <button
            onClick={() => setCurrentCatId(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-accent/70 hover:bg-accent hover:border-violet-400 text-sm font-semibold text-foreground transition-colors shrink-0 mr-1 min-h-[36px]"
          >
            <ChevronLeft size={15} className="text-violet-500 shrink-0" />
            <span>Все категории</span>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{headerTitle}</p>
          {mode === "modal" && !showProducts && (
            <p className="text-[11px] text-muted-foreground">Выберите категорию</p>
          )}
        </div>
        <div className="relative shrink-0">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className="h-8 pl-7 pr-3 w-28 sm:w-36 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        {mode === "modal" && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Extra header slot (e.g. customer name input) */}
      {extraHeader}

      {/* Two-panel body */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

        {/* LEFT: catalog */}
        <div className="flex-1 min-w-0 overflow-y-auto admin-scroll">
          {catLoading ? (
            <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground text-xs">
              <Loader2 size={14} className="animate-spin" /> Загрузка меню…
            </div>
          ) : !showProducts ? (
            /* Screen 1: category / subcategory grid */
            <div className="p-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
              {categories.map((cat) => {
                const count     = products.filter(p => p.category_id === cat.id && p.is_available).length;
                const cartInCat = products
                  .filter(p => p.category_id === cat.id)
                  .reduce((s, p) => {
                    let q = 0;
                    cart.forEach(ci => { if (ci.productId === p.id) q += ci.qty; });
                    return s + q;
                  }, 0);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCurrentCatId(cat.id)}
                    className="relative flex flex-col justify-between rounded-xl border border-border bg-card p-3 hover:border-violet-400 dark:hover:border-violet-500 active:scale-[0.97] transition-all text-left min-h-[56px]"
                  >
                    <p className="text-xs font-semibold leading-tight line-clamp-3 text-foreground pr-5">
                      {capFirst(cat.name.ru || cat.name.en)}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 gap-1">
                      <span className="text-[10px] text-muted-foreground">{count} поз.</span>
                      {cartInCat > 0 && (
                        <span className="min-w-[18px] h-[18px] px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {cartInCat}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Product list */
            <div>
              {mode === "panel" && !isSearching && (
                <div className="sticky top-0 z-10 bg-background px-3 pt-2.5 pb-2 border-b border-border/50 shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                  <button
                    onClick={() => setCurrentCatId(null)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-border bg-accent/70 hover:bg-accent hover:border-violet-400 active:scale-[0.98] text-sm font-semibold text-foreground transition-all min-h-[42px]"
                  >
                    <ChevronLeft size={16} className="text-violet-500 shrink-0" />
                    Все категории
                  </button>
                </div>
              )}
              {visibleProducts.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10">
                  {isSearching ? "Ничего не найдено" : "Нет доступных позиций"}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {visibleProducts.map((product) => {
                    const hasMods = catModifiersFor(product).length > 0;
                    const inCart  = hasMods ? null : cart.get(product.id);
                    const name    = productName(product);
                    const ep     = effPrice(product);
                    const hasDiscount = product.is_promo && !!product.discount_label && ep < product.price;
                    const compositionText = product.ingredients || product.description?.ru || product.description?.en || "";
                    const isOpen = openIngredients.has(product.id);
                    return (
                      <div key={product.id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {/* Name + состав toggle */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight text-foreground">{name}</p>
                            {compositionText && (
                              <button
                                onClick={() => toggleIngredients(product.id)}
                                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-violet-500 transition-colors mt-0.5"
                              >
                                <span>Состав</span>
                                <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>
                          {/* Price */}
                          <div className="shrink-0 text-right min-w-[60px]">
                            {hasDiscount && (
                              <p className="text-[10px] text-muted-foreground/60 line-through tabular-nums">
                                {product.price.toLocaleString("ru-RU")} ₸
                              </p>
                            )}
                            <p className={`text-sm font-black tabular-nums ${hasDiscount ? "text-orange-500" : "text-foreground"}`}>
                              {ep.toLocaleString("ru-RU")} ₸
                            </p>
                          </div>
                          {/* +/- control */}
                          <div className="shrink-0 flex items-center gap-1">
                            {inCart ? (
                              <>
                                <button
                                  onClick={() => decrementCart(product.id)}
                                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.qty}</span>
                                <button
                                  onClick={() => incrementCart(product.id)}
                                  className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors"
                                >
                                  <Plus size={11} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => addToCart(product)}
                                className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-colors"
                              >
                                <Plus size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Ingredient accordion */}
                        {isOpen && compositionText && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                            {compositionText}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: cart panel — desktop only */}
        <ResizeHandle onMouseDown={startCartResize} className="hidden sm:block" />
        <div className="hidden sm:flex shrink-0 flex-col bg-card/30" style={{ width: cartW }}>
          <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center gap-2">
            <ShoppingCart size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground flex-1">
              {mode === "panel" ? "Заказ" : "Чек"}
            </span>
            {(cartCount + (existingItems?.reduce((s, i) => s + i.qty, 0) ?? 0)) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
                {cartCount + (existingItems?.reduce((s, i) => s + i.qty, 0) ?? 0)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto admin-scroll min-h-0">
            {existingGroups.length === 0 && newGroups.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6 px-3">Добавьте блюда из меню</p>
            ) : (
              <div className="px-3 pt-3 pb-2">
                {/* Existing items — chronologically grouped, read-only */}
                {existingGroups.map((group, gi) => (
                  <div key={gi}>
                    {gi === 0 ? (
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">
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
                    <div className="space-y-1 mb-2">
                      {group.items.map((item, idx) => {
                        const existingIdx = localExisting.indexOf(item);
                        return (
                          <div key={idx} className="flex items-center gap-1 opacity-75">
                            <button
                              onClick={() => decrementExisting(existingIdx)}
                              className="w-5 h-5 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                            >
                              <Minus size={8} />
                            </button>
                            <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] leading-tight break-words text-foreground">{capFirst(item.name)}</span>
                              {item.modifiers?.map((mod, mi) => (
                                <p key={mi} className="text-[9px] text-violet-400 leading-tight">+ {mod.name}</p>
                              ))}
                            </div>
                            <span className="shrink-0 text-[9px] text-muted-foreground">×{item.qty}</span>
                            <span className="shrink-0 text-[10px] tabular-nums min-w-[44px] text-right">
                              {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* New items — each group gets a "Дозаказ — HH:MM" divider */}
                {newGroups.map((group, gi) => (
                  <div key={gi}>
                    {(existingGroups.length > 0 || gi > 0) && (
                      <div className="flex items-center gap-2 my-2.5">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">
                          Дозаказ — {group.label}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    {gi === 0 && existingGroups.length === 0 && (
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">
                        Добавлено в {group.label}
                      </p>
                    )}
                    <div className="space-y-1.5 mb-2">
                      {group.items.map((item) => {
                        const ck = item.cartKey;
                        return (
                        <div key={ck}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => decrementCart(ck)}
                              className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                            >
                              <Minus size={9} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="flex-1 min-w-0 text-[11px] leading-tight break-words text-foreground">{capFirst(item.name)}</span>
                                <button
                                  onClick={() => { setEditingNoteId(ck); setNoteInput(item.note ?? ""); }}
                                  className={`shrink-0 transition-colors ${item.note ? "text-amber-500" : "text-muted-foreground/30 hover:text-violet-500"}`}
                                  title={item.note ? "Изменить заметку" : "Добавить заметку"}
                                >
                                  <MessageSquare size={10} />
                                </button>
                              </div>
                              {item.modifiers?.map((mod, mi) => (
                                <p key={mi} className="text-[9px] text-violet-400 leading-tight">+ {mod.name} (+{mod.price} ₸)</p>
                              ))}
                              {item.note && editingNoteId !== ck && (
                                <p className="text-[10px] italic text-amber-600 dark:text-amber-400 leading-tight mt-0.5">✎ {item.note}</p>
                              )}
                              {editingNoteId === ck && (
                                <div className="mt-1 flex items-center gap-1">
                                  <input
                                    autoFocus
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { setNoteForItem(ck, noteInput); setEditingNoteId(null); }
                                      if (e.key === "Escape") { setEditingNoteId(null); }
                                    }}
                                    placeholder="Пожелание к блюду…"
                                    className="flex-1 min-w-0 text-[10px] px-1.5 py-0.5 rounded border border-violet-400 bg-background focus:outline-none"
                                  />
                                  <button
                                    onClick={() => { setNoteForItem(ck, noteInput); setEditingNoteId(null); }}
                                    className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                                  >OK</button>
                                  <button
                                    onClick={() => setEditingNoteId(null)}
                                    className="shrink-0 text-[9px] px-1 py-0.5 rounded text-muted-foreground hover:bg-accent transition-colors"
                                  >✕</button>
                                </div>
                              )}
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground w-5 text-center">{"×"}{item.qty}</span>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums min-w-[52px] text-right">
                              {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                            </span>
                            <button
                              onClick={() => incrementCart(ck)}
                              className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors shrink-0"
                            >
                              <Plus size={9} />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Итого</span>
              <span className="font-black tabular-nums">
                {(cartTotal + existingTotal).toLocaleString("ru-RU")} ₸
              </span>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming || (localExisting.length === 0 && cartItems.length === 0)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              {confirming
                ? <><Loader2 size={13} className="animate-spin" /> Обработка…</>
                : <><Check size={14} /> {cartItems.length > 0 && existingItems?.length ? "Дозаказать" : confirmLabel}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: bottom cart */}
      <div className="sm:hidden shrink-0 border-t border-border bg-background">
        {cartItems.length > 0 && (
          <div className="px-3 pt-2 pb-1 max-h-28 overflow-y-auto admin-scroll space-y-1">
            {existingGroups.length > 0 && (
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60 pb-0.5">
                Уже в заказе ({localExisting.reduce((s, i) => s + i.qty, 0)} поз.)
              </p>
            )}
            {newGroups.map((group, gi) => (
              <div key={gi}>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-500 py-0.5">
                  {existingGroups.length > 0 || gi > 0 ? `Дозаказ — ${group.label}` : `+ ${group.label}`}
                </p>
                {group.items.map((item) => {
                  const ck = item.cartKey;
                  return (
                  <div key={ck} className="py-0.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <button onClick={() => decrementCart(ck)} className="w-5 h-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0">
                        <Minus size={9} />
                      </button>
                      <span className="flex-1 truncate text-foreground">{capFirst(item.name)}</span>
                      <button
                        onClick={() => { setEditingNoteId(ck); setNoteInput(item.note ?? ""); }}
                        className={`shrink-0 transition-colors ${item.note ? "text-amber-500" : "text-muted-foreground/30 hover:text-violet-500"}`}
                      >
                        <MessageSquare size={10} />
                      </button>
                      <span className="shrink-0 text-muted-foreground">{"×"}{item.qty}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{(item.price * item.qty).toLocaleString("ru-RU")} ₸</span>
                      <button onClick={() => incrementCart(ck)} className="w-5 h-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors shrink-0">
                        <Plus size={9} />
                      </button>
                    </div>
                    {item.modifiers?.map((mod, mi) => (
                      <p key={mi} className="text-[9px] text-violet-400 pl-6 leading-tight">+ {mod.name}</p>
                    ))}
                    {item.note && editingNoteId !== ck && (
                      <p className="text-[10px] italic text-amber-600 dark:text-amber-400 pl-6 leading-tight mt-0.5">✎ {item.note}</p>
                    )}
                    {editingNoteId === ck && (
                      <div className="mt-1 pl-6 flex items-center gap-1">
                        <input
                          autoFocus
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { setNoteForItem(ck, noteInput); setEditingNoteId(null); }
                            if (e.key === "Escape") { setEditingNoteId(null); }
                          }}
                          placeholder="Пожелание…"
                          className="flex-1 min-w-0 text-[10px] px-1.5 py-0.5 rounded border border-violet-400 bg-background focus:outline-none"
                        />
                        <button
                          onClick={() => { setNoteForItem(ck, noteInput); setEditingNoteId(null); }}
                          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-600 text-white"
                        >OK</button>
                        <button onClick={() => setEditingNoteId(null)} className="shrink-0 text-[9px] px-1 py-0.5 rounded text-muted-foreground">✕</button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div className="px-3 pb-3 pt-2 flex items-center gap-3">
          <span className="flex-1 text-xs text-muted-foreground">
            {cartItems.length === 0
              ? (localExisting.length ? `${localExisting.reduce((s, i) => s + i.qty, 0)} поз. в заказе` : "Выберите блюда")
              : `+${cartCount} новых · ${(cartTotal + existingTotal).toLocaleString("ru-RU")} ₸`
            }
          </span>
          <button
            onClick={handleConfirm}
            disabled={confirming || (localExisting.length === 0 && cartItems.length === 0)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {confirming
              ? <><Loader2 size={13} className="animate-spin" /> Обработка…</>
              : <><Check size={14} /> {cartItems.length > 0 && existingItems?.length ? "Дозаказать" : confirmLabel}</>
            }
          </button>
        </div>
      </div>

      {/* Modifier picker modal */}
      {pendingProduct && (() => {
        const mods = catModifiersFor(pendingProduct);
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{productName(pendingProduct)}</p>
                  <p className="text-[11px] text-muted-foreground">Выберите добавки</p>
                </div>
                <button onClick={() => setPendingProduct(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors shrink-0">
                  <X size={15} />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto admin-scroll">
                {mods.map(mod => {
                  const checked = selectedMods.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => setSelectedMods(prev => {
                        const next = new Set(prev);
                        if (next.has(mod.id)) next.delete(mod.id); else next.add(mod.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        checked
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                          : "border-border hover:border-violet-300 hover:bg-accent"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? "border-violet-600 bg-violet-600" : "border-muted-foreground"
                      }`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <span className="flex-1 text-sm text-foreground">{mod.name}</span>
                      <span className="text-sm font-semibold text-violet-500 shrink-0">+{mod.price.toLocaleString("ru-RU")} ₸</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-border flex gap-2">
                <button
                  onClick={() => commitToCart(pendingProduct, [])}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  Без добавок
                </button>
                <button
                  onClick={() => commitToCart(pendingProduct, mods.filter(m => selectedMods.has(m.id)))}
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
                >
                  {selectedMods.size > 0 ? `Добавить (+${mods.filter(m => selectedMods.has(m.id)).reduce((s, m) => s + m.price, 0).toLocaleString("ru-RU")} ₸)` : "Добавить"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── OrderPanel ────────────────────────────────────────────────────────────────
// Thin wrapper: builds the submit handler and delegates all UI to PosMenuBrowser.

function OrderPanel({
  table,
  tableLabel,
  orderType = "dine-in",
  onBack,
  onDone,
}: {
  table?: DbRestaurantTable;
  tableLabel?: string;
  orderType?: "dine-in" | "takeaway" | "delivery";
  onBack: () => void;
  onDone: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const currentUserId = useUserId();

  const displayLabel = tableLabel ?? table?.label ?? "?";
  const title =
    orderType === "dine-in"  ? `Стол ${displayLabel} · Новый заказ` :
    orderType === "delivery" ? "Доставка · Новый заказ"              :
                               "С собой · Новый заказ";

  const extraHeader = orderType !== "dine-in" ? (
    <div className="px-4 py-2.5 border-b border-border shrink-0">
      <input
        type="text"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="Имя клиента (необязательно)"
        className="w-full h-8 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  ) : undefined;

  async function handleConfirm(items: OrderItem[]) {
    const tableNumber = orderType === "dine-in"
      ? (tableLabel ?? table?.label ?? null)
      : (customerName.trim() || null);
    const { error } = await supabase.from(DB_TABLES.orders).insert({
      restaurant_id: RESTAURANT_ID,
      status: "pending",
      type: orderType,
      table_number: tableNumber,
      items_json: items,
      total_price: items.reduce((s, it) => s + it.price * it.qty, 0),
      order_type: "asap",
      ...(currentUserId ? { opened_by: currentUserId } : {}),
    });
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    const dest =
      orderType === "dine-in"  ? `стола ${displayLabel}` :
      orderType === "delivery" ? "доставки"               : "самовывоза";
    toast.success(`Заказ для ${dest} отправлен на кухню!`);
    onDone();
  }

  return (
    <PosMenuBrowser
      mode="panel"
      panelTitle={title}
      onBack={onBack}
      extraHeader={extraHeader}
      confirmLabel="Отправить на кухню"
      onConfirm={handleConfirm}
    />
  );
}

// ── DiscountModal ─────────────────────────────────────────────────────────────

function DiscountModal({
  orderId,
  existingItems,
  onDone,
  onClose,
}: {
  orderId: string;
  existingItems: OrderItem[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [pct, setPct]         = useState<number | "">("");
  const [applying, setApplying] = useState(false);

  const PRESETS = [5, 10, 15, 20, 50];

  const baseItems  = existingItems.filter((it) => !it.name.startsWith("Скидка на чек"));
  const baseTotal  = baseItems.reduce((s, it) => s + it.price * it.qty, 0);
  const pctNum     = typeof pct === "number" ? pct : 0;
  const discountAmount = pctNum > 0 ? Math.round(baseTotal * pctNum / 100) : 0;
  const newTotal   = baseTotal - discountAmount;
  const isValid    = pctNum >= 1 && pctNum <= 99;

  async function apply() {
    if (!isValid) return;
    setApplying(true);
    const discountItem: OrderItem = {
      name: `Скидка на чек (${pctNum}%)`,
      qty: 1,
      price: -discountAmount,
      currency: "₸",
    };
    const newItems = [...baseItems, discountItem];
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ items_json: newItems, total_price: newTotal })
      .eq("id", orderId);
    setApplying(false);
    if (error) { toast.error("Ошибка применения скидки"); return; }
    toast.success(`Скидка ${pctNum}% применена`);
    onDone();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-sm bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="flex-1">
              <p className="font-semibold text-sm">Скидка на чек</p>
              <p className="text-[11px] text-muted-foreground">
                База: {baseTotal.toLocaleString("ru-RU")} ₸
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPct(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                    pct === p
                      ? "bg-violet-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={pct}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setPct(isNaN(v) ? "" : v);
                }}
                placeholder="Свой %"
                className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>

            {isValid && (
              <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Скидка {pctNum}%</span>
                  <span>−{discountAmount.toLocaleString("ru-RU")} ₸</span>
                </div>
                <div className="flex justify-between text-sm font-black">
                  <span>Итого</span>
                  <span>{newTotal.toLocaleString("ru-RU")} ₸</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={apply}
              disabled={!isValid || applying}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {applying
                ? <><Loader2 size={14} className="animate-spin" /> Применяю…</>
                : <><Check size={14} /> Применить</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── ChangeOrderTypeModal ──────────────────────────────────────────────────────

function ChangeOrderTypeModal({
  orderId,
  currentType,
  allTables,
  onDone,
  onClose,
}: {
  orderId: string;
  currentType: string;
  allTables: TableWithStatus[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [targetType, setTargetType]       = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  const OPTIONS = [
    { type: "dine-in",  label: "В заведении", icon: "🍽️" },
    { type: "takeaway", label: "С собой",      icon: "🛍️" },
    { type: "delivery", label: "Доставка",     icon: "🛵" },
  ].filter((o) => o.type !== currentType);

  const freeTables = allTables.filter((tws) => tws.status === "free");
  const isValid = targetType !== null && (targetType !== "dine-in" || selectedTable !== null);

  async function confirm() {
    if (!isValid || !targetType) return;
    setSaving(true);
    const newTableNumber = targetType === "dine-in" ? selectedTable : null;
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ type: targetType, table_number: newTableNumber })
      .eq("id", orderId);
    setSaving(false);
    if (error) { toast.error("Ошибка изменения типа"); return; }
    const label = OPTIONS.find((o) => o.type === targetType)?.label ?? targetType;
    toast.success(`Заказ переведён → ${label}`);
    onDone();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-sm bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="flex-1">
              <p className="font-semibold text-sm">Изменить тип заказа</p>
              <p className="text-[11px] text-muted-foreground">Выберите куда перевести заказ</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { setTargetType(opt.type); setSelectedTable(null); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    targetType === opt.type
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                      : "border-border hover:border-violet-300 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>

            {targetType === "dine-in" && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Выберите свободный стол:
                </p>
                {freeTables.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4">Нет свободных столов</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto admin-scroll">
                    {freeTables.map((tws) => (
                      <button
                        key={tws.table.id}
                        onClick={() => setSelectedTable(tws.table.label)}
                        className={`h-10 rounded-lg text-xs font-bold border transition-colors ${
                          selectedTable === tws.table.label
                            ? "border-violet-500 bg-violet-600 text-white"
                            : "border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        }`}
                      >
                        {tws.table.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={confirm}
              disabled={!isValid || saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Перевожу…</>
                : <><Check size={14} /> Подтвердить</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MenuPickerModal ───────────────────────────────────────────────────────────

function MenuPickerModal({
  orderId,
  existingItems,
  orderCreatedAt,
  onDone,
  onClose,
}: {
  orderId: string;
  existingItems: OrderItem[];
  orderCreatedAt?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const role        = useRole();
  const displayName = useDisplayName();

  async function handleConfirm(allItems: OrderItem[]) {
    const total = allItems.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: allItems, total_price: total }).eq("id", orderId);
    if (error) { toast.error("Ошибка сохранения"); return; }
    toast.success("Чек обновлён");
    onDone();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div
          className="w-full max-w-[95vw] sm:max-w-4xl h-[90vh] sm:h-[85vh] bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <PosMenuBrowser
            mode="modal"
            panelTitle="Выбрать из меню"
            onBack={onClose}
            existingItems={existingItems}
            orderCreatedAt={orderCreatedAt}
            addedByRole={role ?? undefined}
            addedByName={displayName ?? undefined}
            confirmLabel="Добавить в чек"
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </>
  );
}
// ── TableFormModal ────────────────────────────────────────────────────────────

function TableFormModal({
  table,
  onClose,
  onSaved,
}: {
  table: DbRestaurantTable | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel]   = useState(table?.label ?? "");
  const [seats, setSeats]   = useState(String(table?.seats ?? 4));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLabel(table?.label ?? "");
    setSeats(String(table?.seats ?? 4));
  }, [table?.id]);

  async function save() {
    if (!label.trim()) return;
    setSaving(true);
    const { data: saved, error } = table
      ? await supabase
          .from(DB_TABLES.restaurantTables)
          .update({ label: label.trim(), seats: Number(seats) || 4 })
          .eq("id", table.id)
          .eq("restaurant_id", RESTAURANT_ID)
          .select("id")
      : await supabase
          .from(DB_TABLES.restaurantTables)
          .insert({ restaurant_id: RESTAURANT_ID, label: label.trim(), seats: Number(seats) || 4 })
          .select("id");
    setSaving(false);
    if (error) {
      console.error("[TableFormModal] save error:", error);
      toast.error(`Ошибка сохранения: ${error.message}`);
      return;
    }
    if (!saved || saved.length === 0) {
      // RLS silently blocked the UPDATE — no error, but 0 rows affected
      console.error("[TableFormModal] 0 rows updated — add UPDATE policy on restaurant_tables in Supabase Dashboard");
      toast.error("Нет доступа. Добавьте политику UPDATE для таблицы restaurant_tables в Supabase");
      return;
    }
    toast.success(table ? "Стол обновлён" : "Стол добавлен");
    onSaved();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-sm bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold">{table ? "Редактировать стол" : "Добавить стол"}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Название / номер
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Напр: 1, A3, Терраса, VIP"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Количество мест
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex gap-2 px-6 pb-6">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving || !label.trim()}
              className="flex-1 h-10 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </>
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
  const byDate: Record<string, DbOrder[]> = {};
  for (const o of preorders) {
    if (o.preorder_date) {
      if (!byDate[o.preorder_date]) byDate[o.preorder_date] = [];
      byDate[o.preorder_date].push(o);
    }
  }

  const firstDay   = new Date(calYear, calMonth, 1);
  const lastDay    = new Date(calYear, calMonth + 1, 0);
  const startDow   = (firstDay.getDay() + 6) % 7;
  const totalDays  = lastDay.getDate();
  const totalCells = Math.ceil((startDow + totalDays) / 7) * 7;
  const monthLabel = firstDay.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); setSelectedDate(`${calYear - 1}-12-01`); }
    else { const m = calMonth - 1; setCalMonth(m); setSelectedDate(`${calYear}-${String(m + 1).padStart(2, "0")}-01`); }
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); setSelectedDate(`${calYear + 1}-01-01`); }
    else { const m = calMonth + 1; setCalMonth(m); setSelectedDate(`${calYear}-${String(m + 1).padStart(2, "0")}-01`); }
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
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft size={15} />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold capitalize">{monthLabel}</span>
                {calLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className={`grid grid-cols-7 gap-0.5 transition-opacity duration-150 ${calLoading ? "opacity-40 pointer-events-none" : ""}`}>
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - startDow + 1;
                if (dayNum < 1 || dayNum > totalDays) return <div key={idx} className="aspect-square" />;
                const dateStr   = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayOrders = byDate[dateStr] ?? [];
                const hasOrders  = dayOrders.length > 0;
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasPending = dayOrders.some((o) => o.status !== "completed" && o.status !== "cancelled");
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
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${
                        isSelected ? "bg-white/70" : hasPending ? "bg-amber-500" : "bg-violet-400"
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>

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

// ── PreorderDayCard ───────────────────────────────────────────────────────────

function PreorderDayCard({
  order,
  isActiveToday,
}: {
  order: DbOrder;
  isActiveToday?: boolean;
}) {
  const [expanded, setExpanded]               = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showMenuPicker, setShowMenuPicker]   = useState(false);
  const [removingIdx, setRemovingIdx]         = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel]     = useState(false);
  const [cancelling, setCancelling]           = useState(false);
  const isWaiter = useRole() === "waiter";

  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const savedAmount = items.reduce(
    (s, it) => (it.original_price != null ? s + (it.original_price - it.price) * it.qty : s),
    0,
  );
  const timeLabel        = order.preorder_time?.slice(0, 5) ?? null;
  const orderTotal       = order.total_price ?? 0;
  const paidAmount       = order.paid_amount ?? 0;
  const remaining        = Math.max(0, orderTotal - paidAmount);
  const isPaid           = !!order.payment_method && remaining === 0;
  const pmLabel          = order.payment_method === "mixed"
    ? "Смешанная"
    : (METHOD_META[order.payment_method ?? ""]?.label ?? (order.payment_method ? capFirst(order.payment_method) : null));
  const pmIcon           = order.payment_method === "mixed"
    ? "💳"
    : (METHOD_META[order.payment_method ?? ""]?.icon ?? "💳");
  const partiallyPaid    = paidAmount > 0 && paidAmount < orderTotal;
  const fullyPrepaid     = orderTotal > 0 && paidAmount >= orderTotal;
  const prepayMethodMeta = order.prepayment_method ? METHOD_META[order.prepayment_method] : null;
  const prepayIcon       = prepayMethodMeta?.icon ?? null;
  const prepayLabel      = prepayMethodMeta?.label ?? (order.prepayment_method ? capFirst(order.prepayment_method) : null);
  const isCancelled      = order.status === "cancelled";
  const isCompleted      = order.status === "completed";

  async function handleCancelOrder() {
    if (cancelling) return;
    setCancelling(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID);
    setCancelling(false);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    toast.success("Предзаказ отменён");
    setConfirmCancel(false);
  }

  async function removeItem(idx: number) {
    if (removingIdx !== null) return;
    const item = items[idx];
    setRemovingIdx(idx);
    const updated = item.qty > 1
      ? items.map((it, i) => i === idx ? { ...it, qty: it.qty - 1 } : it)
      : items.filter((_, i) => i !== idx);
    const newTotal = updated.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: updated, total_price: newTotal }).eq("id", order.id).eq("restaurant_id", RESTAURANT_ID);
    setRemovingIdx(null);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
  }

  return (
    <div className={`rounded-xl border overflow-hidden bg-card ${
      isActiveToday ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border"
    }`}>
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none hover:bg-accent/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
          {timeLabel ? (
            <>
              <span className="text-[12px] font-bold leading-tight">{timeLabel}</span>
              <span className="text-[7px] opacity-50 uppercase tracking-wide">время</span>
            </>
          ) : (
            <Clock size={14} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
              {shortPreorderId(order.id)}
            </span>
            {order.status && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PREORDER_STATUS[order.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                {PREORDER_STATUS[order.status]?.label ?? capFirst(order.status)}
              </span>
            )}
            {isActiveToday && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Сегодня
              </span>
            )}
          </div>

          {(order.customer_name || order.customer_phone || order.customer_city || order.table_number) && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
              {order.customer_name && (
                <span className="font-semibold text-foreground">{order.customer_name}</span>
              )}
              {order.customer_city && (
                <span className="flex items-center gap-0.5">
                  📍 {order.customer_city}
                </span>
              )}
              {order.customer_phone && (
                <a
                  href={`tel:${order.customer_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-violet-600 dark:text-violet-400 hover:underline"
                >
                  📞 {order.customer_phone}
                </a>
              )}
              {!order.customer_name && !order.customer_phone && !order.customer_city && order.table_number && (
                <span>{order.table_number}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {isPaid ? (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="leading-none">{pmIcon}</span>
                <span className="text-foreground font-medium">{pmLabel}</span>
                <span className="font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  ✓ Оплачено
                </span>
              </div>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPaymentModalOpen(true); }}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                    fullyPrepaid
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                      : partiallyPaid
                      ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                      : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                  }`}
                >
                  {fullyPrepaid
                    ? `✓ Полностью оплачено${prepayIcon ? ` · ${prepayIcon}` : ""}`
                    : partiallyPaid
                    ? `Внесено: ${paidAmount.toLocaleString("ru-RU")} ₸${prepayIcon ? ` ${prepayIcon}` : prepayLabel ? ` (${prepayLabel})` : ""} · Остаток: ${remaining.toLocaleString("ru-RU")} ₸`
                    : "Ожидает оплаты"}
                </button>
                {!fullyPrepaid && order.payment_method === "card-transfer" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    🏦 Проверить перевод
                  </span>
                )}
                {!fullyPrepaid && order.payment_method === "remote-payment" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                    📲 Выставить счёт
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums leading-tight">
              {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
            </p>
            {items.length > 0 && (
              <p className="text-[10px] text-muted-foreground">{items.length} поз.</p>
            )}
          </div>
          <div className="text-muted-foreground/60">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </div>

      {order.customer_comments && (
        <div className="px-3 pb-2">
          <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
            <MessageSquare size={11} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
              {order.customer_comments}
            </p>
          </div>
        </div>
      )}

      {expanded && (order.customer_name || order.customer_phone || order.customer_city || order.delivery_address) && (
        <div className="px-3 pb-2">
          <div className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border ${
            order.type === "delivery"
              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700/40"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700/40"
          }`}>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${
              order.type === "delivery" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
            }`}>
              {order.type === "delivery" ? "🚚 Доставка" : "🛍️ С собой"}
            </p>
            {order.customer_name && (
              <div className="flex items-center gap-1.5">
                <User size={10} className="text-muted-foreground shrink-0" />
                <span className="text-[12px] font-semibold">{order.customer_name}</span>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={10} className="text-muted-foreground shrink-0" />
                <a
                  href={`tel:${order.customer_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {order.customer_phone}
                </a>
              </div>
            )}
            {order.customer_city && (
              <div className="flex items-center gap-1.5">
                <MapPin size={10} className="text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">{order.customer_city}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex items-start gap-1.5">
                <MapPin size={10} className="text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">{order.delivery_address}</span>
              </div>
            )}
            {isPaid && pmLabel && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/60 mt-0.5">
                <span className="text-[10px] leading-none">{pmIcon}</span>
                <span className="text-[11px] text-muted-foreground">{pmLabel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Состав заказа
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenuPicker(true); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            >
              <Plus size={11} /> Добавить
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-2">Состав заказа не указан</p>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-start px-2.5 py-1.5 text-xs ${
                      i < items.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-muted-foreground">
                        {capFirst(item.name)}
                        <span className="ml-1 text-muted-foreground/50">×{item.qty}</span>
                        {item.created_at && (
                          <span className="ml-1 text-[9px] text-muted-foreground/40 tabular-nums">({new Date(item.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })})</span>
                        )}
                      </span>
                      {item.modifiers?.map((mod, mi) => (
                        <p key={mi} className="text-[10px] text-violet-400 leading-tight mt-0.5">+ {mod.name}</p>
                      ))}
                      {item.note && (
                        <p className="text-[10px] italic text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
                          ✎ {item.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      {!isWaiter && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void removeItem(i); }}
                          disabled={removingIdx !== null}
                          className="p-0.5 rounded-md text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30"
                          title={item.qty > 1 ? "−1" : "Удалить"}
                        >
                          {removingIdx === i ? <Loader2 size={11} className="animate-spin" /> : <Minus size={11} />}
                        </button>
                      )}
                      <div className="flex flex-col items-end">
                        {item.original_price != null && (
                          <span className="text-[10px] text-muted-foreground/50 line-through tabular-nums">
                            {(item.original_price * item.qty).toLocaleString("ru-RU")} {item.currency}
                          </span>
                        )}
                        <span className={`tabular-nums font-semibold ${item.original_price != null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                          {(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 mt-2 border-t border-border space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Итого</p>
                  <p className="text-sm font-black tabular-nums">{orderTotal.toLocaleString("ru-RU")} ₸</p>
                </div>
                {savedAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Скидка</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">−{savedAmount.toLocaleString("ru-RU")} ₸</p>
                  </div>
                )}
                {paidAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      {prepayIcon && <span className="leading-none">{prepayIcon}</span>}
                      {prepayLabel ? `Предоплата (${prepayLabel})` : "Предоплата"}
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">−{paidAmount.toLocaleString("ru-RU")} ₸</p>
                  </div>
                )}
                {paidAmount > 0 && (
                  <div className={`flex items-center justify-between pt-1 border-t border-border/60 ${
                    fullyPrepaid ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  }`}>
                    <p className="text-[11px] font-bold uppercase tracking-wide">
                      {fullyPrepaid ? "Оплачено полностью" : "К оплате"}
                    </p>
                    <p className="text-sm font-black tabular-nums">
                      {fullyPrepaid ? "✓" : `${remaining.toLocaleString("ru-RU")} ₸`}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Cancel button — only for non-completed, non-cancelled orders */}
      {expanded && !isCancelled && !isCompleted && (
        <div className="px-3 pb-3 border-t border-border pt-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmCancel(true); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={12} />
            Удалить предзаказ
          </button>
        </div>
      )}

      {paymentModalOpen && (
        <PreorderPaymentModal
          order={order}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}
      {showMenuPicker && (
        <MenuPickerModal
          orderId={order.id}
          existingItems={items}
          orderCreatedAt={order.created_at}
          onDone={() => setShowMenuPicker(false)}
          onClose={() => setShowMenuPicker(false)}
        />
      )}

      {/* Confirm cancel modal */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!cancelling) setConfirmCancel(false); }}
        >
          <div
            className="bg-card rounded-2xl border border-border p-5 w-full max-w-sm mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 size={15} />
                Удалить предзаказ?
              </h3>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Вы уверены, что хотите удалить этот предзаказ? Все внесённые предоплаты будут аннулированы.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                onClick={() => void handleCancelOrder()}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancelling ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {cancelling ? "Удаление…" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PreorderPaymentModal ──────────────────────────────────────────────────────

function PreorderPaymentModal({
  order,
  onClose,
}: {
  order: DbOrder;
  onClose: () => void;
}) {
  const total = order.total_price ?? 0;
  const [paidInput, setPaidInput]       = useState(String(order.paid_amount ?? 0));
  const [prepayMethod, setPrepayMethod] = useState<string | null>(order.prepayment_method ?? null);
  const [saving, setSaving]             = useState(false);

  const paidValue = Math.max(0, parseFloat(paidInput) || 0);
  const remaining = Math.max(0, total - paidValue);
  const fullyPaid = paidValue >= total && total > 0;
  const canSave   = paidValue > 0 ? prepayMethod !== null : true;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        paid_amount: paidValue,
        prepayment_method: paidValue > 0 ? prepayMethod : null,
      })
      .eq("id", order.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
    } else {
      toast.success("Оплата обновлена");
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border p-5 w-full max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold">Управление оплатой</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">{shortPreorderId(order.id)}</p>
            {order.preorder_date && (
              <p className="text-[11px] text-muted-foreground">
                {order.preorder_date}
                {order.preorder_time ? ` · ${order.preorder_time.slice(0, 5)}` : ""}
              </p>
            )}
            {order.customer_name && (
              <p className="text-[12px] font-semibold text-foreground mt-0.5">{order.customer_name}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Итого</p>
            <p className="text-xl font-black tabular-nums">{total.toLocaleString("ru-RU")} ₸</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Внесено (₸)
            </label>
            <input
              type="number"
              min="0"
              max={total}
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
              placeholder="0"
              autoFocus
            />
          </div>

          {/* Payment method selector — required when paidValue > 0 */}
          {paidValue > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Способ оплаты
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPrepayMethod(m.id)}
                    className={`flex items-center justify-center gap-1.5 h-9 rounded-xl border-2 text-xs font-semibold transition-all ${
                      prepayMethod === m.id
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                        : "border-border hover:border-violet-300 hover:bg-accent/60 text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              {prepayMethod === null && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">Выберите способ оплаты</p>
              )}
            </div>
          )}

          <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
            fullyPaid
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30"
              : "bg-muted/50"
          }`}>
            <span className="text-xs text-muted-foreground">Остаток</span>
            <span className={`text-sm font-bold tabular-nums ${
              fullyPaid
                ? "text-emerald-600 dark:text-emerald-400"
                : remaining > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}>
              {fullyPaid ? "✓ Полностью оплачено" : `${remaining.toLocaleString("ru-RU")} ₸`}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 h-9 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
