"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Boxes, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import type { DbIngredient } from "@/lib/db-types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<DbIngredient["unit"], string> = {
  kg:    "кг",
  liter: "л",
  pcs:   "шт",
};

const UNIT_OPTIONS: { value: DbIngredient["unit"]; label: string }[] = [
  { value: "kg",    label: "кг (за кг)"  },
  { value: "liter", label: "л (за литр)" },
  { value: "pcs",   label: "шт (за штуку)" },
];

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  ingredient?: DbIngredient;
  onClose: () => void;
  onSaved: (ing: DbIngredient) => void;
}

function IngredientModal({ ingredient, onClose, onSaved }: ModalProps) {
  const isEdit = !!ingredient;
  const [name, setName]               = useState(ingredient?.name ?? "");
  const [unit, setUnit]               = useState<DbIngredient["unit"]>(ingredient?.unit ?? "kg");
  const [stock, setStock]             = useState(String(ingredient?.current_stock ?? "0"));
  const [price, setPrice]             = useState(String(ingredient?.purchase_price ?? "0"));
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Введите название"); return; }
    const stockNum = parseFloat(stock);
    const priceNum = parseFloat(price);
    if (isNaN(stockNum) || stockNum < 0) { setError("Некорректный остаток"); return; }
    if (isNaN(priceNum) || priceNum < 0) { setError("Некорректная цена"); return; }

    setSaving(true);
    setError(null);

    const payload = {
      restaurant_id: RESTAURANT_ID,
      name: name.trim(),
      unit,
      current_stock: stockNum,
      purchase_price: priceNum,
    };

    try {
      if (isEdit && ingredient) {
        const { data, error: err } = await supabase
          .from(DB_TABLES.ingredients)
          .update(payload)
          .eq("id", ingredient.id)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbIngredient);
      } else {
        const { data, error: err } = await supabase
          .from(DB_TABLES.ingredients)
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbIngredient);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? "Редактировать ингредиент" : "Добавить ингредиент"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Фарш говяжий"
              className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Единица измерения
            </label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as DbIngredient["unit"])}
              className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {UNIT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Stock + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Остаток ({UNIT_LABELS[unit]})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Цена ₸/{UNIT_LABELS[unit]}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [ingredients, setIngredients] = useState<DbIngredient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [modal, setModal]             = useState<"create" | DbIngredient | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);

  const fetchIngredients = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const { data, error } = await supabase
      .from(DB_TABLES.ingredients)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("name");
    if (error) { toast.error("Ошибка загрузки"); return; }
    setIngredients((data ?? []) as DbIngredient[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  async function handleDelete(id: string) {
    if (!confirm("Удалить ингредиент? Это также удалит его из всех технологических карт.")) return;
    setDeleting(id);
    const { error } = await supabase.from(DB_TABLES.ingredients).delete().eq("id", id);
    if (error) { toast.error("Ошибка удаления"); setDeleting(null); return; }
    setIngredients(prev => prev.filter(i => i.id !== id));
    toast.success("Удалено");
    setDeleting(null);
  }

  function handleSaved(ing: DbIngredient) {
    setIngredients(prev => {
      const idx = prev.findIndex(i => i.id === ing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ing;
        return next.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      }
      return [...prev, ing].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    });
    toast.success(modal === "create" ? "Ингредиент добавлен" : "Сохранено");
    setModal(null);
  }

  const filtered = ingredients.filter(i =>
    !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const totalStockValue = ingredients.reduce((sum, i) => {
    const mult = i.unit === "kg" || i.unit === "liter" ? 1 : 1;
    return sum + i.current_stock * i.purchase_price * mult;
  }, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Boxes size={20} className="text-violet-500" />
            Склад / Ингредиенты
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Управление складскими позициями и ценами закупки
          </p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors"
        >
          <Plus size={15} />
          Добавить ингредиент
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-xs font-semibold">
            <span className="text-base font-black tabular-nums text-violet-600 dark:text-violet-400">{ingredients.length}</span>
            <span className="font-medium opacity-80 text-violet-600 dark:text-violet-400">позиций</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold">
            <span className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totalStockValue)} ₸</span>
            <span className="font-medium opacity-80 text-emerald-600 dark:text-emerald-400">сумма склада</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск ингредиента…"
          className="w-full pl-8 pr-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-zinc-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Загрузка…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-sm">
            {ingredients.length === 0
              ? "Нет ингредиентов. Добавьте первый склад."
              : "Ничего не найдено по запросу."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Название</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Ед.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Остаток</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Цена ₸/ед.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Сумма ₸</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing, idx) => {
                const rowValue = ing.current_stock * ing.purchase_price;
                return (
                  <tr
                    key={ing.id}
                    className={`border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 ${
                      idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{ing.name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {UNIT_LABELS[ing.unit]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`font-semibold ${ing.current_stock <= 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {fmt(ing.current_stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {fmt(ing.purchase_price)} ₸
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {fmt(rowValue)} ₸
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal(ing)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(ing.id)}
                          disabled={deleting === ing.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          {deleting === ing.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <IngredientModal
          ingredient={modal === "create" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
