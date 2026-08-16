"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, ImageIcon, Flame, Star, Sparkles, Plus, Trash2, Check } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory, DbIngredient, DbProduct, LS } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { useIsStrictOwner } from "@/lib/role-context";
import { ImageCropModal } from "./ImageCropModal";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

interface Props {
  mode: "create" | "edit";
  product?: DbProduct;
  categories: DbCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: (product: DbProduct) => void;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIME_TO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function validateAndUpload(file: File, bucket: string): Promise<string> {
  if (!isConfigured) throw new Error("Database not configured");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Допустимые форматы: JPG, PNG, WebP");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Файл слишком большой (максимум 5 MB)");
  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

// ── Phone mockup wrapper ──────────────────────────────────────────────────────

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 186,
      background: "#1C1C1E",
      borderRadius: 36,
      padding: "18px 9px 14px",
      boxShadow: "inset 0 0 0 1.5px #3a3a3c, 0 12px 32px rgba(0,0,0,0.4)",
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Pill notch */}
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      {/* Screen */}
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden", minHeight: 200, padding: "10px 8px" }}>
        {children}
      </div>
      {/* Home bar */}
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}

// ── Product card preview (mirrors CatalogDishCard from MenuTemplate) ──────────

const BADGE_COLORS = [
  { hex: "#F59E0B", label: "Amber"  },
  { hex: "#00C882", label: "Green"  },
  { hex: "#FF4D6D", label: "Red"    },
  { hex: "#00AAFF", label: "Blue"   },
  { hex: "#FF6B2B", label: "Orange" },
  { hex: "#A855F7", label: "Purple" },
];

// ── Recipe / калькуляция ──────────────────────────────────────────────────────

interface RecipeRow {
  key: string;
  dbId?: string;
  ingredientId: string;
  weightGross: string;
  weightNet: string;
}

const UNIT_INPUT_LABEL: Record<DbIngredient["unit"], string> = {
  kg:    "г",
  liter: "мл",
  pcs:   "шт",
};

function calcLineCost(ing: DbIngredient, weightGross: number): number {
  if (ing.unit === "kg" || ing.unit === "liter") return (weightGross / 1000) * ing.purchase_price;
  return weightGross * ing.purchase_price;
}

