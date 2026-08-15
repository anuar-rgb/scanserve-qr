"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, ShoppingBag,
  Receipt, DollarSign, Building2,
} from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useBranch, useBranchRestaurantId, useIsAllBranches } from "@/lib/branch-context";

// ─── types ────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "all";

interface OrderRow  { total_price: number; created_at: string; restaurant_id: string; }
interface InvoiceRow { supplier_name: string; total_amount: number; created_at: string; restaurant_id: string; }

interface DayBar { label: string; revenue: number; expenses: number; }
interface SupplierRow { name: string; total: number; pct: number; }
interface BranchRow { id: string; name: string; revenue: number; orders: number; }

// ─── helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<Period, string> = {
  today: "Сегодня",
  week:  "7 дней",
  month: "30 дней",
  all:   "Всё время",
};

function fromDate(p: Period): Date | null {
  if (p === "all") return null;
  const d = new Date();
  if (p === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")  { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

function buildDayBars(orders: OrderRow[], invoices: InvoiceRow[], p: Period): DayBar[] {
  if (p === "today") {
    const h = new Date().getHours();
    const bars: DayBar[] = Array.from({ length: h + 1 }, (_, i) => ({
      label: `${i}:00`, revenue: 0, expenses: 0,
    }));
    for (const o of orders) {
      const oh = new Date(o.created_at).getHours();
      if (oh <= h) bars[oh].revenue += o.total_price ?? 0;
    }
    for (const inv of invoices) {
      const ih = new Date(inv.created_at).getHours();
      if (ih <= h) bars[ih].expenses += inv.total_amount ?? 0;
    }
    return bars;
  }
  if (p === "all") return [];
  const dayCount = p === "week" ? 7 : 30;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const bars: DayBar[] = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(todayMs);
    d.setDate(d.getDate() - (dayCount - 1 - i));
    return {
      label: p === "week"
        ? ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"][d.getDay()]
        : String(d.getDate()),
      revenue: 0,
      expenses: 0,
    };
  });
  for (const o of orders) {
    const oMs = new Date(new Date(o.created_at).setHours(0, 0, 0, 0));
    const idx = dayCount - 1 - Math.round((todayMs - oMs.getTime()) / 86_400_000);
    if (idx >= 0 && idx < dayCount) bars[idx].revenue += o.total_price ?? 0;
  }
  for (const inv of invoices) {
    const iMs = new Date(new Date(inv.created_at).setHours(0, 0, 0, 0));
    const idx = dayCount - 1 - Math.round((todayMs - iMs.getTime()) / 86_400_000);
    if (idx >= 0 && idx < dayCount) bars[idx].expenses += inv.total_amount ?? 0;
  }
  return bars;
}

function buildSuppliers(invoices: InvoiceRow[]): SupplierRow[] {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    map.set(inv.supplier_name, (map.get(inv.supplier_name) ?? 0) + inv.total_amount);
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
  return [...map.entries()]
    .map(([name, t]) => ({ name, total: t, pct: (t / total) * 100 }))
    .sort((a, b) => b.total - a.total);
}

