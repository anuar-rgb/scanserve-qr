"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Star } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { useTranslations } from "@/lib/i18n";

// ─── types ────────────────────────────────────────────────────────────────────

interface HallData {
  totalTables: number;
  occupiedCount: number;
  preorderCount: number;
  totalSeats: number;
  occupiedSeats: number;
}

interface TodayData {
  revenue: number;
  ordersCount: number;
  avgCheck: number;
  deltaRevenuePct: number | null;
  paymentBreakdown: Record<string, number>;
}

interface ShiftData {
  isOpen: boolean;
  openedAt: string | null;
  shiftRevenue: number | null;
  shiftOrdersCount: number | null;
}

interface ReviewsData {
  avgRating: number | null;
  count: number;
  recent: { rating: number; comment: string | null; created_at: string }[];
}

interface StaffMember {
  id: string;
  displayName: string;
  role: string;
}

interface StaffData {
  members: StaffMember[];
}

interface WeekData {
  revenue: number;
  ordersCount: number;
  prevRevenue: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  kaspi: "Kaspi",
  halyk: "Halyk",
  terminal: "Терминал",
  "card-transfer": "Перевод",
  "remote-payment": "Онлайн",
};

function buildPaymentBreakdown(
  orders: { payment_method: string | null; payment_details: Record<string, number> | null; paid_amount: number | null; total_price: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.payment_details && typeof o.payment_details === "object") {
      for (const [method, amount] of Object.entries(o.payment_details)) {
        if (typeof amount === "number" && amount > 0) {
          map[method] = (map[method] ?? 0) + amount;
        }
      }
    } else if (o.payment_method) {
      const amount = (o.total_price ?? 0) - (o.paid_amount ?? 0);
      const total = amount > 0 ? amount : (o.total_price ?? 0);
      map[o.payment_method] = (map[o.payment_method] ?? 0) + total;
    }
  }
  return map;
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function OwnerDashboardPage() {
  const { t } = useTranslations();

  const [hallData,    setHallData]    = useState<HallData | null>(null);
  const [todayData,   setTodayData]   = useState<TodayData | null>(null);
  const [shiftData,   setShiftData]   = useState<ShiftData | null>(null);
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [staffData,   setStaffData]   = useState<StaffData | null>(null);
  const [weekData,    setWeekData]    = useState<WeekData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [realtimeOk,  setRealtimeOk]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── fetch hall (called by realtime too) ───────────────────────────────────

  const fetchHall = useCallback(async () => {
    if (!isConfigured) return;
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: tablesData }, { data: ordersData }] = await Promise.all([
      supabase
        .from(DB_TABLES.restaurantTables)
        .select("id, label, seats")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("is_active", true),
      supabase
        .from(DB_TABLES.orders)
        .select("id, table_number, type, order_type, preorder_date, status")
        .eq("restaurant_id", RESTAURANT_ID)
        .in("status", ["pending", "confirmed", "preparing", "ready"]),
    ]);

    const tables = (tablesData ?? []) as { id: string; label: string; seats: number }[];
    const orders = (ordersData ?? []) as {
      id: string;
      table_number: string | null;
      type: string | null;
      order_type: string | null;
      preorder_date: string | null;
      status: string;
    }[];

    let occupiedCount = 0;
    let preorderCount = 0;
    let occupiedSeats = 0;
    let totalSeats    = 0;

    for (const table of tables) {
      totalSeats += table.seats ?? 0;
      const hasDineIn = orders.some(
        (o) => o.type === "dine-in" && o.table_number === table.label,
      );
      const hasPreorder = !hasDineIn && orders.some(
        (o) => o.order_type === "preorder" && o.table_number === table.label && o.preorder_date === today,
      );
      if (hasDineIn) { occupiedCount++; occupiedSeats += table.seats ?? 0; }
      else if (hasPreorder) { preorderCount++; }
    }

    setHallData({ totalTables: tables.length, occupiedCount, preorderCount, totalSeats, occupiedSeats });
  }, []);

  // ── fetch today ───────────────────────────────────────────────────────────

  const fetchToday = useCallback(async () => {
    if (!isConfigured) return;
    const todayStart     = startOfToday().toISOString();
    const yesterdayStart = startOfDaysAgo(1).toISOString();

    const [{ data: todayOrders }, { data: yesterdayOrders }] = await Promise.all([
      supabase
        .from(DB_TABLES.orders)
        .select("total_price, payment_method, payment_details, paid_amount")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .gte("created_at", todayStart),
      supabase
        .from(DB_TABLES.orders)
        .select("total_price")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart),
    ]);

    const rows = (todayOrders ?? []) as {
      total_price: number;
      payment_method: string | null;
      payment_details: Record<string, number> | null;
      paid_amount: number | null;
    }[];

    const revenue    = rows.reduce((s, o) => s + (o.total_price ?? 0), 0);
    const count      = rows.length;
    const avgCheck   = count > 0 ? Math.round(revenue / count) : 0;
    const yRevenue   = ((yesterdayOrders ?? []) as { total_price: number }[]).reduce((s, o) => s + (o.total_price ?? 0), 0);
    const deltaPct   = yRevenue > 0 ? Math.round(((revenue - yRevenue) / yRevenue) * 100) : null;

    setTodayData({
      revenue,
      ordersCount: count,
      avgCheck,
      deltaRevenuePct: deltaPct,
      paymentBreakdown: buildPaymentBreakdown(rows),
    });
  }, []);

  // ── fetch shift + staff ───────────────────────────────────────────────────

  const fetchShiftAndStaff = useCallback(async () => {
    const resp = await fetch("/api/admin/shift")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as { shift: { id: string; opened_at: string } | null; checkins: { staff_user_id: string }[] } | null;

    const shift    = resp?.shift ?? null;
    const checkins = resp?.checkins ?? [];

    let shiftRevenue: number | null = null;
    let shiftOrdersCount: number | null = null;

    if (shift && isConfigured) {
      const { data } = await supabase
        .from("shifts")
        .select("total_revenue, orders_count")
        .eq("id", shift.id)
        .single();
      const row = data as { total_revenue: number | null; orders_count: number | null } | null;
      shiftRevenue      = row?.total_revenue ?? null;
      shiftOrdersCount  = row?.orders_count  ?? null;
    }

    setShiftData({
      isOpen: shift !== null,
      openedAt: shift?.opened_at ?? null,
      shiftRevenue,
      shiftOrdersCount,
    });

    const userIds = checkins.map((c) => c.staff_user_id).filter(Boolean);
    if (userIds.length > 0 && isConfigured) {
      const { data: staffRows } = await supabase
        .from("staff_users")
        .select("id, display_name, username, role")
        .eq("restaurant_id", RESTAURANT_ID)
        .in("id", userIds);

      setStaffData({
        members: ((staffRows ?? []) as { id: string; display_name: string | null; username: string; role: string }[]).map((s) => ({
          id: s.id,
          displayName: s.display_name ?? s.username,
          role: s.role,
        })),
      });
    } else {
      setStaffData({ members: [] });
    }
  }, []);

  // ── fetch reviews ─────────────────────────────────────────────────────────

  const fetchReviews = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase
      .from(DB_TABLES.reviews)
      .select("rating, comment, created_at")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("created_at", startOfDaysAgo(30).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as { rating: number; comment: string | null; created_at: string }[];
    const avg  = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;

    setReviewsData({ avgRating: avg, count: rows.length, recent: rows.slice(0, 3) });
  }, []);

  // ── fetch week ────────────────────────────────────────────────────────────

  const fetchWeek = useCallback(async () => {
    if (!isConfigured) return;
    const [{ data: curWeek }, { data: prevWeek }] = await Promise.all([
      supabase
        .from(DB_TABLES.orders)
        .select("total_price")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .gte("created_at", startOfDaysAgo(7).toISOString()),
      supabase
        .from(DB_TABLES.orders)
        .select("total_price")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("status", "completed")
        .gte("created_at", startOfDaysAgo(14).toISOString())
        .lt("created_at", startOfDaysAgo(7).toISOString()),
    ]);

    const sumArr = (arr: { total_price: number }[] | null) =>
      (arr ?? []).reduce((s, o) => s + (o.total_price ?? 0), 0);

    setWeekData({
      revenue: sumArr(curWeek as { total_price: number }[] | null),
      ordersCount: (curWeek ?? []).length,
      prevRevenue: sumArr(prevWeek as { total_price: number }[] | null),
    });
  }, []);

  // ── fetch all ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHall(), fetchToday(), fetchShiftAndStaff(), fetchReviews(), fetchWeek()]);
    setLastUpdated(new Date());
    setLoading(false);
  }, [fetchHall, fetchToday, fetchShiftAndStaff, fetchReviews, fetchWeek]);

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll();
    if (!isConfigured) return;

    const channel = supabase
      .channel(`owner-dashboard-${RESTAURANT_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DB_TABLES.orders, filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        () => fetchHall(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DB_TABLES.restaurantTables },
        () => fetchHall(),
      )
      .subscribe((s) => setRealtimeOk(s === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll, fetchHall]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-20">
      <DashboardHeader t={t.admin} onRefresh={fetchAll} lastUpdated={lastUpdated} loading={loading} />
      <HallOccupancyCard  t={t.admin} data={hallData}    realtimeOk={realtimeOk} />
      <TodayRevenueCard   t={t.admin} data={todayData} />
      <CurrentShiftCard   t={t.admin} data={shiftData} />
      <ReviewsCard        t={t.admin} data={reviewsData} />
      <StaffOnDutyCard    t={t.admin} data={staffData} />
      <WeekSummaryCard    t={t.admin} data={weekData} />
    </div>
  );
}

// ─── shared skeleton ──────────────────────────────────────────────────────────

function SkeletonBlock({ lines }: { lines: number }) {
  const widths = ["60%", "80%", "50%", "70%"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

// ─── card wrapper ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 p-5">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
      {children}
    </p>
  );
}

// ─── header ───────────────────────────────────────────────────────────────────

type AdminDict = ReturnType<typeof useTranslations>["t"]["admin"];

function DashboardHeader({
  t, onRefresh, lastUpdated, loading,
}: { t: AdminDict; onRefresh: () => void; lastUpdated: Date | null; loading: boolean }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">АС ТӨРІ</h1>
        {lastUpdated && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {t.ownerUpdatedAt} {fmtTime(lastUpdated.toISOString())}
          </p>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={18} className="animate-spin" />
          : <RefreshCw size={18} />
        }
      </button>
    </div>
  );
}

// ─── hall occupancy ───────────────────────────────────────────────────────────

function HallOccupancyCard({ t, data, realtimeOk }: { t: AdminDict; data: HallData | null; realtimeOk: boolean }) {
  const pct      = data && data.totalTables > 0 ? Math.round((data.occupiedCount / data.totalTables) * 100) : 0;
  const barColor = pct < 50 ? "bg-emerald-500" : pct < 80 ? "bg-amber-500" : "bg-red-500";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>{t.ownerSectionHall}</SectionLabel>
        <div className="flex items-center gap-1.5 -mt-1">
          <div className={`w-2 h-2 rounded-full ${realtimeOk ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
          <span className="text-[11px] text-zinc-400">{t.ownerLive}</span>
        </div>
      </div>

      {data === null ? (
        <SkeletonBlock lines={2} />
      ) : (
        <>
          <p className="text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mb-1">
            {data.occupiedCount}{" "}
            <span className="text-xl font-normal text-zinc-400">/ {data.totalTables} {t.hallSeats}</span>
          </p>
          <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {data.occupiedSeats} {t.ownerSeatsOf} {data.totalSeats} {t.ownerTablesOccupied}
          </p>
        </>
      )}
    </Card>
  );
}

