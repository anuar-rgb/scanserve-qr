"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Eye, EyeOff, Pencil, Check, X, BarChart3, Users, Smartphone, Monitor, Bell, BellOff, ChevronDown, ChevronUp, Mail, TrendingUp, TrendingDown, RotateCcw, Coins, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Restaurant = {
  id: string;
  numeric_id: number | null;
  name: string;
  slug: string;
  logo: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  admin_name: string | null;
  admin_phone: string | null;
  restaurant_phone: string | null;
  monthly_payment_status: "paid" | "unpaid" | "overdue" | null;
  payment_due_date: string | null;
  plan_id: string | null;
  created_at: string;
  guest_count: number;
  is_2gis_enabled: boolean | null;
  custom_2gis_api_key: string | null;
};

type StaffUser = {
  id: string;
  username: string;
  role: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
};

type InfoEdit = {
  id: string;
  owner_name: string;
  owner_phone: string;
  admin_name: string;
  admin_phone: string;
  restaurant_phone: string;
  monthly_payment_status: string;
  payment_due_date: string;
  plan_id: string;
  is_2gis_enabled: boolean;
  custom_2gis_api_key: string;
} | null;

type NewStaffForm = {
  username: string;
  password: string;
  role: string;
  displayName: string;
};

type ResetForm = { userId: string; newPassword: string } | null;

type GuestProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  guest_id: string | null;
  push_subscription: boolean;
  created_at: string;
  last_visit: string | null;
  bonus_amount: number;
};

type BonusTx = {
  id: string;
  type: "earned" | "spent" | "refund_spent" | "refund_earned" | "manual";
  amount: number;
  description: string | null;
  created_at: string;
  restaurant_id: string;
  restaurant_name: string;
  order_id: string | null;
  balance_after: number;
};

type GuestBalance = {
  restaurant_id: string;
  restaurant_name: string;
  bonus_amount: number;
};