function buildBranchRows(
  orders: OrderRow[],
  branches: { id: string; name: string }[],
): BranchRow[] {
  return branches
    .map((b) => {
      const bOrders = orders.filter((o) => o.restaurant_id === b.id);
      return {
        id: b.id,
        name: b.name,
        revenue: bOrders.reduce((s, o) => s + (o.total_price ?? 0), 0),
        orders: bOrders.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── component ────────────────────────────────────────────────────────────────

export default function OwnerOverviewPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const { branches } = useBranch();
  const restaurantId  = useBranchRestaurantId();
  const isAll         = useIsAllBranches();

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const from = fromDate(period);

    // Build queries depending on single branch vs. all branches
    const buildOrdersQ = () => {
      let q = supabase
        .from("orders")
        .select("total_price, created_at, restaurant_id")
        .eq("status", "completed");
      if (isAll && branches.length > 0) {
        q = q.in("restaurant_id", branches.map((b) => b.id));
      } else if (restaurantId) {
        q = q.eq("restaurant_id", restaurantId);
      }
      if (from) q = q.gte("created_at", from.toISOString());
      return q;
    };

    const buildInvoicesQ = () => {
      let q = supabase
        .from("invoices")
        .select("supplier_name, total_amount, created_at, restaurant_id");
      if (isAll && branches.length > 0) {
        q = q.in("restaurant_id", branches.map((b) => b.id));
      } else if (restaurantId) {
        q = q.eq("restaurant_id", restaurantId);
      }
      if (from) q = q.gte("created_at", from.toISOString());
      return q;
    };

    const [{ data: ord }, { data: inv }] = await Promise.all([
      buildOrdersQ(),
      buildInvoicesQ(),
    ]);
    setOrders((ord ?? []) as OrderRow[]);
    setInvoices((inv ?? []) as InvoiceRow[]);
    setLoading(false);
  }, [period, restaurantId, isAll, branches]);

  useEffect(() => { load(); }, [load]);

  const revenue  = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const expenses = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const profit   = revenue - expenses;
  const foodCost = revenue > 0 ? (expenses / revenue) * 100 : 0;

  const bars        = buildDayBars(orders, invoices, period);
  const suppliers   = buildSuppliers(invoices);
  const branchRows  = isAll ? buildBranchRows(orders, branches) : [];
  const barMax      = Math.max(...bars.map((b) => Math.max(b.revenue, b.expenses)), 1);
  const branchMax   = Math.max(...branchRows.map((b) => b.revenue), 1);

  const pageTitle = isAll ? "Обзор по сети" : "Обзор прибыли";
  const pageSubtitle = isAll
    ? `Сводная аналитика по ${branches.length} филиалам`
    : "Выручка, расходы и чистая прибыль ресторана";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                period === p
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<ShoppingBag size={16} className="text-emerald-500" />}
            label="Выручка"
            value={`${fmt(revenue)} ₸`}
            sub={`${orders.length} завершённых заказов`}
            color="emerald"
          />
          <KpiCard
            icon={<Receipt size={16} className="text-red-400" />}
            label="Расходы (накладные)"
            value={`${fmt(expenses)} ₸`}
            sub={`${invoices.length} накладных`}
            color="red"
          />
          <KpiCard
            icon={
              profit >= 0
                ? <TrendingUp size={16} className="text-violet-500" />
                : <TrendingDown size={16} className="text-red-500" />
            }
            label="Чистая прибыль"
            value={`${profit >= 0 ? "+" : ""}${fmt(profit)} ₸`}
            sub={`Фудкост: ${fmtPct(foodCost)}`}
            color={profit >= 0 ? "violet" : "red"}
            highlight
          />
          <KpiCard
            icon={<DollarSign size={16} className="text-blue-500" />}
            label="Фудкост %"
            value={fmtPct(foodCost)}
            sub={foodCost < 30 ? "Отлично (< 30%)" : foodCost < 40 ? "Норма (30–40%)" : "Высокий (> 40%)"}
            color={foodCost < 30 ? "emerald" : foodCost < 40 ? "amber" : "red"}
          />
        </div>

        {/* Branch breakdown (only in "all branches" mode) */}
        {isAll && branchRows.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={15} className="text-violet-500" />
              <p className="text-sm font-semibold">Выручка по филиалам</p>
            </div>
            <div className="space-y-3">
              {branchRows.map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate flex-1">{b.name}</span>
                    <span className="text-xs text-muted-foreground ml-4">{b.orders} зак.</span>
                    <span className="text-sm font-medium tabular-nums ml-4">{fmt(b.revenue)} ₸</span>
                    <span className="text-xs text-muted-foreground ml-3 w-10 text-right">
                      {revenue > 0 ? fmtPct((b.revenue / revenue) * 100) : "0%"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500/70"
                      style={{ width: `${(b.revenue / branchMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar chart */}
        {bars.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Выручка vs Расходы — {PERIOD_LABEL[period]}</p>
            <div className="flex items-end gap-1 h-36 overflow-x-auto">
              {bars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-[20px]">
                  <div className="w-full flex flex-col justify-end gap-px" style={{ height: 112 }}>
                    <div
                      className="w-full rounded-t bg-emerald-500/80"
                      style={{ height: `${(bar.revenue / barMax) * 100}%`, minHeight: bar.revenue > 0 ? 2 : 0 }}
                    />
                    <div
                      className="w-full rounded-t bg-red-400/70"
                      style={{ height: `${(bar.expenses / barMax) * 100}%`, minHeight: bar.expenses > 0 ? 2 : 0 }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">{bar.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
                <span className="text-xs text-muted-foreground">Выручка</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-400/70" />
                <span className="text-xs text-muted-foreground">Расходы</span>
              </div>
            </div>
          </div>
        )}

        {/* Supplier breakdown */}
        {suppliers.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Расходы по поставщикам</p>
            <div className="space-y-3">
              {suppliers.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate flex-1">{s.name}</span>
                    <span className="text-sm font-medium tabular-nums ml-4">{fmt(s.total)} ₸</span>
                    <span className="text-xs text-muted-foreground ml-3 w-10 text-right">{fmtPct(s.pct)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500/70"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && orders.length === 0 && invoices.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Нет данных за выбранный период
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

type Color = "emerald" | "red" | "violet" | "amber" | "blue";

const COLOR_BG: Record<Color, string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-500/10",
  red:     "bg-red-50 dark:bg-red-500/10",
  violet:  "bg-violet-50 dark:bg-violet-500/10",
  amber:   "bg-amber-50 dark:bg-amber-500/10",
  blue:    "bg-blue-50 dark:bg-blue-500/10",
};

const COLOR_BORDER: Record<Color, string> = {
  emerald: "border-emerald-200 dark:border-emerald-500/20",
  red:     "border-red-200 dark:border-red-500/20",
  violet:  "border-violet-200 dark:border-violet-500/20",
  amber:   "border-amber-200 dark:border-amber-500/20",
  blue:    "border-blue-200 dark:border-blue-500/20",
};

function KpiCard({
  icon, label, value, sub, color, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: Color;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? `${COLOR_BG[color]} ${COLOR_BORDER[color]}` : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
