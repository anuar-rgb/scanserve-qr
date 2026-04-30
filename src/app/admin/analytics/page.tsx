"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, CreditCard, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DbOrder } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SEED_REVENUE = [45200, 62800, 38400, 71300, 89600, 124500, 95100];

const TOP_DISHES = [
  { name: "Beshbarmak", orders: 47, revenue: 150400 },
  { name: "Kuyrdak",    orders: 35, revenue: 94500  },
  { name: "Naryn",      orders: 28, revenue: 78400  },
  { name: "Kazy",       orders: 22, revenue: 30800  },
  { name: "Qara Shay",  orders: 19, revenue: 7600   },
];

export default function AnalyticsPage() {
  const { t } = useTranslations();
  const [orders, setOrders] = useState<DbOrder[]>([]);

  useEffect(() => {
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setOrders((data as DbOrder[]) ?? []));
  }, []);

  const totalRevenue = orders.length
    ? orders.reduce((s, o) => s + (o.total_price ?? 0), 0)
    : SEED_REVENUE.reduce((a, b) => a + b, 0);
  const totalOrders  = orders.length || 127;
  const avgCheck     = Math.round(totalRevenue / Math.max(totalOrders, 1));
  const maxBar       = Math.max(...SEED_REVENUE);

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navOverview}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descOverview}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard icon={<CreditCard size={16} />} color="violet"
            label={t.admin.revenue} value={`${(totalRevenue / 1000).toFixed(1)}K ₸`} delta="+12%" deltaUp />
          <MetricCard icon={<ShoppingBag size={16} />} color="blue"
            label={t.admin.orders} value={String(totalOrders)} delta="+8%" deltaUp />
          <MetricCard icon={<TrendingUp size={16} />} color="emerald"
            label={t.admin.avgCheck} value={`${avgCheck.toLocaleString()} ₸`} delta="+3%" deltaUp />
          <MetricCard icon={<Star size={16} />} color="amber"
            label={t.admin.totalReviews} value="4.8 / 5" delta="38 reviews" />
        </div>

        {/* Bar chart + Top dishes */}
        <div className="grid grid-cols-5 gap-4">

          <div className="col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.weeklyRevenue}</h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{t.admin.thisWeek}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                {t.admin.vsLastWeek} +18%
              </span>
            </div>
            <div className="flex items-end gap-2 h-40">
              {SEED_REVENUE.map((val, i) => {
                const pct = (val / maxBar) * 100;
                return (
                  <div key={DAYS[i]} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                      {(val / 1000).toFixed(0)}K
                    </span>
                    <div className="w-full relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                      <div className={`absolute inset-0 rounded-t-md ${
                        i === 5 ? "bg-violet-600" : "bg-violet-300 dark:bg-violet-900/70"
                      }`} />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500 font-medium">{DAYS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{t.admin.topDishes}</h2>
            <div className="space-y-3">
              {TOP_DISHES.map((d, i) => {
                const pct = Math.round((d.orders / TOP_DISHES[0].orders) * 100);
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 w-4">{i + 1}</span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{d.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{d.orders} orders</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order type breakdown */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Dine-in", value: "61%", color: "violet" },
            { label: "Pickup",  value: "24%", color: "blue"   },
            { label: "Delivery",value: "15%", color: "emerald"},
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                color === "violet"  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" :
                color === "blue"    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}>{value}</div>
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-600">{label}</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">of all orders</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function MetricCard({ icon, color, label, value, delta, deltaUp }: {
  icon: React.ReactNode; color: "violet"|"blue"|"emerald"|"amber";
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
      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">{value}</p>
      <p className={`text-[11px] font-medium mt-1 ${deltaUp ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-600"}`}>
        {delta}
      </p>
    </div>
  );
}
