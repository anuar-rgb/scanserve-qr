"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, CreditCard, Star, Tag, RefreshCw } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { LS } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { RESTAURANT_ID } from "@/constants";

// ─── types ───────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month";

interface OrderRow {
  total_price: number;
  status: string;
  type: string;
  created_at: string;
  items_json: unknown;
}

interface PromoProduct { id: string; name: LS; price: number; discount_label: string | null; }
interface Bar          { label: string; revenue: number; }
interface TopDish      { name: string; count: number; }
interface Breakdown    { label: string; count: number; pct: number; bg: string; }

// ─── static maps ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string }> = {
  pending:   { label: "Ожидает",   bg: "bg-amber-500"   },
  confirmed: { label: "Принят",    bg: "bg-blue-500"    },
  preparing: { label: "Готовится", bg: "bg-violet-500"  },
  ready:     { label: "Готов",     bg: "bg-emerald-400" },
  completed: { label: "Завершён",  bg: "bg-emerald-500" },
  cancelled: { label: "Отменён",   bg: "bg-red-500"     },
};

const TYPE_META: Record<string, { label: string; bg: string }> = {
  dine_in:  { label: "В зале",    bg: "bg-violet-500"  },
  pickup:   { label: "Самовывоз", bg: "bg-blue-500"    },
  delivery: { label: "Доставка",  bg: "bg-emerald-500" },
};

const RU_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const PERIOD_LABEL: Record<Period, string> = { today: "Сегодня", week: "7 дней", month: "30 дней" };

// ─── helpers ─────────────────────────────────────────────────────────────────

function fromDate(p: Period): Date {
  const d = new Date();
  if (p === "today")  { d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")   { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  /* month */           d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
}

function prevFromDate(p: Period): Date {
  const d = new Date();
  if (p === "today")  { d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")   { d.setDate(d.getDate() - 13); d.setHours(0, 0, 0, 0); return d; }
  /* month */           d.setDate(d.getDate() - 59); d.setHours(0, 0, 0, 0); return d;
}

function buildBars(orders: OrderRow[], p: Period): Bar[] {
  const now = new Date();

  if (p === "today") {
    const h = now.getHours();
    const bars: Bar[] = Array.from({ length: h + 1 }, (_, i) => ({ label: `${i}:00`, revenue: 0 }));
    for (const o of orders) {
      const oh = new Date(o.created_at).getHours();
      if (oh <= h) bars[oh].revenue += o.total_price ?? 0;
    }
    return bars;
  }

  const dayCount = p === "week" ? 7 : 30;
  const todayMs = new Date(now).setHours(0, 0, 0, 0);
  const bars: Bar[] = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(todayMs);
    d.setDate(d.getDate() - (dayCount - 1 - i));
    return { label: p === "week" ? RU_DAYS[d.getDay()] : String(d.getDate()), revenue: 0 };
  });

  for (const o of orders) {
    const oMs = new Date(new Date(o.created_at).setHours(0, 0, 0, 0));
    const idx = dayCount - 1 - Math.round((todayMs - oMs.getTime()) / 86_400_000);
    if (idx >= 0 && idx < dayCount) bars[idx].revenue += o.total_price ?? 0;
  }
  return bars;
}

function buildTopDishes(orders: OrderRow[]): TopDish[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const items = o.items_json as Array<{ name?: string; qty?: number }> | null;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const n = item?.name; if (!n) continue;
      map.set(n, (map.get(n) ?? 0) + (item.qty ?? 1));
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
}

function buildBreakdown(
  orders: OrderRow[],
  key: "status" | "type",
  meta: Record<string, { label: string; bg: string }>,
): Breakdown[] {
  const map = new Map<string, number>();
  for (const o of orders) map.set(o[key] ?? "other", (map.get(o[key] ?? "other") ?? 0) + 1);
  const total = orders.length || 1;
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({
    label: meta[k]?.label ?? k,
    count,
    pct: Math.round(count / total * 100),
    bg: meta[k]?.bg ?? "bg-zinc-400",
  }));
}