type GuestOrder = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  total_price: number;
  status: string;
  type: string;
  created_at: string;
  bonuses_deducted: number;
  earned_bonuses: number;
  bonuses_accrued: boolean;
  refund_status: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:    { label: "Оплачено",    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  unpaid:  { label: "Не оплачено", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20"       },
  overdue: { label: "Просрочено",  cls: "bg-red-500/15 text-red-400 border-red-500/20"             },
};

const ROLE_LABELS: Record<string, string> = {
  owner:      "Владелец",
  manager:    "Менеджер",
  supervisor: "Управляющий",
};

const EMPTY_NEW_STAFF: NewStaffForm = { username: "", password: "", role: "manager", displayName: "" };

// ── Landing Stats ───────────────────────────────────────────────────────────

interface LandingData {
  totalVisitors: number;
  totalViews: number;
  sections: { name: string; uniqueViews: number; totalViews: number }[];
  devices: Record<string, number>;
  daily: { date: string; visitors: number }[];
}

const SECTION_LABELS: Record<string, string> = {
  page_view: "Открыли сайт",
  hero: "Hero (главный экран)",
  stats: "Статистика",
  features: "Возможности",
  "how-it-works": "Как это работает",
  pricing: "Тарифы",
  cta: "CTA (призыв)",
  footer: "Футер (конец)",
};

function LandingStats() {
  const [data, setData] = useState<LandingData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/landing?days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-violet-400" />
          <h2 className="text-base font-bold text-zinc-100">Аналитика лендинга</h2>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                days === d ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {d}д
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Top stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-800/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} className="text-emerald-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Посетители</span>
              </div>
              <p className="text-xl font-bold text-zinc-100 tabular-nums">{data.totalVisitors}</p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Smartphone size={12} className="text-blue-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Мобильных</span>
              </div>
              <p className="text-xl font-bold text-zinc-100 tabular-nums">{data.devices.mobile ?? 0}</p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Monitor size={12} className="text-amber-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Десктоп</span>
              </div>
              <p className="text-xl font-bold text-zinc-100 tabular-nums">{data.devices.desktop ?? 0}</p>
            </div>
          </div>

          {/* Section funnel */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">Воронка по секциям</p>
            <div className="space-y-1">
              {data.sections.map(s => {
                const pct = data.totalVisitors > 0 ? Math.round((s.uniqueViews / data.totalVisitors) * 100) : 0;
                return (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 w-36 truncate">{SECTION_LABELS[s.name] ?? s.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-zinc-400 tabular-nums w-16 text-right">{s.uniqueViews} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily chart (simple bars) */}
          {data.daily.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">По дням</p>
              <div className="flex items-end gap-0.5 h-16">
                {data.daily.slice(-30).map(d => {
                  const max = Math.max(...data.daily.map(x => x.visitors), 1);
                  const h = Math.max(4, (d.visitors / max) * 64);
                  return (
                    <div key={d.date} className="flex-1 min-w-0" title={`${d.date}: ${d.visitors}`}>
                      <div className="rounded-t bg-violet-500/60 hover:bg-violet-400 transition-colors mx-auto" style={{ height: h, maxWidth: 12 }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 text-center py-6">Нет данных</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]         = useState(true);

  // which card is expanded ("manage" panel open)
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  // which tab inside expanded panel: "links" | "staff"
  const [activeTab, setActiveTab]     = useState<"links" | "staff" | "info">("links");

  // info edit state
  const [infoEdit, setInfoEdit]       = useState<InfoEdit>(null);
  const [infoSaving, setInfoSaving]   = useState(false);
  const [infoError, setInfoError]     = useState<string | null>(null);

  // staff state per restaurant
  const [staff, setStaff]             = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newStaff, setNewStaff]       = useState<NewStaffForm>(EMPTY_NEW_STAFF);
  const [newStaffErr, setNewStaffErr] = useState<string | null>(null);
  const [newStaffSaving, setNewStaffSaving] = useState(false);
  const [resetForm, setResetForm]     = useState<ResetForm>(null);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetErr, setResetErr]       = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // guests list per restaurant
  const [guestListId, setGuestListId]       = useState<string | null>(null);
  const [guests, setGuests]                 = useState<GuestProfile[]>([]);
  const [guestsLoading, setGuestsLoading]   = useState(false);

  // guest detail modal
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);

  async function loadGuests(restaurantId: string) {
    if (guestListId === restaurantId) { setGuestListId(null); return; }
    setGuestListId(restaurantId);
    setGuests([]);
    setGuestsLoading(true);
    const res = await fetch(`/api/super-admin/restaurant-guests?restaurantId=${restaurantId}`);
    if (res.ok) setGuests(await res.json());
    setGuestsLoading(false);
  }

  // copy feedback
  const [copied, setCopied]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/restaurants");
    if (res.ok) setRestaurants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Info edit ──────────────────────────────────────────────────────────────

  function startInfoEdit(r: Restaurant) {
    setInfoError(null);
    setInfoEdit({
      id: r.id,
      owner_name:             r.owner_name             ?? "",
      owner_phone:            r.owner_phone            ?? "",
      admin_name:             r.admin_name             ?? "",
      admin_phone:            r.admin_phone            ?? "",
      restaurant_phone:       r.restaurant_phone       ?? "",
      monthly_payment_status: r.monthly_payment_status ?? "unpaid",
      payment_due_date:       r.payment_due_date       ?? "",
      plan_id:                r.plan_id                ?? "standard",
      is_2gis_enabled:        r.is_2gis_enabled        ?? false,
      custom_2gis_api_key:    r.custom_2gis_api_key    ?? "",
    });
  }

  async function saveInfoEdit() {
    if (!infoEdit) return;
    setInfoSaving(true);
    setInfoError(null);
    try {
      const res = await fetch("/api/super-admin/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoEdit),
      });
      const json = await res.json();
      if (!res.ok) {
        setInfoError((json as { error?: string }).error ?? `Ошибка ${res.status}`);
      } else {
        const updated = json as Restaurant;
        setRestaurants((prev) =>
          prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
        );
        setInfoEdit(null);
      }
    } catch {
      setInfoError("Сетевая ошибка — проверьте соединение");
    } finally {
      setInfoSaving(false);
    }
  }

  // ── Expand / tabs ──────────────────────────────────────────────────────────

  async function toggleExpand(r: Restaurant) {
    if (expandedId === r.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(r.id);
    setActiveTab("links");
    setNewStaff(EMPTY_NEW_STAFF);
    setNewStaffErr(null);
    setResetForm(null);
    // load staff
    setStaff([]);
    setStaffLoading(true);
    const res = await fetch(`/api/super-admin/staff?restaurantId=${r.id}`);
    if (res.ok) setStaff(await res.json());
    setStaffLoading(false);
  }

  async function switchToStaff(restaurantId: string) {
    setActiveTab("staff");
    if (staff.length === 0 && !staffLoading) {
      setStaffLoading(true);
      const res = await fetch(`/api/super-admin/staff?restaurantId=${restaurantId}`);
      if (res.ok) setStaff(await res.json());
      setStaffLoading(false);
    }
  }

  // ── Staff CRUD ─────────────────────────────────────────────────────────────

  async function createStaff(restaurantId: string): Promise<boolean> {
    if (!newStaff.username || !newStaff.password) {
      setNewStaffErr("Логин и пароль обязательны");
      return false;
    }
    setNewStaffSaving(true);
    setNewStaffErr(null);
    const res = await fetch("/api/super-admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, ...newStaff }),
    });
    const d = await res.json().catch(() => ({})) as { error?: string; id?: string };
    if (!res.ok) {
      setNewStaffErr(d.error ?? "Ошибка создания");
      setNewStaffSaving(false);
      return false;
    }
    setNewStaff(EMPTY_NEW_STAFF);
    const r2 = await fetch(`/api/super-admin/staff?restaurantId=${restaurantId}`);
    if (r2.ok) setStaff(await r2.json());
    setNewStaffSaving(false);
    return true;
  }

  async function resetPassword(restaurantId: string) {
    if (!resetForm || !resetForm.newPassword) return;
    if (resetForm.newPassword.length < 6) {
      setResetErr("Минимум 6 символов");
      return;
    }
    setResetSaving(true);
    setResetErr(null);
    const res = await fetch("/api/super-admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetForm.userId, restaurantId, newPassword: resetForm.newPassword }),
    });
    const d = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      setResetErr(d.error ?? "Ошибка");
    } else {
      setResetForm(null);
    }
    setResetSaving(false);
  }

  async function deleteStaff(userId: string, restaurantId: string) {
    if (!confirm("Удалить этого пользователя?")) return;
    setDeletingId(userId);
    await fetch("/api/super-admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const r2 = await fetch(`/api/super-admin/staff?restaurantId=${restaurantId}`);
    if (r2.ok) setStaff(await r2.json());
    setDeletingId(null);
  }

  const [cloning, setCloning] = useState(false);

  async function cloneMenu(sourceId: string, targetId: string) {
    if (!confirm(`Клонировать меню? Все категории и блюда будут скопированы.`)) return;
    setCloning(true);
    const res = await fetch("/api/super-admin/clone-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceRestaurantId: sourceId, targetRestaurantId: targetId }),
    });
    const data = await res.json();
    setCloning(false);
    if (res.ok) {
      alert(`Готово! Скопировано: ${data.categoriesCloned} категорий, ${data.productsCloned} блюд`);
    } else {
      alert(`Ошибка: ${data.error}`);
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <LandingStats />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Рестораны</h1>
        <p className="text-sm text-zinc-500 mt-1">Все заведения на платформе</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => {
            const status    = STATUS_LABELS[r.monthly_payment_status ?? "unpaid"] ?? STATUS_LABELS.unpaid;
            const isExpanded = expandedId === r.id;

            return (
              <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                {/* ── Card header ── */}
                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        {r.logo ? (
                          <img src={r.logo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-zinc-800" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-zinc-500">{r.name[0]}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-zinc-100">{r.name}</span>
                            <span className="text-xs text-zinc-600 font-mono">/{r.slug}</span>
                            <span className="text-xs text-zinc-600">#{r.numeric_id}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                              {status.label}
                            </span>
                            {r.payment_due_date && (
                              <span className="text-xs text-zinc-500">
                                до {new Date(r.payment_due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                            {r.owner_name  && <span className="text-xs text-zinc-400">{r.owner_name}</span>}
                            {r.owner_phone && <a href={`tel:${r.owner_phone}`} className="text-xs text-violet-400 hover:text-violet-300">{r.owner_phone}</a>}
                            {!r.owner_name && !r.owner_phone && <span className="text-xs text-zinc-600">Контакты не заполнены</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleExpand(r)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${isExpanded ? "bg-violet-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}>
                          {isExpanded ? "Закрыть" : "Управление"}
                        </button>
                      </div>
                    </div>
                </div>

                {/* ── Expanded panel ── */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800 px-5 pt-3 gap-1">
                      {(["links", "staff", "info"] as const).map((tab) => (
                        <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "staff") switchToStaff(r.id); if (tab === "info") startInfoEdit(r); }}
                          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                            activeTab === tab
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}>
                          {tab === "links" ? "Ссылки & QR" : tab === "staff" ? "Доступ" : "Инфо"}
                        </button>
                      ))}
                      <div className="ml-auto flex items-center pr-1">
                        <select
                          className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg px-2 py-1 mr-1"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) cloneMenu(e.target.value, r.id);
                            e.target.value = "";
                          }}
                          disabled={cloning}
                        >
                          <option value="" disabled>{cloning ? "Копируем..." : "Копировать меню из..."}</option>
                          {restaurants.filter(x => x.id !== r.id).map(x => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-5">
                      {activeTab === "links" && <LinksTab restaurant={r} copied={copied} onCopy={copyText} />}
                      {activeTab === "info" && infoEdit?.id === r.id && (
                        <div className="space-y-5">
                          {/* Guest count + button */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Users size={14} className="text-violet-400" />
                              <span className="text-xs text-zinc-400">Зарегистрированных гостей:</span>
                              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 text-xs font-semibold tabular-nums">
                                {r.guest_count}
                              </span>
                            </div>
                            {r.guest_count > 0 && (
                              <button
                                onClick={() => loadGuests(r.id)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                              >
                                {guestListId === r.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {guestListId === r.id ? "Скрыть" : "Показать список"}
                              </button>
                            )}
                          </div>

                          {/* Guest list */}
                          {guestListId === r.id && (
                            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                              {guestsLoading ? (
                                <div className="h-16 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
                                </div>
                              ) : guests.length === 0 ? (
                                <p className="text-xs text-zinc-600 p-4 text-center">Нет данных</p>
                              ) : (
                                <div className="divide-y divide-zinc-800">
                                  {guests.map((g, i) => (
                                    <div
                                      key={g.id}
                                      onClick={() => g.guest_id && setSelectedGuest(g)}
                                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                                    >
                                      {/* Index */}
                                      <span className="text-xs text-zinc-600 tabular-nums w-5 flex-shrink-0">{i + 1}</span>
                                      {/* Avatar */}
                                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <Users size={14} className="text-zinc-500" />
                                      </div>
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-violet-300 transition-colors">
                                            {g.name ?? "Без имени"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                          {g.phone && (
                                            <span className="text-xs text-zinc-400 font-mono">
                                              {g.phone}
                                            </span>
                                          )}
                                          {g.email && (
                                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                                              <Mail size={10} className="text-zinc-600" />
                                              {g.email}
                                            </span>
                                          )}
                                          <span className="text-xs text-zinc-600">
                                            {new Date(g.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Push + Bonus + Arrow */}
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        <div title={g.push_subscription ? "Push активна" : "Push нет"}>
                                          {g.push_subscription
                                            ? <Bell size={13} className="text-emerald-400" />
                                            : <BellOff size={13} className="text-zinc-600" />
                                          }
                                        </div>
                                        <div className="text-right">
                                          <span className="text-sm font-semibold text-amber-400 tabular-nums">{g.bonus_amount} ₸</span>
                                          <p className="text-[10px] text-zinc-600">бонусы</p>
                                        </div>
                                        <ChevronRight size={14} className="text-zinc-600 group-hover:text-violet-400 transition-colors" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Owner */}
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Владелец</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Имя</label>
                                <input value={infoEdit.owner_name} onChange={(e) => setInfoEdit({ ...infoEdit, owner_name: e.target.value })}
                                  className={INPUT_CLS} placeholder="ФИО владельца" />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Телефон</label>
                                <input value={infoEdit.owner_phone} onChange={(e) => setInfoEdit({ ...infoEdit, owner_phone: e.target.value })}
                                  className={INPUT_CLS} placeholder="+7 700 000 00 00" />
                              </div>
                            </div>
                          </div>

                          {/* Admin */}
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Администратор</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Имя</label>
                                <input value={infoEdit.admin_name} onChange={(e) => setInfoEdit({ ...infoEdit, admin_name: e.target.value })}
                                  className={INPUT_CLS} placeholder="ФИО администратора" />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Телефон</label>
                                <input value={infoEdit.admin_phone} onChange={(e) => setInfoEdit({ ...infoEdit, admin_phone: e.target.value })}
                                  className={INPUT_CLS} placeholder="+7 700 000 00 00" />
                              </div>
                            </div>
                          </div>

                          {/* Restaurant phone */}
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Заведение</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Номер заведения</label>
                                <input value={infoEdit.restaurant_phone} onChange={(e) => setInfoEdit({ ...infoEdit, restaurant_phone: e.target.value })}
                                  className={INPUT_CLS} placeholder="+7 700 000 00 00" />
                              </div>
                            </div>
                          </div>

                          {/* Payment & Plan */}
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Подписка</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Статус оплаты</label>
                                <select value={infoEdit.monthly_payment_status} onChange={(e) => setInfoEdit({ ...infoEdit, monthly_payment_status: e.target.value })}
                                  className={INPUT_CLS}>
                                  <option value="paid">Оплачено</option>
                                  <option value="unpaid">Не оплачено</option>
                                  <option value="overdue">Просрочено</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Дата следующего платежа</label>
                                <input type="date" value={infoEdit.payment_due_date} onChange={(e) => setInfoEdit({ ...infoEdit, payment_due_date: e.target.value })}
                                  className={INPUT_CLS} />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Тариф</label>
                                <select value={infoEdit.plan_id} onChange={(e) => setInfoEdit({ ...infoEdit, plan_id: e.target.value })}
                                  className={INPUT_CLS}>
                                  <option value="starter">Стартовый — 15 780 ₸</option>
                                  <option value="standard">Стандарт — 30 780 ₸</option>
                                  <option value="annual">Годовой — 157 170 ₸/год</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* 2GIS Integration */}
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Интеграции и карты</p>
                            <div className="space-y-3">
                              {/* Toggle */}
                              <div className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3 border border-zinc-700/60">
                                <div>
                                  <p className="text-sm font-medium text-zinc-200">Карты 2GIS</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">Интерактивная карта при оформлении доставки</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setInfoEdit({ ...infoEdit!, is_2gis_enabled: !infoEdit!.is_2gis_enabled })}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                    infoEdit.is_2gis_enabled ? "bg-violet-600" : "bg-zinc-700"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                      infoEdit.is_2gis_enabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                              {/* API Key */}
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Индивидуальный API-ключ 2GIS</label>
                                <input
                                  value={infoEdit.custom_2gis_api_key}
                                  onChange={(e) => setInfoEdit({ ...infoEdit!, custom_2gis_api_key: e.target.value })}
                                  className={INPUT_CLS}
                                  placeholder="Оставьте пустым — будет использован системный ключ"
                                />
                                <p className="text-[11px] text-zinc-600 mt-1">Если ресторан оплатил собственный ключ — введите его здесь. Иначе используется дефолтный ключ платформы.</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-1">
                            <div className="flex gap-2">
                              <button onClick={saveInfoEdit} disabled={infoSaving} className={BTN_PRIMARY}>
                                {infoSaving ? "Сохранение..." : "Сохранить"}
                              </button>
                            </div>
                            {infoError && (
                              <p className="text-xs text-red-400">{infoError}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {activeTab === "staff" && (
                        <StaffTab
                          restaurant={r}
                          staff={staff}
                          loading={staffLoading}
                          newStaff={newStaff}
                          setNewStaff={setNewStaff}
                          newStaffErr={newStaffErr}
                          newStaffSaving={newStaffSaving}
                          onCreateStaff={() => createStaff(r.id)}
                          resetForm={resetForm}
                          setResetForm={setResetForm}
                          resetSaving={resetSaving}
                          resetErr={resetErr}
                          onResetPassword={() => resetPassword(r.id)}
                          deletingId={deletingId}
                          onDeleteStaff={(uid) => deleteStaff(uid, r.id)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-6 text-center">{restaurants.length} заведений на платформе</p>

      {/* Guest detail modal */}
      {selectedGuest && (
        <GuestDetailModal
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
        />
      )}
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const INPUT_CLS  = "w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors";
const BTN_PRIMARY   = "px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors";
const BTN_SECONDARY = "px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors";
const BTN_GHOST     = "px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors";

// ── LinksTab ───────────────────────────────────────────────────────────────────

function LinksTab({
  restaurant,
  copied,
  onCopy,
}: {
  restaurant: Restaurant;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const origin    = typeof window !== "undefined" ? window.location.origin : "";
  const menuUrl   = `${origin}/${restaurant.slug}`;           // ссылка для отправки — С собой + Доставка
  const qrUrl     = `${origin}/${restaurant.slug}?source=qr`; // QR в зале — В заведении + С собой
  const qrCanvasId = `qr-canvas-${restaurant.id}`;

  function downloadQR() {
    const canvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${restaurant.slug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="space-y-6">
      {/* Regular link — takeaway + delivery */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Ссылка для отправки гостям</p>
        <p className="text-[11px] text-zinc-600 mb-2">С собой · Доставка — для рассылки и соцсетей</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-violet-300 text-xs truncate">
            {menuUrl}
          </code>
          <button onClick={() => onCopy(menuUrl, `url-${restaurant.id}`)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
              copied === `url-${restaurant.id}`
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}>
            {copied === `url-${restaurant.id}` ? "Скопировано!" : "Копировать"}
          </button>
        </div>
      </div>

      {/* QR code — dine-in + takeaway */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">QR-код для зала</p>
        <p className="text-[11px] text-zinc-600 mb-3">В заведении · С собой — размещается в зале на столах</p>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="bg-white p-3 rounded-2xl flex-shrink-0">
            <QRCodeCanvas
              id={qrCanvasId}
              value={qrUrl}
              size={160}
              level="H"
              marginSize={1}
            />
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <code className="text-[10px] text-zinc-600 font-mono break-all max-w-[200px]">
              {qrUrl}
            </code>
            <button onClick={downloadQR}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors w-fit">
              Скачать PNG
            </button>
            <button onClick={() => onCopy(qrUrl, `qr-url-${restaurant.id}`)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors w-fit ${
                copied === `qr-url-${restaurant.id}`
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}>
              {copied === `qr-url-${restaurant.id}` ? "Скопировано!" : "Копировать ссылку QR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StaffTab ───────────────────────────────────────────────────────────────────

function StaffTab({
  restaurant,
  staff,
  loading,
  newStaff,
  setNewStaff,
  newStaffErr,
  newStaffSaving,
  onCreateStaff,
  resetForm,
  setResetForm,
  resetSaving,
  resetErr,
  onResetPassword,
  deletingId,
  onDeleteStaff,
}: {
  restaurant: Restaurant;
  staff: StaffUser[];
  loading: boolean;
  newStaff: NewStaffForm;
  setNewStaff: (f: NewStaffForm) => void;
  newStaffErr: string | null;
  newStaffSaving: boolean;
  onCreateStaff: () => Promise<boolean>;
  resetForm: ResetForm;
  setResetForm: (f: ResetForm) => void;
  resetSaving: boolean;
  resetErr: string | null;
  onResetPassword: () => void;
  deletingId: string | null;
  onDeleteStaff: (id: string) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="space-y-5">
      {/* Existing staff */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Администраторы</p>
        {loading ? (
          <div className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
        ) : staff.length === 0 ? (
          <p className="text-xs text-zinc-600 py-3">Нет администраторов — добавьте ниже</p>
        ) : (
          <div className="space-y-2">
            {staff.map((u) => (
              <div key={u.id} className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3">
                {resetForm?.userId === u.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200">{u.username}</span>
                      <span className="text-xs text-zinc-500">{ROLE_LABELS[u.role] ?? u.role}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Новый пароль (мин. 6 символов)"
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <button onClick={onResetPassword} disabled={resetSaving} className={BTN_PRIMARY}>
                        {resetSaving ? "..." : "Сохранить"}
                      </button>
                      <button onClick={() => setResetForm(null)} className={BTN_SECONDARY}>✕</button>
                    </div>
                    {resetErr && <p className="text-xs text-red-400">{resetErr}</p>}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: identity + password row */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-200">{u.username}</span>
                        {u.display_name && <span className="text-xs text-zinc-500">{u.display_name}</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </div>
                    </div>
                    {/* Right: actions */}
                    <div className="flex gap-2 flex-shrink-0 pt-0.5">
                      <button onClick={() => setResetForm({ userId: u.id, newPassword: "" })}
                        className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition-colors whitespace-nowrap">
                        Сбросить пароль
                      </button>
                      <button onClick={() => onDeleteStaff(u.id)} disabled={deletingId === u.id}
                        className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs border border-red-500/20 transition-colors disabled:opacity-50">
                        {deletingId === u.id ? "..." : "Удалить"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new staff */}
      <div className="border-t border-zinc-800 pt-4">
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Создать пользователя
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Добавить администратора</p>
              <button
                onClick={() => { setShowCreateForm(false); setNewStaff(EMPTY_NEW_STAFF); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Закрыть"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Логин</label>
                <input value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                  className={INPUT_CLS} placeholder="manager_astori" autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Пароль <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="минимум 6 символов"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Роль</label>
                <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className={INPUT_CLS}>
                  <option value="owner">Владелец</option>
                  <option value="manager">Менеджер</option>
                  <option value="supervisor">Управляющий</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Имя (необязательно)</label>
                <input value={newStaff.displayName} onChange={(e) => setNewStaff({ ...newStaff, displayName: e.target.value })}
                  className={INPUT_CLS} placeholder="Имя Фамилия" />
              </div>
            </div>
            {newStaffErr && <p className="text-xs text-red-400 mt-2">{newStaffErr}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => { const ok = await onCreateStaff(); if (ok) setShowCreateForm(false); }}
                disabled={newStaffSaving || !newStaff.username || !newStaff.password}
                className={BTN_PRIMARY}>
                {newStaffSaving ? "Создание..." : "Создать"}
              </button>
              <button onClick={() => { setShowCreateForm(false); setNewStaff(EMPTY_NEW_STAFF); }}
                className={BTN_SECONDARY}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GuestDetailModal ───────────────────────────────────────────────────────────

const ORDER_TYPE_LABELS: Record<string, string> = {
  "dine-in": "В зале",
  takeaway:  "С собой",
  delivery:  "Доставка",
};

const ORDER_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open:      { label: "Открыт",   cls: "text-amber-400"   },
  completed: { label: "Завершён", cls: "text-emerald-400" },
  cancelled: { label: "Отменён",  cls: "text-red-400"     },
};

const TX_ICONS: Record<string, React.ReactNode> = {
  earned:       <TrendingUp  size={13} className="text-emerald-400" />,
  spent:        <TrendingDown size={13} className="text-red-400"     />,
  refund_spent: <RotateCcw   size={13} className="text-blue-400"     />,
  refund_earned:<RotateCcw   size={13} className="text-orange-400"   />,
  manual:       <Coins       size={13} className="text-violet-400"   />,
};

const TX_TYPE_LABELS: Record<string, string> = {
  earned:       "Начисление",
  spent:        "Списание",
  refund_spent: "Возврат бонусов",
  refund_earned:"Аннул. кешбэка",
  manual:       "Вручную",
};

function GuestDetailModal({
  guest,
  onClose,
}: {
  guest: GuestProfile;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"info" | "orders" | "addresses" | "bonuses">("info");
  const [transactions, setTransactions] = useState<BonusTx[]>([]);
  const [balances, setBalances]         = useState<GuestBalance[]>([]);
  const [txLoading, setTxLoading]       = useState(false);
  const [orders, setOrders]             = useState<GuestOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded]   = useState(false);

  useEffect(() => {
    if (!guest.guest_id) return;
    setTxLoading(true);
    fetch(`/api/super-admin/guest-transactions?guestId=${guest.guest_id}`)
      .then((r) => r.ok ? r.json() as Promise<{ transactions: BonusTx[]; balances: GuestBalance[] }> : { transactions: [], balances: [] })
      .then((data) => { setTransactions(data.transactions ?? []); setBalances(data.balances ?? []); })
      .finally(() => setTxLoading(false));
  }, [guest.guest_id]);

  useEffect(() => {
    if (activeTab !== "orders" || !guest.guest_id || ordersLoaded) return;
    setOrdersLoading(true);
    fetch(`/api/super-admin/guest-orders?guestId=${guest.guest_id}`)
      .then((r) => r.ok ? r.json() as Promise<GuestOrder[]> : [])
      .then((data) => { setOrders(data ?? []); setOrdersLoaded(true); })
      .finally(() => setOrdersLoading(false));
  }, [activeTab, guest.guest_id, ordersLoaded]);

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "info",      label: "Инфо"      },
    { key: "orders",    label: "Заказы"    },
    { key: "addresses", label: "Избранное" },
    { key: "bonuses",   label: "Бонусы"    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-zinc-100 truncate">{guest.name ?? "Без имени"}</h2>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {guest.phone && <span className="text-xs text-zinc-400 font-mono">{guest.phone}</span>}
              {guest.email && (
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <Mail size={10} className="text-zinc-600" />
                  {guest.email}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-4 gap-0.5 flex-shrink-0 pt-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 text-xs font-semibold transition-colors rounded-t-lg ${
                activeTab === t.key
                  ? "text-violet-300 border-b-2 border-violet-500 -mb-px"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "info"      && <GuestInfoTab guest={guest} balances={balances} txLoading={txLoading} />}
          {activeTab === "orders"    && <GuestOrdersTab orders={orders} loading={ordersLoading} />}
          {activeTab === "addresses" && <GuestAddressesTab />}
          {activeTab === "bonuses"   && <GuestBonusesTab transactions={transactions} balances={balances} loading={txLoading} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex-shrink-0 flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            {activeTab === "bonuses" && `${transactions.length} транзакций`}
            {activeTab === "orders" && ordersLoaded && `${orders.length} заказов`}
          </span>
          <button onClick={onClose} className={BTN_GHOST}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

// ── GuestDetailModal sub-tabs ─────────────────────────────────────────────────

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: "emerald" }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-xs text-zinc-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-right truncate ${mono ? "font-mono" : ""} ${highlight === "emerald" ? "text-emerald-400" : "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}

function GuestInfoTab({ guest, balances, txLoading }: { guest: GuestProfile; balances: GuestBalance[]; txLoading: boolean }) {
  const totalBonus = balances.reduce((s, b) => s + b.bonus_amount, 0);
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 divide-y divide-zinc-700/50">
        <InfoRow label="Имя"         value={guest.name  ?? "Не указано"} />
        <InfoRow label="Телефон"     value={guest.phone ?? "Не указан"} mono />
        <InfoRow label="Email"       value={guest.email ?? "Не указан"} mono />
        <InfoRow label="Регистрация" value={new Date(guest.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
        <InfoRow
          label="Последний визит"
          value={guest.last_visit
            ? new Date(guest.last_visit).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
            : "Нет данных"}
        />
        <InfoRow
          label="Push-уведомления"
          value={guest.push_subscription ? "Подключены" : "Не подключены"}
          highlight={guest.push_subscription ? "emerald" : undefined}
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Бонусный счёт</p>
        {txLoading ? (
          <div className="h-8 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
            <span className="text-xs text-zinc-600">Загрузка...</span>
          </div>
        ) : balances.length === 0 ? (
          <p className="text-xs text-zinc-600">Нет бонусных счетов</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {balances.map((b) => (
              <div key={b.restaurant_id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700">
                <span className="text-xs text-zinc-400 truncate max-w-[120px]">{b.restaurant_name}</span>
                <span className={`text-sm font-bold tabular-nums ${b.bonus_amount >= 0 ? "text-amber-400" : "text-red-400"}`}>
                  {b.bonus_amount >= 0 ? "+" : ""}{b.bonus_amount} ₸
                </span>
              </div>
            ))}
            {balances.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <span className="text-xs text-zinc-500">Итого</span>
                <span className={`text-sm font-bold tabular-nums ${totalBonus >= 0 ? "text-amber-300" : "text-red-400"}`}>
                  {totalBonus >= 0 ? "+" : ""}{totalBonus} ₸
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {guest.guest_id && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">ID гостя</p>
          <code className="text-[10px] text-zinc-600 font-mono break-all">{guest.guest_id}</code>
        </div>
      )}
    </div>
  );
}

function GuestOrdersTab({ orders, loading }: { orders: GuestOrder[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-sm text-zinc-600">Заказов не найдено</p>
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800/60 sticky top-0 bg-zinc-900">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-28 flex-shrink-0">Дата</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex-1">Ресторан</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-14 text-center flex-shrink-0">Тип</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-22 text-right flex-shrink-0">Сумма</span>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-18 text-right flex-shrink-0">Статус</span>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {orders.map((o) => {
          const dt     = new Date(o.created_at);
          const status = ORDER_STATUS_LABELS[o.status] ?? { label: o.status, cls: "text-zinc-400" };
          return (
            <div key={o.id} className="flex items-center gap-2 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
              <div className="w-28 flex-shrink-0">
                <p className="text-xs text-zinc-300 tabular-nums">
                  {dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </p>
                <p className="text-[10px] text-zinc-600 tabular-nums">
                  {dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{o.restaurant_name}</p>
                <p className="text-[10px] text-zinc-600 font-mono">#{o.id.slice(0, 8)}</p>
              </div>
              <div className="w-14 text-center flex-shrink-0">
                <span className="text-[10px] text-zinc-500">{ORDER_TYPE_LABELS[o.type] ?? o.type}</span>
              </div>
              <div className="w-22 text-right flex-shrink-0">
                <span className="text-sm font-bold tabular-nums text-zinc-200">{o.total_price.toLocaleString("ru-RU")} ₸</span>
                {(o.bonuses_deducted > 0 || o.earned_bonuses > 0) && (
                  <p className="text-[10px] text-zinc-600 tabular-nums">
                    {o.bonuses_deducted > 0 && `-${o.bonuses_deducted}б`}
                    {o.bonuses_deducted > 0 && o.earned_bonuses > 0 && " "}
                    {o.earned_bonuses > 0 && `+${o.earned_bonuses}б`}
                  </p>
                )}
              </div>
              <div className="w-18 text-right flex-shrink-0">
                <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
                {o.refund_status && (
                  <p className="text-[10px] text-zinc-600">Возврат</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function GuestAddressesTab() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-sm font-medium text-zinc-400">Адреса и избранное</p>
      <p className="text-xs text-zinc-600">Эта функция будет добавлена в следующем обновлении платформы</p>
    </div>
  );
}

function GuestBonusesTab({
  transactions,
  balances,
  loading,
}: {
  transactions: BonusTx[];
  balances: GuestBalance[];
  loading: boolean;
}) {
  return (
    <>
      {balances.length > 0 && (
        <div className="px-5 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Текущий баланс</p>
          <div className="flex flex-wrap gap-2">
            {balances.map((b) => (
              <div key={b.restaurant_id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700">
                <span className="text-xs text-zinc-400 truncate max-w-[120px]">{b.restaurant_name}</span>
                <span className={`text-sm font-bold tabular-nums ${b.bonus_amount >= 0 ? "text-amber-400" : "text-red-400"}`}>
                  {b.bonus_amount >= 0 ? "+" : ""}{b.bonus_amount} ₸
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-zinc-600">История транзакций пуста</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800/60 sticky top-0 bg-zinc-900">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-32 flex-shrink-0">Дата</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex-1">Ресторан / Причина</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-20 text-right flex-shrink-0">Сумма</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider w-20 text-right flex-shrink-0">Баланс</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              const dt = new Date(tx.created_at);
              return (
                <div key={tx.id} className="flex items-center gap-2 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                  <div className="flex-shrink-0">{TX_ICONS[tx.type] ?? TX_ICONS.manual}</div>
                  <div className="w-28 flex-shrink-0">
                    <p className="text-xs text-zinc-300 tabular-nums">
                      {dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-zinc-600 tabular-nums">
                      {dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-300 truncate">{tx.restaurant_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {tx.description ?? TX_TYPE_LABELS[tx.type] ?? tx.type}
                      {tx.order_id && (
                        <span className="ml-1.5 text-zinc-700 font-mono">#{tx.order_id.slice(0, 8)}</span>
                      )}
                    </p>
                  </div>
                  <div className="w-20 text-right flex-shrink-0">
                    <span className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                  <div className="w-20 text-right flex-shrink-0">
                    <span className={`text-sm tabular-nums ${tx.balance_after >= 0 ? "text-zinc-300" : "text-red-400"}`}>
                      {tx.balance_after}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
