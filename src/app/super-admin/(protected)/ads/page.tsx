"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ImageIcon, X } from "lucide-react";

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

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_MB = 5;

export default function SuperAdminAdsPage() {
  const [ads, setAds]               = useState<Ad[]>([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  // upload state
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [uploadErr, setUploadErr]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/ads");
    if (res.ok) setAds(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploadErr(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadErr("Допустимые форматы: JPG, PNG, WebP, GIF");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadErr(`Файл слишком большой (максимум ${MAX_MB} MB)`);
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/super-admin/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string };

    if (!res.ok) {
      setUploadErr(data.error ?? "Ошибка загрузки");
    } else if (data.url) {
      setForm((f) => ({ ...f, image_url: data.url! }));
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function clearImage() {
    setForm((f) => ({ ...f, image_url: "" }));
    setUploadErr(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Create ──────────────────────────────────────────────────────────────────

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
      setUploadErr(null);
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Рекламные баннеры</h1>
        <p className="text-sm text-zinc-500 mt-1">Отображаются во всех ресторанах на платформе</p>
      </div>

      {/* Форма добавления */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Добавить баннер</h2>
        <form onSubmit={handleCreate} className="space-y-4">

          {/* Upload zone or preview */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Изображение *</label>

            {form.image_url ? (
              /* Preview */
              <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-800">
                <img
                  src={form.image_url}
                  alt="preview"
                  className="w-full h-52 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
                  title="Сменить изображение"
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                  <p className="text-xs text-zinc-300 truncate font-mono">{form.image_url}</p>
                </div>
              </div>
            ) : (
              /* Drag & Drop zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-violet-500 bg-violet-500/8 scale-[1.01]"
                    : uploading
                    ? "border-zinc-600 bg-zinc-800/30 cursor-wait"
                    : "border-zinc-700 bg-zinc-800/20 hover:border-zinc-500 hover:bg-zinc-800/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                />

                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-zinc-400">Загрузка в Supabase Storage...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                      dragOver ? "bg-violet-500/20 text-violet-400" : "bg-zinc-800 text-zinc-500"
                    }`}>
                      <ImageIcon size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-300">
                        {dragOver ? "Отпусти для загрузки" : "Перетащи файл или нажми для выбора"}
                      </p>
                      <p className="text-xs text-zinc-600 mt-1">PNG, JPG, WebP, GIF · до {MAX_MB} MB</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadErr && (
              <p className="text-xs text-red-400 mt-2">{uploadErr}</p>
            )}
          </div>

          {/* URL при клике + подпись */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <button
            type="submit"
            disabled={submitting || !form.image_url.trim() || uploading}
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
