"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Star, LogOut } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG     = "#09090B";
const CARD   = "rgba(255,255,255,0.035)";
const BORDER = "1px solid rgba(255,255,255,0.08)";
const TEXT   = "#F0F0F0";
const MUTED  = "rgba(240,240,240,0.42)";
const GREEN  = "#10B981";
const RED    = "#EF4444";
const AMBER  = "#F59E0B";
const VIOLET = "#A855F7";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HallData {
  totalTables:   number;
  occupiedCount: number;
  preorderCount: number;
  totalSeats:    number;
  occupiedSeats: number;
}

interface TodayData {
  revenue:          number;
  ordersCount:      number;
  avgCheck:         number;
  deltaRevenuePct:  number | null;
  paymentBreakdown: Record<string, number>;
}

interface ShiftData {
  isOpen:           boolean;
  openedAt:         string | null;
  shiftOrdersCount: number | null;
}

interface StaffMember {
  id:          string;
  displayName: string;
  role:        string;
}

interface ReviewsData {
  avgRating: number | null;
  count:     number;
  recent:    { rating: number; comment: string | null; created_at: string }[];
}

interface WeekData {
  revenue:     number;
  ordersCount: number;
  prevRevenue: number;
}

interface TopDish {
  name:  string;
  count: number;
}

interface RecentOrder {
  id:           string;
  total_price:  number;
  type:         string | null;
  created_at:   string;
  table_number: string | null;
}

interface InvoiceRow {
  supplier_name: string;
  total_amount:  number;
  created_at:    string;
}

interface InvoicesData {
  total:     number;
  count:     number;
  suppliers: { name: string; total: number; pct: number }[];
  recent:    InvoiceRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function startOfDaysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные", kaspi: "Kaspi", halyk: "Halyk",
  terminal: "Терминал", "card-transfer": "Перевод", "remote-payment": "Онлайн",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", manager: "Менеджер", cashier: "Кассир",
  waiter: "Официант", chef: "Повар", bartender: "Бармен",
  hostess: "Хостес", courier: "Курьер", cleaner: "Уборщик",
  doorman: "Охранник", sommelier: "Сомелье", senior_waiter: "Ст. официант",
  runner: "Раннер", storekeeper: "Кладовщик", accountant: "Бухгалтер",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  "dine-in": "Зал", takeaway: "С собой", delivery: "Доставка",
};

function buildPaymentBreakdown(
  orders: { payment_method: string | null; payment_details: Record<string, number> | null; total_price: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const o of orders) {
    if (o.payment_details && typeof o.payment_details === "object") {
      for (const [method, amount] of Object.entries(o.payment_details)) {
        if (typeof amount === "number" && amount > 0) map[method] = (map[method] ?? 0) + amount;
      }
    } else if (o.payment_method) {
      map[o.payment_method] = (map[o.payment_method] ?? 0) + (o.total_price ?? 0);
    }
  }
  return map;
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: "18px 16px" }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: TEXT, fontSize: 30, fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
      {children}
    </p>
  );
}

