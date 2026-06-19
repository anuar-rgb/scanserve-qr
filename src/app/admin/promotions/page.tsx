"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Loader2, X, Check, Copy, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID } from "@/constants";
import type { DbPromoCode } from "@/lib/db-types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export default function PromotionsPage() {
  const [codes, setCodes] = useState<DbPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("created_at", { ascending: false });
    setCodes((data ?? []) as DbPromoCode[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setCode(""); setDiscountType("percent"); setDiscountValue("");
    setMinOrder(""); setMaxUses(""); setValidFrom(""); setValidTo("");
    setIsActive(true); setEditingId(null);
  }

  function openCreate() { resetForm(); setModalOpen(true); }

  function openEdit(p: DbPromoCode) {
    setEditingId(p.id);
    setCode(p.code);
    setDiscountType(p.discount_type);
    setDiscountValue(String(p.discount_value));
    setMinOrder(p.min_order_amount ? String(p.min_order_amount) : "");
    setMaxUses(p.max_uses != null ? String(p.max_uses) : "");
    setValidFrom(p.valid_from ? toLocalInput(p.valid_from) : "");
    setValidTo(p.valid_to ? toLocalInput(p.valid_to) : "");
    setIsActive(p.is_active);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!code.trim()) { toast.error("Введите код"); return; }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) { toast.error("Введите значение скидки"); return; }
    if (discountType === "percent" && val > 100) { toast.error("Процент не может быть больше 100"); return; }

    setSaving(true);
    const payload = {
      restaurant_id: RESTAURANT_ID,
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: val,
      min_order_amount: minOrder ? parseInt(minOrder, 10) : 0,
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      valid_to: validTo ? new Date(validTo).toISOString() : null,
      is_active: isActive,
    };

    if (editingId) {
      const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Промокод обновлён");
    } else {
      const { error } = await supabase.from("promo_codes").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Промокод создан");
    }

    setSaving(false);
    setModalOpen(false);
    resetForm();
    load();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from("promo_codes").delete().eq("id", id);
    toast.success("Промокод удалён");
    setDeleting(null);
    load();
  }

  async function toggleActive(p: DbPromoCode) {
    await supabase.from("promo_codes").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c).then(() => toast.success(`Скопировано: ${c}`));
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Промокоды</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Скидки и специальные предложения для гостей</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} />
          Создать промокод
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет промокодов</p>
          <p className="text-xs mt-1">Нажмите «Создать промокод» чтобы начать</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(p => (
            <div
              key={p.id}
              className={`rounded-xl border bg-card p-4 flex items-center gap-4 transition-opacity ${!p.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold tracking-wider">{p.code}</span>
                  <button onClick={() => copyCode(p.code)} className="text-muted-foreground hover:text-foreground">
                    <Copy size={12} />
                  </button>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    p.is_active ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}>
                    {p.is_active ? "Активен" : "Выключен"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.discount_type === "percent" ? `${p.discount_value}%` : `${Number(p.discount_value).toLocaleString("ru-RU")} ₸`}
                  {p.min_order_amount > 0 && ` · от ${p.min_order_amount.toLocaleString("ru-RU")} ₸`}
                  {` · ${p.used_count}${p.max_uses != null ? `/${p.max_uses}` : ""} исп.`}
                  {` · ${fmtDate(p.valid_from)} — ${fmtDate(p.valid_to)}`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(p)}
                  className={`p-2 rounded-lg transition-colors ${
                    p.is_active ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={p.is_active ? "Выключить" : "Включить"}
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                >
                  {deleting === p.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-[440px] max-w-[95vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-semibold text-sm">{editingId ? "Редактировать промокод" : "Создать промокод"}</p>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Код</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Тип скидки</label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as "percent" | "fixed")}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    <option value="percent">Процент (%)</option>
                    <option value="fixed">Фиксированная (₸)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Значение</label>
                  <input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percent" ? "10" : "500"}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Мин. сумма заказа</label>
                  <input
                    type="number"
                    min={0}
                    value={minOrder}
                    onChange={e => setMinOrder(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Макс. использований</label>
                  <input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={e => setMaxUses(e.target.value)}
                    placeholder="Без ограничений"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Действует с</label>
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={e => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Действует до</label>
                  <input
                    type="datetime-local"
                    value={validTo}
                    onChange={e => setValidTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsActive(!isActive)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isActive ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm font-medium">Активен</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm rounded-xl text-muted-foreground hover:bg-accent transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
