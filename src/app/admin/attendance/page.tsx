"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { isConfigured } from "@/lib/supabase";

interface StaffRow {
  id: string;
  display_name: string | null;
  username: string;
  role: string;
  daily_rate: number;
  commission_pct: number;
}

interface AttRecord {
  id: string;
  employee_id: string;
  check_in: string;
  source: string | null;
}

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function staffName(s: StaffRow): string {
  return s.display_name || s.username || "—";
}

export default function AttendancePage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [commPcts, setCommPcts] = useState<Record<string, number>>({});
  const [commTotals, setCommTotals] = useState<Record<string, number>>({});
  const [rateEditing, setRateEditing] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [commEditing, setCommEditing] = useState<string | null>(null);
  const [commInput, setCommInput] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const totalDays = daysInMonth(year, mon);
  const today = dateKey(new Date());

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const monthStart = `${year}-${String(mon + 1).padStart(2, "0")}-01T00:00:00`;
    const monthEnd = `${year}-${String(mon + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}T23:59:59`;

    try {
      const res = await fetch(`/api/admin/attendance/grid?start=${encodeURIComponent(monthStart)}&end=${encodeURIComponent(monthEnd)}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json() as { staff: StaffRow[]; records: AttRecord[]; commissions: Record<string, number> };
      setStaff(data.staff);
      setRecords(data.records);
      const r: Record<string, number> = {};
      const c: Record<string, number> = {};
      for (const s of data.staff) {
        r[s.id] = s.daily_rate ?? 0;
        c[s.id] = s.commission_pct ?? 0;
      }
      setRates(r);
      setCommPcts(c);
      setCommTotals(data.commissions ?? {});
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, mon, totalDays]);

  useEffect(() => { load(); }, [load]);

  const presentMap = new Map<string, Map<number, string>>();
  for (const rec of records) {
    const d = new Date(rec.check_in);
    const day = d.getDate();
    if (!presentMap.has(rec.employee_id)) presentMap.set(rec.employee_id, new Map());
    const src = rec.source ?? "shift";
    const existing = presentMap.get(rec.employee_id)!.get(day);
    if (!existing || src === "shift") presentMap.get(rec.employee_id)!.set(day, src);
  }

  function isPresent(empId: string, day: number): boolean {
    return presentMap.get(empId)?.has(day) ?? false;
  }

  function getSource(empId: string, day: number): string {
    return presentMap.get(empId)?.get(day) ?? "shift";
  }

  async function toggleDay(empId: string, day: number) {
    const dk = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const present = !isPresent(empId, day);
    const key = `${empId}-${day}`;
    setToggling(key);

    if (present) {
      if (!presentMap.has(empId)) presentMap.set(empId, new Map());
      presentMap.get(empId)!.set(day, "manual");
    } else {
      presentMap.get(empId)?.delete(day);
    }
    setRecords([...records]);

    await fetch("/api/admin/attendance/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: empId, date: dk, present }),
    });
    setToggling(null);
    load();
  }

  async function saveRate(empId: string) {
    const val = parseInt(rateInput, 10);
    if (isNaN(val) || val < 0) { setRateEditing(null); return; }
    setRates(prev => ({ ...prev, [empId]: val }));
    setRateEditing(null);
    await fetch("/api/admin/staff/daily-rate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: empId, dailyRate: val }),
    });
    toast.success("Ставка сохранена");
  }

  async function saveComm(empId: string) {
    const val = parseFloat(commInput);
    if (isNaN(val) || val < 0) { setCommEditing(null); return; }
    const clamped = Math.min(100, val);
    setCommPcts(prev => ({ ...prev, [empId]: clamped }));
    setCommEditing(null);
    await fetch("/api/admin/staff/daily-rate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: empId, commissionPct: clamped }),
    });
    toast.success("Процент сохранён");
  }

  function prevMonth() { setMonth(new Date(year, mon - 1, 1)); }
  function nextMonth() { setMonth(new Date(year, mon + 1, 1)); }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-lg font-bold">Табель</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{MONTH_NAMES[mon]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 py-20">
          <p className="text-sm">Нет сотрудников</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-background border-b border-r border-border px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[120px]">
                  Сотрудник
                </th>
                <th className="border-b border-r border-border px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground min-w-[70px]">
                  ₸/день
                </th>
                <th className="border-b border-r border-border px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground min-w-[45px]">
                  %
                </th>
                {Array.from({ length: totalDays }, (_, i) => {
                  const d = new Date(year, mon, i + 1);
                  const dk = dateKey(d);
                  const isToday = dk === today;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th
                      key={i}
                      className={`border-b border-r border-border px-0 py-1 text-center min-w-[34px] ${isToday ? "bg-violet-100 dark:bg-violet-900/30" : isWeekend ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                    >
                      <div className="text-[8px] text-muted-foreground leading-none">{DAY_NAMES[d.getDay()]}</div>
                      <div className={`text-[11px] font-bold leading-tight ${isToday ? "text-violet-600 dark:text-violet-400" : ""}`}>{i + 1}</div>
                    </th>
                  );
                })}
                <th className="border-b border-r border-border px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground min-w-[35px]">Дн</th>
                <th className="border-b border-r border-border px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[80px]">Зарплата</th>
                <th className="border-b border-r border-border px-2 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[80px]">Комиссия</th>
                <th className="border-b border-border px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground min-w-[90px]">Итого</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const presentDays = presentMap.get(s.id)?.size ?? 0;
                const rate = rates[s.id] ?? 0;
                const pct = commPcts[s.id] ?? 0;
                const salary = presentDays * rate;
                const commission = commTotals[s.id] ?? 0;
                const total = salary + commission;

                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-background border-b border-r border-border px-3 py-1.5">
                      <p className="text-[11px] font-semibold truncate max-w-[110px]">{staffName(s)}</p>
                    </td>
                    <td className="border-b border-r border-border px-1 py-1 text-center">
                      {rateEditing === s.id ? (
                        <input
                          autoFocus
                          type="number"
                          min={0}
                          value={rateInput}
                          onChange={e => setRateInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveRate(s.id); if (e.key === "Escape") setRateEditing(null); }}
                          onBlur={() => saveRate(s.id)}
                          className="w-14 px-1 py-0.5 text-[11px] text-center rounded border border-violet-400 bg-background focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setRateEditing(s.id); setRateInput(String(rate)); }}
                          className="text-[11px] tabular-nums text-muted-foreground hover:text-foreground transition-colors px-1"
                        >
                          {rate > 0 ? rate.toLocaleString("ru-RU") : "—"}
                        </button>
                      )}
                    </td>
                    <td className="border-b border-r border-border px-1 py-1 text-center">
                      {commEditing === s.id ? (
                        <input
                          autoFocus
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={commInput}
                          onChange={e => setCommInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveComm(s.id); if (e.key === "Escape") setCommEditing(null); }}
                          onBlur={() => saveComm(s.id)}
                          className="w-12 px-1 py-0.5 text-[11px] text-center rounded border border-emerald-400 bg-background focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setCommEditing(s.id); setCommInput(String(pct)); }}
                          className="text-[11px] tabular-nums text-muted-foreground hover:text-foreground transition-colors px-1"
                        >
                          {pct > 0 ? `${pct}%` : "—"}
                        </button>
                      )}
                    </td>
                    {Array.from({ length: totalDays }, (_, i) => {
                      const day = i + 1;
                      const present = isPresent(s.id, day);
                      const d = new Date(year, mon, day);
                      const dk = dateKey(d);
                      const isToday = dk === today;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const cellKey = `${s.id}-${day}`;

                      return (
                        <td
                          key={i}
                          onClick={() => toggleDay(s.id, day)}
                          className={`border-b border-r border-border text-center cursor-pointer select-none transition-colors ${
                            present && getSource(s.id, day) === "shift"
                              ? "bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                              : present && getSource(s.id, day) === "manual"
                              ? "bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                              : isToday
                              ? "bg-violet-50 dark:bg-violet-900/10 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                              : isWeekend
                              ? "bg-red-50/50 dark:bg-red-900/5 hover:bg-red-100 dark:hover:bg-red-900/20"
                              : "hover:bg-muted/40"
                          }`}
                          style={{ minWidth: 34, height: 32 }}
                        >
                          {toggling === cellKey ? (
                            <Loader2 size={10} className="animate-spin mx-auto text-muted-foreground" />
                          ) : present ? (
                            <Check size={13} className={`mx-auto ${getSource(s.id, day) === "manual" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="border-b border-r border-border px-2 py-1 text-center text-[11px] font-bold tabular-nums">
                      {presentDays}
                    </td>
                    <td className="border-b border-r border-border px-2 py-1 text-right text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {salary > 0 ? salary.toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="border-b border-r border-border px-2 py-1 text-right text-[12px] font-bold tabular-nums text-violet-600 dark:text-violet-400">
                      {commission > 0 ? commission.toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="border-b border-border px-3 py-1 text-right text-[12px] font-bold tabular-nums text-foreground">
                      {total > 0 ? total.toLocaleString("ru-RU") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/30 border-t border-r border-border px-3 py-2 text-[11px] font-semibold" colSpan={3}>
                  Итого
                </td>
                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const count = staff.filter(s => isPresent(s.id, day)).length;
                  return (
                    <td key={i} className="border-t border-r border-border text-center text-[10px] font-semibold text-muted-foreground py-1">
                      {count > 0 ? count : ""}
                    </td>
                  );
                })}
                <td className="border-t border-r border-border px-2 py-2 text-center text-[11px] font-bold">
                  {staff.reduce((s, emp) => s + (presentMap.get(emp.id)?.size ?? 0), 0)}
                </td>
                <td className="border-t border-r border-border px-2 py-2 text-right text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  {staff.reduce((s, emp) => s + (presentMap.get(emp.id)?.size ?? 0) * (rates[emp.id] ?? 0), 0).toLocaleString("ru-RU")} ₸
                </td>
                <td className="border-t border-r border-border px-2 py-2 text-right text-[12px] font-bold text-violet-600 dark:text-violet-400">
                  {staff.reduce((s, emp) => s + (commTotals[emp.id] ?? 0), 0).toLocaleString("ru-RU")} ₸
                </td>
                <td className="border-t border-border px-3 py-2 text-right text-[12px] font-bold">
                  {staff.reduce((s, emp) => {
                    const salary = (presentMap.get(emp.id)?.size ?? 0) * (rates[emp.id] ?? 0);
                    return s + salary + (commTotals[emp.id] ?? 0);
                  }, 0).toLocaleString("ru-RU")} ₸
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