function Skeleton({ lines = 2 }: { lines?: number }) {
  const ws = ["55%", "75%", "45%", "65%"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: 13, borderRadius: 6, background: "rgba(255,255,255,0.07)", width: ws[i % ws.length] }} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OwnerPage() {
  const [view,         setView]         = useState<"loading" | "login" | "dashboard">("loading");
  const [loginUser,    setLoginUser]    = useState("");
  const [loginPass,    setLoginPass]    = useState("");
  const [loginErr,     setLoginErr]     = useState("");
  const [loginBusy,    setLoginBusy]    = useState(false);

  const [hallData,      setHallData]      = useState<HallData | null>(null);
  const [todayData,     setTodayData]     = useState<TodayData | null>(null);
  const [shiftData,     setShiftData]     = useState<ShiftData | null>(null);
  const [staffMembers,  setStaffMembers]  = useState<StaffMember[] | null>(null);
  const [reviewsData,   setReviewsData]   = useState<ReviewsData | null>(null);
  const [weekData,      setWeekData]      = useState<WeekData | null>(null);
  const [topDishes,     setTopDishes]     = useState<TopDish[] | null>(null);
  const [recentOrders,  setRecentOrders]  = useState<RecentOrder[] | null>(null);
  const [invoicesData,   setInvoicesData]   = useState<InvoicesData | null>(null);
  const [invoicesPeriod, setInvoicesPeriod] = useState<"today" | "7d" | "30d" | "90d">("30d");
  const [busy,          setBusy]          = useState(false);
  const [realtimeOk,    setRealtimeOk]    = useState(false);
  const [updatedAt,     setUpdatedAt]     = useState<Date | null>(null);

  // ── Auth check on mount ────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/admin/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => setView(d ? "dashboard" : "login"))
      .catch(() => setView("login"));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true); setLoginErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUser, password: loginPass }),
    });
    if (res.ok) { setView("dashboard"); }
    else {
      const d = await res.json();
      setLoginErr(d.error ?? "Неверный логин или пароль");
      setLoginBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setView("login"); setLoginUser(""); setLoginPass(""); setLoginErr("");
  }

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchHall = useCallback(async () => {
    if (!isConfigured) return;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: tbls }, { data: ords }] = await Promise.all([
      supabase.from(DB_TABLES.restaurantTables).select("id, label, seats")
        .eq("restaurant_id", RESTAURANT_ID).eq("is_active", true),
      supabase.from(DB_TABLES.orders).select("table_number, type, order_type, preorder_date")
        .eq("restaurant_id", RESTAURANT_ID).in("status", ["pending", "confirmed", "preparing", "ready"]),
    ]);
    const tables = (tbls ?? []) as { label: string; seats: number }[];
    const orders = (ords ?? []) as { table_number: string | null; type: string | null; order_type: string | null; preorder_date: string | null }[];
    let occupied = 0, preorder = 0, occSeats = 0, totSeats = 0;
    for (const t of tables) {
      totSeats += t.seats ?? 0;
      const dineIn    = orders.some(o => o.type === "dine-in" && o.table_number === t.label);
      const preorderT = !dineIn && orders.some(o => o.order_type === "preorder" && o.table_number === t.label && o.preorder_date === today);
      if (dineIn) { occupied++; occSeats += t.seats ?? 0; }
      else if (preorderT) preorder++;
    }
    setHallData({ totalTables: tables.length, occupiedCount: occupied, preorderCount: preorder, totalSeats: totSeats, occupiedSeats: occSeats });
  }, []);

  const fetchToday = useCallback(async () => {
    if (!isConfigured) return;
    const todayISO = startOfToday().toISOString();
    const yestISO  = startOfDaysAgo(1).toISOString();
    const [{ data: tOrd }, { data: yOrd }] = await Promise.all([
      supabase.from(DB_TABLES.orders).select("total_price, payment_method, payment_details")
        .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed").gte("created_at", todayISO),
      supabase.from(DB_TABLES.orders).select("total_price")
        .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed").gte("created_at", yestISO).lt("created_at", todayISO),
    ]);
    const rows = (tOrd ?? []) as { total_price: number; payment_method: string | null; payment_details: Record<string, number> | null }[];
    const revenue  = rows.reduce((s, o) => s + (o.total_price ?? 0), 0);
    const count    = rows.length;
    const yRev     = ((yOrd ?? []) as { total_price: number }[]).reduce((s, o) => s + (o.total_price ?? 0), 0);
    const deltaPct = yRev > 0 ? Math.round(((revenue - yRev) / yRev) * 100) : null;
    setTodayData({ revenue, ordersCount: count, avgCheck: count > 0 ? Math.round(revenue / count) : 0, deltaRevenuePct: deltaPct, paymentBreakdown: buildPaymentBreakdown(rows) });
  }, []);

  const fetchShiftAndStaff = useCallback(async () => {
    const resp = await fetch("/api/admin/shift").then(r => r.ok ? r.json() : null).catch(() => null) as {
      shift: { id: string; opened_at: string } | null;
      checkins: { staff_user_id: string }[];
    } | null;
    const shift    = resp?.shift ?? null;
    const checkins = resp?.checkins ?? [];

    let ordCount: number | null = null;
    if (shift && isConfigured) {
      const { data } = await supabase.from("shifts").select("orders_count").eq("id", shift.id).single();
      ordCount = (data as { orders_count: number | null } | null)?.orders_count ?? null;
    }
    setShiftData({ isOpen: !!shift, openedAt: shift?.opened_at ?? null, shiftOrdersCount: ordCount });

    const ids = checkins.map(c => c.staff_user_id).filter(Boolean);
    if (ids.length > 0 && isConfigured) {
      const { data } = await supabase.from("staff_users").select("id, display_name, username, role")
        .eq("restaurant_id", RESTAURANT_ID).in("id", ids);
      setStaffMembers(((data ?? []) as { id: string; display_name: string | null; username: string; role: string }[])
        .map(s => ({ id: s.id, displayName: s.display_name ?? s.username, role: s.role })));
    } else {
      setStaffMembers([]);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.from(DB_TABLES.reviews).select("rating, comment, created_at")
      .eq("restaurant_id", RESTAURANT_ID).gte("created_at", startOfDaysAgo(30).toISOString())
      .order("created_at", { ascending: false }).limit(20);
    const rows = (data ?? []) as { rating: number; comment: string | null; created_at: string }[];
    const avg  = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    setReviewsData({ avgRating: avg, count: rows.length, recent: rows.slice(0, 3) });
  }, []);

  const fetchWeek = useCallback(async () => {
    if (!isConfigured) return;
    const [{ data: cur }, { data: prev }] = await Promise.all([
      supabase.from(DB_TABLES.orders).select("total_price")
        .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed").gte("created_at", startOfDaysAgo(7).toISOString()),
      supabase.from(DB_TABLES.orders).select("total_price")
        .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed")
        .gte("created_at", startOfDaysAgo(14).toISOString()).lt("created_at", startOfDaysAgo(7).toISOString()),
    ]);
    const sum = (a: { total_price: number }[] | null) => (a ?? []).reduce((s, o) => s + (o.total_price ?? 0), 0);
    setWeekData({ revenue: sum(cur as { total_price: number }[] | null), ordersCount: (cur ?? []).length, prevRevenue: sum(prev as { total_price: number }[] | null) });
  }, []);

  const fetchTopDishes = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.from(DB_TABLES.orders).select("items_json")
      .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed")
      .gte("created_at", startOfDaysAgo(7).toISOString());
    const map: Record<string, number> = {};
    for (const o of (data ?? []) as { items_json: unknown }[]) {
      const items = o.items_json as Array<{ name?: string; qty?: number }> | null;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item.name) map[item.name] = (map[item.name] ?? 0) + (item.qty ?? 1);
      }
    }
    setTopDishes(Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })));
  }, []);

  const fetchInvoices = useCallback(async (period: "today" | "7d" | "30d" | "90d" = "30d") => {
    if (!isConfigured) return;
    const from = period === "today" ? startOfToday()
      : period === "7d"  ? startOfDaysAgo(7)
      : period === "30d" ? startOfDaysAgo(30)
      : startOfDaysAgo(90);
    const { data } = await supabase.from("invoices")
      .select("supplier_name, total_amount, created_at")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as InvoiceRow[];
    const total = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.supplier_name, (map.get(r.supplier_name) ?? 0) + (r.total_amount ?? 0));
    const suppliers = [...map.entries()]
      .map(([name, t]) => ({ name, total: t, pct: total > 0 ? (t / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
    setInvoicesData({ total, count: rows.length, suppliers, recent: rows.slice(0, 3) });
  }, []);

  const fetchRecent = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.from(DB_TABLES.orders).select("id, total_price, type, created_at, table_number")
      .eq("restaurant_id", RESTAURANT_ID).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(5);
    setRecentOrders((data ?? []) as RecentOrder[]);
  }, []);

  const fetchAll = useCallback(async () => {
    setBusy(true);
    await Promise.all([fetchHall(), fetchToday(), fetchShiftAndStaff(), fetchReviews(), fetchWeek(), fetchTopDishes(), fetchRecent(), fetchInvoices(invoicesPeriod)]);
    setUpdatedAt(new Date());
    setBusy(false);
  }, [fetchHall, fetchToday, fetchShiftAndStaff, fetchReviews, fetchWeek, fetchTopDishes, fetchRecent, fetchInvoices, invoicesPeriod]);

  // ── Realtime + initial load ────────────────────────────────────────────────

  useEffect(() => {
    if (view !== "dashboard") return;
    fetchAll();
    if (!isConfigured) return;
    const ch = supabase.channel(`owner-page-${RESTAURANT_ID}`)
      .on("postgres_changes", { event: "*", schema: "public", table: DB_TABLES.orders, filter: `restaurant_id=eq.${RESTAURANT_ID}` }, () => fetchHall())
      .on("postgres_changes", { event: "*", schema: "public", table: DB_TABLES.restaurantTables }, () => fetchHall())
      .subscribe(s => setRealtimeOk(s === "SUBSCRIBED"));
    return () => { supabase.removeChannel(ch); };
  }, [view, fetchAll, fetchHall]);

  // ── Render: loading ────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={30} className="animate-spin" style={{ color: VIOLET }} />
      </div>
    );
  }

  // ── Render: login ──────────────────────────────────────────────────────────

  if (view === "login") {
    const inp: React.CSSProperties = {
      width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12, color: TEXT, padding: "13px 14px", fontSize: 15, outline: "none", boxSizing: "border-box",
    };
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 380, background: CARD, borderRadius: 24, border: BORDER, padding: "36px 28px" }}>
          <h1 style={{ color: TEXT, fontSize: 22, fontWeight: 800, textAlign: "center", margin: "0 0 4px" }}>АС ТӨРІ</h1>
          <p style={{ color: MUTED, fontSize: 14, textAlign: "center", margin: "0 0 28px" }}>Панель владельца</p>
          <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input type="text" placeholder="Логин" value={loginUser} onChange={e => setLoginUser(e.target.value)} required autoComplete="username" style={inp} />
            <input type="password" placeholder="Пароль" value={loginPass} onChange={e => setLoginPass(e.target.value)} required autoComplete="current-password" style={inp} />
            {loginErr && <p style={{ color: RED, fontSize: 13, margin: 0 }}>{loginErr}</p>}
            <button type="submit" disabled={loginBusy} style={{
              background: VIOLET, color: "#fff", border: "none", borderRadius: 12, padding: "14px 0",
              fontSize: 15, fontWeight: 700, cursor: loginBusy ? "wait" : "pointer",
              opacity: loginBusy ? 0.7 : 1, marginTop: 4, transition: "opacity 0.15s",
            }}>
              {loginBusy ? "Входим…" : "Войти"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: dashboard ──────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 0" }}>
        <div>
          <h1 style={{ color: TEXT, fontSize: 18, fontWeight: 800, margin: 0 }}>АС ТӨРІ</h1>
          <p style={{ color: MUTED, fontSize: 11, margin: "2px 0 0" }}>
            {updatedAt ? `Обновлено в ${fmtTime(updatedAt.toISOString())}` : "Загрузка…"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchAll} disabled={busy} style={{
            background: "rgba(255,255,255,0.06)", border: BORDER, borderRadius: 10,
            padding: "9px 11px", cursor: "pointer", display: "flex", alignItems: "center", opacity: busy ? 0.5 : 1,
          }}>
            {busy
              ? <Loader2 size={16} className="animate-spin" style={{ color: MUTED }} />
              : <RefreshCw size={16} style={{ color: MUTED }} />}
          </button>
          <button onClick={logout} style={{
            background: "rgba(255,255,255,0.06)", border: BORDER, borderRadius: 10,
            padding: "9px 11px", cursor: "pointer", display: "flex", alignItems: "center",
          }}>
            <LogOut size={16} style={{ color: MUTED }} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* 1 — Зал */}
        <HallCard data={hallData} realtimeOk={realtimeOk} />

        {/* 2 — Сегодня */}
        <TodayCard data={todayData} />

        {/* 3 — Смена */}
        <ShiftCard data={shiftData} />

        {/* 4 — Персонал */}
        <StaffCard members={staffMembers} />

        {/* 5 — Оценки */}
        <ReviewsCard data={reviewsData} />

        {/* 6 — Неделя */}
        <WeekCard data={weekData} />

        {/* 7 — Топ блюд */}
        <TopDishesCard data={topDishes} />

        {/* 8 — Последние заказы */}
        <RecentOrdersCard data={recentOrders} />

        {/* 9 — Накладные */}
        <InvoicesCard
          data={invoicesData}
          period={invoicesPeriod}
          onPeriod={(p) => { setInvoicesPeriod(p); setInvoicesData(null); fetchInvoices(p); }}
        />

      </div>
    </div>
  );
}

