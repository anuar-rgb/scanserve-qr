"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, Plus, Clock, Calendar, X, Copy, Edit2, Users,
  Check, ChevronRight, Printer, ShoppingCart, Settings, Trash2, Lock,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbOrder, DbRestaurantTable } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type TableStatus = "free" | "occupied" | "preorder";
type OrderItem = { name: string; qty: number; price: number; currency: string };

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HallPage() {
  const [tables, setTables]         = useState<DbRestaurantTable[]>([]);
  const [orders, setOrders]         = useState<DbOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [selected, setSelected]     = useState<string | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [editTable, setEditTable]   = useState<DbRestaurantTable | null>(null);
  const knownOrderIds               = useRef(new Set<string>());

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

    const newOrders = (ordersRes.data as DbOrder[]) ?? [];

    if (knownOrderIds.current.size > 0) {
      const incoming = newOrders.filter((o) => !knownOrderIds.current.has(o.id));
      if (incoming.length > 0) {
        playNewOrderSound();
        toast.success(`Новый заказ · Стол ${incoming[0].table_number ?? "—"}`, { duration: 6000 });
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
      .on("postgres_changes", { event: "*", schema: "public", table: DB_TABLES.orders }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: DB_TABLES.restaurantTables }, () => load())
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-3 bg-background">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">План зала</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${realtimeOk ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
            <span className="text-xs text-muted-foreground">
              {realtimeOk ? "Realtime" : "Подключение…"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {occupiedCount} занято · {freeCount} свободно
              {preorderCount > 0 && ` · ${preorderCount} предзаказ`}
            </span>
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

        {editMode && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0"
          >
            <Plus size={12} />
            Добавить стол
          </button>
        )}

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
      </header>

      {/* ── Edit mode banner ────────────────────────────────────────────────── */}
      {editMode && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-700/50 shrink-0 flex items-center gap-2">
          <Settings size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Режим редактирования · Занятые столы защищены от изменений · Нажмите «Готово» чтобы вернуться к работе
          </p>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-2 flex items-center gap-4 text-xs border-b border-border bg-muted/20 shrink-0">
        <LegendDot color="emerald" label="Свободен" />
        <LegendDot color="red"     label="Занят"    />
        <LegendDot color="amber"   label="Предзаказ" />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Grid area */}
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

        {/* Side panel — work mode only, slides from right */}
        {!editMode && selectedData && (
          <TablePanel
            key={selectedData.table.id}
            data={selectedData}
            onClose={() => setSelected(null)}
            onRefresh={load}
          />
        )}
      </div>

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

// ── TablePanel ────────────────────────────────────────────────────────────────

function TablePanel({
  data,
  onClose,
  onRefresh,
}: {
  data: TableWithStatus;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { table, status, order, preorderOrder, elapsed } = data;
  const [closing, setClosing]             = useState(false);
  const [copiedId, setCopiedId]           = useState(false);
  const [changingTable, setChangingTable] = useState(false);
  const [newLabel, setNewLabel]           = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [addingItem, setAddingItem]       = useState(false);
  const [itemName, setItemName]           = useState("");
  const [itemPrice, setItemPrice]         = useState("");
  const [itemQty, setItemQty]             = useState("1");
  const [itemSaving, setItemSaving]       = useState(false);

  const activeOrder = order ?? preorderOrder;
  const items: OrderItem[] = Array.isArray(activeOrder?.items_json)
    ? (activeOrder!.items_json as OrderItem[])
    : [];

  async function closeOrder() {
    if (!order) return;
    if (!confirm(`Закрыть заказ и принять оплату?\n\nСтол: ${table.label} · Итого: ${(order.total_price ?? 0).toLocaleString("ru-RU")} ₸`)) return;
    setClosing(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "completed" })
      .eq("id", order.id);
    setClosing(false);
    if (error) { toast.error("Ошибка закрытия заказа"); return; }
    toast.success("Заказ закрыт, стол освобождён!");
    onRefresh();
  }

  async function changeTable() {
    if (!order || !newLabel.trim()) return;
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ table_number: newLabel.trim() })
      .eq("id", order.id);
    if (error) { toast.error("Ошибка обновления"); return; }
    toast.success(`Заказ перенесён на стол ${newLabel.trim()}`);
    setChangingTable(false);
    setNewLabel("");
    onRefresh();
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function createWalkInOrder() {
    setCreatingOrder(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .insert({
        restaurant_id: RESTAURANT_ID,
        status: "pending",
        type: "dine-in",
        table_number: table.label,
        items_json: [],
        total_price: 0,
        order_type: "asap",
      });
    setCreatingOrder(false);
    if (error) { toast.error("Ошибка создания заказа"); return; }
    toast.success(`Заказ для стола ${table.label} открыт`);
    onRefresh();
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
    <aside className="w-[340px] shrink-0 border-l border-border flex flex-col bg-background overflow-hidden">

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
              onClick={createWalkInOrder}
              disabled={creatingOrder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {creatingOrder
                ? <><Loader2 size={14} className="animate-spin" /> Создаём…</>
                : <><ShoppingCart size={14} /> Принять заказ</>}
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
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Время за столом</p>
                  <p className="text-base font-black text-red-800 dark:text-red-200">{formatElapsed(elapsed)}</p>
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Номер нового стола"
                      className="flex-1 h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && changeTable()}
                    />
                    <button
                      onClick={changeTable}
                      disabled={!newLabel.trim()}
                      className="px-4 h-9 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => { setChangingTable(false); setNewLabel(""); }}
                      className="px-3 h-9 rounded-xl border border-border hover:bg-accent transition-colors"
                    >
                      <X size={13} />
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
    if (table) {
      await supabase
        .from(DB_TABLES.restaurantTables)
        .update({ label: label.trim(), seats: Number(seats) || 4 })
        .eq("id", table.id);
    } else {
      await supabase
        .from(DB_TABLES.restaurantTables)
        .insert({ restaurant_id: RESTAURANT_ID, label: label.trim(), seats: Number(seats) || 4 });
    }
    setSaving(false);
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
