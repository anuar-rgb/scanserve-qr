"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Clock, MessageSquare, Users, ShoppingBag, Zap } from "lucide-react";

interface Plan {
  name: string;
  monthly_price: number;
  max_staff: number;
  max_orders_month: number;
  features: string[];
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string | null;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface BillingData {
  name: string;
  status: "paid" | "unpaid" | "overdue";
  dueDate: string | null;
  plan: Plan;
  payments: Payment[];
  usage: { staff: number; ordersThisMonth: number };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  paid:    { label: "Оплачено",    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10",  border: "border-emerald-200 dark:border-emerald-500/20", icon: CheckCircle2 },
  unpaid:  { label: "Не оплачено", color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-500/10",     border: "border-amber-200 dark:border-amber-500/20",    icon: Clock },
  overdue: { label: "Просрочено",  color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-500/10",         border: "border-red-200 dark:border-red-500/20",        icon: AlertTriangle },
};

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: "Оплачен", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" },
  pending:   { label: "Ожидает", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10" },
  failed:    { label: "Ошибка",  color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10" },
  refunded:  { label: "Возврат", color: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-800" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtPrice(n: number) {
  return n.toLocaleString("ru-RU") + " ₸";
}

function usagePct(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/billing");
      if (res.ok) setData(await res.json() as BillingData);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!data) return null;

  const st = STATUS_CFG[data.status] ?? STATUS_CFG.unpaid;
  const StIcon = st.icon;
  const plan = data.plan;
  const staffPct = usagePct(data.usage.staff, plan.max_staff);
  const ordersPct = usagePct(data.usage.ordersThisMonth, plan.max_orders_month);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Оплата</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Подписка и биллинг ScanServe</p>
        </div>

        {/* ── Status + Plan card ── */}
        <div className={`rounded-2xl border ${st.border} ${st.bg} p-5`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-11 h-11 rounded-xl bg-white/80 dark:bg-zinc-900/50 flex items-center justify-center shrink-0`}>
              <StIcon size={22} className={st.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-lg font-bold ${st.color}`}>{st.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Тариф: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{plan.name}</span>
                {" · "}
                {fmtPrice(plan.monthly_price)}/мес
              </p>
            </div>
          </div>

          {data.dueDate && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 dark:bg-zinc-900/40">
              <Clock size={14} className="text-zinc-400 shrink-0" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Следующая оплата: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmtDate(data.dueDate)}</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Usage ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Использование</p>
          <div className="grid grid-cols-1 gap-4">
            <UsageBar icon={Users} label="Сотрудники" used={data.usage.staff} max={plan.max_staff} pct={staffPct} />
          </div>
        </div>

        {/* ── Features ── */}
        {plan.features.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Включено в тариф</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(plan.features as string[]).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Zap size={12} className="text-violet-500 shrink-0" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Payment history ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">История платежей</p>
          </div>
          {data.payments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Нет платежей</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.payments.map((p) => {
                const pst = PAY_STATUS[p.status] ?? PAY_STATUS.completed;
                return (
                  <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {fmtPrice(p.amount)}
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {fmtDate(p.period_start)} — {fmtDate(p.period_end)}
                        {p.payment_method && ` · ${p.payment_method}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pst.color}`}>
                      {pst.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Contact ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="text-violet-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">По вопросам оплаты</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
                Свяжитесь с нами для продления подписки, смены тарифа или получения счёта.
              </p>
              <a
                href="https://wa.me/77789651312"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                <MessageSquare size={16} />
                Написать в WhatsApp
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function UsageBar({ icon: Icon, label, used, max, pct }: { icon: typeof Users; label: string; used: number; max: number; pct: number }) {
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className="text-zinc-400 shrink-0" />
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{used}</span>
        <span className="text-xs text-zinc-400">/ {max > 0 ? max : "∞"}</span>
      </div>
      {max > 0 && (
        <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
