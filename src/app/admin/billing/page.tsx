"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Clock, MessageSquare } from "lucide-react";

interface BillingData {
  name: string;
  status: "paid" | "unpaid" | "overdue";
  dueDate: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  paid:    { label: "Оплачено",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", icon: CheckCircle2 },
  unpaid:  { label: "Не оплачено", color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-100 dark:bg-amber-500/15",    icon: Clock },
  overdue: { label: "Просрочено",  color: "text-red-600 dark:text-red-400",        bg: "bg-red-100 dark:bg-red-500/15",        icon: AlertTriangle },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
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

  const status = STATUS_MAP[data?.status ?? "unpaid"] ?? STATUS_MAP.unpaid;
  const StatusIcon = status.icon;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Оплата</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Статус подписки ScanServe</p>
        </div>

        {/* Status card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center shrink-0`}>
                <StatusIcon size={22} className={status.color} />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Статус подписки</p>
                <p className={`text-lg font-bold ${status.color}`}>{status.label}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Тариф</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Стандарт</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Ресторан</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{data?.name ?? "—"}</span>
              </div>

              {data?.dueDate && (
                <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Следующая оплата</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmtDate(data.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact section */}
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">По вопросам оплаты</p>
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

        {/* Info */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Как работает подписка</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Подписка на ScanServe даёт доступ ко всем функциям платформы: QR-меню, POS-терминал, аналитика, CRM, управление сотрудниками и многое другое. Оплата производится ежемесячно.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
