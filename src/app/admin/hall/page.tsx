"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, RefreshCw, Plus, Clock, Calendar,
  X, Copy, Edit2, Users, Check, ChevronRight,
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
  const [tables, setTables]   = useState<DbRestaurantTable[]>([]);
  const [orders, setOrders]   = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen]   = useState(false);
  const [editTable, setEditTable] = useState<DbRestaurantTable | null>(null);

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
    setTables((tablesRes.data as DbRestaurantTable[]) ?? []);
    setOrders((ordersRes.data as DbOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

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

  const selectedData = selected
    ? tablesWithStatus.find((t) => t.table.id === selected) ?? null
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">План зала</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Интерактивная карта столов · статус обновляется автоматически каждые 30 сек
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          <Plus size={13} />
          Добавить стол
        </button>
      </header>

      {/* ── Legend ── */}
      <div className="px-8 py-2.5 flex items-center gap-5 text-xs border-b border-border bg-muted/30 shrink-0">
        <StatusDot color="emerald" label="Свободен" />
        <StatusDot color="red"     label="Занят"    />
        <StatusDot color="amber"   label="Предзаказ" />
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
              <Loader2 size={16} className="animate-spin" />
              Загрузка…
            </div>
          ) : tables.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(152px, 1fr))" }}
            >
              {tablesWithStatus.map((tws) => (
                <TableCard
                  key={tws.table.id}
                  tws={tws}
                  isSelected={selected === tws.table.id}
                  onClick={() => setSelected(selected === tws.table.id ? null : tws.table.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        {selectedData && (
          <TablePanel
            data={selectedData}
            onClose={() => setSelected(null)}
            onRefresh={load}
            onEditTable={() => setEditTable(selectedData.table)}
            onDeactivate={async () => {
              if (!confirm(`Деактивировать стол «${selectedData.table.label}»?`)) return;
              await supabase
                .from(DB_TABLES.restaurantTables)
                .update({ is_active: false })
                .eq("id", selectedData.table.id);
              toast.success("Стол деактивирован");
              setSelected(null);
              load();
            }}
          />
        )}
      </div>

      {/* Add / Edit modal */}
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

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ color, label }: { color: "emerald" | "red" | "amber"; label: string }) {
  const cls =
    color === "emerald" ? "bg-emerald-500" :
    color === "red"     ? "bg-red-500"     : "bg-amber-400";
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
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
        <p className="text-xs mt-1">Нажмите кнопку ниже, чтобы создать план зала</p>
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
  onClick,
}: {
  tws: TableWithStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { table, status, order, preorderOrder, elapsed } = tws;

  const colors = {
    free:     "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/40",
    occupied: "bg-red-50    dark:bg-red-900/10    border-red-200    dark:border-red-700/40",
    preorder: "bg-amber-50  dark:bg-amber-900/10  border-amber-200  dark:border-amber-700/40",
  };
  const dotColors = {
    free:     "bg-emerald-500",
    occupied: "bg-red-500",
    preorder: "bg-amber-400",
  };
  const labelColors = {
    free:     "text-emerald-700 dark:text-emerald-400",
    occupied: "text-red-700    dark:text-red-400",
    preorder: "text-amber-700  dark:text-amber-400",
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col rounded-xl border-2 p-4 text-left cursor-pointer
        transition-all duration-150 select-none
        ${colors[status]}
        ${isSelected ? "ring-2 ring-violet-500 ring-offset-2" : "hover:opacity-90"}
      `}
    >
      {/* Status dot */}
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dotColors[status]}`} />

      {/* Table number */}
      <p className="text-3xl font-black text-foreground leading-none mb-1">{table.label}</p>

      {/* Seats */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
        <Users size={11} />
        {table.seats} мест
      </div>

      {/* Status info */}
      {status === "occupied" && order && (
        <div className="mt-auto space-y-0.5">
          <p className="text-sm font-bold text-foreground">
            {(order.total_price ?? 0).toLocaleString("ru-RU")} ₸
          </p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock size={10} />
            {formatElapsed(elapsed)}
          </div>
        </div>
      )}

      {status === "preorder" && preorderOrder && (
        <div className="mt-auto">
          <div className="flex items-center gap-1 text-[11px]">
            <Calendar size={10} className={labelColors.preorder} />
            <span className={`font-semibold ${labelColors.preorder}`}>
              {preorderOrder.preorder_time?.slice(0, 5) ?? preorderOrder.preorder_date}
            </span>
          </div>
        </div>
      )}

      {status === "free" && (
        <div className="mt-auto">
          <span className={`text-[11px] font-semibold ${labelColors.free}`}>Свободен</span>
        </div>
      )}
    </button>
  );
}

// ── TablePanel ────────────────────────────────────────────────────────────────

function TablePanel({
  data,
  onClose,
  onRefresh,
  onEditTable,
  onDeactivate,
}: {
  data: TableWithStatus;
  onClose: () => void;
  onRefresh: () => void;
  onEditTable: () => void;
  onDeactivate: () => void;
}) {
  const { table, status, order, preorderOrder, elapsed } = data;
  const [closing, setClosing]           = useState(false);
  const [copiedId, setCopiedId]         = useState(false);
  const [changingTable, setChangingTable] = useState(false);
  const [newLabel, setNewLabel]         = useState("");

  const activeOrder = order ?? preorderOrder;
  const items: OrderItem[] = Array.isArray(activeOrder?.items_json)
    ? (activeOrder!.items_json as OrderItem[])
    : [];

  async function closeOrder() {
    if (!order) return;
    if (!confirm(`Закрыть заказ #${order.id}? Это действие нельзя отменить.`)) return;
    setClosing(true);
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ status: "completed" })
      .eq("id", order.id);
    setClosing(false);
    if (error) { toast.error("Ошибка закрытия заказа"); return; }
    toast.success("Заказ закрыт!");
    onRefresh();
  }

  async function changeTable() {
    if (!order || !newLabel.trim()) return;
    const { error } = await supabase
      .from(DB_TABLES.orders)
      .update({ table_number: newLabel.trim() })
      .eq("id", order.id);
    if (error) { toast.error("Ошибка обновления"); return; }
    toast.success("Стол изменён!");
    setChangingTable(false);
    setNewLabel("");
    onRefresh();
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast.success("Номер заказа скопирован!");
    } catch { /* clipboard unavailable */ }
  }

  return (
    <aside className="w-80 shrink-0 border-l border-border flex flex-col bg-background overflow-y-auto">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <p className="text-sm font-semibold">Стол {table.label}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users size={10} />
            {table.seats} мест ·{" "}
            {status === "free"     ? "Свободен"  :
             status === "occupied" ? "Занят"     : "Предзаказ"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEditTable}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Редактировать стол"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {status === "free" && (
          <div className="p-4 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <span className="text-4xl mt-4 select-none">🟢</span>
            <p className="text-sm font-medium text-foreground">Стол свободен</p>
            <p className="text-xs max-w-[200px]">
              Гости делают заказ самостоятельно через QR-код на столе
            </p>
          </div>
        )}

        {(status === "occupied" || status === "preorder") && activeOrder && (
          <div className="p-4 space-y-4">
            {/* Order ID row */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                Заказ
              </p>
              <button
                onClick={() => copyId(activeOrder.id)}
                className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{activeOrder.id}</span>
                {copiedId
                  ? <Check size={11} className="text-emerald-500" />
                  : <Copy size={11} />
                }
              </button>
            </div>

            {/* Elapsed / preorder time */}
            {status === "occupied" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30">
                <Clock size={14} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Сидят
                  </p>
                  <p className="text-sm font-bold text-red-800 dark:text-red-200">
                    {formatElapsed(elapsed)}
                  </p>
                </div>
              </div>
            )}

            {status === "preorder" && activeOrder.preorder_date && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30">
                <Calendar size={14} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Предзаказ на
                  </p>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                    {[activeOrder.preorder_date, activeOrder.preorder_time?.slice(0, 5)].filter(Boolean).join(" в ")}
                  </p>
                </div>
              </div>
            )}

            {/* Guest comments */}
            {activeOrder.customer_comments && (
              <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                  Пожелания гостя
                </p>
                <p className="text-sm">{activeOrder.customer_comments}</p>
              </div>
            )}

            {/* Items */}
            {items.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Состав заказа
                </p>
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">
                        {item.name} × {item.qty}
                      </span>
                      <span className="font-medium shrink-0">
                        {(item.price * item.qty).toLocaleString("ru-RU")} {item.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-sm font-semibold">Итого</p>
              <p className="text-lg font-black">
                {(activeOrder.total_price ?? 0).toLocaleString("ru-RU")} ₸
              </p>
            </div>

            {/* Change table */}
            {status === "occupied" && (
              <div>
                {changingTable ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Новый стол"
                      className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && changeTable()}
                    />
                    <button
                      onClick={changeTable}
                      disabled={!newLabel.trim()}
                      className="px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setChangingTable(false)}
                      className="px-2 h-8 rounded-lg border border-border text-xs hover:bg-accent transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setChangingTable(true)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent text-sm transition-colors"
                  >
                    <span>Перенести на другой стол</span>
                    <ChevronRight size={13} className="text-muted-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* Close order */}
            {status === "occupied" && (
              <button
                onClick={closeOrder}
                disabled={closing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {closing ? (
                  <><Loader2 size={14} className="animate-spin" /> Закрытие…</>
                ) : (
                  <><Check size={14} /> Оплачен / Закрыть заказ</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Deactivate footer */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={onDeactivate}
          className="w-full text-xs text-muted-foreground hover:text-red-500 transition-colors py-1"
        >
          Деактивировать стол
        </button>
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
  const [label, setLabel] = useState(table?.label ?? "");
  const [seats, setSeats] = useState(String(table?.seats ?? 4));
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
    toast.success("Стол сохранён!");
    onSaved();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-sm bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">{table ? "Редактировать стол" : "Добавить стол"}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Название стола
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Напр: 1, A3, Терраса, VIP"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving || !label.trim()}
              className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
