"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Infinity, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: { en: string; ru: string; kz: string };
  emoji: string | null;
  price: number;
  category_id: string;
  remaining_qty: number | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: { en: string; ru: string; kz: string };
  order_index: number;
}

function getName(name: { en: string; ru: string; kz: string }): string {
  return name.ru || name.en || "";
}

function StatusBadge({ qty }: { qty: number | null }) {
  if (qty === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Infinity size={10} /> Без лимита
      </span>
    );
  }
  if (qty === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
        Стоп-лист
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
      {qty} порц.
    </span>
  );
}

function ProductRow({
  product,
  onUpdate,
}: {
  product: Product;
  onUpdate: (id: string, qty: number | null) => Promise<void>;
}) {
  const [qty, setQty] = useState<number | null>(product.remaining_qty);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function save(newQty: number | null) {
    setSaving(true);
    await onUpdate(product.id, newQty);
    setSaving(false);
  }

  function handleDecrement() {
    const next = qty === null ? 0 : Math.max(0, qty - 1);
    setQty(next);
    save(next);
  }

  function handleIncrement() {
    const next = qty === null ? 1 : qty + 1;
    setQty(next);
    save(next);
  }

  function handleUnlimited() {
    setQty(null);
    save(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") { setQty(null); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) setQty(n);
  }

  function handleInputBlur() {
    save(qty);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
  }

  return (
    <div className="py-3 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
      {/* Name row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl shrink-0 w-8 text-center">{product.emoji ?? "🍽️"}</span>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1 min-w-0">
          {getName(product.name)}
        </p>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between pl-10">
        <StatusBadge qty={qty} />
        <div className="flex items-center gap-1">
          <button
            onClick={handleDecrement}
            disabled={saving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            aria-label="Уменьшить"
          >
            <Minus size={14} />
          </button>
          <input
            ref={inputRef}
            type="number"
            min={0}
            value={qty === null ? "" : qty}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder="∞"
            className="w-12 h-8 text-center text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleIncrement}
            disabled={saving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            aria-label="Увеличить"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleUnlimited}
            disabled={saving || qty === null}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-500 transition-colors disabled:opacity-30"
            aria-label="Без лимита"
            title="Снять лимит"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Infinity size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DishLimitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dish-limits");
      if (res.ok) {
        const data = await res.json() as { products: Product[]; categories: Category[] };
        setProducts(data.products);
        setCategories(data.categories);
      } else if (res.status === 401) {
        toast.error("Нет доступа");
      }
    } catch {
      toast.error("Ошибка загрузки");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate(productId: string, qty: number | null) {
    try {
      const res = await fetch("/api/admin/dish-limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, remainingQty: qty }),
      });
      if (!res.ok) {
        toast.error("Не удалось сохранить");
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, remaining_qty: qty, is_available: qty !== 0 } : p)),
      );
    } catch {
      toast.error("Ошибка сети");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-zinc-400" size={24} />
      </div>
    );
  }

  const stopListCount = products.filter((p) => p.remaining_qty === 0).length;

  return (
    <div className="max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-800/60 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center">
            <ChefHat size={16} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Лимиты блюд</h1>
            {stopListCount > 0 && (
              <p className="text-[11px] text-red-500 font-medium">
                {stopListCount} в стоп-листе
              </p>
            )}
          </div>
        </div>
        <button
          onClick={load}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Обновить"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/60">
        <span className="flex items-center gap-1">
          <Infinity size={10} className="text-emerald-500" /> — без лимита (показывается гостям)
        </span>
        <span>·</span>
        <span className="text-red-500 font-medium">0 = Стоп-лист</span>
      </div>

      {/* Products grouped by category */}
      <div className="px-4 py-2 space-y-6">
        {categories.map((cat) => {
          const catProducts = products.filter((p) => p.category_id === cat.id);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2 pt-2">
                {getName(cat.name)}
              </p>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 px-4">
                {catProducts.map((product) => (
                  <ProductRow key={product.id} product={product} onUpdate={handleUpdate} />
                ))}
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-600">
            <ChefHat size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Нет блюд в меню</p>
          </div>
        )}
      </div>
    </div>
  );
}
