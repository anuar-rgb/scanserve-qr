"use client";

import { useRef, useState } from "react";
import { X, Upload, Loader2, ImageIcon, Flame, Star, Sparkles } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory, DbProduct, LS } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

interface Props {
  mode: "create" | "edit";
  product?: DbProduct;
  categories: DbCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: (product: DbProduct) => void;
}

async function uploadToStorage(file: File, bucket: string): Promise<string> {
  if (!isConfigured) throw new Error("Database not configured");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

export default function ProductModal({ mode, product, categories, defaultCategoryId, onClose, onSaved }: Props) {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState(product?.name.ru ?? product?.name.en ?? "");
  const [desc, setDesc]           = useState(product?.description?.ru ?? product?.description?.en ?? "");
  const [price, setPrice]         = useState(String(product?.price ?? ""));
  const [emoji, setEmoji]         = useState(product?.emoji ?? "");
  const [badge, setBadge]         = useState(product?.badge ?? "");
  const [catId, setCatId]         = useState(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
  const [isNew, setIsNew]         = useState(product?.is_new ?? false);
  const [isPopular, setIsPopular] = useState(product?.is_popular ?? false);
  const [isSpicy, setIsSpicy]     = useState(product?.is_spicy ?? false);
  const [isAvail, setIsAvail]     = useState(product?.is_available ?? true);

  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image_url ?? null);
  const [file, setFile]             = useState<File | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!isConfigured) { setError("Database not configured. Set Supabase env vars in Railway."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 0) { setError("Enter a valid price."); return; }
    if (!catId) { setError("Select a category."); return; }

    setSaving(true);
    setError(null);

    try {
      let imageUrl = product?.image_url ?? null;
      if (file) {
        imageUrl = await uploadToStorage(file, "menu-images");
      }

      const payload = {
        restaurant_id: RESTAURANT_ID,
        category_id: catId,
        name: { en: name.trim(), ru: name.trim(), kz: name.trim() },
        description: desc.trim()
          ? { en: desc.trim(), ru: desc.trim(), kz: desc.trim() }
          : null,
        price: priceNum,
        image_url: imageUrl,
        emoji: emoji.trim() || null,
        badge: badge.trim() || null,
        is_new: isNew,
        is_popular: isPopular,
        is_spicy: isSpicy,
        is_available: isAvail,
        is_archived: product?.is_archived ?? false,
        order_index: product?.order_index ?? 9999,
      };

      if (mode === "edit" && product) {
        const { data, error: err } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbProduct);
      } else {
        const { data, error: err } = await supabase
          .from("products")
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        onSaved(data as DbProduct);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Check Supabase permissions.");
      setSaving(false);
    }
  }

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? t.admin.editProduct : t.admin.addProduct}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Photo */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              {t.admin.photoLabel}
            </label>
            <div className="flex items-start gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-28 h-28 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-violet-500 dark:hover:border-violet-500 transition-colors overflow-hidden shrink-0 bg-zinc-50 dark:bg-zinc-800/50"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon size={20} className="text-zinc-400" />
                    <span className="text-[10px] text-zinc-400 text-center leading-tight px-2">{t.admin.uploadPhoto}</span>
                  </>
                )}
              </div>
              <div className="flex-1 space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {previewUrl ? t.admin.changePhoto : t.admin.uploadPhoto}
                </button>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 leading-relaxed">
                  PNG, JPG, WebP — max 5 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onFileChange}
                />
                {/* Emoji fallback */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.admin.emojiLabel}</span>
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    placeholder="🍖"
                    maxLength={4}
                    className="w-16 text-center text-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Name */}
          <Field label={t.admin.nameLabel} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Бешбармак"
              className={inputCls}
            />
          </Field>

          {/* Description */}
          <Field label={t.admin.descLabel}>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Традиционное казахское блюдо…"
              className={inputCls + " resize-none"}
            />
          </Field>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.admin.priceLabel} required>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1200"
                className={inputCls}
              />
            </Field>
            <Field label={t.admin.categoryLabel} required>
              <select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? ""} {c.name.ru || c.name.en}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Custom badge */}
          <Field label={t.admin.customBadge}>
            <input
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="★ ТОП"
              maxLength={24}
              className={inputCls}
            />
          </Field>

          {/* Badge toggles */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              {t.admin.badgesLabel}
            </label>
            <div className="flex gap-2 flex-wrap">
              <BadgeToggle
                active={isNew}
                onToggle={() => setIsNew(!isNew)}
                label={t.admin.badgeNew}
                color="emerald"
                icon={<Sparkles size={11} />}
              />
              <BadgeToggle
                active={isPopular}
                onToggle={() => setIsPopular(!isPopular)}
                label={t.admin.badgePopular}
                color="amber"
                icon={<Star size={11} />}
              />
              <BadgeToggle
                active={isSpicy}
                onToggle={() => setIsSpicy(!isSpicy)}
                label={t.admin.badgeSpicy}
                color="red"
                icon={<Flame size={11} />}
              />
            </div>
          </div>

          {/* Availability */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {t.admin.available}
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                Visible to guests on the QR menu
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvail(!isAvail)}
              className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-all duration-200 ${
                isAvail ? "bg-emerald-500 justify-end" : "bg-zinc-300 dark:bg-zinc-600 justify-start"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/20">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            {t.admin.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function BadgeToggle({
  active, onToggle, label, color, icon,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  color: "emerald" | "amber" | "red";
  icon: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    amber:   "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    red:     "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? cls[color]
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
