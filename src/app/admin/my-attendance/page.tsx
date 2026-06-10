"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTranslations } from "@/lib/i18n";

const QrScannerModal = dynamic(() => import("@/components/admin/QrScannerModal"), { ssr: false });

// ─── types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | null;
  status: "active" | "completed";
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function useElapsed(checkIn: string | null) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!checkIn) { setElapsed(""); return; }

    function tick() {
      const ms = Date.now() - new Date(checkIn!).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  return elapsed;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MyAttendancePage() {
  const { t } = useTranslations();
  const [active, setActive]     = useState<AttendanceRecord | null>(null);
  const [history, setHistory]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState<"checkin" | "checkout" | null>(null);
  const [busy, setBusy]         = useState(false);
  const elapsed = useElapsed(active?.check_in ?? null);

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

  async function handleScan(qrToken: string) {
    const mode = scanning;
    setScanning(null);
    setBusy(true);
    try {
      const url = mode === "checkin"
        ? "/api/admin/attendance/checkin"
        : "/api/admin/attendance/checkout";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json() as { attendance?: AttendanceRecord; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка");
        return;
      }
      if (mode === "checkin") {
        setActive(data.attendance ?? null);
        setHistory((prev) => [data.attendance!, ...prev].filter(Boolean));
        toast.success("Смена начата!");
      } else {
        // Clear active state directly from confirmed API response — do NOT re-fetch
        // (re-fetching risks race-condition restoring old "active" record)
        setActive(null);
        if (data.attendance) {
          setHistory((prev) =>
            prev.map((r) => r.id === data.attendance!.id ? data.attendance! : r)
          );
        }
        const fin = data.attendance;
        if (fin?.total_hours != null) {
          toast.success(`Смена завершена. Отработано: ${fmtHours(fin.total_hours)}`);
        } else {
          toast.success("Смена завершена!");
        }
        // Reload history after a short delay so the DB record is visible
        setTimeout(() => { void loadStatus(); }, 600);
      }
    } finally {
      setBusy(false);
    }
  }

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

            {/* Timer */}
            <div className="flex items-center gap-3 mb-5">
              <Clock size={20} className="text-emerald-500 shrink-0" />
              <span className="text-3xl font-black tabular-nums text-emerald-700 dark:text-emerald-300 tracking-tight">
                {elapsed}
              </span>
            </div>

            <button
              onClick={() => setScanning("checkout")}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white text-sm font-bold transition-all disabled:opacity-60"
            >
              <LogOut size={16} />
              {t.admin.attendanceEndShift}
            </button>
            <p className="text-center text-xs text-emerald-600 dark:text-emerald-500 mt-2">
              {t.admin.attendanceScanEnd}
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              {t.admin.attendanceScanStart}
            </p>

            <button
              onClick={() => setScanning("checkin")}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-bold transition-all disabled:opacity-60"
            >
              <LogIn size={16} />
              {t.admin.attendanceStartShift}
            </button>
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

      {/* QR Scanner */}
      {scanning && (
        <QrScannerModal
          title={scanning === "checkin" ? t.admin.attendanceStartShift : t.admin.attendanceEndShift}
          hint={scanning === "checkin" ? t.admin.attendanceScanStart : t.admin.attendanceScanEnd}
          onScan={handleScan}
          onClose={() => setScanning(null)}
        />
      )}
    </div>
  );
}
