"use client";

import React, { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Plus, Clock, Calendar, X, Copy, Edit2, Users,
  Check, ChevronLeft, ChevronRight, Printer, ShoppingCart, Settings, Trash2, Lock,
  ArrowLeft, Search, Minus, UtensilsCrossed, Package, Bike, CheckCircle2, MessageSquare,
  Percent, ArrowLeftRight, ChevronDown, Move,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder, DbRestaurantTable, DbCategory, DbProduct } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { capFirst } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = "free" | "occupied" | "preorder";
type OrderItem = { name: string; qty: number; price: number; currency: string; original_price?: number; created_at?: string };
type CartItem  = { productId: string; name: string; price: number; qty: number; addedAt: string };

interface TableWithStatus {
  table: DbRestaurantTable;
  status: TableStatus;
  order: DbOrder | null;
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
  console.log("[PRINT RECEIPT]", {
    orderId: order.id,
    table: order.table_number,
    items: order.items_json,
    total: `${(order.total_price ?? 0).toLocaleString("ru-RU")} ₸`,
    createdAt: new Date(order.created_at).toLocaleString("ru-RU"),
  });
  toast.info("Чек отправлен на принтер (в разработке)");
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

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveTab = "dine-in" | "takeaway" | "delivery";

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
  const knownOrderIds               = useRef(new Set<string>());

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
          knownOrderIds.current.add(newOrder.id);
          setOrders((prev) => [newOrder, ...prev]);
          playNewOrderSound();
          const label =
            newOrder.type === "delivery"   ? "Доставка" :
            newOrder.type === "dine-in"    ? `Стол ${newOrder.table_number ?? "—"}` :
            "С собой";
          toast.success(`Новый заказ · ${label}`, { duration: 6000 });
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
    const order = orders.find(
      (o) => o.type === "dine-in" && o.table_number === table.label
    ) ?? null;
    const preorderOrder = !order
      ? (orders.find(
          (o) =>
            o.order_type === "preorder" &&
            o.table_number === table.label &&
            o.preorder_date === today
        ) ?? null)
      : null;
    const status: TableStatus = order ? "occupied" : preorderOrder ? "preorder" : "free";
    return { table, status, order, preorderOrder, elapsed: order ? getElapsed(order.created_at) : 0 };
  });

  const occupiedCount  = tablesWithStatus.filter((t) => t.status === "occupied").length;
  const freeCount      = tablesWithStatus.filter((t) => t.status === "free").length;
  const preorderCount  = tablesWithStatus.filter((t) => t.status === "preorder").length;
  const selectedData   = selected ? tablesWithStatus.find((t) => t.table.id === selected) ?? null : null;
  const { width: tablePanelW, startResize: startTableResize } = usePanelResize("hall:tablePanel", 500, 280, 720);

  const takeawayOrders = orders
    .filter((o) => o.type !== "dine-in" && o.type !== "delivery")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const deliveryOrders = orders
    .filter((o) => o.type === "delivery")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-6 py-3 border-b border-border shrink-0 flex items-center gap-3 bg-background">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${realtimeOk ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
            <span className="text-xs text-muted-foreground">
              {realtimeOk ? "Realtime" : "Подключение…"}
            </span>
            {activeTab === "dine-in" && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {occupiedCount} занято · {freeCount} свободно
                  {preorderCount > 0 && ` · ${preorderCount} предзаказ`}
                </span>
              </>
            )}
          </div>
        </div>

        {activeTab === "dine-in" && editMode && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0"
          >
            <Plus size={12} />
            Добавить стол
          </button>
        )}

        {activeTab === "dine-in" && (
          <button
            onClick={editMode ? exitEditMode : enterEditMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              editMode
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "border border-border hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings size={12} className={editMode ? "animate-spin" : ""} style={{ animationDuration: "3s" }} />
            {editMode ? "Готово" : "Редактировать зал"}
          </button>
        )}
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-border bg-background px-4 gap-1 pt-1">
        {([
          { id: "dine-in",  icon: UtensilsCrossed, label: "В заведении", count: occupiedCount },
          { id: "takeaway", icon: Package,          label: "С собой",     count: takeawayOrders.length },
          { id: "delivery", icon: Bike,             label: "Доставка",    count: deliveryOrders.length },
        ] as const).map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); if (id !== "dine-in") setEditMode(false); }}
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
        ))}
      </div>

      {/* ── Edit mode banner ────────────────────────────────────────────────── */}
      {activeTab === "dine-in" && editMode && (
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
          <div className="px-6 py-2 flex items-center gap-4 text-xs border-b border-border bg-muted/20 shrink-0">
            <LegendDot color="emerald" label="Свободен" />
            <LegendDot color="red"     label="Занят"    />
            <LegendDot color="amber"   label="Предзаказ" />
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
                  <Loader2 size={16} className="animate-spin" /> Загрузка…
                </div>
              ) : tables.length === 0 ? (
                <EmptyState onAdd={() => { setEditMode(true); setAddOpen(true); }} />
              ) : (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}
                >
                  {tablesWithStatus.map((tws) => (
                    <TableCard
                      key={tws.table.id}
                      tws={tws}
                      isSelected={!editMode && selected === tws.table.id}
                      editMode={editMode}
                      onClick={() => {
                        if (editMode) return;
                        setSelected(selected === tws.table.id ? null : tws.table.id);
                      }}
                      onEdit={() => {
                        if (tws.status !== "free") {
                          toast.error("Нельзя редактировать занятый стол");
                          return;
                        }
                        setEditTable(tws.table);
                      }}
                      onDelete={() => deleteTable(tws)}
                    />
                  ))}
                </div>
              )}
            </div>

            {!editMode && selectedData && (
              <>
                <ResizeHandle onMouseDown={startTableResize} />
                <TablePanel
                  key={selectedData.table.id}
                  data={selectedData}
                  width={tablePanelW}
                  onClose={() => setSelected(null)}
                  onRefresh={load}
                  onOrderClosed={handleOrderClosed}
                  onOrderTransferred={(orderId, newTableNumber) => {
                    setOrders((prev) =>
                      prev.map((o) => (o.id === orderId ? { ...o, table_number: newTableNumber } : o))
                    );
                    setSelected(null);
                  }}
                  allTables={tablesWithStatus}
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

// ── TableCard ─────────────────────────────────────────────────────────────────

function TableCard({
  tws,
  isSelected,
  editMode,
  onClick,
  onEdit,
  onDelete,
}: {
  tws: TableWithStatus;
  isSelected: boolean;
  editMode: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
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

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col rounded-xl border-2 select-none
        transition-all duration-150
        ${palette.card}
        ${!editMode ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
        ${isSelected ? "ring-2 ring-violet-500 ring-offset-2 shadow-md" : ""}
        ${editMode && isLocked ? "opacity-60" : ""}
      `}
    >
      {/* Status dot */}
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${palette.dot} ${status === "occupied" ? "animate-pulse" : ""}`} />

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
              {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
            </p>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {formatElapsed(elapsed)}
              </span>
            </div>
            {Array.isArray(order.items_json) && (order.items_json as OrderItem[]).length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {(order.items_json as OrderItem[]).length} позиц.
              </p>
            )}
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
          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            Свободен
          </span>
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
  onComplete,
}: {
  order: DbOrder;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onComplete: () => void;
}) {
  const elapsed = getElapsed(order.created_at);
  const shortId = order.id.startsWith("ORD-") ? order.id : `#${order.id.slice(0, 8)}`;
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const queueNum = String(index).padStart(2, "0");
  const isOverdue = elapsed >= 30;

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col rounded-xl border-2 select-none cursor-pointer
        transition-all duration-150
        bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/40
        hover:shadow-md hover:-translate-y-0.5
        ${isSelected ? "ring-2 ring-violet-500 ring-offset-2 shadow-md" : ""}
      `}
    >
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-pulse ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />

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

      <div className="border-t border-amber-200/60 dark:border-amber-700/30 px-3 py-2">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle2 size={11} />
          Выдан
        </button>
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
}: {
  order: DbOrder;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  allTables: TableWithStatus[];
  width?: number;
}) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedId, setCopiedId]                 = useState(false);
  const [showMenuPicker, setShowMenuPicker]     = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showTypeModal, setShowTypeModal]       = useState(false);

  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);
  const elapsed  = getElapsed(order.created_at);
  const typeLabel = order.type === "delivery" ? "Доставка" : "С собой";
  const typeIcon  = order.type === "delivery" ? "🛵" : "🛍️";

  async function copyId(id: string) {
    try { await navigator.clipboard.writeText(id); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  return (
    <aside className="shrink-0 flex flex-col bg-background overflow-hidden" style={{ width: width ?? 500 }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span>{typeIcon}</span>
            <p className="font-semibold text-sm">{typeLabel}</p>
          </div>
          {order.table_number && <p className="text-[11px] text-muted-foreground mt-0.5">{order.table_number}</p>}
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
            <button onClick={() => handlePrint(order)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Printer size={12} /> Чек
            </button>
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

          {order.customer_comments && (
            <div className="px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Пожелания</p>
              <p className="text-sm leading-snug">{order.customer_comments}</p>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Состав · {items.length} позиц.</p>
              {groupOrderItems(items, order.created_at).map((group, gi) => (
                <div key={gi}>
                  {gi === 0 ? (
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">Заказ · {group.label}</p>
                  ) : (
                    <div className="flex items-center gap-2 my-2.5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">Дозаказ в {group.label}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="rounded-xl border border-border overflow-hidden mb-1">
                    {group.items.map((item, i) => (
                      <div key={i} className={`flex justify-between items-start px-3 py-2 text-sm ${i < group.items.length - 1 ? "border-b border-border" : ""}`}>
                        <span className="text-muted-foreground break-words flex-1 min-w-0 mr-3">{capFirst(item.name)}<span className="ml-1 text-muted-foreground/60">× {item.qty}</span></span>
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

          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold">Итого</p>
              {savedAmount > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                </p>
              )}
            </div>
            <p className="text-2xl font-black tabular-nums">{(order.total_price ?? 0).toLocaleString("ru-RU")} ₸</p>
          </div>

          <button onClick={() => setShowPaymentModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
            <Check size={15} /> Оплатить
          </button>

        </div>
      </div>
      {showPaymentModal && (
        <PaymentModal
          order={order}
          onDone={() => { setShowPaymentModal(false); onOrderClosed(order.id); onClose(); onRefresh(); }}
          onClose={() => setShowPaymentModal(false)}
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
}: {
  orders: DbOrder[];
  loading: boolean;
  orderType: "takeaway" | "delivery";
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  allTables: TableWithStatus[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { width: slotPanelW, startResize: startSlotResize } = usePanelResize("hall:orderSlotPanel", 500, 280, 720);

  async function completeOrder(orderId: string) {
    console.log("[completeOrder] UPDATE order", orderId, "→ status=completed");
    const { error, data } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "completed" })
      .eq("id", orderId)
      .eq("restaurant_id", RESTAURANT_ID)
      .select();
    console.log("[completeOrder] response:", { error, data });
    if (error) { toast.error(`Ошибка закрытия: ${error.message}`); return; }
    if (!data || data.length === 0) {
      console.warn("[completeOrder] 0 rows updated — возможна блокировка RLS");
      toast.error("Заказ не обновлён — проверьте RLS в Supabase Dashboard");
      return;
    }
    onOrderClosed(orderId);
    toast.success("Заказ выдан!");
    if (selected === orderId) setSelected(null);
    onRefresh();
  }

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
                    onComplete={() => completeOrder(order.id)}
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
          />
        </>
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
  const total = order.total_price ?? 0;

  const totalEntered = PAYMENT_METHODS.reduce((s, m) => s + (parseFloat(amounts[m.id]) || 0), 0);
  const remaining    = total - totalEntered;
  const isOverpaid   = totalEntered > total + 0.01;
  const isExact      = Math.abs(remaining) < 0.01;
  const canConfirm   = mixed ? (isExact && !isOverpaid) : singleMethod !== null;

  function setAmount(id: PaymentMethodId, value: string) {
    const clean = value.replace(/[^\d.]/g, "").replace(/(\.\d*)\.+/g, "$1");
    setAmounts(prev => ({ ...prev, [id]: clean }));
  }

  function fillRemainder(id: PaymentMethodId) {
    const others = PAYMENT_METHODS.filter(m => m.id !== id).reduce((s, m) => s + (parseFloat(amounts[m.id]) || 0), 0);
    const rem = total - others;
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
          <p className="text-5xl font-black tabular-nums leading-none">{total.toLocaleString("ru-RU")} ₸</p>
          {savedAmount > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
              Скидка {savedAmount.toLocaleString("ru-RU")} ₸
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">К оплате</p>
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
}: {
  data: TableWithStatus;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  onOrderTransferred: (orderId: string, newTableNumber: string) => void;
  allTables: TableWithStatus[];
  width?: number;
}) {
  const { table, status, order, preorderOrder, elapsed } = data;
  const [panelMode, setPanelMode]                 = useState<"info" | "order">("info");
  const [showPaymentModal, setShowPaymentModal]   = useState(false);
  const [copiedId, setCopiedId]                   = useState(false);
  const [changingTable, setChangingTable]         = useState(false);
  const [showMenuPicker, setShowMenuPicker]       = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showTypeModal, setShowTypeModal]         = useState(false);

  const activeOrder = order ?? preorderOrder;
  const items: OrderItem[] = Array.isArray(activeOrder?.items_json)
    ? (activeOrder!.items_json as OrderItem[])
    : [];
  const savedAmount = items.reduce((s, it) => it.original_price != null ? s + (it.original_price - it.price) * it.qty : s, 0);

  // ── Order creation mode ──────────────────────────────────────────────────────
  if (panelMode === "order") {
    return (
      <aside className="w-[640px] shrink-0 border-l border-border flex flex-col bg-background overflow-hidden">
        <OrderPanel
          table={table}
          onBack={() => setPanelMode("info")}
          onDone={() => { setPanelMode("info"); onRefresh(); }}
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

  return (
    <aside className="shrink-0 flex flex-col bg-background overflow-hidden" style={{ width: width ?? 500 }}>

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
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={15} />
        </button>
      </div>

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
              onClick={() => setPanelMode("order")}
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
              <button
                onClick={() => handlePrint(activeOrder)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Печать чека"
              >
                <Printer size={12} />
                Чек
              </button>
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
                {groupOrderItems(items, activeOrder.created_at).map((group, gi) => (
                  <div key={gi}>
                    {gi === 0 ? (
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1.5">Заказ · {group.label}</p>
                    ) : (
                      <div className="flex items-center gap-2 my-2.5">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[9px] font-semibold tracking-wide text-violet-400 shrink-0 px-1">Дозаказ в {group.label}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className="rounded-xl border border-border overflow-hidden mb-1">
                      {group.items.map((item, i) => (
                        <div
                          key={i}
                          className={`flex justify-between items-start px-3 py-2 text-sm ${
                            i < group.items.length - 1 ? "border-b border-border" : ""
                          }`}
                        >
                          <span className="text-muted-foreground break-words flex-1 min-w-0 mr-3">
                            {capFirst(item.name)}
                            <span className="ml-1 text-muted-foreground/60">× {item.qty}</span>
                          </span>
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

            {/* Total */}
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold">Итого</p>
                {savedAmount > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Скидка {savedAmount.toLocaleString("ru-RU")} ₸
                  </p>
                )}
              </div>
              <p className="text-2xl font-black tabular-nums">
                {(activeOrder.total_price ?? 0).toLocaleString("ru-RU")} ₸
              </p>
            </div>

            {/* Close order */}
            {status === "occupied" && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                <Check size={15} /> Оплатить
              </button>
            )}

          </div>
        )}
      </div>
      {showPaymentModal && order && (
        <PaymentModal
          order={order}
          tableName={table.label}
          onDone={() => { setShowPaymentModal(false); onOrderClosed(order.id); onClose(); onRefresh(); }}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </aside>
  );
}

// Groups any items with an optional created_at by time, with 2-min tolerance.
// Items missing created_at fall back to fallbackTimestamp (e.g. order.created_at).
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
  confirmLabel,
  onConfirm,
}: {
  mode: "panel" | "modal";
  panelTitle?: string;
  onBack: () => void;
  extraHeader?: ReactNode;
  existingItems?: OrderItem[];
  orderCreatedAt?: string;
  confirmLabel: string;
  onConfirm: (items: OrderItem[]) => Promise<void>;
}) {
  const [categories, setCategories]      = useState<DbCategory[]>([]);
  const [products, setProducts]          = useState<DbProduct[]>([]);
  const [catLoading, setCatLoading]      = useState(true);
  const [currentCatId, setCurrentCatId]     = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [cart, setCart]                     = useState<Map<string, CartItem>>(new Map());
  const [confirming, setConfirming]         = useState(false);
  const [openIngredients, setOpenIngredients]                = useState<Set<string>>(new Set());
  const { width: cartW, startResize: startCartResize }       = usePanelResize("hall:cartPanel", 360, 260, 520);

  function toggleIngredients(id: string) {
    setOpenIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    async function fetchCatalog() {
      const [catsRes, prodsRes] = await Promise.all([
        supabase.from(DB_TABLES.categories).select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index"),
        supabase.from(DB_TABLES.products).select("*").eq("restaurant_id", RESTAURANT_ID).eq("is_archived", false).order("order_index"),
      ]);
      setCategories((catsRes.data as DbCategory[]) ?? []);
      setProducts((prodsRes.data as DbProduct[]) ?? []);
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

  function addToCart(product: DbProduct) {
    const name  = productName(product);
    const price = effPrice(product);
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, existing
        ? { ...existing, qty: existing.qty + 1 }
        : { productId: product.id, name, price, qty: 1, addedAt: new Date().toISOString() }
      );
      return next;
    });
  }

  function incrementCart(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      next.set(productId, { ...existing, qty: existing.qty + 1 });
      return next;
    });
  }

  function decrementCart(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      if (existing.qty <= 1) next.delete(productId);
      else next.set(productId, { ...existing, qty: existing.qty - 1 });
      return next;
    });
  }

  const cartItems = Array.from(cart.values());
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const existingTotal = (existingItems ?? []).reduce((s, i) => s + i.price * i.qty, 0);
  const existingGroups = existingItems?.length
    ? groupOrderItems(existingItems, orderCreatedAt ?? new Date().toISOString())
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
    if (cartItems.length === 0) return;
    setConfirming(true);
    const items: OrderItem[] = cartItems.map((ci) => {
      const prod = productMap.get(ci.productId);
      const item: OrderItem = { name: ci.name, qty: ci.qty, price: ci.price, currency: "₸", created_at: ci.addedAt };
      if (prod && prod.is_promo && prod.discount_label) item.original_price = prod.price;
      return item;
    });
    await onConfirm(items);
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
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={15} />
          </button>
        )}
        {mode === "modal" && showProducts && !isSearching && (
          <button
            onClick={() => setCurrentCatId(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mr-1"
          >
            <ChevronLeft size={14} /><span>Категории</span>
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
            /* Screen 1: category grid — text-only, no images/icons for instant load */
            <div className="p-3 grid grid-cols-3 gap-2">
              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id && p.is_available).length;
                const cartInCat = products.filter((p) => p.category_id === cat.id).reduce((s, p) => s + (cart.get(p.id)?.qty ?? 0), 0);
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
            /* Screen 2: product list — flat rows, no images, with ingredient accordion */
            <div>
              {mode === "panel" && !isSearching && (
                <div className="px-3 pt-2.5 pb-1">
                  <button
                    onClick={() => setCurrentCatId(null)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={13} /> Все категории
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
                    const inCart = cart.get(product.id);
                    const name   = productName(product);
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
                      {group.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 opacity-55">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                          <span className="flex-1 min-w-0 text-[10px] leading-tight break-words text-foreground">{capFirst(item.name)}</span>
                          <span className="shrink-0 text-[9px] text-muted-foreground">×{item.qty}</span>
                          <span className="shrink-0 text-[10px] tabular-nums min-w-[44px] text-right">
                            {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                          </span>
                        </div>
                      ))}
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
                    <div className="space-y-1 mb-2">
                      {group.items.map((item) => (
                        <div key={item.productId} className="flex items-center gap-1">
                          <button
                            onClick={() => decrementCart(item.productId)}
                            className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                          >
                            <Minus size={9} />
                          </button>
                          <span className="flex-1 min-w-0 text-[11px] leading-tight break-words text-foreground">{capFirst(item.name)}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground w-5 text-center">{"×"}{item.qty}</span>
                          <span className="shrink-0 text-[11px] font-bold tabular-nums min-w-[52px] text-right">
                            {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                          </span>
                          <button
                            onClick={() => incrementCart(item.productId)}
                            className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors shrink-0"
                          >
                            <Plus size={9} />
                          </button>
                        </div>
                      ))}
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
              disabled={confirming || cartItems.length === 0}
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
                Уже в заказе ({existingItems!.reduce((s, i) => s + i.qty, 0)} поз.)
              </p>
            )}
            {newGroups.map((group, gi) => (
              <div key={gi}>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-500 py-0.5">
                  {existingGroups.length > 0 || gi > 0 ? `Дозаказ — ${group.label}` : `+ ${group.label}`}
                </p>
                {group.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-1.5 text-xs py-0.5">
                    <button onClick={() => decrementCart(item.productId)} className="w-5 h-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0">
                      <Minus size={9} />
                    </button>
                    <span className="flex-1 truncate text-foreground">{capFirst(item.name)}</span>
                    <span className="shrink-0 text-muted-foreground">{"×"}{item.qty}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{(item.price * item.qty).toLocaleString("ru-RU")} ₸</span>
                    <button onClick={() => incrementCart(item.productId)} className="w-5 h-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:border-violet-400 transition-colors shrink-0">
                      <Plus size={9} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="px-3 pb-3 pt-2 flex items-center gap-3">
          <span className="flex-1 text-xs text-muted-foreground">
            {cartItems.length === 0
              ? (existingItems?.length ? `${existingItems.reduce((s, i) => s + i.qty, 0)} поз. в заказе` : "Выберите блюда")
              : `+${cartCount} новых · ${(cartTotal + existingTotal).toLocaleString("ru-RU")} ₸`
            }
          </span>
          <button
            onClick={handleConfirm}
            disabled={confirming || cartItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {confirming
              ? <><Loader2 size={13} className="animate-spin" /> Обработка…</>
              : <><Check size={14} /> {cartItems.length > 0 && existingItems?.length ? "Дозаказать" : confirmLabel}</>
            }
          </button>
        </div>
      </div>
    </>
  );
}

// ── OrderPanel ────────────────────────────────────────────────────────────────
// Thin wrapper: builds the submit handler and delegates all UI to PosMenuBrowser.

function OrderPanel({
  table,
  orderType = "dine-in",
  onBack,
  onDone,
}: {
  table?: DbRestaurantTable;
  orderType?: "dine-in" | "takeaway" | "delivery";
  onBack: () => void;
  onDone: () => void;
}) {
  const [customerName, setCustomerName] = useState("");

  const title =
    orderType === "dine-in"  ? `Стол ${table?.label ?? "?"} · Новый заказ` :
    orderType === "delivery" ? "Доставка · Новый заказ"                     :
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
      ? (table?.label ?? null)
      : (customerName.trim() || null);
    const { error } = await supabase.from(DB_TABLES.orders).insert({
      restaurant_id: RESTAURANT_ID,
      status: "pending",
      type: orderType,
      table_number: tableNumber,
      items_json: items,
      total_price: items.reduce((s, it) => s + it.price * it.qty, 0),
      order_type: "asap",
    });
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    const dest =
      orderType === "dine-in"  ? `стола ${table?.label}` :
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
  async function handleConfirm(newItems: OrderItem[]) {
    const merged = [...existingItems, ...newItems];
    const total  = merged.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: merged, total_price: total }).eq("id", orderId);
    if (error) { toast.error("Ошибка добавления"); return; }
    toast.success(`${newItems.reduce((s, it) => s + it.qty, 0)} позиц. добавлено в чек`);
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