function fmtNum(n: number, decimals = 2) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export const ALLERGEN_TAGS = [
  { key: "spicy",        emoji: "🌶️", label: "Острое",           activeCls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
  { key: "nuts",         emoji: "🥜",  label: "Содержит орехи",   activeCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { key: "vegetarian",   emoji: "🌱",  label: "Вегетарианское",   activeCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  { key: "lactose_free", emoji: "🥛",  label: "Без лактозы",      activeCls: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  { key: "gluten",       emoji: "🌾",  label: "Содержит глютен",  activeCls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
];

const CUSTOM_TAG_CLS = "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30";

function AllergenPicker({ allergens, onToggle, onChange }: { allergens: string[]; onToggle: (key: string) => void; onChange: (v: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const knownKeys = new Set(ALLERGEN_TAGS.map(t => t.key));
  const customTags = allergens.filter(k => !knownKeys.has(k));

  function addCustom() {
    const tag = newTag.trim();
    if (!tag) return;
    if (!allergens.includes(tag)) onChange([...allergens, tag]);
    setNewTag("");
    setAdding(false);
  }

  function removeCustom(tag: string) {
    onChange(allergens.filter(k => k !== tag));
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {ALLERGEN_TAGS.map(({ key, emoji, label, activeCls }) => (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            allergens.includes(key)
              ? activeCls
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-700"
          }`}
        >
          <span>{emoji}</span>
          {label}
        </button>
      ))}
      {customTags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => removeCustom(tag)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${CUSTOM_TAG_CLS}`}
        >
          {tag}
          <X size={10} />
        </button>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") setAdding(false); }}
            placeholder="Название..."
            className="w-28 px-2 py-1 rounded-full text-xs border border-violet-400 bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <button type="button" onClick={addCustom} className="p-1 rounded-full text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/30">
            <Check size={12} />
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewTag(""); }} className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-violet-600 hover:border-violet-400 transition-colors"
        >
          <Plus size={11} />
          Добавить
        </button>
      )}
    </div>
  );
}

function fgFromHex(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#111111" : "#ffffff";
}

function ProductCardPreview({
  name, price, imagePreview, emoji, badge, badgeColor, isNew, isPopular, isSpicy, isPromo, discountPct,
}: {
  name: string; price: string; imagePreview: string | null;
  emoji: string; badge: string; badgeColor: string | null;
  isNew: boolean; isPopular: boolean; isSpicy: boolean; isPromo: boolean; discountPct: string;
}) {
  type BadgeItem = { text: string; bg: string; fg: string };
  const badges: BadgeItem[] = [];
  if (badge.trim()) {
    const bg = badgeColor ?? "#111111";
    const fg = badgeColor ? fgFromHex(badgeColor) : "#fff";
    badges.push({ text: badge.trim(), bg, fg });
  }
  if (isNew)     badges.push({ text: "NEW", bg: "#111", fg: "#fff" });
  if (isPopular) badges.push({ text: "★",   bg: "#F59E0B", fg: "#1C0F00" });
  if (isSpicy)   badges.push({ text: "🌶",  bg: "#FF4D6D", fg: "#fff" });
  const priceNum   = parseInt(price, 10);
  const pct        = parseInt(discountPct, 10);
  const discountedPrice = isPromo && !isNaN(pct) && pct > 0 && pct < 100 && !isNaN(priceNum)
    ? Math.round(priceNum * (1 - pct / 100))
    : null;

  return (
    <div style={{
      borderRadius: 20, overflow: "hidden",
      border: "1px solid rgba(0,0,0,0.10)",
      background: "#fff",
      display: "flex", flexDirection: "column",
      width: 150,
    }}>
      {/* Image / emoji area — 1:1 */}
      <div style={{
        width: "100%", aspectRatio: "1/1",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, background: "#f0f0f0",
      } as React.CSSProperties}>
        {imagePreview
          ? <img src={imagePreview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : (emoji || "🍽️")
        }
        {badges.length > 0 && (
          <div style={{ position: "absolute", top: 5, left: 5, display: "flex", flexDirection: "column", gap: 2 }}>
            {badges.map((b, i) => (
              <span key={i} style={{ fontSize: 7, fontWeight: 800, padding: "2px 5px", borderRadius: 6, backgroundColor: b.bg, color: b.fg, letterSpacing: "0.03em", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                {b.text}
              </span>
            ))}
          </div>
        )}
        {discountedPrice !== null && (
          <span style={{
            position: "absolute", bottom: 5, left: 5,
            fontSize: 7, fontWeight: 700, padding: "2px 6px",
            borderRadius: 8, background: "#E05555", color: "#fff",
            letterSpacing: "0.03em", lineHeight: 1.4,
          }}>
            −{pct}%
          </span>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "7px 8px 8px" }}>
        <p style={{
          fontFamily: "'Montserrat', system-ui, sans-serif",
          fontWeight: 700, fontSize: 10, color: "#111",
          margin: "0 0 4px", lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        } as React.CSSProperties}>
          {name || "Название блюда"}
        </p>
        {discountedPrice !== null ? (
          <div>
            <p style={{ fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 500, fontSize: 9, color: "#888", margin: 0, textDecoration: "line-through" }}>
              {priceNum > 0 ? `${priceNum} ₸` : ""}
            </p>
            <p style={{ fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 700, fontSize: 11, color: "#E05555", margin: 0 }}>
              {discountedPrice} ₸
            </p>
          </div>
        ) : (
          <p style={{
            fontFamily: "'Montserrat', system-ui, sans-serif",
            fontWeight: 700, fontSize: 11, color: "#111", margin: 0,
          }}>
            {!isNaN(priceNum) && priceNum > 0 ? `${priceNum} ₸` : "— ₸"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ProductModal({ mode, product, categories, defaultCategoryId, onClose, onSaved }: Props) {
  const { t } = useTranslations();
  const isStrictOwner = useIsStrictOwner();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState(product?.name.ru ?? product?.name.en ?? "");
  const [desc, setDesc]           = useState(product?.description?.ru ?? product?.description?.en ?? "");
  const [price, setPrice]         = useState(String(product?.price ?? ""));
  const [emoji, setEmoji]         = useState(product?.emoji ?? "");
  const [badge, setBadge]         = useState(product?.badge ?? "");
  const [badgeColor, setBadgeColor] = useState<string | null>(product?.badge_color ?? null);
  const [catId, setCatId]         = useState(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const [isNew, setIsNew]         = useState(product?.is_new ?? false);
  const [isPopular, setIsPopular] = useState(product?.is_popular ?? false);
  const [isSpicy, setIsSpicy]     = useState(product?.is_spicy ?? false);
  const [isAvail, setIsAvail]     = useState(product?.is_available ?? true);
  const [allergens, setAllergens] = useState<string[]>(product?.allergens ?? []);
  const [bonusPercent, setBonusPercent] = useState(product?.bonus_percent != null ? String(product.bonus_percent) : "");

  function toggleAllergen(key: string) {
    setAllergens(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  // Recipe / калькуляция
  const [dbIngredients, setDbIngredients] = useState<DbIngredient[]>([]);
  const [recipeRows, setRecipeRows]       = useState<RecipeRow[]>([]);

  const loadRecipeData = useCallback(async () => {
    if (!isConfigured) return;
    const { data: ingData } = await supabase
      .from("ingredients")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("name");
    setDbIngredients((ingData ?? []) as DbIngredient[]);

    if (product?.id) {
      const { data: recipeData } = await supabase
        .from("recipe_items")
        .select("*")
        .eq("product_id", product.id);
      setRecipeRows(
        ((recipeData ?? []) as { id: string; ingredient_id: string; weight_gross: number; weight_net: number }[])
          .map(r => ({
            key:          r.id,
            dbId:         r.id,
            ingredientId: r.ingredient_id,
            weightGross:  String(r.weight_gross),
            weightNet:    String(r.weight_net),
          }))
      );
    }
  }, [product?.id]);

  useEffect(() => { loadRecipeData(); }, [loadRecipeData]);

  function addRecipeRow() {
    setRecipeRows(prev => [...prev, {
      key: `new-${Date.now()}`, ingredientId: dbIngredients[0]?.id ?? "", weightGross: "", weightNet: "",
    }]);
  }

  function removeRecipeRow(key: string) {
    setRecipeRows(prev => prev.filter(r => r.key !== key));
  }

  function updateRecipeRow(key: string, patch: Partial<RecipeRow>) {
    setRecipeRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }

  const totalCost = recipeRows.reduce((sum, row) => {
    const ing = dbIngredients.find(i => i.id === row.ingredientId);
    if (!ing) return sum;
    return sum + calcLineCost(ing, parseFloat(row.weightGross) || 0);
  }, 0);

  const priceForCost = parseInt(price, 10);
  const markupPct    = totalCost > 0 && !isNaN(priceForCost) && priceForCost > totalCost
    ? ((priceForCost - totalCost) / totalCost) * 100 : null;
  const foodCostPct  = !isNaN(priceForCost) && priceForCost > 0 && totalCost > 0
    ? (totalCost / priceForCost) * 100 : null;

  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image_url ?? null);
  const [file, setFile]             = useState<File | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Crop state
  const [cropSrc, setCropSrc]         = useState<string | null>(null);
  const [rawMimeType, setRawMimeType] = useState("image/jpeg");

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRawMimeType(f.type || "image/jpeg");
    setCropSrc(URL.createObjectURL(f));
    // reset input so same file can be re-selected after cancel
    e.target.value = "";
  }

  function handleCropApply(blob: Blob, url: string) {
    const ext = rawMimeType === "image/png" ? "png" : rawMimeType === "image/webp" ? "webp" : "jpg";
    setFile(new File([blob], `cropped.${ext}`, { type: blob.type }));
    setPreviewUrl(url);
    setCropSrc(null);
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
        imageUrl = await validateAndUpload(file, "menu-images");
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
        badge_color: badge.trim() ? (badgeColor || null) : null,
        ...(ingredients.trim() ? { ingredients: ingredients.trim() } : {}),
        is_new: isNew,
        is_popular: isPopular,
        is_spicy: isSpicy,
        is_available: isAvail,
        is_promo: product?.is_promo ?? false,
        discount_label: product?.discount_label ?? null,
        is_archived: product?.is_archived ?? false,
        order_index: product?.order_index ?? 9999,
        allergens,
        bonus_percent: bonusPercent.trim() !== "" ? (parseFloat(bonusPercent) || 0) : null,
      };

      let savedProduct: DbProduct;
      if (mode === "edit" && product) {
        const { data, error: err } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id)
          .select()
          .single();
        if (err) throw err;
        savedProduct = data as DbProduct;
      } else {
        const { data, error: err } = await supabase
          .from("products")
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        savedProduct = data as DbProduct;
      }

      // Save recipe items (калькуляция)
      const { error: delErr } = await supabase.from("recipe_items").delete().eq("product_id", savedProduct.id);
      if (delErr) throw new Error(`Ошибка удаления тех.карты: ${delErr.message}`);
      const validRows = recipeRows.filter(r => r.ingredientId && parseFloat(r.weightGross) > 0);
      if (validRows.length > 0) {
        const { error: insErr } = await supabase.from("recipe_items").insert(
          validRows.map(r => ({
            product_id:    savedProduct.id,
            ingredient_id: r.ingredientId,
            weight_gross:  parseFloat(r.weightGross) || 0,
            weight_net:    parseFloat(r.weightNet)   || 0,
          }))
        );
        if (insErr) throw new Error(`Ошибка сохранения тех.карты: ${insErr.message}`);
      }

      onSaved(savedProduct);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Check Supabase permissions.");
      setSaving(false);
    }
  }

  const isEdit = mode === "edit";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Panel — bottom sheet on mobile, centered dialog on desktop */}
        <div className="relative w-full md:max-w-[900px] h-[92dvh] md:h-auto md:max-h-[90vh] bg-white dark:bg-zinc-900 rounded-t-2xl md:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
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

          {/* Body — single column on mobile, two columns on desktop */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
            {/* Left: scrollable form */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5 min-w-0">

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

              {/* Ingredients */}
              <Field label="Состав">
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={2}
                  placeholder="Говядина, лук, морковь, специи…"
                  className={inputCls + " resize-none"}
                />
              </Field>

              {/* Allergens */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Аллергены и особенности
                </label>
                <AllergenPicker allergens={allergens} onToggle={toggleAllergen} onChange={setAllergens} />
              </div>

              {/* Технологическая карта */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700/60">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Технологическая карта
                  </label>
                  {dbIngredients.length > 0 && (
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors"
                    >
                      <Plus size={12} />
                      Добавить
                    </button>
                  )}
                </div>

                {dbIngredients.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-4 py-3">
                    Сначала добавьте ингредиенты в разделе{" "}
                    <a href="/admin/warehouse" target="_blank" className="text-violet-600 dark:text-violet-400 underline">Склад / Ингредиенты</a>.
                  </p>
                ) : recipeRows.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-4 py-3">
                    Нет ингредиентов. Нажмите «Добавить» для создания рецептуры.
                  </p>
                ) : (
                  <div>
                    <div className="grid grid-cols-[1fr_80px_28px] gap-1.5 px-3 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Ингредиент</span>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide text-right">Вес</span>
                      <span />
                    </div>
                    <div className="px-3 pb-2 space-y-1.5">
                      {recipeRows.map(row => {
                        const ing     = dbIngredients.find(i => i.id === row.ingredientId);
                        const unitLbl = ing ? UNIT_INPUT_LABEL[ing.unit] : "г";
                        return (
                          <div key={row.key} className="grid grid-cols-[1fr_80px_28px] gap-1.5 items-center">
                            <select
                              value={row.ingredientId}
                              onChange={e => updateRecipeRow(row.key, { ingredientId: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            >
                              {dbIngredients.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                            <div className="relative">
                              <input
                                type="number" min={0} step="0.1"
                                value={row.weightGross}
                                onChange={e => updateRecipeRow(row.key, { weightGross: e.target.value, weightNet: e.target.value })}
                                placeholder="0"
                                className="w-full pr-6 pl-2 py-1.5 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-right"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 pointer-events-none">{unitLbl}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRecipeRow(row.key)}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Калькуляция — автоматический расчёт */}
              {recipeRows.length > 0 && totalCost > 0 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700/60">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Калькуляция
                    </label>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="grid grid-cols-[1fr_70px] gap-1 px-1">
                      {recipeRows.map(row => {
                        const ing = dbIngredients.find(i => i.id === row.ingredientId);
                        const lineCost = ing ? calcLineCost(ing, parseFloat(row.weightGross) || 0) : 0;
                        if (lineCost <= 0) return null;
                        return (
                          <div key={row.key} className="contents">
                            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{ing?.name}</span>
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 text-right tabular-nums">{fmtNum(lineCost)} ₸</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-700/60 mt-2 pt-2 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">Себестоимость</span>
                        <span className="text-xs font-black tabular-nums text-zinc-800 dark:text-zinc-200">{fmtNum(totalCost)} ₸</span>
                      </div>
                      {markupPct !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">Наценка</span>
                          <span className="text-xs font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmtNum(markupPct)}%</span>
                        </div>
                      )}
                      {foodCostPct !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">Фудкост</span>
                          <span className={`text-xs font-black tabular-nums ${foodCostPct > 35 ? "text-red-500" : "text-amber-500"}`}>
                            {fmtNum(foodCostPct)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.admin.priceLabel} required>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => isStrictOwner && setPrice(e.target.value)}
                    readOnly={!isStrictOwner}
                    placeholder="1200"
                    className={inputCls + (!isStrictOwner ? " opacity-50 cursor-not-allowed" : "")}
                    title={!isStrictOwner ? "Только владелец может изменять цену" : undefined}
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

              {/* Bonus percent */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Бонусы за блюдо (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={bonusPercent}
                    onChange={(e) => setBonusPercent(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <div className="flex items-end pb-0.5">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                    Сколько % от цены блюда начисляется гостю бонусами
                  </p>
                </div>
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
                {badge.trim() && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase tracking-wide font-semibold shrink-0">Цвет:</span>
                    <button
                      type="button"
                      onClick={() => setBadgeColor(null)}
                      className={`w-5 h-5 rounded-full border-2 bg-zinc-800 transition-all ${!badgeColor ? "border-violet-500 scale-110" : "border-transparent"}`}
                      title="По умолчанию"
                    />
                    {BADGE_COLORS.map(({ hex, label }) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setBadgeColor(hex)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${badgeColor === hex ? "border-violet-500 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: hex }}
                        title={label}
                      />
                    ))}
                  </div>
                )}
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


            </div>

            {/* Right: live preview — hidden on mobile */}
            <div className="hidden md:flex w-56 shrink-0 border-l border-zinc-200 dark:border-zinc-800 px-5 py-5 flex-col items-center gap-4 overflow-y-auto">
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">
                Preview
              </p>
              <PhoneMockup>
                <ProductCardPreview
                  name={name}
                  price={price}
                  imagePreview={previewUrl}
                  emoji={emoji}
                  badge={badge}
                  badgeColor={badgeColor}
                  isNew={isNew}
                  isPopular={isPopular}
                  isSpicy={isSpicy}
                  isPromo={product?.is_promo ?? false}
                  discountPct={product?.discount_label ?? ""}
                />
              </PhoneMockup>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                Так выглядит карточка блюда в меню гостя
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 md:px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/20 w-full">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
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
      </div>

      {/* Crop modal — rendered above product modal */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          mimeType={rawMimeType}
          onApply={handleCropApply}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
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
