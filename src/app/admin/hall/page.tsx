"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, Plus, Clock, Calendar, X, Copy, Edit2, Users,
  Check, ChevronLeft, ChevronRight, Printer, ShoppingCart, Settings, Trash2, Lock,
  ArrowLeft, Search, Minus, UtensilsCrossed, Package, Bike, CheckCircle2, MessageSquare,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder, DbRestaurantTable, DbCategory, DbProduct } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = "free" | "occupied" | "preorder";
type OrderItem = { name: string; qty: number; price: number; currency: string };
type CartItem  = { productId: string; name: string; price: number; qty: number };

interface TableWithStatus {
  table: DbRestaurantTable;
  status: TableStatus;
  order: DbOrder | null;
  preorderOrder: DbOrder | null;
  elapsed: number;
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
  return p.name.ru || p.name.en || p.name.kz || "";
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
    await supabase
      .from(DB_TABLES.restaurantTables)
      .update({ is_active: false })
      .eq("id", tws.table.id);
    toast.success(`Стол ${tws.table.label} удалён`);
    if (selected === tws.table.id) setSelected(null);
    load();
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

  const takeawayOrders = orders.filter((o) => o.type !== "dine-in" && o.type !== "delivery");
  const deliveryOrders = orders.filter((o) => o.type === "delivery");

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

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>

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
              <TablePanel
                key={selectedData.table.id}
                data={selectedData}
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
        />
      )}

      {/* Modals */}
      {(addOpen || editTable) && (
        <TableFormModal
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
  isSelected,
  onClick,
  onComplete,
}: {
  order: DbOrder;
  isSelected: boolean;
  onClick: () => void;
  onComplete: () => void;
}) {
  const elapsed = getElapsed(order.created_at);
  const shortId = order.id.startsWith("ORD-") ? order.id : `#${order.id.slice(0, 8)}`;
  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];

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
      <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />

      <div className="p-4 pb-3 flex-1">
        <p className="text-[11px] font-mono font-semibold text-muted-foreground mb-1">{shortId}</p>
        {order.table_number && (
          <p className="text-sm font-bold text-foreground truncate mb-1">{order.table_number}</p>
        )}
        <p className="text-xl font-black text-foreground">
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
}: {
  order: DbOrder;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
}) {
  const [closing, setClosing]       = useState(false);
  const [copiedId, setCopiedId]     = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [itemName, setItemName]     = useState("");
  const [itemPrice, setItemPrice]   = useState("");
  const [itemQty, setItemQty]       = useState("1");
  const [itemSaving, setItemSaving] = useState(false);

  const items: OrderItem[] = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];
  const elapsed  = getElapsed(order.created_at);
  const typeLabel = order.type === "delivery" ? "Доставка" : "С собой";
  const typeIcon  = order.type === "delivery" ? "🛵" : "🛍️";

  async function close() {
    if (!confirm(`Завершить и выдать заказ?\n${typeLabel} · ${(order.total_price ?? 0).toLocaleString("ru-RU")} ₸`)) return;
    setClosing(true);
    console.log("[OrderSlotPanel.close] UPDATE order", order.id, "→ status=completed");
    const { error, data } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select();
    setClosing(false);
    console.log("[OrderSlotPanel.close] response:", { error, data });
    if (error) { toast.error(`Ошибка закрытия: ${error.message}`); return; }
    if (!data || data.length === 0) {
      console.warn("[OrderSlotPanel.close] 0 rows updated — возможна блокировка RLS");
      toast.error("Заказ не обновлён — проверьте RLS в Supabase Dashboard");
      return;
    }
    onOrderClosed(order.id);
    toast.success("Заказ выдан!");
    onClose();
    onRefresh();
  }

  async function copyId(id: string) {
    try { await navigator.clipboard.writeText(id); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  async function addItemToOrder() {
    if (!itemName.trim() || !itemPrice) return;
    setItemSaving(true);
    const newItem: OrderItem = { name: itemName.trim(), qty: Math.max(1, parseInt(itemQty) || 1), price: parseFloat(itemPrice) || 0, currency: "₸" };
    const updatedItems = [...items, newItem];
    const newTotal = updatedItems.reduce((s, it) => s + it.price * it.qty, 0);
    const { error } = await supabase.from(DB_TABLES.orders).update({ items_json: updatedItems, total_price: newTotal }).eq("id", order.id);
    setItemSaving(false);
    if (error) { toast.error("Ошибка добавления"); return; }
    toast.success(`${newItem.name} — добавлено в чек`);
    setItemName(""); setItemPrice(""); setItemQty("1"); setAddingItem(false);
    onRefresh();
  }

  return (
    <aside className="w-[500px] shrink-0 border-l border-border flex flex-col bg-background overflow-hidden">
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
              <div className="space-y-1.5 rounded-xl border border-border overflow-hidden">
                {items.map((item, i) => (
                  <div key={i} className={`flex justify-between items-center px-3 py-2 text-sm ${i < items.length - 1 ? "border-b border-border" : ""}`}>
                    <span className="text-muted-foreground truncate mr-3">{item.name}<span className="ml-1 text-muted-foreground/60">× {item.qty}</span></span>
                    <span className="font-semibold shrink-0 tabular-nums">{(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            {addingItem ? (
              <div className="space-y-2 p-3.5 rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50/60 dark:bg-violet-900/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Добавить позицию</p>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Название блюда / напитка" className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" autoFocus />
                <div className="flex gap-2">
                  <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="Цена, ₸" min={0} className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} placeholder="Кол." min={1} max={99} className="w-14 h-8 px-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500" onKeyDown={(e) => e.key === "Enter" && addItemToOrder()} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addItemToOrder} disabled={itemSaving || !itemName.trim() || !itemPrice} className="flex-1 h-8 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors">
                    {itemSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Добавить в чек"}
                  </button>
                  <button onClick={() => { setAddingItem(false); setItemName(""); setItemPrice(""); setItemQty("1"); }} className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-accent transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingItem(true)} className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border hover:border-violet-400 hover:text-violet-600 text-xs text-muted-foreground transition-colors">
                <Plus size={12} /> Добавить позицию в чек
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold">Итого</p>
            <p className="text-2xl font-black tabular-nums">{(order.total_price ?? 0).toLocaleString("ru-RU")} ₸</p>
          </div>

          <button onClick={close} disabled={closing} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {closing ? <><Loader2 size={14} className="animate-spin" /> Закрытие…</> : <><Check size={15} /> Выдан · Закрыть заказ</>}
          </button>

        </div>
      </div>
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
}: {
  orders: DbOrder[];
  loading: boolean;
  orderType: "takeaway" | "delivery";
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
                {orders.map((order) => (
                  <OrderSlotCard
                    key={order.id}
                    order={order}
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
        <OrderSlotPanel
          key={selectedOrder.id}
          order={selectedOrder}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
          onOrderClosed={onOrderClosed}
        />
      )}
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
}: {
  data: TableWithStatus;
  onClose: () => void;
  onRefresh: () => void;
  onOrderClosed: (orderId: string) => void;
  onOrderTransferred: (orderId: string, newTableNumber: string) => void;
  allTables: TableWithStatus[];
}) {
  const { table, status, order, preorderOrder, elapsed } = data;
  const [panelMode, setPanelMode]             = useState<"info" | "order">("info");
  const [closing, setClosing]                 = useState(false);
  const [copiedId, setCopiedId]               = useState(false);
  const [changingTable, setChangingTable]     = useState(false);
  const [addingItem, setAddingItem]           = useState(false);
  const [itemName, setItemName]               = useState("");
  const [itemPrice, setItemPrice]             = useState("");
  const [itemQty, setItemQty]                 = useState("1");
  const [itemSaving, setItemSaving]           = useState(false);

  const activeOrder = order ?? preorderOrder;
  const items: OrderItem[] = Array.isArray(activeOrder?.items_json)
    ? (activeOrder!.items_json as OrderItem[])
    : [];

  // ── Order creation mode ──────────────────────────────────────────────────────
  if (panelMode === "order") {
    return (
      <aside className="w-[500px] shrink-0 border-l border-border flex flex-col bg-background overflow-hidden">
        <OrderPanel
          table={table}
          onBack={() => setPanelMode("info")}
          onDone={() => { setPanelMode("info"); onRefresh(); }}
        />
      </aside>
    );
  }

  // ── Info mode ────────────────────────────────────────────────────────────────

  async function closeOrder() {
    if (!order) return;
    if (!confirm(`Закрыть заказ и принять оплату?\n\nСтол: ${table.label} · Итого: ${(order.total_price ?? 0).toLocaleString("ru-RU")} ₸`)) return;
    setClosing(true);
    console.log("[closeOrder] UPDATE order", order.id, "→ status=completed");
    const { error, data } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("restaurant_id", RESTAURANT_ID)
      .select();
    setClosing(false);
    console.log("[closeOrder] response:", { error, data });
    if (error) { toast.error(`Ошибка закрытия: ${error.message}`); return; }
    if (!data || data.length === 0) {
      console.warn("[closeOrder] 0 rows updated — возможна блокировка RLS");
      toast.error("Заказ не обновлён — проверьте RLS в Supabase Dashboard");
      return;
    }
    onOrderClosed(order.id);
    toast.success("Заказ закрыт, стол освобождён!");
    onClose();
    onRefresh();
  }

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

  async function addItemToOrder() {
    if (!order || !itemName.trim() || !itemPrice) return;
    setItemSaving(true);
    const newItem: OrderItem = {
      name: itemName.trim(),
      qty: Math.max(1, parseInt(itemQty) || 1),
      price: parseFloat(itemPrice) || 0,
      currency: "₸",
    };
    const updatedItems = [...items, newItem];
    const newTotal = updatedItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ items_json: updatedItems, total_price: newTotal })
      .eq("id", order.id);
    setItemSaving(false);
    if (error) { toast.error("Ошибка добавления"); return; }
    toast.success(`${newItem.name} — добавлено в чек`);
    setItemName(""); setItemPrice(""); setItemQty("1"); setAddingItem(false);
    onRefresh();
  }

  return (
    <aside className="w-[500px] shrink-0 border-l border-border flex flex-col bg-background overflow-hidden">

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
                <div className="space-y-1.5 rounded-xl border border-border overflow-hidden">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className={`flex justify-between items-center px-3 py-2 text-sm ${
                        i < items.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <span className="text-muted-foreground truncate mr-3">
                        {item.name}
                        <span className="ml-1 text-muted-foreground/60">× {item.qty}</span>
                      </span>
                      <span className="font-semibold shrink-0 tabular-nums">
                        {(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick-add item — occupied only */}
            {status === "occupied" && (
              <div>
                {addingItem ? (
                  <div className="space-y-2 p-3.5 rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50/60 dark:bg-violet-900/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                      Добавить позицию
                    </p>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Название блюда / напитка"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        placeholder="Цена, ₸"
                        min={0}
                        className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        placeholder="Кол."
                        min={1}
                        max={99}
                        className="w-14 h-8 px-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                        onKeyDown={(e) => e.key === "Enter" && addItemToOrder()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addItemToOrder}
                        disabled={itemSaving || !itemName.trim() || !itemPrice}
                        className="flex-1 h-8 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        {itemSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Добавить в чек"}
                      </button>
                      <button
                        onClick={() => { setAddingItem(false); setItemName(""); setItemPrice(""); setItemQty("1"); }}
                        className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-accent transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingItem(true)}
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border hover:border-violet-400 hover:text-violet-600 text-xs text-muted-foreground transition-colors"
                  >
                    <Plus size={12} />
                    Добавить позицию в чек
                  </button>
                )}
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold">Итого</p>
              <p className="text-2xl font-black tabular-nums">
                {(activeOrder.total_price ?? 0).toLocaleString("ru-RU")} ₸
              </p>
            </div>

            {/* Change table */}
            {status === "occupied" && (
              <>
                {changingTable ? (
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
                ) : (
                  <button
                    onClick={() => setChangingTable(true)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-sm transition-colors"
                  >
                    <span className="text-muted-foreground">Перенести на другой стол</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                )}
              </>
            )}

            {/* Close order */}
            {status === "occupied" && (
              <button
                onClick={closeOrder}
                disabled={closing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {closing
                  ? <><Loader2 size={14} className="animate-spin" /> Закрытие…</>
                  : <><Check size={15} /> Оплачен · Закрыть заказ</>}
              </button>
            )}

          </div>
        )}
      </div>
    </aside>
  );
}

// ── OrderPanel ────────────────────────────────────────────────────────────────

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
  const [categories, setCategories]       = useState<DbCategory[]>([]);
  const [products, setProducts]           = useState<DbProduct[]>([]);
  const [catLoading, setCatLoading]       = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [cart, setCart]                   = useState<Map<string, CartItem>>(new Map());
  const [submitting, setSubmitting]       = useState(false);
  const [customerName, setCustomerName]   = useState("");
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const catTabsRef = useRef<HTMLDivElement>(null);

  // Wheel → horizontal scroll + arrow visibility
  useEffect(() => {
    const el = catTabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    function onScroll() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Recheck arrows when categories load
  useEffect(() => {
    const el = catTabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, [categories]);

  useEffect(() => {
    async function fetchCatalog() {
      const [catsRes, prodsRes] = await Promise.all([
        supabase
          .from(DB_TABLES.categories)
          .select("*")
          .eq("restaurant_id", RESTAURANT_ID)
          .order("order_index"),
        supabase
          .from(DB_TABLES.products)
          .select("*")
          .eq("restaurant_id", RESTAURANT_ID)
          .eq("is_archived", false)
          .order("order_index"),
      ]);
      const cats = (catsRes.data as DbCategory[]) ?? [];
      setCategories(cats);
      setProducts((prodsRes.data as DbProduct[]) ?? []);
      setSelectedCatId(cats[0]?.id ?? null);
      setCatLoading(false);
    }
    fetchCatalog();
  }, []);

  function scrollCats(dir: "left" | "right") {
    catTabsRef.current?.scrollBy({ left: dir === "left" ? -180 : 180, behavior: "smooth" });
  }

  function addToCart(product: DbProduct) {
    const name = productName(product);
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, existing
        ? { ...existing, qty: existing.qty + 1 }
        : { productId: product.id, name, price: product.price, qty: 1 }
      );
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
  const total     = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const trimmed = search.trim().toLowerCase();
  const visibleProducts = products.filter((p) => {
    if (!p.is_available) return false;
    if (trimmed) {
      return (
        p.name.ru.toLowerCase().includes(trimmed) ||
        p.name.en.toLowerCase().includes(trimmed) ||
        p.name.kz.toLowerCase().includes(trimmed)
      );
    }
    return !selectedCatId || p.category_id === selectedCatId;
  });

  async function submitOrder() {
    if (cartItems.length === 0) { toast.error("Добавьте хотя бы одно блюдо"); return; }
    setSubmitting(true);
    const items: OrderItem[] = cartItems.map((i) => ({
      name: i.name, qty: i.qty, price: i.price, currency: "₸",
    }));
    const tableNumber = orderType === "dine-in"
      ? (table?.label ?? null)
      : (customerName.trim() || null);
    const { error } = await supabase.from(DB_TABLES.orders).insert({
      restaurant_id: RESTAURANT_ID,
      status: "pending",
      type: orderType,
      table_number: tableNumber,
      items_json: items,
      total_price: total,
      order_type: "asap",
    });
    setSubmitting(false);
    if (error) { toast.error(`Ошибка: ${error.message}`); return; }
    const dest = orderType === "dine-in"
      ? `стола ${table?.label}`
      : orderType === "delivery" ? "доставки" : "самовывоза";
    toast.success(`Заказ для ${dest} отправлен на кухню!`);
    onDone();
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {orderType === "dine-in"
              ? `Стол ${table?.label} · Новый заказ`
              : orderType === "delivery" ? "Доставка · Новый заказ" : "С собой · Новый заказ"}
          </p>
        </div>
        <div className="relative shrink-0">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className="h-8 pl-7 pr-3 w-28 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:w-36 transition-all"
          />
        </div>
      </div>

      {/* ── Customer name (pickup / delivery only) ── */}
      {orderType !== "dine-in" && (
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Имя клиента (необязательно)"
            className="w-full h-8 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      )}

      {/* ── Category tabs ── */}
      {!trimmed && categories.length > 0 && (
        <div className="relative border-b border-border shrink-0">

          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scrollCats("left")}
              className="absolute left-0 top-0 bottom-[5px] z-10 flex items-center pl-1 pr-2.5 bg-gradient-to-r from-background via-background/70 to-transparent"
            >
              <ChevronLeft size={14} className="text-zinc-400 dark:text-zinc-500 hover:text-foreground transition-colors shrink-0" />
            </button>
          )}

          {/* Scrollable strip */}
          <div
            ref={catTabsRef}
            className="flex gap-1.5 py-2 overflow-x-auto admin-scroll-x"
            style={{
              paddingLeft:  canScrollLeft  ? 28 : 12,
              paddingRight: canScrollRight ? 28 : 12,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(120,120,130,0.4) transparent",
            } as React.CSSProperties}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedCatId === cat.id
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name.ru || cat.name.en}
              </button>
            ))}
          </div>

          {/* Right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scrollCats("right")}
              className="absolute right-0 top-0 bottom-[5px] z-10 flex items-center pr-1 pl-2.5 bg-gradient-to-l from-background via-background/70 to-transparent"
            >
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 hover:text-foreground transition-colors shrink-0" />
            </button>
          )}

        </div>
      )}

      {/* ── Product grid (scrollable) ── */}
      <div className="flex-1 overflow-y-auto p-2.5 min-h-0 admin-scroll">
        {catLoading ? (
          <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground text-xs">
            <Loader2 size={14} className="animate-spin" /> Загрузка меню…
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">
            {trimmed ? "Ничего не найдено" : "Нет доступных позиций"}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {visibleProducts.map((product) => {
              const inCart = cart.get(product.id);
              const name   = productName(product);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="relative flex flex-col text-left rounded-lg border border-border bg-card p-2 hover:border-violet-400 dark:hover:border-violet-500 active:scale-[0.97] transition-all group"
                >
                  {/* Qty badge */}
                  {inCart && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {inCart.qty}
                    </span>
                  )}

                  {/* Name */}
                  <p className="text-[10px] font-semibold leading-tight line-clamp-3 pr-4 min-h-[2.8rem] text-foreground">
                    {name}
                  </p>

                  {/* Price + add */}
                  <div className="flex items-center justify-between mt-1.5 gap-0.5">
                    <span className="text-[11px] font-black tabular-nums text-foreground leading-none">
                      {product.price.toLocaleString("ru-RU")} ₸
                    </span>
                    <div className="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                      <Plus size={11} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cart + Submit (pinned to bottom) ── */}
      <div className="shrink-0 border-t border-border bg-background">
        {/* Cart items */}
        {cartItems.length > 0 && (
          <div className="px-3 pt-2 pb-1 max-h-32 overflow-y-auto space-y-1">
            {cartItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => decrementCart(item.productId)}
                  className="w-5 h-5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                >
                  <Minus size={9} />
                </button>
                <span className="flex-1 truncate text-foreground">{item.name}</span>
                <span className="shrink-0 text-muted-foreground">×{item.qty}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {(item.price * item.qty).toLocaleString("ru-RU")} ₸
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total + button */}
        <div className="px-3 pb-3 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {cartItems.length === 0 ? "Корзина пуста" : `${cartCount} позиц.`}
            </span>
            <span className="text-xl font-black tabular-nums">
              {total.toLocaleString("ru-RU")} ₸
            </span>
          </div>
          <button
            onClick={submitOrder}
            disabled={submitting || cartItems.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Отправка…</>
              : <><Check size={15} /> Отправить на кухню</>
            }
          </button>
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

  async function save() {
    if (!label.trim()) return;
    setSaving(true);
    const { error } = table
      ? await supabase
          .from(DB_TABLES.restaurantTables)
          .update({ label: label.trim(), seats: Number(seats) || 4 })
          .eq("id", table.id)
      : await supabase
          .from(DB_TABLES.restaurantTables)
          .insert({ restaurant_id: RESTAURANT_ID, label: label.trim(), seats: Number(seats) || 4 });
    setSaving(false);
    if (error) {
      console.error("[TableFormModal] save error:", error);
      toast.error(`Ошибка сохранения: ${error.message}`);
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
