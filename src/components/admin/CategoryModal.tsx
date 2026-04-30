"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DbCategory, LS } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

interface Props {
  mode: "create" | "edit";
  category?: DbCategory;
  onClose: () => void;
  onSaved: (category: DbCategory) => void;
}

function emptyLS(): LS { return { en: "", ru: "", kz: "" }; }

export default function CategoryModal({ mode, category, onClose, onSaved }: Props) {
  const { t } = useTranslations();
  const [nameEn, setNameEn] = useState(category?.name.en ?? "");
  const [nameRu, setNameRu] = useState(category?.name.ru ?? "");
  const [icon, setIcon]     = useState(category?.icon ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave() {
    if (!nameEn.trim() || !nameRu.trim()) {
      setError("Name (EN) and Name (RU) are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      restaurant_id: RESTAURANT_ID,
      name: { en: nameEn.trim(), ru: nameRu.trim(), kz: nameRu.trim() } satisfies LS,
      icon: icon.trim() || null,
      image_url: category?.image_url ?? null,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t.admin.nameEn} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Main Courses"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.admin.nameRu} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={nameRu}
                onChange={(e) => setNameRu(e.target.value)}
                placeholder="Основные блюда"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t.admin.emojiLabel}</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍖"
                maxLength={4}
                className={`${inputCls} w-20 text-center text-xl`}
              />
              <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Emoji displayed next to the category name</span>
            </div>
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

const labelCls =
  "block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5";
