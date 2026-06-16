"use client";

import { useEffect, useState, useCallback } from "react";

type Ad = {
  id: string;
  image_url: string;
  target_url: string | null;
  title: string | null;
  is_active: boolean;
  placement: string;
  display_order: number;
  created_at: string;
};

type FormState = {
  image_url: string;
  target_url: string;
  title: string;
  placement: string;
};

const EMPTY_FORM: FormState = {
  image_url:  "",
  target_url: "",
  title:      "",
  placement:  "menu_middle",
};

const PLACEMENT_LABELS: Record<string, string> = {
  menu_middle: "В меню (середина)",
};

export default function SuperAdminAdsPage() {
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/ads");
    if (res.ok) setAds(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/super-admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url:  form.image_url.trim(),
        target_url: form.target_url.trim() || null,
        title:      form.title.trim()      || null,
        placement:  form.placement,
      }),
    });
    if (res.ok) {
      const created: Ad = await res.json();
      setAds((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
    }
    setSubmitting(false);
  }

  async function toggleActive(ad: Ad) {
    setToggling(ad.id);
    const res = await fetch("/api/super-admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id, is_active: !ad.is_active }),
    });
    if (res.ok) {
      const updated: Ad = await res.json();
      setAds((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    }
    setToggling(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить рекламный баннер?")) return;
    setDeleting(id);
    const res = await fetch("/api/super-admin/ads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setAds((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Рекламные баннеры</h1>
        <p className="text-sm text-zinc-500 mt-1">Отображаются во всех ресторанах на платформе</p>
      </div>

      {/* Форма добавления */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Добавить баннер</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Ссылка на изображение *</label>
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                required
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">URL при клике</label>
              <input
                value={form.target_url}
                onChange={(e) => setForm({ ...form, target_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Подпись (необязательно)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Название акции..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {/* Предпросмотр изображения */}
          {form.image_url && (
            <div className="mt-2">
              <img
                src={form.image_url}
                alt="preview"
                className="h-24 rounded-xl object-cover border border-zinc-700"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.image_url.trim()}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {submitting ? "Публикуем..." : "Опубликовать"}
          </button>
        </form>
      </div>

      {/* Список баннеров */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-900 animate-pulse" />)}
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-zinc-600 text-sm">
          Нет рекламных баннеров
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className={`rounded-2xl border p-4 flex items-center gap-4 transition-opacity ${
                ad.is_active
                  ? "border-zinc-800 bg-zinc-900/40"
                  : "border-zinc-800/50 bg-zinc-900/20 opacity-60"
              }`}
            >
              <img
                src={ad.image_url}
                alt=""
                className="w-20 h-14 rounded-xl object-cover flex-shrink-0 bg-zinc-800"
              />
              <div className="flex-1 min-w-0">
                {ad.title && (
                  <p className="text-sm font-medium text-zinc-200 truncate">{ad.title}</p>
                )}
                {ad.target_url && (
                  <a
                    href={ad.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 truncate block transition-colors"
                  >
                    {ad.target_url}
                  </a>
                )}
                <p className="text-xs text-zinc-600 mt-0.5">
                  {PLACEMENT_LABELS[ad.placement] ?? ad.placement}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(ad)}
                  disabled={toggling === ad.id}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    ad.is_active
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700"
                  }`}
                >
                  {toggling === ad.id ? "..." : ad.is_active ? "Вкл" : "Выкл"}
                </button>
                <button
                  onClick={() => handleDelete(ad.id)}
                  disabled={deleting === ad.id}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition-colors disabled:opacity-50"
                >
                  {deleting === ad.id ? "..." : "Удалить"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