// ─── today revenue ────────────────────────────────────────────────────────────

function TodayRevenueCard({ t, data }: { t: AdminDict; data: TodayData | null }) {
  const deltaPos = (data?.deltaRevenuePct ?? 0) >= 0;

  return (
    <Card>
      <SectionLabel>{t.ownerSectionToday}</SectionLabel>
      {data === null ? (
        <SkeletonBlock lines={3} />
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
              ₸ {fmt(data.revenue)}
            </p>
            {data.deltaRevenuePct !== null && (
              <span className={`text-sm font-semibold ${deltaPos ? "text-emerald-500" : "text-red-500"}`}>
                {deltaPos ? "↑ +" : "↓ "}{data.deltaRevenuePct}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
            <span>{data.ordersCount} {t.ownerOrders}</span>
            <span>·</span>
            <span>{t.ownerAvgCheck} ₸ {fmt(data.avgCheck)}</span>
          </div>
          {Object.keys(data.paymentBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.paymentBreakdown).map(([method, amount]) => (
                <span
                  key={method}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  {PAYMENT_LABELS[method] ?? method} ₸ {fmt(amount)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── current shift ────────────────────────────────────────────────────────────

function CurrentShiftCard({ t, data }: { t: AdminDict; data: ShiftData | null }) {
  return (
    <Card>
      <SectionLabel>{t.ownerSectionShift}</SectionLabel>
      {data === null ? (
        <SkeletonBlock lines={1} />
      ) : data.isOpen && data.openedAt ? (
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t.ownerShiftSince} {fmtTime(data.openedAt)}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1">
            {data.shiftOrdersCount !== null && (
              <span>{data.shiftOrdersCount} {t.ownerOrders}</span>
            )}
            {data.shiftRevenue !== null && data.shiftRevenue > 0 && (
              <><span>·</span><span>₸ {fmt(data.shiftRevenue)}</span></>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">{t.ownerNoShift}</p>
      )}
    </Card>
  );
}

// ─── reviews ──────────────────────────────────────────────────────────────────

function ReviewsCard({ t, data }: { t: AdminDict; data: ReviewsData | null }) {
  return (
    <Card>
      <SectionLabel>{t.ownerSectionReviews}</SectionLabel>
      {data === null ? (
        <SkeletonBlock lines={3} />
      ) : data.count === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">{t.ownerNoReviews}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
              ★ {data.avgRating?.toFixed(1)}
            </span>
            <span className="text-sm text-zinc-400">{data.count} {t.ownerReviews30d}</span>
          </div>
          <div className="space-y-2.5">
            {data.recent.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex gap-0.5 shrink-0 mt-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={10}
                      className={s <= r.rating ? "text-amber-400 fill-amber-400" : "text-zinc-200 dark:text-zinc-700"}
                    />
                  ))}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 flex-1 min-w-0 truncate">
                  {r.comment ? (r.comment.length > 60 ? r.comment.slice(0, 60) + "…" : r.comment) : "—"}
                </p>
                <span className="text-[10px] text-zinc-400 shrink-0 ml-1">{fmtDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── staff on duty ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", manager: "Менеджер", cashier: "Кассир",
  waiter: "Официант", chef: "Повар", bartender: "Бармен",
  hostess: "Хостес", courier: "Курьер", cleaner: "Уборщик",
  doorman: "Охранник", sommelier: "Сомелье", senior_waiter: "Ст. официант",
  runner: "Раннер", storekeeper: "Кладовщик", accountant: "Бухгалтер",
};

function pluralStaff(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "сотрудник";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "сотрудника";
  return "сотрудников";
}

function StaffOnDutyCard({ t, data }: { t: AdminDict; data: StaffData | null }) {
  return (
    <Card>
      <SectionLabel>{t.ownerSectionStaff}</SectionLabel>
      {data === null ? (
        <SkeletonBlock lines={2} />
      ) : data.members.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">{t.ownerNoStaff}</p>
      ) : (
        <>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {data.members.length} {pluralStaff(data.members.length)} {t.ownerOnShift}
          </p>
          <div className="space-y-2.5">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 select-none">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{m.displayName}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{ROLE_LABELS[m.role] ?? m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── week summary ─────────────────────────────────────────────────────────────

function WeekSummaryCard({ t, data }: { t: AdminDict; data: WeekData | null }) {
  if (data === null) {
    return (
      <Card>
        <SectionLabel>{t.ownerSectionWeek}</SectionLabel>
        <SkeletonBlock lines={2} />
      </Card>
    );
  }

  const revDelta = data.prevRevenue > 0
    ? Math.round(((data.revenue - data.prevRevenue) / data.prevRevenue) * 100)
    : null;
  const deltaPos = (revDelta ?? 0) >= 0;

  return (
    <Card>
      <SectionLabel>{t.ownerSectionWeek}</SectionLabel>
      <div className="flex items-baseline gap-3 mb-1">
        <p className="text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
          ₸ {fmt(data.revenue)}
        </p>
        {revDelta !== null && (
          <span className={`text-sm font-semibold ${deltaPos ? "text-emerald-500" : "text-red-500"}`}>
            {deltaPos ? "↑ +" : "↓ "}{revDelta}% {t.ownerVsPrevWeek}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">{data.ordersCount} {t.ownerOrders}</p>
    </Card>
  );
}