// ─── component ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslations();
  const [period, setPeriod]           = useState<Period>("week");
  const [loading, setLoading]         = useState(true);
  const [orders, setOrders]           = useState<OrderRow[]>([]);
  const [prevOrders, setPrevOrders]   = useState<OrderRow[]>([]);
  const [reviewAvg, setReviewAvg]     = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [promoProducts, setPromoProducts] = useState<PromoProduct[]>([]);

  const load = useCallback(async (p: Period) => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const from     = fromDate(p).toISOString();
    const prevFrom = prevFromDate(p).toISOString();
    const now      = new Date().toISOString();

    const [curRes, prevRes, revRes, promoRes] = await Promise.all([
      supabase.from("orders")
        .select("total_price, status, type, created_at, items_json")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", from)
        .lte("created_at", now),
      supabase.from("orders")
        .select("total_price")
        .eq("restaurant_id", RESTAURANT_ID)
        .gte("created_at", prevFrom)
        .lt("created_at", from),
      supabase.from("reviews")
        .select("rating")
        .eq("restaurant_id", RESTAURANT_ID),
      supabase.from("products")
        .select("id, name, price, discount_label")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_promo", true)
        .eq("is_archived", false)
        .order("name->ru"),
    ]);

    setOrders((curRes.data ?? []) as OrderRow[]);
    setPrevOrders((prevRes.data ?? []) as OrderRow[]);

    const revs = (revRes.data ?? []) as { rating: number }[];
    setReviewCount(revs.length);
    setReviewAvg(revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : null);
    setPromoProducts((promoRes.data as PromoProduct[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  // ── derived metrics ──
  const totalRevenue = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const totalOrders  = orders.length;
  const avgCheck     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const prevRevenue  = prevOrders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const prevTotal    = prevOrders.length;
  const revDelta     = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : null;
  const ordDelta     = prevTotal   > 0 ? Math.round((totalOrders  - prevTotal)   / prevTotal   * 100) : null;

  const bars      = buildBars(orders, period);
  const dishes    = buildTopDishes(orders);
  const statuses  = buildBreakdown(orders, "status", STATUS_META);
  const types     = buildBreakdown(orders, "type",   TYPE_META);

  const maxBarRev = Math.max(...bars.map(b => b.revenue), 1);
  const maxDish   = dishes[0]?.count ?? 1;

  const deltaStr = (v: number | null) =>
    v === null ? "нет данных" : `${v >= 0 ? "+" : ""}${v}%`;

  return (
    <div className="flex flex-col h-full">
      {/* ── header ── */}
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navOverview}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descOverview}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period tabs */}
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl text-xs">
            {(["today", "week", "month"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} disabled={loading}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  period === p
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button onClick={() => load(period)} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* ── metric cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard loading={loading} icon={<CreditCard size={16} />} color="violet"
            label={t.admin.revenue}
            value={`${(totalRevenue / 1000).toFixed(1)}K ₸`}
            delta={deltaStr(revDelta)} deltaUp={revDelta !== null ? revDelta >= 0 : undefined} />
          <MetricCard loading={loading} icon={<ShoppingBag size={16} />} color="blue"
            label={t.admin.orders}
            value={String(totalOrders)}
            delta={deltaStr(ordDelta)} deltaUp={ordDelta !== null ? ordDelta >= 0 : undefined} />
          <MetricCard loading={loading} icon={<TrendingUp size={16} />} color="emerald"
            label={t.admin.avgCheck}
            value={`${avgCheck.toLocaleString("ru-RU")} ₸`}
            delta="средний чек" />
          <MetricCard loading={loading} icon={<Star size={16} />} color="amber"
            label={t.admin.totalReviews}
            value={reviewAvg !== null ? `${reviewAvg.toFixed(1)} / 5` : "—"}
            delta={reviewCount > 0 ? `${reviewCount} отзывов` : "нет отзывов"} />
        </div>

        {/* ── bar chart + top dishes ── */}
        <div className="grid grid-cols-5 gap-4">

          {/* Bar chart */}
          <div className="col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {period === "today" ? "Выручка по часам" : period === "week" ? "Выручка по дням" : "Выручка за 30 дней"}
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{PERIOD_LABEL[period]}</p>
            </div>

            {loading ? (
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {Array.from({ length: period === "today" ? 10 : period === "week" ? 7 : 15 }, (_, i) => (
                  <div key={i} className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-t animate-pulse"
                    style={{ height: `${25 + (i * 17 + 30) % 70}%` }} />
                ))}
              </div>
            ) : (
              <>
                {/* bars */}
                <div className="flex items-end gap-1" style={{ height: 120 }}>
                  {bars.map((bar, i) => {
                    const px = Math.round((bar.revenue / maxBarRev) * 112);
                    const isLatest = period !== "today" && i === bars.length - 1;
                    return (
                      <div key={i} className="flex-1 min-w-0"
                        style={{ height: Math.max(px, bar.revenue > 0 ? 4 : 1), borderRadius: "3px 3px 0 0",
                          background: isLatest ? "#7c3aed" : "var(--bar-color, #c4b5fd)" }}
                        title={bar.revenue > 0 ? `${bar.revenue.toLocaleString("ru-RU")} ₸` : undefined}
                      />
                    );
                  })}
                </div>
                {/* labels */}
                <div className="flex gap-1 mt-1">
                  {bars.map((bar, i) => {
                    const show = period === "month" ? i % 5 === 0 || i === bars.length - 1 : true;
                    return (
                      <div key={i} className="flex-1 min-w-0 text-center">
                        {show && (
                          <span className="text-[9px] text-zinc-500 dark:text-zinc-500 font-medium leading-none">
                            {bar.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Top dishes */}
          <div className="col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{t.admin.topDishes}</h2>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" style={{ width: `${75 - i * 12}%` }} />
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : dishes.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-8">Нет данных за период</p>
            ) : (
              <div className="space-y-3">
                {dishes.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{d.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0 ml-2">{d.count} шт</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round(d.count / maxDish * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── status + type breakdown ── */}
        <div className="grid grid-cols-2 gap-4">
          <BreakdownCard title="Статусы заказов" items={statuses} loading={loading} />
          <BreakdownCard title="Тип заказов"     items={types}    loading={loading} />
        </div>

        {/* ── promo products (already real data) ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <Tag size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Акционные блюда</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                {promoProducts.length > 0 ? `${promoProducts.length} блюд со скидкой` : "Нет активных акций"}
              </p>
            </div>
          </div>
          {promoProducts.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-4">
              Включите «Акцию» в карточке блюда, чтобы увидеть их здесь
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {promoProducts.map((p) => {
                const pct = parseInt(p.discount_label ?? "", 10);
                const discounted = !isNaN(pct) && pct > 0 && pct < 100
                  ? Math.round(p.price * (1 - pct / 100)) : null;
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {p.name?.ru ?? p.name?.en ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {discounted !== null && (
                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">−{pct}%</span>
                      )}
                      <div className="text-right">
                        {discounted !== null && (
                          <p className="text-[11px] text-zinc-400 line-through leading-none">{p.price.toLocaleString()} ₸</p>
                        )}
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                          {(discounted ?? p.price).toLocaleString()} ₸
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MetricCard({ loading, icon, color, label, value, delta, deltaUp }: {
  loading: boolean; icon: React.ReactNode;
  color: "violet" | "blue" | "emerald" | "amber";
  label: string; value: string; delta: string; deltaUp?: boolean;
}) {
  const iconBg: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg[color]}`}>{icon}</div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
      {loading
        ? <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mt-1" />
        : <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">{value}</p>}
      <p className={`text-[11px] font-medium mt-1 ${
        deltaUp === true  ? "text-emerald-600 dark:text-emerald-400" :
        deltaUp === false ? "text-red-500 dark:text-red-400" :
                            "text-zinc-400 dark:text-zinc-600"
      }`}>{loading ? "…" : delta}</p>
    </div>
  );
}

function BreakdownCard({ title, items, loading }: {
  title: string; items: Breakdown[]; loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{title}</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0" />
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse flex-1" />
              <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-600 text-center py-4">Нет данных</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.bg}`} />
              <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300">{s.label}</span>
              <span className="text-xs tabular-nums text-zinc-500">{s.count}</span>
              <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.bg}`} style={{ width: `${s.pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-zinc-400 w-8 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
