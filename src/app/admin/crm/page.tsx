"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Bell, Send, RefreshCw, Loader2, CheckCircle2, Phone, BellOff, ChevronDown, Copy, Check, Pencil, X, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsOwner, useIsStrictOwner } from "@/lib/role-context";
import { RESTAURANT_ID } from "@/constants";

// ─── types ────────────────────────────────────────────────────────────────────

interface CrmClient {
  id: string;
  phone: string | null;
  name: string | null;
  push_subscription: Record<string, unknown> | null;
  created_at: string;
  last_visit: string;
  guest_id: string | null;
}

interface BonusEntry {
  guestId: string | null;
  bonusAmount: number | null;
  loading: boolean;
  editing: boolean;
  editValue: string;
  saving: boolean;
}

type ClientTab = "registered" | "anonymous";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const isOwner = useIsOwner();
  const isStrictOwner = useIsStrictOwner();

  const [clients, setClients]     = useState<CrmClient[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [clientTab, setClientTab] = useState<ClientTab>("registered");

  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [sending, setSending]     = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [copiedId, setCopiedId]   = useState<string | null>(null);
  const [bonusMap, setBonusMap]   = useState<Map<string, BonusEntry>>(new Map());

  // Split clients into two groups
  const registeredClients = clients.filter(c => c.guest_id !== null);
  const anonymousClients  = clients.filter(c => c.guest_id === null);
  const visibleClients    = clientTab === "registered" ? registeredClients : anonymousClients;

  // Only registered guests with push count toward the broadcast
  const subscribedCount = registeredClients.filter(c => c.push_subscription !== null).length;

  function toggleClient(id: string) {
    setExpandedClientId((prev) => (prev === id ? null : id));
  }

  async function fetchBonus(phone: string) {
    setBonusMap((m) => {
      const next = new Map(m);
      next.set(phone, { guestId: null, bonusAmount: null, loading: true, editing: false, editValue: "", saving: false });
      return next;
    });
    const res = await fetch(`/api/crm/guest-bonus?phone=${encodeURIComponent(phone)}&restaurantId=${RESTAURANT_ID}`);
    if (res.ok) {
      const json = await res.json() as { guestId: string | null; bonusAmount: number | null };
      setBonusMap((m) => {
        const next = new Map(m);
        next.set(phone, { guestId: json.guestId, bonusAmount: json.bonusAmount, loading: false, editing: false, editValue: String(json.bonusAmount ?? 0), saving: false });
        return next;
      });
    } else {
      setBonusMap((m) => {
        const next = new Map(m);
        next.set(phone, { guestId: null, bonusAmount: null, loading: false, editing: false, editValue: "", saving: false });
        return next;
      });
    }
  }

  async function saveBonus(phone: string) {
    const entry = bonusMap.get(phone);
    if (!entry?.guestId) return;
    const newAmount = parseInt(entry.editValue, 10);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error("Введите корректную сумму");
      return;
    }
    setBonusMap((m) => { const next = new Map(m); next.set(phone, { ...entry, saving: true }); return next; });
    const res = await fetch("/api/crm/guest-bonus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: entry.guestId, restaurantId: RESTAURANT_ID, newAmount }),
    });
    if (res.ok) {
      setBonusMap((m) => { const next = new Map(m); next.set(phone, { ...entry, bonusAmount: newAmount, editValue: String(newAmount), editing: false, saving: false }); return next; });
      toast.success("Баланс обновлён");
    } else {
      toast.error("Ошибка при обновлении баланса");
      setBonusMap((m) => { const next = new Map(m); next.set(phone, { ...entry, saving: false }); return next; });
    }
  }

  async function copyToClipboard(text: string, clientId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(clientId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch { /* ignore */ }
  }

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

  useEffect(() => {
    if (!expandedClientId) return;
    const client = clients.find((c) => c.id === expandedClientId);
    if (!client?.phone) return;
    if (bonusMap.has(client.phone)) return;
    fetchBonus(client.phone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedClientId, clients]);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-violet-500 mb-1">
            <ShieldCheck size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Зарег.</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{registeredClients.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-violet-500 mb-1">
            <Bell size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Подписок</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{subscribedCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <UserX size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Анонимных</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{anonymousClients.length}</p>
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

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20">
            <ShieldCheck size={12} className="text-violet-500 shrink-0" />
            <p className="text-[11px] text-violet-700 dark:text-violet-400">
              Рассылка отправляется только зарегистрированным гостям с активной push-подпиской
            </p>
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
              Нет зарегистрированных гостей с активными push-подписками.
            </p>
          )}
        </div>

        {/* ── Clients table ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">

          {/* Panel header */}
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Users size={14} className="text-zinc-400 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex-1">Клиенты</h2>
            {loading && <Loader2 size={12} className="animate-spin text-zinc-400" />}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-4 pt-2 gap-1">
            <button
              onClick={() => { setClientTab("registered"); setExpandedClientId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
                clientTab === "registered"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <ShieldCheck size={11} className="text-violet-500" />
              Зарегистрированные
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 text-[10px] font-bold">
                {registeredClients.length}
              </span>
            </button>
            <button
              onClick={() => { setClientTab("anonymous"); setExpandedClientId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
                clientTab === "anonymous"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <UserX size={11} className="text-zinc-400" />
              Анонимные
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold">
                {anonymousClients.length}
              </span>
            </button>
          </div>

          {/* Empty state */}
          {!loading && visibleClients.length === 0 && (
            <div className="p-8 text-center flex-1">
              {clientTab === "registered" ? (
                <>
                  <ShieldCheck size={28} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-400">Нет зарегистрированных гостей</p>
                  <p className="text-xs text-zinc-400 mt-1">Гости появятся после регистрации в системе лояльности.</p>
                </>
              ) : (
                <>
                  <UserX size={28} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-400">Нет анонимных гостей</p>
                  <p className="text-xs text-zinc-400 mt-1">Сюда попадают телефоны из заказов без аккаунта.</p>
                </>
              )}
            </div>
          )}

          {/* Table */}
          {visibleClients.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-5 py-2.5">
                    {clientTab === "registered" ? "Гость" : "Телефон / ID"}
                  </th>
                  {clientTab === "registered" && (
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-3 py-2.5">Push</th>
                  )}
                  <th className="hidden sm:table-cell text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-3 py-2.5">Последний визит</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((c) => {
                  const isExpanded = expandedClientId === c.id;
                  const isCopied   = copiedId === c.id;
                  return (
                    <>
                      <tr
                        key={c.id}
                        onClick={() => toggleClient(c.id)}
                        className={`border-b border-zinc-50 dark:border-zinc-800/50 cursor-pointer transition-colors ${isExpanded ? "bg-zinc-50 dark:bg-zinc-800/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              clientTab === "registered"
                                ? "bg-violet-100 dark:bg-violet-500/15"
                                : "bg-zinc-100 dark:bg-zinc-800"
                            }`}>
                              {clientTab === "registered"
                                ? <ShieldCheck size={11} className="text-violet-600 dark:text-violet-400" />
                                : <UserX size={11} className="text-zinc-400" />
                              }
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
                                  Номер не указан
                                </p>
                              )}
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono leading-tight">
                                {c.id.slice(0, 8)}…
                              </p>
                            </div>
                          </div>
                        </td>

                        {clientTab === "registered" && (
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
                        )}

                        <td className="hidden sm:table-cell px-3 py-3">
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {fmtDate(c.last_visit)}
                          </span>
                        </td>
                        <td className="pr-3 py-3">
                          <ChevronDown
                            size={14}
                            className={`text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${c.id}-expanded`} className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800">
                          <td colSpan={clientTab === "registered" ? 4 : 3} className="px-5 pb-4 pt-2">
                            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 p-3 space-y-3">
                              {/* Phone */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Телефон</p>
                                {c.phone ? (
                                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{c.phone}</p>
                                ) : (
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Не указан</p>
                                )}
                              </div>
                              {/* Full ID */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">ID клиента</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 break-all select-all flex-1">{c.id}</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(c.id, c.id); }}
                                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-[11px] font-medium text-zinc-600 dark:text-zinc-300"
                                  >
                                    {isCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    {isCopied ? "Скопировано" : "Копировать"}
                                  </button>
                                </div>
                              </div>

                              {/* Guest profile — registered only */}
                              {c.guest_id && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20">
                                  <ShieldCheck size={13} className="text-violet-500 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 leading-none mb-0.5">Зарегистрированный гость</p>
                                    <p className="text-[11px] font-mono text-violet-500 dark:text-violet-400 truncate">{c.guest_id}</p>
                                  </div>
                                </div>
                              )}

                              {/* Last visit — mobile */}
                              <div className="sm:hidden">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Последний визит</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmtDate(c.last_visit)}</p>
                              </div>

                              {/* Push status — registered only */}
                              {clientTab === "registered" && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Push-подписка</p>
                                  {c.push_subscription ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                                      <Bell size={10} /> Активна
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-[11px]">
                                      <BellOff size={10} /> Нет подписки
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Bonus balance */}
                              {c.phone && (() => {
                                const bonus = bonusMap.get(c.phone!);
                                return (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Бонусный баланс</p>
                                    {bonus?.loading && (
                                      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                        <Loader2 size={11} className="animate-spin" /> Загрузка…
                                      </span>
                                    )}
                                    {!bonus?.loading && bonus?.guestId === null && bonus?.bonusAmount === null && (
                                      <span className="text-[11px] text-zinc-400 italic">Гость не зарегистрирован в системе лояльности</span>
                                    )}
                                    {!bonus?.loading && bonus?.guestId && !bonus.editing && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                                          {(bonus.bonusAmount ?? 0).toLocaleString("ru-RU")} ₸
                                        </span>
                                        {isStrictOwner && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setBonusMap((m) => { const next = new Map(m); next.set(c.phone!, { ...bonus, editing: true, editValue: String(bonus.bonusAmount ?? 0) }); return next; });
                                            }}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-[11px] font-medium text-zinc-600 dark:text-zinc-300"
                                          >
                                            <Pencil size={10} /> Изменить
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {isStrictOwner && !bonus?.loading && bonus?.guestId && bonus.editing && (
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="number"
                                          min="0"
                                          value={bonus.editValue}
                                          onChange={(e) => setBonusMap((m) => { const next = new Map(m); next.set(c.phone!, { ...bonus, editValue: e.target.value }); return next; })}
                                          className="w-28 px-2 py-1 text-sm font-semibold tabular-nums rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        />
                                        <span className="text-xs text-zinc-400">₸</span>
                                        <button
                                          onClick={() => saveBonus(c.phone!)}
                                          disabled={bonus.saving}
                                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors"
                                        >
                                          {bonus.saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                          Сохранить
                                        </button>
                                        <button
                                          onClick={() => setBonusMap((m) => { const next = new Map(m); next.set(c.phone!, { ...bonus, editing: false, editValue: String(bonus.bonusAmount ?? 0) }); return next; })}
                                          className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-400"
                                        >
                                          <X size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
