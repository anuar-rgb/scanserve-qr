"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Loader2, X, Check, Copy, Tag, Clock, Star, Percent } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useBranchRestaurantId } from "@/lib/branch-context";
import type { DbPromoCode, DbHappyHour, DbCategory, LS } from "@/lib/db-types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function PromotionsPage() {
  const [tab, setTab] = useState<"promo" | "happy" | "bonus" | "akcia">("promo");
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-1 border-b border-border flex-wrap">
        <button
          onClick={() => setTab("promo")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "promo" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Tag size={14} className="inline mr-1.5 -mt-0.5" />
          Промокоды
        </button>
        <button
          onClick={() => setTab("happy")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "happy" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Clock size={14} className="inline mr-1.5 -mt-0.5" />
          Счастливые часы
        </button>
        <button
          onClick={() => setTab("bonus")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "bonus" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Star size={14} className="inline mr-1.5 -mt-0.5" />
          Бонусы
        </button>
        <button
          onClick={() => setTab("akcia")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "akcia" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Percent size={14} className="inline mr-1.5 -mt-0.5" />
          Акции
        </button>
      </div>
      {tab === "promo" ? <PromoCodesTab /> : tab === "happy" ? <HappyHoursTab /> : tab === "bonus" ? <BonusTab /> : <PromoProductsTab />}
    </div>
  );
}

function PromoCodesTab() {
  const restaurantId = useBranchRestaurantId() ?? "";
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
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    setCodes((data ?? []) as DbPromoCode[]);
    setLoading(false);
  }, [restaurantId]);

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
      restaurant_id: restaurantId,
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
    <div className="space-y-6">
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

// ── Happy Hours Tab ──────────────────────────────────────────────────────────

function HappyHoursTab() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [items, setItems] = useState<DbHappyHour[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("16:00");
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    const [{ data: hh }, { data: cats }] = await Promise.all([
      supabase.from("happy_hours").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name, order_index").eq("restaurant_id", restaurantId).order("order_index"),
    ]);
    setItems((hh ?? []) as DbHappyHour[]);
    setCategories((cats ?? []) as DbCategory[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setName(""); setDiscountPct(""); setSelectedCats(new Set());
    setStartTime("12:00"); setEndTime("16:00");
    setDays(new Set([1, 2, 3, 4, 5])); setIsActive(true); setEditingId(null);
  }

  function openEdit(h: DbHappyHour) {
    setEditingId(h.id); setName(h.name); setDiscountPct(String(h.discount_percent));
    setSelectedCats(new Set(h.category_ids)); setStartTime(h.start_time.slice(0, 5));
    setEndTime(h.end_time.slice(0, 5)); setDays(new Set(h.days_of_week));
    setIsActive(h.is_active); setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Введите название"); return; }
    const pct = parseInt(discountPct, 10);
    if (isNaN(pct) || pct <= 0 || pct > 100) { toast.error("Скидка 1-100%"); return; }
    if (selectedCats.size === 0) { toast.error("Выберите категорию"); return; }
    if (days.size === 0) { toast.error("Выберите день"); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId, name: name.trim(), discount_percent: pct,
      category_ids: [...selectedCats], start_time: startTime, end_time: endTime,
      days_of_week: [...days].sort(), is_active: isActive,
    };
    if (editingId) {
      const { error } = await supabase.from("happy_hours").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("happy_hours").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success(editingId ? "Обновлено" : "Создано");
    setSaving(false); setModalOpen(false); resetForm(); load();
  }

  function toggleDay(d: number) { setDays(p => { const n = new Set(p); if (n.has(d)) n.delete(d); else n.add(d); return n; }); }
  function toggleCat(id: string) { setSelectedCats(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  const getCatName = (id: string) => { const c = categories.find(x => x.id === id); if (!c) return ""; return typeof c.name === "string" ? c.name : c.name.ru || c.name.en; };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Счастливые часы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Автоматические скидки по времени и категориям</p>
        </div>
        <button onClick={() => { resetForm(); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Plus size={16} /> Создать
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет счастливых часов</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(h => (
            <div key={h.id} className={`rounded-xl border bg-card p-4 flex items-center gap-4 transition-opacity ${!h.is_active ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold">{h.name}</span>
                  <span className="text-xs font-bold text-amber-500">-{h.discount_percent}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {h.start_time.slice(0, 5)} — {h.end_time.slice(0, 5)} · {h.days_of_week.map(d => DAY_LABELS[d]).join(", ")} · {h.category_ids.map(getCatName).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(h)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => { setDeleting(h.id); supabase.from("happy_hours").delete().eq("id", h.id).then(() => { toast.success("Удалено"); setDeleting(null); load(); }); }} disabled={deleting === h.id} className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                  {deleting === h.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-[440px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-semibold text-sm">{editingId ? "Редактировать" : "Новые счастливые часы"}</p>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={15} /></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Название</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Обеденная скидка" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Скидка (%)</label>
                <input type="number" min={1} max={100} value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="20" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">С</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">До</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Дни недели</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((l, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${days.has(i) ? "bg-violet-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Категории</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => {
                    const n = typeof c.name === "string" ? c.name : c.name.ru || c.name.en;
                    return <button key={c.id} type="button" onClick={() => toggleCat(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedCats.has(c.id) ? "bg-violet-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>{n}</button>;
                  })}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setIsActive(!isActive)} className={`w-10 h-5 rounded-full transition-colors relative ${isActive ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm font-medium">Активен</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl text-muted-foreground hover:bg-accent transition-colors">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2">
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

// ── Bonus Tab ────────────────────────────────────────────────────────────────

type BonusProduct = { id: string; name: LS; price: number; bonus_percent: number };

function BonusTab() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [products, setProducts] = useState<BonusProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase
      .from("products")
      .select("id, name, price, bonus_percent")
      .eq("restaurant_id", restaurantId)
      .eq("is_archived", false)
      .gt("bonus_percent", 0)
      .order("bonus_percent", { ascending: false });
    setProducts((data as BonusProduct[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function handleBulkSet() {
    const val = parseFloat(bulkValue);
    if (isNaN(val) || val < 0) return;
    if (!window.confirm(`Установить бонус ${val}% для ВСЕХ блюд?`)) return;
    setBulkSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ bonus_percent: val })
      .eq("restaurant_id", restaurantId)
      .eq("is_archived", false);
    setBulkSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Бонус ${val}% установлен для всех блюд`);
    setBulkValue("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Бонусные баллы</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Кешбэк за покупки — процент от стоимости блюда</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Массовая установка бонуса</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-40">
            <input type="number" min={0} max={100} step={0.01} value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Например: 0.5" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <button onClick={handleBulkSet} disabled={bulkSaving || !bulkValue.trim() || isNaN(parseFloat(bulkValue))} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors w-full sm:w-auto">
            {bulkSaving ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
            Применить ко всем блюдам
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Установит одинаковый процент бонуса для всех блюд (не затрагивает архивные)</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star size={15} className="text-emerald-500" />
          <div>
            <h2 className="text-sm font-semibold">Блюда с бонусами</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{products.length > 0 ? `${products.length} блюд` : "Нет блюд с бонусами"}</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Установите процент бонуса в карточке блюда или используйте массовую установку</p>
        ) : (
          <div className="divide-y divide-border">
            {products.map(p => {
              const amt = Math.round(p.price * p.bonus_percent / 100);
              return (
                <div key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm truncate flex-1">{p.name?.ru ?? p.name?.en ?? "—"}</span>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">+{p.bonus_percent}%</span>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground leading-none">+{amt.toLocaleString()} ₸</p>
                      <p className="text-sm font-semibold leading-tight">{p.price.toLocaleString()} ₸</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Promo Products Tab ───────────────────────────────────────────────────────

type PromoProduct = { id: string; name: LS; price: number; is_promo: boolean; discount_label: string | null };

function PromoProductsTab() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [products, setProducts] = useState<PromoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase
      .from("products")
      .select("id, name, price, is_promo, discount_label")
      .eq("restaurant_id", restaurantId)
      .eq("is_archived", false)
      .order("name->ru");
    setProducts((data as PromoProduct[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function togglePromo(p: PromoProduct) {
    const next = !p.is_promo;
    setSaving(p.id);
    await supabase.from("products").update({ is_promo: next, discount_label: next ? (p.discount_label ?? null) : null }).eq("id", p.id);
    setSaving(null);
    load();
  }

  async function saveLabel(id: string) {
    setSaving(id);
    await supabase.from("products").update({ discount_label: editPct.trim() || null }).eq("id", id);
    setSaving(null);
    setEditingId(null);
    load();
  }

  const promoCount = products.filter(p => p.is_promo).length;
  const filteredProducts = search.trim()
    ? products.filter(p => {
        const q = search.toLowerCase();
        return (p.name?.ru ?? "").toLowerCase().includes(q) ||
               (p.name?.en ?? "").toLowerCase().includes(q) ||
               (p.name?.kz ?? "").toLowerCase().includes(q);
      })
    : products;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Акционные блюда</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Зачёркнутая цена и бейдж скидки на карточке блюда
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Percent size={15} className="text-red-500" />
          <div>
            <h2 className="text-sm font-semibold">Все блюда</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {promoCount > 0 ? `${promoCount} блюд на акции` : "Нет акционных блюд"}
            </p>
          </div>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск блюд..."
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Нет блюд в каталоге</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Ничего не найдено</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredProducts.map(p => {
              const pname = p.name?.ru ?? p.name?.en ?? "—";
              const pct = parseInt(p.discount_label ?? "", 10);
              const discounted = p.is_promo && !isNaN(pct) && pct > 0
                ? Math.round(p.price * (1 - pct / 100))
                : null;
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => togglePromo(p)}
                    disabled={saving === p.id}
                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all duration-200 shrink-0 ${
                      p.is_promo ? "bg-red-500 justify-end" : "bg-zinc-300 dark:bg-zinc-600 justify-start"
                    } disabled:opacity-40`}
                  >
                    {saving === p.id
                      ? <Loader2 size={12} className="animate-spin text-white mx-auto" />
                      : <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    }
                  </button>

                  <span className="text-sm flex-1 truncate">{pname}</span>

                  {p.is_promo && (
                    editingId === p.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editPct}
                          onChange={e => setEditPct(e.target.value)}
                          placeholder="15"
                          autoFocus
                          className="w-16 px-2 py-1 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <button
                          onClick={() => saveLabel(p.id)}
                          disabled={saving === p.id}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(p.id); setEditPct(p.discount_label ?? ""); }}
                        className="flex items-center gap-1.5 shrink-0 group"
                      >
                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full group-hover:bg-red-500/20 transition-colors">
                          {p.discount_label ? `−${p.discount_label}%` : "Скидка не указана"}
                        </span>
                        {discounted !== null && (
                          <span className="text-[11px] text-muted-foreground">
                            {discounted.toLocaleString()} ₸
                          </span>
                        )}
                        <Edit2 size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )
                  )}

                  <div className="text-right shrink-0 ml-auto">
                    <p className={`text-sm font-semibold leading-tight ${p.is_promo ? "line-through text-muted-foreground" : ""}`}>
                      {p.price.toLocaleString()} ₸
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
