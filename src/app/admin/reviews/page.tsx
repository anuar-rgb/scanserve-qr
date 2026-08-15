"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbReview } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { useBranchRestaurantId } from "@/lib/branch-context";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-200 dark:text-zinc-700"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const { t } = useTranslations();
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase
      .from("reviews")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: DbReview[] | null; error: unknown }) => {
        if (!error && data) setReviews(data);
        setLoading(false);
      });
  }, []);

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
    : null;

  const ratingDist = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    const pct   = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { stars, count, pct };
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navReviews}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descReviews}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4">

          {/* Average rating */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6 flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {t.admin.avgRating}
            </p>
            {loading ? (
              <p className="text-4xl font-black text-zinc-300 dark:text-zinc-700">…</p>
            ) : avgRating ? (
              <>
                <p className="text-5xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{avgRating}</p>
                <StarRow rating={Math.round(parseFloat(avgRating))} />
              </>
            ) : (
              <p className="text-4xl font-black text-zinc-300 dark:text-zinc-700">—</p>
            )}
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
              {loading ? "…" : `${totalReviews} ${t.admin.totalReviews}`}
            </p>
          </div>

          {/* Rating distribution */}
          <div className="col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
              {t.admin.ratingDist}
            </p>
            <div className="space-y-2.5">
              {ratingDist.map(({ stars, count, pct }) => (
                <div key={stars} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16 shrink-0">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{stars}</span>
                  </div>
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Review list */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">{t.admin.recentReviews}</h2>

          {loading ? (
            <div className="text-center py-12 text-zinc-400 dark:text-zinc-600 text-sm">Загрузка…</div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-10 text-center">
              <p className="text-3xl mb-3">⭐</p>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Отзывов пока нет</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                Отзывы появятся здесь после того, как гости оценят свои заказы.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-4 flex gap-4"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Star size={16} className="text-amber-500 fill-amber-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                        {r.order_id ?? "—"}
                      </span>
                      <StarRow rating={r.rating} />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600 ml-auto shrink-0">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    {r.comment ? (
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{r.comment}</p>
                    ) : (
                      <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">Без комментария</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
