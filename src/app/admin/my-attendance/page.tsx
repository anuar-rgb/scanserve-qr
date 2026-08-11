"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | null;
  status: "active" | "completed";
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function fmtHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs} ч. ${String(mins).padStart(2, "0")} мин.`;
}


export default function MyAttendancePage() {
  const { t } = useTranslations();
  const [active, setActive]     = useState<AttendanceRecord | null>(null);
  const [history, setHistory]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch("/api/admin/attendance/my-status"),
        fetch(`/api/admin/attendance/my-history`),
      ]);
      if (statusRes.ok) {
        const d = await statusRes.json() as { attendance: AttendanceRecord | null };
        setActive(d.attendance);
      }
      if (historyRes.ok) {
        const d = await historyRes.json() as { records: AttendanceRecord[] };
        setHistory(d.records ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // Auto-refresh every 30s to pick up changes from shift checkin/checkout
  useEffect(() => {
    const id = setInterval(() => { void loadStatus(); }, 30_000);
    return () => clearInterval(id);
  }, [loadStatus]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/60 px-4 py-3">
        <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          {t.admin.navMyAttendance}
        </h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Status card */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 p-5 animate-pulse">
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        ) : active ? (
          /* On shift */
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t.admin.attendanceStatusActive}
              </span>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
              {t.admin.attendanceOnShift} · {t.admin.attendanceCheckIn}: {fmtTime(active.check_in)}
            </p>

          </div>
        ) : (
          /* Not on shift */
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {t.admin.attendanceNotOnShift}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              {t.admin.attendanceScanStart}
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-xs font-medium">
              <Info size={14} className="shrink-0" />
              Сканируйте QR на входе для начала смены
            </div>
          </div>
        )}

        {/* Today's history */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 p-5">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
              {t.admin.attendanceTodayHistory}
            </p>
            <div className="space-y-2">
              {history.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-100 dark:border-zinc-800/40 last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    {rec.status === "completed" ? (
                      <CheckCircle2 size={15} className="text-zinc-400 shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="text-emerald-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {fmtTime(rec.check_in)} — {rec.check_out ? fmtTime(rec.check_out) : "…"}
                      </p>
                      <p className="text-xs text-zinc-400">{fmtDate(rec.check_in)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {rec.total_hours != null ? (
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {fmtHours(rec.total_hours)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {t.admin.attendanceStatusActive}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
