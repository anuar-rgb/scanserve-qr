"use client";

import { Star } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const REVIEWS = [
  { id: 1, name: "Айгерим С.",    rating: 5, date: "2025-04-27", dish: "Beshbarmak",  text: "Очень вкусный бешбармак! Обязательно вернёмся. Порция огромная, всё свежее." },
  { id: 2, name: "Amir T.",       rating: 5, date: "2025-04-26", dish: "Kuyrdak",     text: "Amazing food and atmosphere. The Kuyrdak was perfectly cooked. Will recommend to friends." },
  { id: 3, name: "Дина М.",       rating: 4, date: "2025-04-25", dish: "Naryn",        text: "Вкусно, но пришлось немного подождать. Нарын порадовал, бульон насыщенный." },
  { id: 4, name: "Bekzhan A.",    rating: 5, date: "2025-04-24", dish: "Kazy",         text: "Best kazakh food in the city. The Kazy is authentic and the service was great." },
  { id: 5, name: "Алия Н.",      rating: 5, date: "2025-04-23", dish: "Beshbarmak",  text: "Заказывали на семейный ужин — все в восторге. Атмосфера уютная, персонал приветливый." },
  { id: 6, name: "Sergei K.",     rating: 4, date: "2025-04-22", dish: "Zhent",        text: "Good place overall. The desserts were a nice surprise, especially Zhent. A bit pricey." },
  { id: 7, name: "Мариям Е.",    rating: 5, date: "2025-04-21", dish: "Kymyz",        text: "Настоящий кымыз — редкость в городе! Пришли из-за него и не пожалели." },
  { id: 8, name: "David L.",      rating: 3, date: "2025-04-20", dish: "Baursak",      text: "The food is okay, but baursak could be fresher. Location is convenient." },
];

const RATING_DIST = [
  { stars: 5, count: 24, pct: 63 },
  { stars: 4, count: 9,  pct: 24 },
  { stars: 3, count: 3,  pct: 8  },
  { stars: 2, count: 1,  pct: 3  },
  { stars: 1, count: 1,  pct: 2  },
];

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
  const { t } = useTranslations();
  const totalReviews = RATING_DIST.reduce((s, r) => s + r.count, 0);
  const avgRating = (
    RATING_DIST.reduce((s, r) => s + r.stars * r.count, 0) / totalReviews
  ).toFixed(1);

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
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{t.admin.avgRating}</p>
            <p className="text-5xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{avgRating}</p>
            <StarRow rating={Math.round(parseFloat(avgRating))} />
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">{totalReviews} {t.admin.totalReviews}</p>
          </div>

          {/* Rating distribution */}
          <div className="col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-6">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">{t.admin.ratingDist}</p>
            <div className="space-y-2.5">
              {RATING_DIST.map(({ stars, count, pct }) => (
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
          <div className="space-y-3">
            {REVIEWS.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-4 flex gap-4"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-violet-600 dark:text-violet-400">
                  {r.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{r.name}</span>
                    <StarRow rating={r.rating} />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 ml-auto shrink-0">{r.date}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    Ordered: <span className="font-medium text-zinc-700 dark:text-zinc-300">{r.dish}</span>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
