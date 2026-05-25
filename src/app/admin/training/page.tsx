"use client";

import { useEffect, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { ALLERGEN_TAGS } from "@/components/admin/ProductModal";
import { Loader2, Search, X } from "lucide-react";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

interface TrainingDish {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  emoji: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  allergens: string[];
}

const ALL_KEY = "__all__";

export default function TrainingPage() {
  const [dishes,  setDishes]  = useState<TrainingDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<string>(ALL_KEY);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    Promise.all([
      supabase.from("categories").select("id, name, icon").eq("restaurant_id", RESTAURANT_ID),
      supabase.from("products").select("id, name, category_id, emoji, image_url, ingredients, allergens")
        .eq("restaurant_id", RESTAURANT_ID).eq("is_archived", false).order("order_index"),
    ]).then(([catsRes, prodsRes]) => {
      const cats = catsRes.data ?? [];
      const prods = prodsRes.data ?? [];

      const catMap = Object.fromEntries(
        cats.map((c: { id: string; name: { ru?: string; en?: string }; icon: string | null }) => [
          c.id,
          { name: c.name?.ru ?? c.name?.en ?? "", icon: c.icon ?? "🍽️" },
        ])
      );

      setDishes(
        prods.map((p: {
          id: string;
          name: { ru?: string; en?: string };
          category_id: string;
          emoji: string | null;
          image_url: string | null;
          ingredients: string | null;
          allergens: string[] | null;
        }) => ({
          id:           p.id,
          name:         p.name?.ru ?? p.name?.en ?? "",
          category:     catMap[p.category_id]?.name ?? "",
          categoryIcon: catMap[p.category_id]?.icon ?? "🍽️",
          emoji:        p.emoji,
          imageUrl:     p.image_url,
          ingredients:  p.ingredients,
          allergens:    p.allergens ?? [],
        }))
      );
      setLoading(false);
    });
  }, []);

  const filtered = dishes.filter(d => {
    const matchTag    = filter === ALL_KEY || d.allergens.includes(filter);
    const matchSearch = !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchTag && matchSearch;
  });

  const withAllergens    = dishes.filter(d => d.allergens.length > 0).length;
  const withoutAllergens = dishes.length - withAllergens;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Обучение персонала</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Аллергены и особенности блюд — для ознакомления официантов
        </p>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          <StatChip label="Всего блюд" value={dishes.length} color="violet" />
          <StatChip label="С аллергенами" value={withAllergens} color="amber" />
          <StatChip label="Без аллергенов" value={withoutAllergens} color="emerald" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilter(ALL_KEY)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            filter === ALL_KEY
              ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
          }`}
        >
          Все блюда
        </button>
        {ALLERGEN_TAGS.map(({ key, emoji, label, activeCls }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? ALL_KEY : key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === key
                ? activeCls
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск блюда…"
          className="w-full pl-8 pr-8 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-zinc-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Загружаем блюда…</span>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-zinc-400 text-sm">Блюда не найдены</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(dish => (
            <DishAllergenCard key={dish.id} dish={dish} />
          ))}
        </div>
      )}
    </div>
  );
}

function DishAllergenCard({ dish }: { dish: TrainingDish }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex gap-3">
      {/* Thumb */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl">
        {dish.imageUrl
          ? <img src={dish.imageUrl} alt="" className="w-full h-full object-cover" />
          : (dish.emoji ?? "🍽️")
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{dish.name}</p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 mb-2">
          {dish.categoryIcon} {dish.category}
        </p>

        {dish.allergens.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dish.allergens.map(key => {
              const tag = ALLERGEN_TAGS.find(t => t.key === key);
              if (!tag) return null;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${tag.activeCls}`}
                >
                  {tag.emoji} {tag.label}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Аллергены не указаны</span>
        )}

        {dish.ingredients && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">
            {dish.ingredients}
          </p>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: "violet" | "amber" | "emerald" }) {
  const cls = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  }[color];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cls}`}>
      <span className="text-base font-black tabular-nums">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
}
