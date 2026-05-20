"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory, DbModifier } from "@/lib/db-types";
import { RESTAURANT_ID } from "@/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalState = { mode: "create" | "edit"; modifier?: DbModifier } | null;

// ── Modifier Modal ─────────────────────────────────────────────────────────────

function ModifierModal({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: ModalState;
  categories: DbCategory[];
  onClose: () => void;
  onSaved: (m: DbModifier) => void;
}) {
  if (!state) return null;
  const s = state;
  const m = s.modifier;

  const [name, setName]         = useState(m?.name ?? "");
  const [price, setPrice]       = useState(String(m?.price ?? "0"));
  const [catId, setCatId]       = useState(m?.category_id ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!isConfigured) { setError("DB not configured"); return; }
    if (!name.trim()) { setError("Введите название"); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setError("Укажите корректную цену"); return; }

    setSaving(true);
    setError(null);

    const payload = {
      restaurant_id: RESTAURANT_ID,
      name: name.trim(),
      price: priceNum,
      category_id: catId || null,
      is_active: true,
    };

    try {
      if (s.mode === "edit" && m) {
        const { data, error: err } = await supabase
          .from("modifiers").update(payload).eq("id", m.id).select().single();
        if (err) throw err;
        onSaved(data as DbModifier);
      } else {
        const { data, error: err } = await supabase
          .from("modifiers").insert({ ...payload, order_index: 999 }).select().single();
        if (err) throw err;
        onSaved(data as DbModifier);
      }
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Ошибка сохранения");
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40 placeholder:text-zinc-400 dark:placeholder:text-zinc-600";
  const labelCls = "block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {state.mode === "edit" ? "Редактировать добавку" : "Новая добавка"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Название <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Карамельный сироп" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Цена (₸) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="50" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="200" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Категория (необязательно)</label>
            <select value={catId} onChange={e => setCatId(e.target.value)} className={inputCls}>
              <option value="">— Любая категория —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name.ru || c.name.en}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">
              Добавки будут предлагаться при выборе блюд из этой категории
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/20">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModifiersPage() {
  const [modifiers, setModifiers]   = useState<DbModifier[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<ModalState>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const [modsRes, catsRes] = await Promise.all([
      supabase.from("modifiers").select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index"),
      supabase.from("categories").select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index"),
    ]);
    setModifiers((modsRes.data as DbModifier[]) ?? []);
    setCategories((catsRes.data as DbCategory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function onSaved(saved: DbModifier) {
    setModifiers(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      return idx >= 0 ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved];
    });
    setModal(null);
  }

  async function toggleActive(mod: DbModifier) {
    await supabase.from("modifiers").update({ is_active: !mod.is_active }).eq("id", mod.id);
    setModifiers(prev => prev.map(m => m.id === mod.id ? { ...m, is_active: !m.is_active } : m));
  }

  async function deleteModifier(id: string) {
    setDeleting(id);
    await supabase.from("modifiers").delete().eq("id", id);
    setModifiers(prev => prev.filter(m => m.id !== id));
    setDeleting(null);
  }

  const catName = (id: string | null) => {
    if (!id) return "Все категории";
    return categories.find(c => c.id === id)?.name.ru ?? "—";
  };

  // Group modifiers by category_id
  const grouped = new Map<string | null, DbModifier[]>();
  for (const m of modifiers) {
    const key = m.category_id ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-600 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Загрузка…
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Модификаторы</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Добавки и сиропы — показываются при выборе блюда из нужной категории
            </p>
          </div>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={14} /> Добавить
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {modifiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-zinc-400 dark:text-zinc-600 text-sm">Модификаторы не добавлены</p>
              <button
                onClick={() => setModal({ mode: "create" })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
              >
                <Plus size={12} /> Создать первый
              </button>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl">
              {Array.from(grouped.entries()).map(([catId, mods]) => (
                <div key={catId ?? "__none__"}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
                    {catName(catId)}
                  </p>
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/40">
                    {mods.map(mod => (
                      <div key={mod.id} className={`flex items-center gap-3 px-5 py-3 bg-white dark:bg-zinc-900/30 transition-opacity ${!mod.is_active ? "opacity-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{mod.name}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-600">+{mod.price.toLocaleString("ru-RU")} ₸</p>
                        </div>
                        <button
                          onClick={() => toggleActive(mod)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            mod.is_active
                              ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                          }`}
                          title={mod.is_active ? "Отключить" : "Включить"}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setModal({ mode: "edit", modifier: mod })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteModifier(mod.id)}
                          disabled={deleting === mod.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          {deleting === mod.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModifierModal state={modal} categories={categories} onClose={() => setModal(null)} onSaved={onSaved} />
    </>
  );
}
