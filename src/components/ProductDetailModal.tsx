"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Heart } from "lucide-react";
import type { Dish, Lang } from "./MenuTemplate";
import { resolve } from "./MenuTemplate";
import type { CartMap } from "./CartDrawer";
import { capFirst } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const R = { sm: 10, md: 20, lg: 24, full: 999 };

type AllergenKey = string;

const ALLERGEN_MAP: Record<string, { emoji: string; bg: string; fg: string; label: Record<Lang, string> }> = {
  spicy:        { emoji: "🌶️", bg: "#FF4D6D", fg: "#fff",    label: { en: "Spicy",           ru: "Острое",          kz: "Өткір" } },
  nuts:         { emoji: "🥜", bg: "#F59E0B", fg: "#1C0F00", label: { en: "Contains nuts",   ru: "Содержит орехи",  kz: "Жаңғақ бар" } },
  vegetarian:   { emoji: "🌱", bg: "#00C882", fg: "#001A0F", label: { en: "Vegetarian",      ru: "Вегетарианское",  kz: "Вегетариандық" } },
  lactose_free: { emoji: "🥛", bg: "#0EA5E9", fg: "#fff",    label: { en: "Lactose free",    ru: "Без лактозы",     kz: "Лактозасыз" } },
  gluten:       { emoji: "🌾", bg: "#A855F7", fg: "#fff",    label: { en: "Contains gluten", ru: "Содержит глютен", kz: "Глютен бар" } },
  dairy:        { emoji: "🧀", bg: "#F59E0B", fg: "#1C0F00", label: { en: "Dairy",           ru: "Молочное",        kz: "Сүт өнімі" } },
  eggs:         { emoji: "🥚", bg: "#F59E0B", fg: "#1C0F00", label: { en: "Eggs",            ru: "Яйца",            kz: "Жұмыртқа" } },
  shellfish:    { emoji: "🦐", bg: "#FF6B2B", fg: "#fff",    label: { en: "Shellfish",       ru: "Морепродукты",    kz: "Теңіз өнімдері" } },
  soy:          { emoji: "🫘", bg: "#10B981", fg: "#fff",    label: { en: "Soy",             ru: "Соя",             kz: "Соя" } },
  fish:         { emoji: "🐟", bg: "#0EA5E9", fg: "#fff",    label: { en: "Fish",            ru: "Рыба",            kz: "Балық" } },
  vegan:        { emoji: "🌿", bg: "#00C882", fg: "#001A0F", label: { en: "Vegan",           ru: "Веганское",       kz: "Вегандық" } },
  halal:        { emoji: "☪️", bg: "#10B981", fg: "#fff",    label: { en: "Halal",           ru: "Халяль",          kz: "Халал" } },
};

const T: Record<string, Record<Lang, string>> = {
  ingredients: { en: "Ingredients",      ru: "Состав",               kz: "Құрамы" },
  features:    { en: "Features",         ru: "Особенности",          kz: "Ерекшеліктері" },
  addons:      { en: "Add-ons",          ru: "Добавки",              kz: "Қосымшалар" },
  addToCart:   { en: "Add to cart",      ru: "Добавить в корзину",   kz: "Себетке қосу" },
  customize:   { en: "Choose add-ons",   ru: "Выбрать добавки",      kz: "Қосымша таңдау" },
  added:       { en: "Added ✓",          ru: "Добавлено ✓",          kz: "Қосылды ✓" },
};

const tn = (key: string, lang: Lang): string => T[key]?.[lang] ?? T[key]?.en ?? key;

export interface ProductDetailModalProps {
  dish: Dish | null;
  lang: Lang;
  currency: string;
  cart: CartMap;
  onClose: () => void;
  onAddToCart: (dish: Dish, currency: string, delta: number) => void;
  liked?: Record<string, boolean>;
  onToggleLike?: (id: string) => void;
  getLikeCount?: (id: string) => number;
}