// ─── Card components ──────────────────────────────────────────────────────────

function HallCard({ data, realtimeOk }: { data: HallData | null; realtimeOk: boolean }) {
  const pct      = data && data.totalTables > 0 ? Math.round((data.occupiedCount / data.totalTables) * 100) : 0;
  const barColor = pct < 50 ? GREEN : pct < 80 ? AMBER : RED;
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Label>Зал</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: -8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: realtimeOk ? GREEN : "rgba(255,255,255,0.25)",
            boxShadow: realtimeOk ? `0 0 6px ${GREEN}` : "none",
          }} />
          <span style={{ color: MUTED, fontSize: 11 }}>Live</span>
        </div>
      </div>
      {data === null ? <Skeleton lines={2} /> : (
        <>
          <Big>
            {data.occupiedCount}
            <span style={{ fontSize: 18, fontWeight: 400, color: MUTED }}> / {data.totalTables} столов</span>
          </Big>
          <div style={{ height: 9, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", margin: "10px 0 6px" }}>
            <div style={{ height: "100%", borderRadius: 999, background: barColor, width: `${pct}%`, transition: "width 0.5s" }} />
          </div>
          <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>{data.occupiedSeats} мест занято из {data.totalSeats}</p>
          {data.preorderCount > 0 && (
            <p style={{ color: AMBER, fontSize: 12, margin: "4px 0 0" }}>{data.preorderCount} предзаказов сегодня</p>
          )}
        </>
      )}
    </Card>
  );
}

