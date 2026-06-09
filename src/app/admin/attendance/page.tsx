"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Users, Clock, ChevronDown, X, Search,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

// ─── types ────────────────────────────────────────────────────────────────────

type StaffRole =
  | "owner" | "manager" | "cashier" | "waiter" | "chef"
  | "bartender" | "hostess" | "courier" | "cleaner" | "doorman"
  | "sommelier" | "senior_waiter" | "runner" | "storekeeper" | "accountant";

interface StaffUser {
  id: string;
  display_name: string | null;
  username: string;
  role: StaffRole;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | null;
  status: "active" | "completed";
  staff_users: StaffUser | null;
}

type Period = "today" | "week" | "month";

// ─── constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<StaffRole, string> = {
  owner:        "Владелец",
  manager:      "Менеджер",
  cashier:      "Кассир",
  waiter:       "Официант",
  senior_waiter:"Ст. официант",
  chef:         "Повар",
  bartender:    "Бармен",
  sommelier:    "Сомелье",
  hostess:      "Хостес",
  runner:       "Раннер",
  courier:      "Курьер",
  storekeeper:  "Кладовщик",
  accountant:   "Бухгалтер",
  cleaner:      "Уборщик",
  doorman:      "Швейцар",
};

const ROLE_COLOR: Record<StaffRole, string> = {
  owner:        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  manager:      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  cashier:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  waiter:       "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  senior_waiter:"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  chef:         "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  bartender:    "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  sommelier:    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  hostess:      "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  runner:       "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  courier:      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  storekeeper:  "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
  accountant:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  cleaner:      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  doorman:      "bg-stone-100 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300",
};

const FILTERABLE_ROLES: StaffRole[] = [
  "waiter", "senior_waiter", "chef", "bartender", "cashier",
  "hostess", "runner", "courier", "storekeeper", "accountant",
  "cleaner", "doorman", "sommelier",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function fmtHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}ч ${String(mins).padStart(2, "0")}м`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function periodDates(period: Period): { start: Date; end: Date } {
  const end = new Date();
  if (period === "today")  return { start: startOfToday(), end };
  if (period === "week")   return { start: startOfDaysAgo(6), end };
  return { start: startOfDaysAgo(29), end };
}

function employeeName(su: StaffUser | null) {
  return su?.display_name ?? su?.username ?? "—";
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { t } = useTranslations();

  const [records, setRecords]       = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState<Period>("today");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [search, setSearch]         = useState("");

  // ─── fetch ────────────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async (p: Period, role: StaffRole | "") => {
    setLoading(true);
    try {
      const { start, end } = periodDates(p);
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (role) params.set("role", role);
      const res = await fetch(`/api/admin/attendance?${params}`);
      if (!res.ok) { toast.error("Ошибка загрузки"); return; }
      const data = await res.json() as { records: AttendanceRecord[] };
      setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords(period, roleFilter);
  }, [period, roleFilter, fetchRecords]);

  // ─── derived ──────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? records.filter((r) => {
        const name = employeeName(r.staff_users).toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : records;

  const totalHours = filtered.reduce((acc, r) => acc + (r.total_hours ?? 0), 0);
  const onShiftNow = filtered.filter((r) => r.status === "active").length;

  // ─── ui ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">

      {/* ── Desktop header ────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t.admin.attendanceTitle}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{t.admin.descAttendance}</p>
        </div>
        <button
          onClick={() => fetchRecords(period, roleFilter)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* ── Mobile header ─────────────────────────────────────────────────── */}
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/60 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{t.admin.attendanceTitle}</h1>
        <button onClick={() => fetchRecords(period, roleFilter)} disabled={loading}>
          <RefreshCw size={16} className={`text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/60 px-4 md:px-8 py-3 space-y-2.5">
        {/* Period pills */}
        <div className="flex gap-2">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {p === "today" ? t.admin.attendanceToday : p === "week" ? t.admin.attendanceWeek : t.admin.attendanceMonth}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.admin.attendanceFilterAll}
              className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border-0 outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={13} className="text-zinc-400" />
              </button>
            )}
          </div>

          {/* Role filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as StaffRole | "")}
              className="appearance-none pl-3 pr-7 py-2 text-sm bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border-0 outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-800 dark:text-zinc-200"
            >
              <option value="">Все роли</option>
              {FILTERABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Summary row ───────────────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-3 gap-3 px-4 md:px-8 py-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 px-3 py-2.5 text-center">
          <p className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-100">{filtered.length}</p>
          <p className="text-[10px] text-zinc-400 font-medium">Записей</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 px-3 py-2.5 text-center">
          <p className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-100">
            {totalHours.toFixed(1)}
          </p>
          <p className="text-[10px] text-zinc-400 font-medium">{t.admin.attendanceTotalHours}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            {onShiftNow > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            <p className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-100">{onShiftNow}</p>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium">На смене</p>
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Desktop table */}
        <div className="hidden md:block px-8 pb-8">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-zinc-400">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{t.admin.attendanceNoRecords}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceDate}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceEmployee}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceCheckIn}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceCheckOut}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceHours}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{t.admin.attendanceStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rec, i) => {
                    const su = rec.staff_users;
                    return (
                      <tr
                        key={rec.id}
                        className={`border-b border-zinc-100 dark:border-zinc-800/40 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors ${i % 2 === 0 ? "" : "bg-zinc-50/40 dark:bg-zinc-900/20"}`}
                      >
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {fmtDate(rec.check_in)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 select-none shrink-0">
                              {(employeeName(su))[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-800 dark:text-zinc-200 leading-tight">{employeeName(su)}</p>
                              {su?.role && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ROLE_COLOR[su.role]}`}>
                                  {ROLE_LABEL[su.role]}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">
                          {fmtTime(rec.check_in)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                          {rec.check_out ? fmtTime(rec.check_out) : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-zinc-700 dark:text-zinc-300">
                          {rec.total_hours != null ? fmtHours(rec.total_hours) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {rec.status === "active" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {t.admin.attendanceStatusActive}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded-full">
                              {t.admin.attendanceStatusCompleted}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden px-4 py-3 space-y-2.5 pb-24">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800/40 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-zinc-400">
              <Clock size={36} className="mb-3 opacity-30" />
              <p className="text-sm">{t.admin.attendanceNoRecords}</p>
            </div>
          ) : (
            filtered.map((rec) => {
              const su = rec.staff_users;
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 select-none shrink-0">
                        {(employeeName(su))[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{employeeName(su)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {su?.role && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ROLE_COLOR[su.role]}`}>
                              {ROLE_LABEL[su.role]}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400">{fmtDate(rec.check_in)}</span>
                        </div>
                      </div>
                    </div>

                    {rec.status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {t.admin.attendanceStatusActive}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-1 rounded-full shrink-0">
                        {t.admin.attendanceStatusCompleted}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/40">
                    <div className="text-center">
                      <p className="text-xs text-zinc-400">{t.admin.attendanceCheckIn}</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{fmtTime(rec.check_in)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-zinc-400">{t.admin.attendanceCheckOut}</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                        {rec.check_out ? fmtTime(rec.check_out) : "—"}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-zinc-400">{t.admin.attendanceHours}</p>
                      <p className="text-sm font-bold tabular-nums text-violet-600 dark:text-violet-400">
                        {rec.total_hours != null ? fmtHours(rec.total_hours) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