export function ProductDetailModal({
  dish, lang, currency, cart, onClose, onAddToCart, liked = {}, onToggleLike, getLikeCount,
}: ProductDetailModalProps) {
  const [added, setAdded] = useState(false);
  const [recipe, setRecipe] = useState<{ name: string; weight: number; unit: string }[]>([]);

  useEffect(() => {
    if (!dish) { setRecipe([]); return; }
    let cancelled = false;
    const sb = getSupabaseBrowser();
    sb.from("recipe_items")
      .select("weight_gross, ingredients:ingredient_id(name, unit)")
      .eq("product_id", dish.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const UNIT_LABEL: Record<string, string> = { kg: "г", liter: "мл", pcs: "шт" };
        setRecipe(
          (data as { weight_gross: number; ingredients: { name: string; unit: string } | null }[])
            .filter(r => r.ingredients)
            .map(r => ({
              name: r.ingredients!.name,
              weight: r.weight_gross,
              unit: UNIT_LABEL[r.ingredients!.unit] ?? r.ingredients!.unit,
            }))
        );
      });
    return () => { cancelled = true; };
  }, [dish?.id]);

  const qty = dish
    ? dish.modifiers?.length
      ? Object.entries(cart)
          .filter(([k]) => k === dish.id || k.startsWith(`${dish.id}:`))
          .reduce((s, [, v]) => s + (v as { qty: number }).qty, 0)
      : cart[dish.id]?.qty ?? 0
    : 0;
  const atLimit = dish != null && dish.remainingQty != null && qty >= dish.remainingQty;

  const dishPct = dish?.isPromo && dish.discountLabel ? parseInt(dish.discountLabel, 10) : 0;
  const discountedPrice =
    dish && !isNaN(dishPct) && dishPct > 0 && dishPct < 100
      ? Math.round(dish.price * (1 - dishPct / 100))
      : null;

  const allergenBadges = dish
    ? (() => {
        const keys: AllergenKey[] = [...(dish.allergens ?? [])];
        if (dish.isSpicy && !keys.includes("spicy")) keys.unshift("spicy");
        return keys
          .map((k) => {
            const def = ALLERGEN_MAP[k];
            if (def) return { emoji: def.emoji, label: def.label[lang] ?? def.label.en, bg: def.bg, fg: def.fg };
            return { emoji: "🏷️", label: k, bg: "#7C3AED", fg: "#fff" };
          });
      })()
    : [];

  function handleAdd() {
    if (!dish) return;
    onAddToCart(dish, currency, +1);
    if (!dish.modifiers?.length) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  }

  function handleRemove() {
    if (!dish) return;
    onAddToCart(dish, currency, -1);
  }

  return (
    <AnimatePresence>
      {dish && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pdm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 210,
            }}
          />

          {/* Slide-up panel */}
          <motion.div
            key="pdm-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: "max(calc(50vw - 240px), 0px)",
              right: "max(calc(50vw - 240px), 0px)",
              zIndex: 211,
              backgroundColor: "var(--bg-color)",
              borderRadius: "24px 24px 0 0",
              maxHeight: "92dvh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            } as React.CSSProperties}
          >
            {/* Hero image / emoji */}
            <div
              style={{
                position: "relative",
                height: 260,
                flexShrink: 0,
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                overflow: "hidden",
              }}
            >
              {dish.imageUrl ? (
                <img
                  src={dish.imageUrl}
                  alt={resolve(dish.name, lang)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                dish.emoji
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: R.full,
                  border: "none",
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.48)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                } as React.CSSProperties}
              >
                <X size={18} />
              </button>

              {/* Discount badge */}
              {discountedPrice !== null && (
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: R.full,
                    backgroundColor: "#FF6B2B",
                    color: "#fff",
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    zIndex: 2,
                  }}
                >
                  −{dishPct}%
                </span>
              )}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
              {/* Name + price row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    margin: 0,
                    lineHeight: 1.25,
                    color: "var(--text-color)",
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    flex: 1,
                  }}
                >
                  {capFirst(resolve(dish.name, lang))}
                </h2>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {discountedPrice !== null ? (
                    <>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          margin: 0,
                          color: "var(--text-muted)",
                          textDecoration: "line-through",
                        }}
                      >
                        {dish.price.toLocaleString()} {currency}
                      </p>
                      <p
                        style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#FF6B2B" }}
                      >
                        {discountedPrice.toLocaleString()} {currency}
                      </p>
                    </>
                  ) : (
                    <p
                      style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-color)" }}
                    >
                      {dish.price.toLocaleString()} {currency}
                    </p>
                  )}
                </div>
              </div>

              {/* Bonus + Like row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                {!!dish.bonusPercent && dish.bonusPercent > 0 ? (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#10B981" }}>
                    ⭐ +{Math.round((discountedPrice ?? dish.price) * dish.bonusPercent / 100)} {lang === "en" ? "bonuses" : lang === "kz" ? "бонус" : "бонусов"}
                  </p>
                ) : <span />}
                {onToggleLike && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleLike(dish.id); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", cursor: "pointer",
                      padding: "4px 8px", borderRadius: 99,
                      color: liked[dish.id] ? "#EF4444" : "var(--text-muted)",
                      fontSize: 13, fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    <Heart size={16} fill={liked[dish.id] ? "#EF4444" : "none"} />
                    {getLikeCount ? getLikeCount(dish.id) : 0}
                  </button>
                )}
              </div>

              {/* Description */}
              {resolve(dish.desc, lang) && (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    margin: "0 0 16px",
                    color: "var(--text-muted)",
                  }}
                >
                  {resolve(dish.desc, lang)}
                </p>
              )}

              {/* Ingredients */}
              {dish.ingredients && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      margin: "0 0 6px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}
                  >
                    {tn("ingredients", lang)}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      margin: 0,
                      color: "var(--text-muted)",
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}
                  >
                    {dish.ingredients}
                  </p>
                </div>
              )}

              {/* Allergen / feature badges */}
              {allergenBadges.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      margin: "0 0 8px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}
                  >
                    {tn("features", lang)}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allergenBadges.map((b, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "5px 12px",
                          borderRadius: R.full,
                          backgroundColor: b.bg,
                          color: b.fg,
                          fontFamily: "'Montserrat', system-ui, sans-serif",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {b.emoji} {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipe / Рецептура */}
              {recipe.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, margin: "0 0 8px",
                    color: "var(--text-muted)", textTransform: "uppercase",
                    letterSpacing: "0.06em", fontFamily: "'Montserrat', system-ui, sans-serif",
                  }}>
                    {lang === "kz" ? "Рецепт" : lang === "ru" ? "Рецептура" : "Recipe"}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {recipe.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "var(--text-color)" }}>{r.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {r.weight} {r.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifiers list */}
              {dish.modifiers && dish.modifiers.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      margin: "0 0 8px",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}
                  >
                    {tn("addons", lang)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dish.modifiers.map((mod) => (
                      <div
                        key={mod.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderRadius: R.sm,
                          border: "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-surface)",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--text-color)" }}>{mod.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-color)" }}>
                          +{mod.price.toLocaleString()} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacer for sticky footer clearance */}
              <div style={{ height: 100 }} />
            </div>

            {/* Sticky footer — cart controls */}
            <div
              style={{
                padding: "12px 20px 20px",
                borderTop: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-color)",
                flexShrink: 0,
              }}
            >
              {qty > 0 && !dish.modifiers?.length ? (
                /* Stepper row when item already in cart */
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={handleRemove}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: R.full,
                      border: "1.5px solid var(--border-color)",
                      background: "var(--bg-surface)",
                      color: "var(--text-color)",
                      cursor: "pointer",
                      fontSize: 22,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      minWidth: 28,
                      textAlign: "center",
                      color: "var(--text-color)",
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={handleAdd}
                    disabled={atLimit}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: R.full,
                      border: "none",
                      background: added ? "#10B981" : "var(--cta-bg)",
                      color: "var(--cta-fg)",
                      cursor: atLimit ? "default" : "pointer",
                      opacity: atLimit ? 0.45 : 1,
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                      transition: "background 0.25s",
                    } as React.CSSProperties}
                  >
                    {added ? tn("added", lang) : `+ ${tn("addToCart", lang)}`}
                  </button>
                </div>
              ) : (
                /* Full-width add button */
                <button
                  onClick={handleAdd}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: R.full,
                    border: "none",
                    background: added ? "#10B981" : "var(--cta-bg)",
                    color: "var(--cta-fg)",
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    transition: "background 0.25s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  } as React.CSSProperties}
                >
                  {added
                    ? tn("added", lang)
                    : dish.modifiers?.length
                    ? `+ ${tn("customize", lang)}`
                    : `+ ${tn("addToCart", lang)}`}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
