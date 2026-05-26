"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Bell, Send, RefreshCw, Loader2, CheckCircle2, Phone, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsOwner } from "@/lib/role-context";

// ─── types ────────────────────────────────────────────────────────────────────

interface CrmClient {
  id: string;
  phone: string | null;
  name: string | null;
  push_subscription: Record<string, unknown> | null;
  created_at: string;
  last_visit: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const isOwner = useIsOwner();

  const [clients, setClients]     = useState<CrmClient[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);

  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [sending, setSending]     = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/clients?limit=200");
    if (res.ok) {
      const json = await res.json();
      setClients(json.clients ?? []);
      setTotal(json.total ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const subscribedCount = clients.filter((c) => c.push_subscription !== null).length;

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast.error("Введите заголовок и текст сообщения");
      return;
    }
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/crm/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), body: body.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setSendResult({ sent: json.sent, failed: json.failed });
      toast.success(`Отправлено: ${json.sent}. Ошибок: ${json.failed}`);
    } else {
      toast.error("Ошибка при отправке");
    }
    setSending(false);
  }

  if (!isOwner) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Раздел доступен только владельцу.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto admin-scroll p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Мини-CRM / Рассылки</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            База гостей и Web Push уведомления
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
            <Users size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Гостей</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{total}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-violet-500 mb-1">
            <Bell size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Подписок</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{subscribedCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <Phone size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">С телефоном</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {clients.filter((c) => c.phone).length}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── Send push form ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-violet-500 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Отправить рассылку</h2>
          </div>

          <div className="space-y-1">
            <Label htmlFor="push-title" className="text-xs">Заголовок</Label>
            <Input
              id="push-title"
              placeholder="Пример: Акция дня!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="push-body" className="text-xs">Текст сообщения</Label>
            <textarea
              id="push-body"
              rows={3}
              placeholder="Пример: Скидка 20% на все блюда сегодня до 22:00."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 resize-none"
            />
            <p className="text-[11px] text-zinc-400 text-right">{body.length}/200</p>
          </div>

          {sendResult && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 size={13} className="shrink-0" />
              Отправлено: {sendResult.sent} · Ошибок: {sendResult.failed}
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || subscribedCount === 0}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          >
            {sending
              ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Отправка…</>
              : <>Запустить рассылку ({subscribedCount} подписчиков)</>
            }
          </Button>

          {subscribedCount === 0 && !loading && (
            <p className="text-xs text-zinc-400 text-center">
              Нет подписчиков с активными push-подписками.
            </p>
          )}
        </div>

        {/* ── Clients table ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Users size={14} className="text-zinc-400 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex-1">
              Клиенты
            </h2>
            {loading && <Loader2 size={12} className="animate-spin text-zinc-400" />}
          </div>

          {!loading && clients.length === 0 && (
            <div className="p-8 text-center">
              <Users size={28} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-400">Нет клиентов</p>
              <p className="text-xs text-zinc-400 mt-1">
                Гости появятся после первой подписки на уведомления.
              </p>
            </div>
          )}

          {clients.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-5 py-2.5">Телефон / ID</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-3 py-2.5">Push</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-3 py-2.5">Последний визит</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
                            <Users size={11} className="text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {c.name && (
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{c.name}</p>
                            )}
                            {c.phone ? (
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight tabular-nums">
                                {c.phone}
                              </p>
                            ) : (
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight italic">
                                📱 Номер не указан
                              </p>
                            )}
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono leading-tight">
                              {c.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {c.push_subscription ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Bell size={11} />
                            <span className="text-[11px] font-semibold">Да</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <BellOff size={11} />
                            <span className="text-[11px]">Нет</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {fmtDate(c.last_visit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