function TodayCard({ data }: { data: TodayData | null }) {
  const pos = (data?.deltaRevenuePct ?? 0) >= 0;
  return (
    <Card>
      <Label>Сегодня</Label>
      {data === null ? <Skeleton lines={3} /> : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <Big>₸ {fmt(data.revenue)}</Big>
            {data.deltaRevenuePct !== null && (
              <span style={{ color: pos ? GREEN : RED, fontSize: 13, fontWeight: 700 }}>
                {pos ? "↑ +" : "↓ "}{data.deltaRevenuePct}%
              </span>
            )}
          </div>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 10px" }}>
            {data.ordersCount} заказов · Средний чек ₸ {fmt(data.avgCheck)}
          </p>
          {Object.keys(data.paymentBreakdown).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(data.paymentBreakdown).map(([method, amount]) => (
                <span key={method} style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 999, padding: "4px 10px", fontSize: 12, color: TEXT,
                }}>
                  {PAYMENT_LABELS[method] ?? method} · ₸ {fmt(amount)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ShiftCard({ data }: { data: ShiftData | null }) {
  return (
    <Card>
      <Label>Смена</Label>
      {data === null ? <Skeleton lines={1} /> : data.isOpen && data.openedAt ? (
        <div>
          <p style={{ color: TEXT, fontSize: 16, fontWeight: 700, margin: 0 }}>Открыта с {fmtTime(data.openedAt)}</p>
          {data.shiftOrdersCount !== null && (
            <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>{data.shiftOrdersCount} заказов за смену</p>
          )}
        </div>
      ) : (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Смена не открыта</p>
      )}
    </Card>
  );
}

function StaffCard({ members }: { members: StaffMember[] | null }) {
  return (
    <Card>
      <Label>Персонал на смене</Label>
      {members === null ? <Skeleton lines={2} /> : members.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Нет сотрудников на смене</p>
      ) : (
        <>
          <p style={{ color: TEXT, fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>
            {members.length} чел. на смене
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `${VIOLET}1A`, border: `1px solid ${VIOLET}40`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ color: VIOLET, fontSize: 12, fontWeight: 800 }}>{m.displayName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p style={{ color: TEXT, fontSize: 14, fontWeight: 600, margin: 0 }}>{m.displayName}</p>
                  <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>{ROLE_LABELS[m.role] ?? m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function ReviewsCard({ data }: { data: ReviewsData | null }) {
  return (
    <Card>
      <Label>Оценки (30 дней)</Label>
      {data === null ? <Skeleton lines={3} /> : data.count === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Нет отзывов за 30 дней</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <Big>★ {data.avgRating?.toFixed(1)}</Big>
            <span style={{ color: MUTED, fontSize: 14 }}>{data.count} отзывов</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.recent.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", gap: 2, flexShrink: 0, paddingTop: 2 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={10} style={{ color: s <= r.rating ? AMBER : "rgba(255,255,255,0.18)", fill: s <= r.rating ? AMBER : "transparent" }} />
                  ))}
                </div>
                <p style={{ color: "rgba(240,240,240,0.65)", fontSize: 13, flex: 1, minWidth: 0, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.comment ? (r.comment.length > 60 ? r.comment.slice(0, 60) + "…" : r.comment) : "—"}
                </p>
                <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>{fmtDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function WeekCard({ data }: { data: WeekData | null }) {
  const delta = data && data.prevRevenue > 0 ? Math.round(((data.revenue - data.prevRevenue) / data.prevRevenue) * 100) : null;
  const pos   = (delta ?? 0) >= 0;
  return (
    <Card>
      <Label>Неделя (7 дней)</Label>
      {data === null ? <Skeleton lines={2} /> : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <Big>₸ {fmt(data.revenue)}</Big>
            {delta !== null && (
              <span style={{ color: pos ? GREEN : RED, fontSize: 13, fontWeight: 700 }}>
                {pos ? "↑ +" : "↓ "}{delta}% vs прошлая неделя
              </span>
            )}
          </div>
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>{data.ordersCount} заказов</p>
        </>
      )}
    </Card>
  );
}

function TopDishesCard({ data }: { data: TopDish[] | null }) {
  return (
    <Card>
      <Label>Топ блюд (7 дней)</Label>
      {data === null ? <Skeleton lines={4} /> : data.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Нет данных</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: MUTED, fontSize: 12, fontWeight: 700, width: 22, flexShrink: 0 }}>#{i + 1}</span>
              <span style={{ color: TEXT, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ color: VIOLET, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{d.count} шт.</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const INVOICE_PERIODS: { key: "today" | "7d" | "30d" | "90d"; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7d",    label: "7 дней"  },
  { key: "30d",   label: "30 дней" },
  { key: "90d",   label: "90 дней" },
];

function InvoicesCard({ data, period, onPeriod }: {
  data:     InvoicesData | null;
  period:   "today" | "7d" | "30d" | "90d";
  onPeriod: (p: "today" | "7d" | "30d" | "90d") => void;
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Label>Накладные</Label>
        <div style={{ display: "flex", gap: 5, marginTop: -8 }}>
          {INVOICE_PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onPeriod(key)}
              style={{
                background: period === key ? RED : "rgba(255,255,255,0.06)",
                border: period === key ? "none" : "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                color: period === key ? "#fff" : MUTED,
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {data === null ? <Skeleton lines={3} /> : data.count === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Нет накладных за выбранный период</p>
      ) : (
        <>
          <Big>₸ {fmt(data.total)}</Big>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 14px" }}>{data.count} накладных</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.suppliers.map((s, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: TEXT, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span style={{ color: RED, fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>₸ {fmt(s.total)}</span>
                  <span style={{ color: MUTED, fontSize: 11, width: 38, textAlign: "right", flexShrink: 0, marginLeft: 8 }}>{s.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: RED, width: `${s.pct}%`, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RecentOrdersCard({ data }: { data: RecentOrder[] | null }) {
  return (
    <Card>
      <Label>Последние заказы</Label>
      {data === null ? <Skeleton lines={4} /> : data.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14, fontStyle: "italic", margin: 0 }}>Нет завершённых заказов</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map(o => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {ORDER_TYPE_LABEL[o.type ?? ""] ?? o.type ?? "—"}
                  {o.table_number ? ` · стол ${o.table_number}` : ""}
                </p>
                <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>{fmtTime(o.created_at)}</p>
              </div>
              <span style={{ color: GREEN, fontSize: 15, fontWeight: 700 }}>₸ {fmt(o.total_price)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
