"use client";

import { useRef, useState } from "react";
import { X, Upload, Loader2, ImageIcon } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory, LS } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

interface Props {
  mode: "create" | "edit";
  category?: DbCategory;
  onClose: () => void;
  onSaved: (category: DbCategory) => void;
}

async function uploadCategoryImage(file: File): Promise<string> {
  if (!isConfigured) throw new Error("Database not configured");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from("category-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("category-images").getPublicUrl(data.path);
  return publicUrl;
}

export default function CategoryModal({ mode, category, onClose, onSaved }: Props) {
  const { t } = useTranslations();
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [name, setName]           = useState(category?.name.ru ?? category?.name.en ?? "");
  const [imageUrl, setImageUrl]   = useState(category?.image_url ?? "");
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл не должен превышать 5 МБ");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadCategoryImage(file);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!isConfigured) { setError("Database not configured. Set Supabase env vars in Railway."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);

    const payload = {
      restaurant_id: RESTAURANT_ID,
      name: { en: name.trim(), ru: name.trim(), kz: name.trim() } satisfies LS,
      icon: null,
      image_url: imageUrl.trim() || null,
      order_index: category?.order_index ?? 9999,
    };

    try {
      if (mode === "edit" && category) {
        const { data, error: err } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", category.id)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbCategory);
      } else {
        const { data, error: err } = await supabase
          .from("categories")
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbCategory);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : (e as { message?: string })?.message ?? JSON.stringify(e);
      setError(msg || "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "edit" ? t.admin.editProduct : t.admin.addCategory}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Name */}
          <div>
            <label className={labelCls}>{t.admin.nameLabel} <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Основные блюда"
              className={inputCls}
            />
          </div>

          {/* Image */}
          <div>
            <label className={labelCls}>Фото категории</label>

            {/* Preview + upload button row */}
            <div className="mb-3 flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={28} className="text-zinc-300 dark:text-zinc-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {uploading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Upload size={14} />}
                  {uploading ? "Загрузка…" : "Загрузить фото"}
                </button>
                <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-600">
                  JPG, PNG, WebP · до 5 МБ
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>
            </div>

            {/* URL input */}
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… или загрузите файл выше"
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/20">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            {t.admin.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? t.admin.saving : t.admin.save}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 placeholder:text-zinc-400 dark:placeholder:text-zinc-600";

const labelCls =
  "block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5";
