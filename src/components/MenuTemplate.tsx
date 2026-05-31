"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SlideTag } from "@/lib/db-types";
import { capFirst } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Sun, Moon, ChevronDown, Heart, Search, X, Clock } from "lucide-react";
import { FloatingNavBar } from "./FloatingNavBar";
import { CartDrawer, type CartMap, type StoredOrder } from "./CartDrawer";
import { WaiterModal } from "./WaiterModal";
import { OrdersModal } from "./OrdersModal";
import { PushNotificationBanner } from "./PushNotificationBanner";
import { ProductDetailModal } from "./ProductDetailModal";

export type { StoredOrder };

// ── Types ─────────────────────────────────────────────────────────────────────

export type Lang = "en" | "ru" | "kz";
export type LS = { en: string; ru: string; kz: string };

export function resolve(s: string | LS, lang: Lang): string {
  if (typeof s === "string") return s;
  return s[lang] ?? s.en;
}

export interface DishModifier {
  id: string;
  name: string;
  price: number;
}

export interface Dish {
  id: string;
  emoji: string;
  imageUrl?: string;
  discountLabel?: string;
  name: string | LS;
  desc: string | LS;
  price: number;
  currency?: string;
  badge?: string;
  badgeColor?: string;
  isNew?: boolean;
  isPopular?: boolean;
  isSpicy?: boolean;
  isPromo?: boolean;
  isRecommended?: boolean;
  ingredients?: string;
  allergens?: string[];
  modifiers?: DishModifier[];
}

export interface Banner {
  id: string;
  imageUrl: string | null;
  title?: string | LS;
  subtitle?: string | LS;
  linkUrl?: string | null;
}

export interface MenuCategory {
  id: string;
  icon: string;
  name: string | LS;
  dishes: Dish[];
  imageUrl?: string;
}

export interface PaymentInfo {
  bankName: string;
  phone: string;
  recipientName?: string;
}

export interface RestaurantInfo {
  name: string;
  logoUrl?: string;
  address?: string | LS;
  currency?: string;
  kaspiPhone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  phone?: string;
  description?: string | LS;
  cardTransferOptions?: PaymentInfo[];
  serviceCharge?: string;
  workingHours?: string | LS;
}

export interface HeroBanner {
  imageUrl?: string;
  title?: string | LS;
  subtitle?: string | LS;
}

export interface HeroSlide {
  id: string;
  type: "image" | "video";
  url: string;
  title?: string | null;
  description?: string | null;
  tags?: SlideTag[] | null;
}

export interface FeaturedItem {
  id: string;
  emoji: string;
  name: string | LS;
  desc?: string | LS;
  price: number;
  currency?: string;
  tag?: string;
}

export interface ShowcaseItem {
  id: string;
  emoji: string;
  title: string | LS;
  description?: string | null;
}

export interface MenuTemplateProps {
  restaurant: RestaurantInfo;
  categories: MenuCategory[];
  lang?: Lang;
  heroBanner?: HeroBanner;
  heroSlides?: HeroSlide[];
  banners?: Banner[];
  showcaseItems?: ShowcaseItem[];
  featuredItems?: FeaturedItem[];
  featuredTitle?: string | LS;
  ctaLabel?: string;
  initialTableNumber?: string;
  restaurantTables?: { id: string; label: string }[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 10, md: 20, lg: 24, full: 999 } as const;
const HEADER_H  = 80;                     // 64px height + 8px top margin + 8px gap below
const SLIDER_H  = "min(485px, 133vw)";   // hero slider height — ~485px on any phone

// ── Theme ─────────────────────────────────────────────────────────────────────

type Theme = "dark" | "light";

const DARK_VARS = {
  "--bg-color":       "#111111",
  "--bg-surface":     "#1A1A1A",
  "--bg-card":        "#1E1E1E",
  "--bg-shell":       "#0A0A0A",
  "--text-color":     "#E0E0E0",
  "--text-muted":     "#9A9A9A",
  "--border-color":   "#303030",
  "--pill-active-bg": "#E0E0E0",
  "--pill-active-fg": "#111111",
  "--pill-border":    "#383838",
  "--pill-text":      "#9A9A9A",
  "--cta-bg":         "#E0E0E0",
  "--cta-fg":         "#111111",
  "--card-shadow":    "none",
};

const LIGHT_VARS = {
  "--bg-color":       "#F5F5F7",
  "--bg-surface":     "#EBEBED",
  "--bg-card":        "#FFFFFF",
  "--bg-shell":       "#D0D4D9",
  "--text-color":     "#111111",
  "--text-muted":     "#6B7280",
  "--border-color":   "#E2E4E8",
  "--pill-active-bg": "#111111",
  "--pill-active-fg": "#FFFFFF",
  "--pill-border":    "#D0D4D9",
  "--pill-text":      "#5C6370",
  "--cta-bg":         "#111111",
  "--cta-fg":         "#FFFFFF",
  "--card-shadow":    "none",
};

// ── Featured / Promotions section ─────────────────────────────────────────────

function FeaturedSection({
  items,
  title,
  lang,
  defaultCurrency,
}: {
  items: FeaturedItem[];
  title: string | LS | undefined;
  lang: Lang;
  defaultCurrency?: string;
}) {
  const label = title
    ? resolve(title, lang)
    : lang === "kz" ? "Арнайы ұсыныстар"
    : lang === "ru" ? "Спецпредложения"
    : "Special Offers";

  return (
    <section
      style={{
        paddingTop: SP.lg,
        paddingBottom: SP.sm,
        marginBottom: SP.lg,
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SP.sm,
          paddingLeft: SP.md,
          paddingRight: SP.md,
          marginBottom: SP.md,
        }}
      >
        <div
          style={{
            width: 3,
            height: 20,
            borderRadius: R.full,
            backgroundColor: "var(--text-color)",
            flexShrink: 0,
          }}
        />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
          {label}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        <span style={{ fontSize: 18 }}>⭐</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: SP.sm + 4,
          overflowX: "auto",
          paddingLeft: SP.md,
          paddingRight: SP.md,
          paddingBottom: SP.sm,
          scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              flexShrink: 0,
              width: 152,
              borderRadius: R.lg,
              overflow: "hidden",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-card)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div
              style={{
                height: 100,
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                position: "relative",
              }}
            >
              {item.emoji}
              {item.tag && (
                <span
                  style={{
                    position: "absolute",
                    top: SP.xs,
                    left: SP.xs,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 7px",
                    borderRadius: R.sm,
                    backgroundColor: "var(--text-color)",
                    color: "var(--bg-color)",
                    letterSpacing: "0.03em",
                    lineHeight: 1.4,
                  }}
                >
                  {item.tag}
                </span>
              )}
            </div>

            <div style={{ padding: SP.sm }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  margin: "0 0 3px",
                  color: "var(--text-color)",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                {capFirst(resolve(item.name, lang))}
              </p>
              {item.desc && (
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    margin: "0 0 5px",
                    lineHeight: 1.4,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}
                >
                  {resolve(item.desc, lang)}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
                {item.price.toLocaleString()} {item.currency ?? defaultCurrency ?? ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── DB Banner Slider ──────────────────────────────────────────────────────────

function BannerSlider({ banners, lang }: { banners: Banner[]; lang: Lang }) {
  if (!banners.length) return null;
  return (
    <section style={{ marginBottom: SP.lg + 4 }}>
      <div
        style={{
          display: "flex", gap: 12,
          overflowX: "auto",
          marginLeft: -SP.md, marginRight: -SP.md,
          paddingLeft: SP.md, paddingRight: SP.md,
          paddingBottom: SP.sm, scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            onClick={() => banner.linkUrl ? window.open(banner.linkUrl, "_blank") : undefined}
            style={{
              flexShrink: 0, width: 280, height: 140,
              borderRadius: 16, overflow: "hidden",
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.10)",
              cursor: banner.linkUrl ? "pointer" : "default",
              position: "relative",
            }}
          >
            {banner.imageUrl ? (
              <img
                src={banner.imageUrl}
                alt={banner.title ? resolve(banner.title, lang) : ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                🖼️
              </div>
            )}
            {(banner.title || banner.subtitle) && (
              <div style={{
                position: "absolute", bottom: 8, left: 8, right: 8,
                background: "rgba(0,0,0,0.52)",
                borderRadius: 10,
                padding: "6px 10px",
              }}>
                {banner.title && (
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: "0 0 1px", lineHeight: 1.2 }}>
                    {resolve(banner.title, lang)}
                  </p>
                )}
                {banner.subtitle && (
                  <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, margin: 0 }}>
                    {resolve(banner.subtitle, lang)}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Marketing Banner Slider (hardcoded, home view) ────────────────────────────

const PROMO_SLIDES = [
  {
    id: "ps1",
    bg: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    emoji: "🍕",
    badge: "−20%",
    badgeBg: "#FF4D6D",
    title: "Скидка 20% на все пиццы",
    sub: "Только в будни с 12:00 до 16:00",
  },
  {
    id: "ps2",
    bg: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
    emoji: "🚗",
    badge: "FREE",
    badgeBg: "#10B981",
    title: "Бесплатная доставка",
    sub: "При заказе от 3 000 ₸",
  },
  {
    id: "ps3",
    bg: "linear-gradient(135deg, #3b1f6e 0%, #1a1a2e 100%)",
    emoji: "⭐",
    badge: "NEW",
    badgeBg: "#F59E0B",
    title: "Новинки сезона",
    sub: "Попробуй что-то новое уже сегодня",
  },
];

function MarketingBannerSlider({ lang: _lang }: { lang: Lang }) {
  const [cur, setCur] = useState(0);
  const dragRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCur((c) => (c + 1) % PROMO_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  const goTo = (i: number) => setCur((i + PROMO_SLIDES.length) % PROMO_SLIDES.length);

  const onTouchStart = (e: React.TouchEvent) => { dragRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragRef.current === null) return;
    const dx = e.changedTouches[0].clientX - dragRef.current;
    if (Math.abs(dx) > 44) goTo(cur + (dx < 0 ? 1 : -1));
    dragRef.current = null;
  };

  return (
    <div
      style={{
        marginBottom: SP.lg + 4,
        position: "relative", overflow: "hidden",
        borderRadius: 18, height: 130,
        userSelect: "none",
      } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {PROMO_SLIDES.map((s, i) => (
        <div
          key={s.id}
          style={{
            position: "absolute", inset: 0,
            background: s.bg,
            opacity: i === cur ? 1 : 0,
            transition: "opacity 0.55s ease",
            pointerEvents: i === cur ? "auto" : "none",
            display: "flex", alignItems: "center",
            padding: "0 20px", gap: 14,
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: R.full, flexShrink: 0,
            background: "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
          }}>
            {s.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "inline-block",
              fontSize: 10, fontWeight: 800,
              padding: "3px 9px", borderRadius: R.full,
              background: s.badgeBg, color: "#fff",
              marginBottom: 5, letterSpacing: "0.05em",
              fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>{s.badge}</span>
            <p style={{
              color: "#fff", fontWeight: 800, fontSize: 16,
              margin: "0 0 3px", lineHeight: 1.2,
              fontFamily: "'Montserrat', system-ui, sans-serif",
              textShadow: "0 1px 8px rgba(0,0,0,0.35)",
            }}>{s.title}</p>
            <p style={{
              color: "rgba(255,255,255,0.72)", fontSize: 11,
              margin: 0, fontWeight: 500,
              fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>{s.sub}</p>
          </div>
        </div>
      ))}

      <div style={{
        position: "absolute", bottom: 8, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none",
      }}>
        {PROMO_SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === cur ? 18 : 5, height: 5,
              borderRadius: R.full,
              background: i === cur ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Promo Slider ─────────────────────────────────────────────────────────────

function PromoSlider({
  dishes,
  lang,
}: {
  dishes: Dish[];
  lang: Lang;
}) {
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [displayDish, setDisplayDish]   = useState<Dish | null>(null);

  if (!dishes.length) return null;

  const tTitle =
    lang === "kz" ? "Арнайы ұсыныстар"
    : lang === "ru" ? "Акции и спецпредложения"
    : "Special Offers";
  const tClose = lang === "kz" ? "Жабу" : lang === "ru" ? "Закрыть" : "Close";

  const openDetail = (dish: Dish) => {
    setDisplayDish(dish);
    setSelectedDish(dish);
  };
  const closeDetail = () => {
    setSelectedDish(null);
    setTimeout(() => setDisplayDish(null), 350);
  };

  return (
    <>
      <section style={{ marginBottom: SP.lg + 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.md }}>
          <div style={{ width: 3, height: 20, borderRadius: R.full, backgroundColor: "var(--text-color)", flexShrink: 0 }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>{tTitle}</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        </div>

        <div style={{
          display: "flex", gap: 12, overflowX: "auto",
          marginLeft: -SP.md, marginRight: -SP.md,
          paddingLeft: SP.md, paddingRight: SP.md,
          paddingBottom: SP.sm, scrollbarWidth: "none",
        } as React.CSSProperties}>
          {dishes.map((dish, idx) => {
            const palette = PROMO_PALETTES[idx % PROMO_PALETTES.length];
            return (
              <button
                key={dish.id}
                onClick={() => openDetail(dish)}
                style={{
                  flexShrink: 0, width: 190, height: 150,
                  borderRadius: 18, background: palette.bg,
                  position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: 14, border: "none", cursor: "pointer",
                  textAlign: "left",
                } as React.CSSProperties}
              >
                {dishBadges(dish).length > 0 && (
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <BadgeStack badges={dishBadges(dish)} size="xs" />
                  </div>
                )}

                <span style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-60%)",
                  fontSize: 56, pointerEvents: "none",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
                }}>{dish.emoji}</span>

                <p style={{
                  color: "rgba(255,255,255,0.95)", fontWeight: 700, fontSize: 13,
                  margin: 0, lineHeight: 1.25, maxWidth: "65%",
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                }}>
                  {capFirst(resolve(dish.name, lang))}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Promo detail popup — placeholder for admin-panel managed content */}
      <div
        onClick={closeDetail}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
          zIndex: 80,
          opacity: selectedDish ? 1 : 0,
          pointerEvents: selectedDish ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      />
      <div style={{
        position: "fixed", bottom: 0,
        left: "max(calc(50vw - 240px), 0px)", width: "min(100vw, 480px)",
        background: "var(--bg-color)",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
        zIndex: 90, padding: "20px 20px 36px",
        transform: selectedDish ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        fontFamily: "'Montserrat', system-ui, sans-serif",
        color: "var(--text-color)",
      } as React.CSSProperties}>
        {displayDish && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: R.md, flexShrink: 0,
                background: "var(--bg-surface)", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40,
              }}>
                {displayDish.imageUrl ? (
                  <img src={displayDish.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : displayDish.emoji}
              </div>
              <div style={{ flex: 1 }}>
                {dishBadges(displayDish).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    <BadgeStack badges={dishBadges(displayDish)} size="xs" />
                  </div>
                )}
                <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>
                  {capFirst(resolve(displayDish.name, lang))}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {resolve(displayDish.desc, lang)}
                </p>
              </div>
            </div>
            <button
              onClick={closeDetail}
              style={{
                width: "100%", padding: "12px 0", borderRadius: R.full,
                border: "1px solid var(--border-color)",
                background: "var(--bg-surface)",
                color: "var(--text-color)",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              {tClose}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ── Popular Dishes ─────────────────────────────────────────────────────────────

function PopularDishesSection({
  dishes,
  lang,
  liked,
  getLikeCount,
  onGoToDish,
}: {
  dishes: Dish[];
  lang: Lang;
  liked: Record<string, boolean>;
  getLikeCount: (id: string) => number;
  onGoToDish: (dishId: string) => void;
}) {
  if (!dishes.length) return null;

  const tTitle =
    lang === "kz" ? "Танымал тағамдар"
    : lang === "ru" ? "Популярные блюда"
    : "Popular Dishes";

  const sorted = [...dishes]
    .sort((a, b) => getLikeCount(b.id) - getLikeCount(a.id))
    .slice(0, 8);

  return (
    <section style={{ marginBottom: SP.lg + 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.md }}>
        <div style={{ width: 3, height: 20, borderRadius: R.full, backgroundColor: "var(--text-color)", flexShrink: 0 }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
          {tTitle}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
      </div>

      <div
        style={{
          display: "flex", gap: 12,
          overflowX: "auto",
          marginLeft: -SP.md, marginRight: -SP.md,
          paddingLeft: SP.md, paddingRight: SP.md,
          paddingBottom: SP.sm,
          scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {sorted.map((dish) => {
          const badges = dishBadges(dish);
          const likeCount = getLikeCount(dish.id);
          const isLiked = !!liked[dish.id];
          const discountPct = dish.isPromo && dish.discountLabel ? parseInt(dish.discountLabel, 10) : 0;
          const discountedPrice = !isNaN(discountPct) && discountPct > 0 && discountPct < 100
            ? Math.round(dish.price * (1 - discountPct / 100))
            : null;

          return (
            <div
              key={dish.id}
              onClick={() => onGoToDish(dish.id)}
              style={{
                flexShrink: 0, width: 148,
                borderRadius: R.lg, overflow: "hidden",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
                boxShadow: "var(--card-shadow)",
                cursor: "pointer",
                display: "flex", flexDirection: "column",
              } as React.CSSProperties}
            >
              <div style={{
                height: 148, width: "100%",
                backgroundColor: "var(--bg-surface)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 50, position: "relative", overflow: "hidden",
              }}>
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : dish.emoji}
                {badges.length > 0 && (
                  <div style={{ position: "absolute", top: 6, left: 6 }}>
                    <BadgeStack badges={badges} size="xs" />
                  </div>
                )}
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  display: "flex", alignItems: "center", gap: 3,
                  fontSize: 9, fontWeight: 800,
                  padding: "3px 7px", borderRadius: R.full,
                  backgroundColor: "rgba(0,0,0,0.52)", color: "#fff",
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  lineHeight: 1.4,
                }}>
                  <Heart size={9} strokeWidth={2.5} fill={isLiked ? "#FF4D6D" : "#fff"} stroke={isLiked ? "#FF4D6D" : "#fff"} />
                  {likeCount}
                </div>
              </div>

              <div style={{ padding: "9px 10px 11px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <p style={{
                  fontSize: 12, fontWeight: 700, margin: "0 0 6px",
                  color: "var(--text-color)",
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  lineHeight: 1.3, overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                }}>
                  {capFirst(resolve(dish.name, lang))}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
                    {(discountedPrice ?? dish.price).toLocaleString()} {dish.currency ?? ""}
                  </p>
                  {discountedPrice !== null && (
                    <p style={{ fontSize: 10, margin: 0, color: "var(--text-muted)", textDecoration: "line-through" }}>
                      {dish.price.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── "А вы это пробовали?" horizontal section ──────────────────────────────────

function TryThisSection({
  dishes,
  lang,
  defaultCurrency,
  onGoToDish,
}: {
  dishes: Dish[];
  lang: Lang;
  defaultCurrency?: string;
  onGoToDish: (dishId: string) => void;
}) {
  if (!dishes.length) return null;

  const title =
    lang === "kz" ? "Бұны сынап көрдіңіз бе?"
    : lang === "ru" ? "А вы это пробовали?"
    : "Have You Tried This?";

  return (
    <section style={{ marginBottom: SP.lg + 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.md }}>
        <div style={{ width: 3, height: 20, borderRadius: R.full, backgroundColor: "var(--text-color)", flexShrink: 0 }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
      </div>

      <div
        style={{
          display: "flex", gap: 12,
          overflowX: "auto",
          marginLeft: -SP.md, marginRight: -SP.md,
          paddingLeft: SP.md, paddingRight: SP.md,
          paddingBottom: SP.sm,
          scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {dishes.map((dish) => {
          const badges = dishBadges(dish);
          const discountPct = dish.isPromo && dish.discountLabel ? parseInt(dish.discountLabel, 10) : 0;
          const discountedPrice = !isNaN(discountPct) && discountPct > 0 && discountPct < 100
            ? Math.round(dish.price * (1 - discountPct / 100))
            : null;

          return (
            <div
              key={dish.id}
              onClick={() => onGoToDish(dish.id)}
              style={{
                flexShrink: 0, width: 148,
                borderRadius: R.lg, overflow: "hidden",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
                boxShadow: "var(--card-shadow)",
                cursor: "pointer",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{
                height: 148, width: "100%",
                backgroundColor: "var(--bg-surface)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 50, position: "relative", overflow: "hidden",
              }}>
                {dish.imageUrl ? (
                  <img
                    src={dish.imageUrl}
                    alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : dish.emoji}
                {badges.length > 0 && (
                  <div style={{ position: "absolute", top: 6, left: 6 }}>
                    <BadgeStack badges={badges} size="xs" />
                  </div>
                )}
              </div>

              <div style={{ padding: "9px 10px 11px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <p style={{
                  fontSize: 12, fontWeight: 700, margin: "0 0 6px",
                  color: "var(--text-color)",
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  lineHeight: 1.3, overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                }}>
                  {capFirst(resolve(dish.name, lang))}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
                    {(discountedPrice ?? dish.price).toLocaleString()} {dish.currency ?? defaultCurrency ?? ""}
                  </p>
                  {discountedPrice !== null && (
                    <p style={{ fontSize: 10, margin: 0, color: "var(--text-muted)", textDecoration: "line-through" }}>
                      {dish.price.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Info Cards ────────────────────────────────────────────────────────────────

function InfoCards({
  lang,
  theme,
  whatsappPhone,
  instagramUrl,
  phone,
  address,
  workingHours,
  onGoToCatalog,
}: {
  lang: Lang;
  theme: "dark" | "light";
  whatsappPhone?: string;
  instagramUrl?: string;
  phone?: string;
  address?: string | LS;
  workingHours?: string | LS;
  onGoToCatalog?: () => void;
}) {
  const isDark = theme === "dark";
  const [contactOpen,   setContactOpen]   = useState(false);
  const [orderInfoOpen, setOrderInfoOpen] = useState(false);

  const tBook     = lang === "kz" ? "Үстел брондау"      : lang === "ru" ? "Забронировать стол" : "Reserve a Table";
  const tContact  = lang === "kz" ? "Байланыс"           : lang === "ru" ? "Связаться с нами"   : "Contact Us";
  const tPreorder = lang === "kz" ? "Алдын ала тапсырыс" : lang === "ru" ? "Предзаказ"          : "Pre-order";
  const tDelivery = lang === "kz" ? "Жеткізу"            : lang === "ru" ? "Доставка"           : "Delivery";
  const tPhone    = lang === "kz" ? "Телефон"            : lang === "ru" ? "Телефон"            : "Phone";
  const tAddress  = lang === "kz" ? "Мекенжай"           : lang === "ru" ? "Адрес"              : "Address";
  const tHours    = lang === "kz" ? "Жұмыс уақыты"       : lang === "ru" ? "Часы работы"        : "Working Hours";

  const bookingMsg =
    lang === "kz" ? "Сәлем! Мен сіздің мейрамханаңызда үстел броньдағым келеді. Бос орындарды айтып беріңіз."
    : lang === "ru" ? "Здравствуйте! Я хотел бы забронировать столик в вашем ресторане. Подскажите, пожалуйста, свободные места."
    : "Hello! I would like to book a table at your restaurant. Please provide availability.";

  const preorderMsg =
    lang === "kz" ? "Сәлем! Мен алдын ала тапсырыс жасағым келеді."
    : lang === "ru" ? "Здравствуйте! Я хочу сделать предзаказ."
    : "Hello! I would like to make a pre-order.";

  const deliveryMsg =
    lang === "kz" ? "Сәлем! Мен жеткізу тапсырысы берген болатынмын."
    : lang === "ru" ? "Здравствуйте! Я хочу заказать доставку."
    : "Hello! I would like to order delivery.";

  const openWA = (msg: string) => {
    if (!whatsappPhone) return;
    window.open(`https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const cardBase: React.CSSProperties = {
    height: 72, borderRadius: R.lg,
    border: "1px solid var(--border-color)",
    background: isDark ? "var(--bg-card)" : "#FFFFFF",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 4, cursor: "pointer",
    boxShadow: "var(--card-shadow)",
    transition: "background 0.15s",
  };

  const rowLabel: React.CSSProperties = { margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 };
  const rowValue: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-color)", lineHeight: 1.4 };

  const igHandle = instagramUrl
    ? instagramUrl.replace(/https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")
    : null;

  const activeBg = isDark ? "#E0E0E0" : "#121212";
  const activeFg = isDark ? "#121212" : "#E0E0E0";

  return (
    <section style={{ marginBottom: SP.lg }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button onClick={() => openWA(bookingMsg)} style={cardBase}>
          <span style={{ fontSize: 22 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tBook}</span>
        </button>
        <button onClick={() => setOrderInfoOpen(true)} style={cardBase}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tPreorder}</span>
        </button>
        <button onClick={() => setOrderInfoOpen(true)} style={cardBase}>
          <span style={{ fontSize: 22 }}>🚗</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tDelivery}</span>
        </button>
        <button
          onClick={() => setContactOpen((o) => !o)}
          style={{ ...cardBase, background: contactOpen ? activeBg : cardBase.background }}
        >
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: contactOpen ? activeFg : "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tContact}</span>
        </button>
      </div>

      {/* Inline accordion — slides down below the grid */}
      <div style={{
        maxHeight: contactOpen ? "400px" : "0px",
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s",
        opacity: contactOpen ? 1 : 0,
      } as React.CSSProperties}>
        <div style={{
          marginTop: 10,
          borderRadius: R.lg,
          border: "1px solid var(--border-color)",
          background: isDark ? "var(--bg-card)" : "#FFFFFF",
          padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 14,
          boxShadow: "var(--card-shadow)",
        }}>
          {igHandle && instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>📸</span>
              <div>
                <p style={rowLabel}>Instagram</p>
                <p style={rowValue}>{igHandle}</p>
              </div>
            </a>
          )}
          {phone && (
            <a href={`tel:${phone}`}
              style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>📞</span>
              <div>
                <p style={rowLabel}>{tPhone}</p>
                <p style={rowValue}>{phone}</p>
              </div>
            </a>
          )}
          {address && (() => {
            const addrStr = resolve(address, lang);
            const isUrl = /^https?:\/\//i.test(addrStr);
            return (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
                <div>
                  <p style={rowLabel}>{tAddress}</p>
                  {isUrl ? (
                    <a href={addrStr} target="_blank" rel="noopener noreferrer" style={{ ...rowValue, color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(128,128,128,0.5)" }}>
                      {addrStr}
                    </a>
                  ) : (
                    <p style={rowValue}>{addrStr}</p>
                  )}
                </div>
              </div>
            );
          })()}
          {workingHours && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🕐</span>
              <div>
                <p style={rowLabel}>{tHours}</p>
                <p style={rowValue}>{resolve(workingHours, lang)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Order Info Modal (Delivery / Preorder) ────────────────────────── */}
      {orderInfoOpen && (
        <>
          <div
            onClick={() => setOrderInfoOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
            }}
          />
          <div style={{
            position: "fixed", bottom: 0, zIndex: 101,
            left: "max(calc(50vw - 240px), 0px)",
            width: "min(100vw, 480px)",
            background: isDark ? "#1C1C1C" : "#FFFFFF",
            borderRadius: "24px 24px 0 0",
            padding: "28px 24px calc(env(safe-area-inset-bottom, 0px) + 76px)",
            fontFamily: "'Montserrat', system-ui, sans-serif",
            boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: isDark ? "#3A3A3A" : "#DDE1E6" }} />
            </div>

            {/* Icon */}
            <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>🛍️</div>

            {/* Title */}
            <h2 style={{
              margin: "0 0 12px",
              fontSize: 20, fontWeight: 800,
              color: isDark ? "#F0F0F0" : "#111111",
              textAlign: "center",
            }}>
              {lang === "kz" ? "Қалай тапсырыс беруге болады?" : lang === "ru" ? "Как заказать?" : "How to Order?"}
            </h2>

            {/* Text */}
            <p style={{
              margin: "0 0 28px",
              fontSize: 14, lineHeight: 1.6, fontWeight: 500,
              color: isDark ? "#9A9A9A" : "#6B7280",
              textAlign: "center",
            }}>
              {lang === "kz"
                ? "Жеткізу немесе алдын ала тапсырысты өзіңіз рәсімдей аласыз! Каталогқа немесе Мәзірге өтіп, ұнаған тағамдарды таңдап, себетке қосыңыз. Тапсырысты рәсімдеу кезінде алу түрін көрсете аласыз."
                : lang === "ru"
                ? "Вы можете оформить доставку или предзаказ самостоятельно! Просто перейдите в Каталог или Меню, выберите понравившиеся блюда и добавьте их в корзину. В разделе оформления заказа вы сможете указать тип получения заказа."
                : "You can place a delivery or pre-order yourself! Go to the Catalog or Menu, choose your dishes and add them to the cart. During checkout you can select the order type."}
            </p>

            {/* CTA button */}
            <button
              onClick={() => { setOrderInfoOpen(false); onGoToCatalog?.(); }}
              style={{
                width: "100%", padding: "15px 0",
                borderRadius: 999, border: "none",
                background: isDark ? "#F0F0F0" : "#111111",
                color: isDark ? "#111111" : "#F0F0F0",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {lang === "kz" ? "Мәзірге өту" : lang === "ru" ? "Перейти к меню" : "Go to Menu"}
            </button>

            {/* Close link */}
            <button
              onClick={() => setOrderInfoOpen(false)}
              style={{
                display: "block", width: "100%", marginTop: 12,
                padding: "10px 0", borderRadius: 999,
                border: `1px solid ${isDark ? "#2A2A2A" : "#DDE1E6"}`,
                background: "transparent",
                color: isDark ? "#9A9A9A" : "#6B7280",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {lang === "kz" ? "Жабу" : lang === "ru" ? "Закрыть" : "Close"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Info Showcase Section ─────────────────────────────────────────────────────

function InfoShowcaseSection({
  items,
  lang,
  theme,
}: {
  items: ShowcaseItem[];
  lang: Lang;
  theme: "dark" | "light";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visible,  setVisible]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  // Two-frame delay so the CSS transition fires after mount
  useEffect(() => {
    if (!activeId) { setVisible(false); return; }
    let id2: number;
    const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setVisible(true)); });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, [activeId]);

  if (!items.length) return null;
  const isDark     = theme === "dark";
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  // Card colours matching the design-system dark/light card
  const cardBg     = isDark ? "#1E1E1E" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  function isWifi(item: ShowcaseItem) {
    const title = resolve(item.title, lang).toLowerCase();
    return (
      ["📶", "🛜", "📡", "🔑", "🔐"].includes(item.emoji) ||
      title.includes("wi-fi") || title.includes("wifi") ||
      title.includes("wi fi") || title.includes("интернет")
    );
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silently fail */ }
  }

  function openItem(id: string) {
    setCopied(false);
    setActiveId((prev) => (prev === id ? null : id));
  }

  function close() {
    setCopied(false);
    setActiveId(null);
  }

  return (
    // Outer wrapper: relative so the dropdown sits in page flow below circles
    <div style={{ marginBottom: SP.lg }}>

      {/* ── Stacking circles row ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {items.map((item, i) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => openItem(item.id)}
              style={{
                width: 32, height: 32,
                borderRadius: "50%",
                border: isActive
                  ? `2px solid ${isDark ? "#ffffff" : "#111111"}`
                  : `2px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.11)"}`,
                background: isDark ? "rgba(38,38,50,0.96)" : "#FFFFFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, cursor: "pointer", flexShrink: 0,
                marginRight: i === items.length - 1 ? 0 : -10,
                zIndex: isActive ? 50 : items.length - i,
                position: "relative",
                transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                transform: isActive ? "scale(1.25) translateY(-4px)" : "scale(1)",
                boxShadow: isActive
                  ? "0 4px 16px rgba(0,0,0,0.35)"
                  : "0 1px 5px rgba(0,0,0,0.15)",
                outline: "none", WebkitTapHighlightColor: "transparent", padding: 0,
              } as React.CSSProperties}
            >
              <span style={{ lineHeight: 1, userSelect: "none" }}>{item.emoji}</span>
            </button>
          );
        })}
      </div>

      {/* ── Inline dropdown — opens in page flow, pushes content down ─────── */}
      {activeId && activeItem && (
        <div
          style={{
            marginTop: 12,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(-8px)",
            transition: "opacity 0.22s ease-out, transform 0.22s ease-out",
            position: "relative",
          } as React.CSSProperties}
        >
          {/* ── Tooltip arrow (rotated square, top-center) ──────────────────── */}
          <div style={{
            position: "absolute",
            top: -7,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 14, height: 14,
            background: cardBg,
            borderTop: `1px solid ${cardBorder}`,
            borderLeft: `1px solid ${cardBorder}`,
            zIndex: 2,
          }} />

          {/* ── Card ────────────────────────────────────────────────────────── */}
          <div style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: R.lg,
            padding: "14px 12px 14px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            position: "relative",
            zIndex: 1,
          }}>

            {/* Emoji circle */}
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {activeItem.emoji}
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <p style={{
                margin: "0 0 4px",
                fontSize: 14, fontWeight: 800, lineHeight: 1.2,
                color: isDark ? "#FFFFFF" : "#111111",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                {resolve(activeItem.title, lang)}
              </p>
              {activeItem.description && (
                <p style={{
                  margin: isWifi(activeItem) ? "0 0 10px" : "0",
                  fontSize: 13, lineHeight: 1.55,
                  color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.52)",
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                }}>
                  {activeItem.description}
                </p>
              )}
              {isWifi(activeItem) && activeItem.description && (
                <button
                  onClick={() => handleCopy(activeItem.description!)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: R.full,
                    background: copied ? "#10B981" : "#6D28D9",
                    color: "#FFFFFF", fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer",
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    transition: "background 0.2s", outline: "none",
                    WebkitTapHighlightColor: "transparent",
                  } as React.CSSProperties}
                >
                  {copied
                    ? (lang === "ru" ? "✓ Скопировано!" : lang === "kz" ? "✓ Көшірілді!" : "✓ Copied!")
                    : (lang === "ru" ? "📋 Скопировать пароль" : lang === "kz" ? "📋 Пароль көшіру" : "📋 Copy password")}
                </button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={close}
              style={{
                flexShrink: 0, marginTop: 1,
                width: 24, height: 24, borderRadius: "50%",
                background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)",
                outline: "none", WebkitTapHighlightColor: "transparent",
              } as React.CSSProperties}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category Grid ─────────────────────────────────────────────────────────────

// Used for horizontal promo/hit dish carousel cards
const PROMO_PALETTES = [
  { bg: "linear-gradient(145deg, #FF6B35 0%, #FFA33A 100%)" },
  { bg: "linear-gradient(145deg, #00B894 0%, #1DD1A1 100%)" },
  { bg: "linear-gradient(145deg, #00B4D8 0%, #48DBFB 100%)" },
  { bg: "linear-gradient(145deg, #F0A500 0%, #FECA57 100%)" },
  { bg: "linear-gradient(145deg, #7B2FBE 0%, #9F5AFD 100%)" },
  { bg: "linear-gradient(145deg, #FF4040 0%, #FF6B6B 100%)" },
];

const PASTEL_BLOBS = [
  "rgba(255,182,193,0.42)",  // rose
  "rgba(255,218,185,0.42)",  // peach
  "rgba(186,225,255,0.42)",  // sky
  "rgba(190,235,210,0.42)",  // mint
  "rgba(255,231,175,0.42)",  // cream
  "rgba(224,192,255,0.42)",  // lavender
];

const DECOR_ICONS = ["🌸", "🌿", "🍃", "🌺", "🍀", "🌼"];

// keyword pattern → Unsplash photo ID for auto-matching common food categories
const CATEGORY_PHOTO_MAP: Array<[RegExp, string]> = [
  [/салат|salad/i,                      "photo-1512621776951-a57141f2eefd"],
  [/суп|soup|борщ|шурп/i,               "photo-1547592180-85f173990554"],
  [/бургер|burger|фаст|fast.?food/i,    "photo-1568901346375-23c9450c58cd"],
  [/завтрак|breakfast/i,                "photo-1533089860892-a7c6f0a88666"],
  [/пицц|pizza/i,                       "photo-1565299624946-b28f40a0ae38"],
  [/десерт|dessert|торт|выпечк/i,       "photo-1488477181946-6428a0291777"],
  [/суши|sushi|ролл|roll/i,             "photo-1553621042-f6e147245754"],
  [/мяс|нарезк|steak|стейк/i,          "photo-1544025162-d76538647573"],
  [/каш|oatmeal|porridge/i,             "photo-1517673132405-a56a62b18caf"],
  [/паст|pasta|спаге/i,                 "photo-1473093295043-cdd812d0e601"],
];

function resolveCategoryPhoto(name: string | LS): string | null {
  const text = typeof name === "string" ? name : (name.ru ?? name.en ?? name.kz ?? "");
  for (const [pattern, id] of CATEGORY_PHOTO_MAP) {
    if (pattern.test(text)) return `https://images.unsplash.com/${id}?w=300&h=300&fit=crop&q=80`;
  }
  return null;
}

function CategoryGrid({
  categories,
  lang,
  theme,
  onSelect,
}: {
  categories: MenuCategory[];
  lang: Lang;
  theme: Theme;
  onSelect: (id: string) => void;
}) {
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [failedImgs, setFailedImgs] = useState<Set<string>>(new Set());

  const shadow = theme === "dark"
    ? "0 2px 16px rgba(0,0,0,0.40)"
    : "0 2px 14px rgba(0,0,0,0.09)";

  return (
    <section style={{ marginBottom: SP.lg }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {categories.map((cat, idx) => {
          const blobColor = PASTEL_BLOBS[idx % PASTEL_BLOBS.length];
          const decor     = DECOR_ICONS[idx % DECOR_ICONS.length];
          const pressed   = pressedId === cat.id;
          const autoPhoto = resolveCategoryPhoto(cat.name);
          const photoSrc  = cat.imageUrl ?? (failedImgs.has(cat.id) ? null : autoPhoto);

          return (
            <button
              key={cat.id}
              onPointerDown={() => setPressedId(cat.id)}
              onPointerUp={() => setPressedId(null)}
              onPointerLeave={() => setPressedId(null)}
              onClick={() => onSelect(cat.id)}
              style={{
                position: "relative",
                height: 148,
                borderRadius: 18,
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                padding: 0,
                background: "var(--bg-card)",
                overflow: "hidden",
                boxShadow: shadow,
                transform: pressed ? "scale(0.96)" : "scale(1)",
                transition: "transform 0.12s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                textAlign: "left",
              } as React.CSSProperties}
            >
              {/* Pastel glow blob */}
              <div style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                width: 100,
                height: 78,
                borderRadius: "50%",
                background: blobColor,
                filter: "blur(24px)",
                pointerEvents: "none",
                zIndex: 0,
              }} />

              {/* Header: name left, decor right */}
              <div style={{
                padding: "10px 10px 0 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                position: "relative",
                zIndex: 1,
              }}>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-color)",
                  lineHeight: 1.3,
                  maxWidth: "78%",
                }}>
                  {capFirst(resolve(cat.name, lang))}
                </p>
                <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{decor}</span>
              </div>

              {/* Food photo or emoji */}
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 1,
                paddingBottom: 14,
              }}>
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt=""
                    onError={() => setFailedImgs(prev => new Set(prev).add(cat.id))}
                    style={{
                      width: 82,
                      height: 82,
                      objectFit: "cover",
                      borderRadius: "50%",
                      display: "block",
                      pointerEvents: "none",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 82, height: 82, borderRadius: "50%",
                    background: "var(--bg-surface)",
                    border: "1.5px solid var(--border-color)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    pointerEvents: "none",
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: "var(--text-muted)", opacity: 0.45 }}>
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="3" x2="12" y2="8" />
                      <line x1="12" y1="16" x2="12" y2="21" />
                      <line x1="3" y1="12" x2="8" y2="12" />
                      <line x1="16" y1="12" x2="21" y2="12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Count — bottom right */}
              <div style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
                borderRadius: 99,
                padding: "2px 7px",
                zIndex: 1,
              }}>
                {cat.dishes.length}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Like seed ─────────────────────────────────────────────────────────────────

function seedLikes(dishId: string): number {
  let h = 5381;
  for (const c of dishId) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return 8 + (Math.abs(h) % 28);
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

type BadgeItem = { text: string; bg: string; fg: string };

function fgFromHex(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#111111" : "#ffffff";
}

function customBadgeColors(color?: string): { bg: string; fg: string } {
  if (color?.startsWith("#")) return { bg: color, fg: fgFromHex(color) };
  return { bg: "var(--text-color)", fg: "var(--bg-color)" };
}

/** Small icon-only badges for menu list & popular section (overlaid on photo) */
function dishBadges(dish: Dish): BadgeItem[] {
  const out: BadgeItem[] = [];
  if (dish.badge?.trim()) {
    const { bg, fg } = customBadgeColors(dish.badgeColor);
    out.push({ text: dish.badge.trim(), bg, fg });
  }
  if (dish.isNew)     out.push({ text: "NEW", bg: "#FF4D6D", fg: "#fff"    });
  if (dish.isPopular) out.push({ text: "★",   bg: "#F59E0B", fg: "#1C0F00" });
  if (dish.isSpicy)   out.push({ text: "🌶",  bg: "#FF4D6D", fg: "#fff"    });
  return out;
}

/** Text pill badges for catalog card photo overlay (top-left) */
function catalogBadges(dish: Dish): BadgeItem[] {
  const out: BadgeItem[] = [];
  if (dish.badge?.trim()) {
    const { bg, fg } = customBadgeColors(dish.badgeColor);
    out.push({ text: dish.badge.trim(), bg, fg });
  }
  if (dish.isNew)     out.push({ text: "NEW",    bg: "#FF4D6D", fg: "#fff"    });
  if (dish.isPopular) out.push({ text: "★ TOP",  bg: "#F59E0B", fg: "#1C0F00" });
  if (dish.isSpicy)   out.push({ text: "🔥 HOT", bg: "#FFF0F2", fg: "#D62B4B" });
  return out;
}

function BadgeStack({ badges, size = "sm" }: { badges: BadgeItem[]; size?: "sm" | "xs" }) {
  if (!badges.length) return null;
  const fs  = size === "xs" ? 7 : 8;
  const pad = size === "xs" ? "2px 4px" : "2px 6px";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {badges.map((b, i) => (
        <span key={i} style={{ fontSize: fs, fontWeight: 800, padding: pad, borderRadius: 6, backgroundColor: b.bg, color: b.fg, letterSpacing: "0.03em", lineHeight: 1.4, whiteSpace: "nowrap", fontFamily: "'Montserrat', system-ui, sans-serif" }}>
          {b.text}
        </span>
      ))}
    </div>
  );
}

// ── Catalog Dish Card (2-column square grid) ──────────────────────────────────

function CatalogDishCard({
  dish,
  lang,
  currency,
  cart,
  liked,
  onAddToCart,
  onToggleLike,
  getLikeCount,
  onDishClick,
  id,
}: {
  dish: Dish;
  lang: Lang;
  currency: string;
  cart: CartMap;
  liked: Record<string, boolean>;
  onAddToCart: (dish: Dish, currency: string, delta: number) => void;
  onToggleLike: (id: string) => void;
  getLikeCount: (id: string) => number;
  onDishClick: (dish: Dish) => void;
  id?: string;
}) {
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const isLiked = !!liked[dish.id];
  const count   = getLikeCount(dish.id);
  const qty = dish.modifiers?.length
    ? Object.entries(cart).filter(([k]) => k === dish.id || k.startsWith(`${dish.id}:`)).reduce((s, [, v]) => s + v.qty, 0)
    : cart[dish.id]?.qty ?? 0;
  const catBadges = catalogBadges(dish);
  const dishPct   = dish.isPromo && dish.discountLabel ? parseInt(dish.discountLabel, 10) : 0;
  const discountedPrice = !isNaN(dishPct) && dishPct > 0 && dishPct < 100
    ? Math.round(dish.price * (1 - dishPct / 100))
    : null;

  return (
    <div
      id={id}
      onClick={() => onDishClick(dish)}
      style={{
        borderRadius: R.lg,
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-card)",
        boxShadow: "var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
    >
      {/* Image or emoji area */}
      <div
        style={{
          aspectRatio: "1 / 1",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 52,
          backgroundColor: "var(--bg-surface)",
        } as React.CSSProperties}
      >
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt={resolve(dish.name, lang)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : dish.emoji}
        {catBadges.length > 0 && (
          <div style={{ position: "absolute", top: 6, left: 6, display: "flex", flexDirection: "column", gap: 3, zIndex: 2 }}>
            {catBadges.map((b, i) => (
              <span key={i} style={{
                fontSize: 9, fontWeight: 800, padding: "2px 8px",
                borderRadius: 999, backgroundColor: b.bg, color: b.fg,
                letterSpacing: "0.05em", lineHeight: 1.5, whiteSpace: "nowrap",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                {b.text}
              </span>
            ))}
          </div>
        )}
        {discountedPrice !== null && (
          <span
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: R.full,
              backgroundColor: "#FF6B2B",
              color: "#fff",
              letterSpacing: "0.04em",
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              fontFamily: "'Montserrat', system-ui, sans-serif",
              zIndex: 2,
            }}
          >
            −{dishPct}%
          </span>
        )}
      </div>

      {/* Card content */}
      <div
        style={{
          padding: "10px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.3,
            color: "var(--text-color)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {capFirst(resolve(dish.name, lang))}
        </p>

        {discountedPrice !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 500, margin: 0, color: "var(--text-muted)", textDecoration: "line-through" }}>
              {dish.price.toLocaleString()} {currency}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#FF6B2B" }}>
              {discountedPrice.toLocaleString()} {currency}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
            {dish.price.toLocaleString()} {currency}
          </p>
        )}

        {/* Action bar: heart + cart control */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 4,
          }}
        >
          {/* Heart + count */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleLike(dish.id); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              color: isLiked ? "#E05555" : "var(--text-muted)",
            }}
          >
            <Heart
              size={14}
              fill={isLiked ? "#E05555" : "none"}
              stroke={isLiked ? "#E05555" : "currentColor"}
            />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{count}</span>
          </button>

          {/* Cart stepper or add button */}
          {dish.modifiers?.length ? (
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCart(dish, currency, +1); }}
                style={{
                  width: 28, height: 28, borderRadius: R.full, border: "none",
                  background: "var(--text-color)", color: "var(--bg-color)",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 18, fontWeight: 700,
                }}
              >+</button>
              {qty > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#FF4D6D", color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>{qty}</span>
              )}
            </div>
          ) : qty > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCart(dish, currency, -1); }}
                style={{
                  width: 24, height: 24, borderRadius: R.full,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-surface)", color: "var(--text-color)",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14, fontWeight: 700,
                }}
              >−</button>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 14, textAlign: "center" }}>
                {qty}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCart(dish, currency, +1); }}
                style={{
                  width: 24, height: 24, borderRadius: R.full,
                  border: "none",
                  background: "var(--text-color)", color: "var(--bg-color)",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14, fontWeight: 700,
                }}
              >+</button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(dish, currency, +1); }}
              style={{
                width: 28, height: 28, borderRadius: R.full,
                border: "none",
                background: "var(--text-color)", color: "var(--bg-color)",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, fontWeight: 700,
              }}
            >+</button>
          )}
        </div>

        {dish.ingredients && (
          <div style={{ marginTop: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setIngredientsOpen(o => !o); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "none", border: "none",
                padding: "7px 0 0",
                borderTop: "1px solid var(--border-color)",
                cursor: "pointer", color: "var(--text-muted)",
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                letterSpacing: "0.03em",
              }}>
                Состав
              </span>
              <ChevronDown
                size={12}
                style={{
                  transform: ingredientsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              />
            </button>
            {ingredientsOpen && (
              <p style={{
                fontSize: 10, color: "var(--text-muted)", margin: "5px 0 0",
                lineHeight: 1.55, fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>
                {dish.ingredients}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Menu List Dish Row ────────────────────────────────────────────────────────

function MenuDishRow({
  dish, lang, currency, cart, addToCart, onDishClick,
}: {
  dish: Dish; lang: Lang; currency: string;
  cart: CartMap;
  addToCart: (dish: Dish, currency: string, delta: number) => void;
  onDishClick: (dish: Dish) => void;
}) {
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const qty = dish.modifiers?.length
    ? Object.entries(cart).filter(([k]) => k === dish.id || k.startsWith(`${dish.id}:`)).reduce((s, [, v]) => s + v.qty, 0)
    : cart[dish.id]?.qty ?? 0;
  const badges = dishBadges(dish);
  const rowPct = dish.isPromo && dish.discountLabel ? parseInt(dish.discountLabel, 10) : 0;
  const rowDiscountedPrice = !isNaN(rowPct) && rowPct > 0 && rowPct < 100
    ? Math.round(dish.price * (1 - rowPct / 100))
    : null;

  return (
    <div
      onClick={() => onDishClick(dish)}
      style={{
        borderRadius: R.md, border: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-card)", boxShadow: "var(--card-shadow)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12 }}>
        {/* Thumbnail */}
        <div style={{
          width: 72, height: 72, borderRadius: R.md, flexShrink: 0,
          background: "var(--bg-surface)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 34, position: "relative", overflow: "hidden",
        }}>
          {dish.imageUrl
            ? <img src={dish.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            : dish.emoji}
          {badges.length > 0 && (
            <div style={{ position: "absolute", top: 4, left: 4 }}>
              <BadgeStack badges={badges} size="xs" />
            </div>
          )}
          {rowDiscountedPrice !== null && (
            <span style={{
              position: "absolute", bottom: 4, right: 4,
              fontSize: 8, fontWeight: 800,
              padding: "2px 5px", borderRadius: R.full,
              backgroundColor: "#FF6B2B", color: "#fff",
              letterSpacing: "0.04em", lineHeight: 1.4, whiteSpace: "nowrap",
              fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>
              −{rowPct}%
            </span>
          )}
        </div>

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px", color: "var(--text-color)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
            {capFirst(resolve(dish.name, lang))}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {resolve(dish.desc, lang)}
          </p>
          {rowDiscountedPrice !== null ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <p style={{ fontSize: 11, fontWeight: 500, margin: 0, color: "var(--text-muted)", textDecoration: "line-through" }}>
                {dish.price.toLocaleString()} {currency}
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#FF6B2B" }}>
                {rowDiscountedPrice.toLocaleString()} {currency}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
              {dish.price.toLocaleString()} {currency}
            </p>
          )}

          {dish.ingredients && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setIngredientsOpen(o => !o); }}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  background: "none", border: "none", padding: "5px 0 0",
                  cursor: "pointer", color: "var(--text-muted)",
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  letterSpacing: "0.03em",
                }}>
                  Состав
                </span>
                <ChevronDown
                  size={11}
                  style={{
                    transform: ingredientsOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                />
              </button>
              {ingredientsOpen && (
                <p style={{
                  fontSize: 10, color: "var(--text-muted)", margin: "3px 0 0",
                  lineHeight: 1.55, fontFamily: "'Montserrat', system-ui, sans-serif",
                }}>
                  {dish.ingredients}
                </p>
              )}
            </>
          )}
        </div>

        {/* Cart control — pinned top-right */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          {dish.modifiers?.length ? (
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button onClick={(e) => { e.stopPropagation(); addToCart(dish, currency, +1); }} style={{ width: 34, height: 34, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              {qty > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#FF4D6D", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{qty}</span>
              )}
            </div>
          ) : qty > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={(e) => { e.stopPropagation(); addToCart(dish, currency, -1); }} style={{ width: 28, height: 28, borderRadius: R.full, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span>
              <button onClick={(e) => { e.stopPropagation(); addToCart(dish, currency, +1); }} style={{ width: 28, height: 28, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); addToCart(dish, currency, +1); }} style={{ width: 34, height: 34, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hero Slider ───────────────────────────────────────────────────────────────

const TAG_COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  white:  { bg: "#FFFFFF",               fg: "#111111" },
  yellow: { bg: "#F59E0B",               fg: "#1C0F00" },
  green:  { bg: "#00C882",               fg: "#001A0F" },
  red:    { bg: "#FF4D6D",               fg: "#fff"    },
  blue:   { bg: "#00AAFF",               fg: "#fff"    },
  orange: { bg: "#FF6B2B",               fg: "#fff"    },
  purple: { bg: "#A855F7",               fg: "#fff"    },
};

function HeroSliderInner({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0);

  const go = useCallback((next: number) => {
    const n = ((next % slides.length) + slides.length) % slides.length;
    setIdx(n);
  }, [slides.length]);

  const slide = slides[idx];
  if (!slide) return null;

  return (
    <div
      style={{
        position: "relative", width: "100%", height: SLIDER_H, overflow: "hidden",
        borderRadius: "0 0 24px 24px", backgroundColor: "#000",
      }}
    >
      {/* Slide media */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{ position: "absolute", inset: 0 }}
        >
          {slide.type === "video" ? (
            <video
              key={slide.url}
              src={slide.url}
              autoPlay muted playsInline loop={false}
              onEnded={() => go(idx + 1)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%", height: "100%",
                backgroundImage: `url(${slide.url})`,
                backgroundSize: "cover", backgroundPosition: "center",
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Tap zones: left 40% = prev, right 60% = next */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex" }}>
        <div style={{ flex: 4 }} onClick={() => go(idx - 1)} />
        <div style={{ flex: 6 }} onClick={() => go(idx + 1)} />
      </div>

      {/* Text overlay — content sits directly on the clean image */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 6,
          padding: "12px 12px 22px",
          display: "flex", flexDirection: "column", gap: 8,
          pointerEvents: "none",
        }}
      >
        {/* Slide text */}
        {(slide.tags?.length || slide.title || slide.description) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Tag badges */}
            {slide.tags && slide.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {slide.tags.map((tag, i) => {
                  const palette = tag.color.startsWith("#")
                    ? (() => { const h=tag.color.slice(1); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return { bg: tag.color, fg: (0.299*r+0.587*g+0.114*b)/255>0.5?"#111111":"#ffffff" }; })()
                    : (TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.white);
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        backgroundColor: palette.bg,
                        color: palette.fg,
                        fontSize: 10, fontWeight: 800,
                        padding: "3px 10px", borderRadius: 99,
                        letterSpacing: "0.04em", lineHeight: 1.5,
                        fontFamily: "'Montserrat', system-ui, sans-serif",
                      }}
                    >
                      {tag.text}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Title */}
            {slide.title && (
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 19, margin: 0, lineHeight: 1.25, textShadow: "0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35)" }}>
                {slide.title}
              </p>
            )}

            {/* Description */}
            {slide.description && (
              <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, margin: 0, lineHeight: 1.4, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>
                {slide.description}
              </p>
            )}
          </div>
        )}

        {/* Dot / pill progress indicators — centered */}
        {slides.length > 1 && (
          <div style={{ display: "flex", gap: 5, justifyContent: "center", alignItems: "center" }}>
            {slides.map((_, i) => {
              const isActive = i === idx;
              const isPast   = i < idx;
              return (
                <div
                  key={i}
                  style={{
                    height: 5,
                    width: isActive ? 22 : 6,
                    borderRadius: 99,
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.95)"
                      : isPast
                        ? "rgba(255,255,255,0.75)"
                        : "rgba(255,255,255,0.28)",
                    transition: "width 0.25s ease, background-color 0.25s ease",
                    flexShrink: 0,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroSlider({
  slides,
  fallback,
  lang,
}: {
  slides: HeroSlide[];
  fallback?: HeroBanner;
  lang: Lang;
}) {
  if (slides.length > 0) {
    return <HeroSliderInner slides={slides} />;
  }

  if (!fallback?.imageUrl) return null;
  return (
    <div
      style={{
        position: "relative", width: "100%", height: SLIDER_H, overflow: "hidden",
        backgroundImage: `url(${fallback.imageUrl})`,
        backgroundSize: "cover", backgroundPosition: "center",
        borderRadius: "0 0 20px 20px",
      } as React.CSSProperties}
    >
      {(fallback.title || fallback.subtitle) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 16px 16px" }}>
          {fallback.title && (
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: "0 0 2px", textShadow: "0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35)" }}>
              {resolve(fallback.title, lang)}
            </p>
          )}
          {fallback.subtitle && (
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, margin: 0, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>
              {resolve(fallback.subtitle, lang)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MenuTemplate({
  restaurant,
  categories,
  lang: initLang = "en",
  heroBanner,
  heroSlides = [],
  banners = [],
  showcaseItems = [],
  featuredItems,
  featuredTitle,
  initialTableNumber,
  restaurantTables,
}: MenuTemplateProps) {
  const [theme, setTheme]           = useState<Theme>("dark");
  const [lang, setLang]             = useState<Lang>(initLang);
  const [view, setView]             = useState<"home" | "catalog" | "menu">("home");
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [scrollToId, setScrollToId]       = useState<string | null>(null);
  const [scrollToDishId, setScrollToDishId] = useState<string | null>(null);
  const [cart, setCart]             = useState<CartMap>({});
  const [cartOpen, setCartOpen]     = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [langOpen, setLangOpen]     = useState(false);
  const [liked, setLiked]           = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ordersOpen, setOrdersOpen]     = useState(false);
  const [orders, setOrders]             = useState<StoredOrder[]>([]);
  const [clientId, setClientId]         = useState("anon");
  const [hasUnseenOrder, setHasUnseenOrder] = useState(false);
  const [contentX, setContentX]             = useState(0);
  const [contentTrans, setContentTrans]     = useState("none");
  const [modPickerDish, setModPickerDish]   = useState<Dish | null>(null);
  const [modPickerCur, setModPickerCur]     = useState("");
  const [selectedMods, setSelectedMods]     = useState<Set<string>>(new Set());
  const [selectedDish, setSelectedDish]         = useState<Dish | null>(null);
  const [selectedDishCurrency, setSelectedDishCurrency] = useState("");

  const stripRef           = useRef<HTMLDivElement>(null);
  const pillRefs           = useRef<Record<string, HTMLButtonElement | null>>({});
  const langRef            = useRef<HTMLDivElement>(null);
  const searchInputRef     = useRef<HTMLInputElement>(null);
  const catalogSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const touchStartX        = useRef(0);
  const touchStartY        = useRef(0);
  const swipeLock          = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("menu-theme") as Theme | null;
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    const savedLang = localStorage.getItem("menu-lang") as Lang | null;
    if (savedLang === "en" || savedLang === "ru" || savedLang === "kz") setLang(savedLang);
    const savedLiked = localStorage.getItem("menu-liked");
    if (savedLiked) { try { setLiked(JSON.parse(savedLiked)); } catch {} }

    // Client ID
    let cid = localStorage.getItem("menu-client-id");
    if (!cid) {
      cid = `C-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      localStorage.setItem("menu-client-id", cid);
    }
    setClientId(cid);

    // Orders — filter out entries older than 7 days
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const raw = localStorage.getItem("menu-orders");
    if (raw) {
      try {
        const parsed: StoredOrder[] = JSON.parse(raw);
        const fresh = parsed.filter((o) => Date.now() - o.timestamp < sevenDays);
        setOrders(fresh);
        if (fresh.length !== parsed.length) {
          localStorage.setItem("menu-orders", JSON.stringify(fresh));
        }
      } catch {}
    }
  }, []);

  const saveOrder = (order: StoredOrder) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      localStorage.setItem("menu-orders", JSON.stringify(next));
      return next;
    });
    setHasUnseenOrder(true);
  };

  const handleRefundRequest = (orderId: string) => {
    setOrders((prev) => {
      const next = prev.map((o) => o.id === orderId ? { ...o, status: "refund-requested" as const } : o);
      localStorage.setItem("menu-orders", JSON.stringify(next));
      return next;
    });
  };

  const handlePartialRefund = (orderId: string, itemIndex: number, qtyReturned: number) => {
    setOrders((prev) => {
      const next = prev.map((order) => {
        if (order.id !== orderId) return order;
        const newItems = order.items
          .map((item, i) => i === itemIndex ? { ...item, qty: item.qty - qtyReturned } : item)
          .filter((item) => item.qty > 0);
        const newTotal = newItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        return {
          ...order,
          items: newItems,
          total: newTotal,
          status: newItems.length === 0 ? "refund-requested" as const : order.status,
        };
      });
      localStorage.setItem("menu-orders", JSON.stringify(next));
      return next;
    });
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("menu-theme", next);
  };

  // Sync body background so mobile overscroll bounce matches the active theme
  useEffect(() => {
    const vars = theme === "dark" ? DARK_VARS : LIGHT_VARS;
    document.body.style.backgroundColor = vars["--bg-color"];
    return () => { document.body.style.backgroundColor = ""; };
  }, [theme]);


  const switchLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("menu-lang", l);
  };

  // Navigation helpers
  const goToMenuSection = (catId: string) => {
    setView("menu");
    setActiveCatId(catId);
    setScrollToId(catId);
    setSearchOpen(false);
  };

  const goToCatalogCategory = (catId: string) => {
    setActiveCatId(catId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToCatalogGrid = () => {
    setView("catalog");
    setActiveCatId(null);
    setScrollToId(null);
    setScrollToDishId(null);
    setSearchOpen(false);
  };

  const goToDish = (dishId: string) => {
    const cat = categories.find((c) => c.dishes.some((d) => d.id === dishId));
    if (!cat) return;
    setView("catalog");
    setActiveCatId(cat.id);
    setScrollToDishId(dishId);
    setScrollToId(null);
    setSearchOpen(false);
  };

  const goHome = () => {
    setView("home");
    setActiveCatId(null);
    setScrollToId(null);
    setSearchOpen(false);
  };

  // Like helpers
  const toggleLike = (dishId: string) => {
    setLiked((prev) => {
      const next = { ...prev, [dishId]: !prev[dishId] };
      localStorage.setItem("menu-liked", JSON.stringify(next));
      return next;
    });
  };

  const getLikeCount = (dishId: string) => seedLikes(dishId) + (liked[dishId] ? 1 : 0);

  // Cart helpers
  const cartCount = Object.values(cart).reduce((s, { qty }) => s + qty, 0);

  const addToCart = (dish: Dish, effectiveCurrency: string, delta: number, forceMods?: DishModifier[]) => {
    if (dish.modifiers?.length && delta > 0 && forceMods === undefined) {
      setModPickerDish(dish);
      setModPickerCur(effectiveCurrency);
      setSelectedMods(new Set());
      return;
    }
    const mods = forceMods ?? [];
    const cartKey = mods.length > 0
      ? `${dish.id}:${mods.map(m => m.id).sort().join(",")}`
      : dish.id;
    setCart((prev) => {
      const current = prev[cartKey]?.qty ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [cartKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cartKey]: { dish, qty: next, currency: effectiveCurrency, cartKey, selectedModifiers: mods } };
    });
  };

  const updateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) => {
      const entry = prev[cartKey];
      if (!entry) return prev;
      const next = Math.max(0, entry.qty + delta);
      if (next === 0) {
        const { [cartKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cartKey]: { ...entry, qty: next } };
    });
  };

  // Scroll to category section in menu view
  useEffect(() => {
    if (view !== "menu" || !scrollToId) return;
    const el = catalogSectionRefs.current[scrollToId];
    if (!el) return;
    const t = setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setScrollToId(null);
    }, 80);
    return () => clearTimeout(t);
  }, [view, scrollToId]);

  // Scroll to a specific dish after navigating to its catalog category
  useEffect(() => {
    if (view !== "catalog" || !activeCatId || !scrollToDishId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`dish-${scrollToDishId}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setScrollToDishId(null);
    }, 100);
    return () => clearTimeout(t);
  }, [view, activeCatId, scrollToDishId]);

  // Auto-scroll active pill into view in the strip
  useEffect(() => {
    if (activeCatId === null) {
      stripRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const pill = pillRefs.current[activeCatId];
    const strip = stripRef.current;
    if (pill && strip) {
      strip.scrollTo({
        left: pill.offsetLeft - strip.clientWidth / 2 + pill.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [activeCatId]);

  // Focus search input when search opens; clear query when it closes
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  // Close lang dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  // Curated home sections
  const allDishes   = categories.flatMap((c) => c.dishes);
  const promoDishes = allDishes.filter((d) => d.isPromo);
  const hitDishes     = allDishes.filter((d) => d.isRecommended).slice(0, 8);
  const popularDishes = allDishes.filter((d) => getLikeCount(d.id) > 0);

  const tAll = lang === "kz" ? "Барлығы" : lang === "ru" ? "Все" : "All";

  const searchTrimmed  = searchQuery.trim().toLowerCase();
  const isSearching    = searchOpen && searchTrimmed.length > 0;
  const filteredDishes = isSearching
    ? categories.flatMap((c) =>
        c.dishes.filter((d) =>
          resolve(d.name, lang).toLowerCase().includes(searchTrimmed) ||
          resolve(d.desc, lang).toLowerCase().includes(searchTrimmed)
        )
      )
    : [];

  const getAdjacentCatId = (dir: "prev" | "next"): string | null => {
    const idx = activeCatId ? categories.findIndex((c) => c.id === activeCatId) : -1;
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next < 0 || next >= categories.length) return null;
    return categories[next].id;
  };

  const navigateWithSwipe = (dir: "left" | "right", action: () => void) => {
    if (swipeLock.current) return;
    swipeLock.current = true;
    const W = window.innerWidth;
    setContentTrans("transform 0.22s cubic-bezier(0.4,0,1,1)");
    setContentX(dir === "left" ? -W : W);
    setTimeout(() => {
      action();
      setContentTrans("none");
      setContentX(dir === "left" ? W : -W);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setContentTrans("transform 0.22s cubic-bezier(0,0,0.2,1)");
        setContentX(0);
        setTimeout(() => { setContentTrans("none"); swipeLock.current = false; }, 220);
      }));
    }, 220);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeLock.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const canSwipe = view === "menu" || (view === "catalog" && activeCatId !== null);
    if (!canSwipe) return;
    if (dx < 0) {
      const nextId = getAdjacentCatId("next");
      if (!nextId) return;
      navigateWithSwipe("left", () =>
        view === "menu" ? goToMenuSection(nextId) : goToCatalogCategory(nextId)
      );
    } else {
      const prevId = getAdjacentCatId("prev");
      if (!prevId) return;
      navigateWithSwipe("right", () =>
        view === "menu" ? goToMenuSection(prevId) : goToCatalogCategory(prevId)
      );
    }
  };

  const themeVars = {
    ...(theme === "dark" ? DARK_VARS : LIGHT_VARS),
  } as React.CSSProperties;

  const onImage  = !!heroBanner?.imageUrl;

  return (
    <div
      style={{
        ...themeVars,
        minHeight: "100vh",
        backgroundColor: "var(--bg-shell)",
        color: "var(--text-color)",
        fontFamily: "'Montserrat', system-ui, sans-serif",
        transition: "background-color 0.2s, color 0.2s",
      }}
    >
    <div
      style={{
        maxWidth: 480,
        minHeight: "100vh",
        margin: "0 auto",
        backgroundColor: "var(--bg-color)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 8px 48px rgba(0,0,0,0.18)",
        transition: "background-color 0.2s",
        paddingTop: (onImage && view === "home") ? 0 : HEADER_H,
        overflowX: "hidden",
      }}
    >
      {/* ── Fixed global header ────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 8,
          left: "max(calc(50vw - 232px), 8px)",
          right: "max(calc(50vw - 232px), 8px)",
          zIndex: 100,
          display: (cartOpen || ordersOpen) ? "none" : undefined,
          borderRadius: R.lg,
          backgroundColor: theme === "dark" ? "rgba(11,11,17,0.72)" : "rgba(245,245,247,0.70)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          border: "1px solid var(--border-color)",
          boxShadow: theme === "dark"
            ? "0 4px 24px rgba(0,0,0,0.35)"
            : "0 4px 24px rgba(0,0,0,0.10)",
        } as React.CSSProperties}
      >
        {/* Single row: logo + controls  ↔  search mode */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 64,
            padding: `0 ${SP.md + 4}px`,
            gap: SP.sm,
          }}
        >
          {searchOpen ? (
            /* ── Search mode ── */
            <>
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                style={{
                  width: 36, height: 36, borderRadius: R.full, flexShrink: 0,
                  border: "none", background: "none",
                  color: "var(--text-muted)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={17} />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "kz" ? "Іздеу..." :
                  lang === "ru" ? "Поиск блюд..." :
                  "Search dishes..."
                }
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: R.full,
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-color)",
                  fontSize: 14,
                  padding: "0 16px",
                  outline: "none",
                } as React.CSSProperties}
              />
            </>
          ) : (
            /* ── Normal mode ── */
            <>
              {/* Logo + Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
                {restaurant.logoUrl ? (
                  <div style={{
                    flexShrink: 0, height: 36,
                    display: "flex", alignItems: "center",
                    mixBlendMode: theme === "dark" ? "screen" : "multiply",
                  } as React.CSSProperties}>
                    <img
                      src={restaurant.logoUrl}
                      alt=""
                      style={{ height: "100%", width: "auto", maxWidth: 88, objectFit: "contain", display: "block" }}
                    />
                  </div>
                ) : (
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-color)"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 } as React.CSSProperties}>
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
                  </svg>
                )}
                <h1 style={{
                  fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: "0.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: "var(--text-color)",
                }}>
                  {restaurant.name}
                </h1>
              </div>

              {/* Right controls — flat, no borders/backgrounds */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                {/* Search icon */}
                <button
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  style={{
                    width: 36, height: 36, borderRadius: R.full,
                    border: "none", background: "none",
                    color: "var(--text-muted)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Search size={17} />
                </button>

                {/* Orders icon */}
                <button
                  onClick={() => { setOrdersOpen(true); setHasUnseenOrder(false); }}
                  aria-label={lang === "kz" ? "Тапсырыстар" : lang === "ru" ? "Мои заказы" : "My Orders"}
                  style={{
                    width: 36, height: 36, borderRadius: R.full,
                    border: "none", background: "none",
                    color: "var(--text-muted)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <Clock size={17} />
                  {hasUnseenOrder && (
                    <span style={{
                      position: "absolute", top: 4, right: 4,
                      width: 7, height: 7, borderRadius: "50%",
                      backgroundColor: "#E05555",
                    }} />
                  )}
                </button>

                {/* Language dropdown */}
                <div ref={langRef} style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    onClick={() => setLangOpen((o) => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "6px 8px", borderRadius: R.full,
                      border: "none", background: "none",
                      color: "var(--text-color)",
                      fontSize: 12, fontWeight: 700,
                      cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
                    } as React.CSSProperties}
                  >
                    {lang}
                    <ChevronDown size={11} style={{ opacity: 0.55, transition: "transform 0.2s", transform: langOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {langOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      background: "var(--bg-surface)", border: "1px solid var(--border-color)",
                      borderRadius: R.md, overflow: "hidden", zIndex: 200,
                      minWidth: 64, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                    }}>
                      {(["kz", "ru", "en"] as Lang[]).filter((l) => l !== lang).map((l) => (
                        <button
                          key={l}
                          onClick={() => { switchLang(l); setLangOpen(false); }}
                          style={{
                            display: "block", width: "100%", padding: "9px 14px",
                            background: "none", border: "none", color: "var(--text-color)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
                          } as React.CSSProperties}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                  style={{
                    width: 36, height: 36, borderRadius: R.full,
                    border: "none", background: "none",
                    color: "var(--text-muted)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Hero Slider ────────────────────────────────────────────────── */}
      {view === "home" && (
        <HeroSlider slides={heroSlides} fallback={heroBanner} lang={lang} />
      )}

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${contentX}px)`,
          transition: contentTrans,
          willChange: "transform",
        } as React.CSSProperties}
      >
      <main
        style={{
          padding: `${SP.lg}px ${SP.md}px ${view === "menu" ? 190 : 140}px`,
        }}
      >
        {/* ── SEARCH RESULTS ─────────────────────────────────────────────── */}
        {isSearching && (
          filteredDishes.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 48, fontSize: 14 }}>
              {lang === "kz" ? "Ештеңе табылмады" : lang === "ru" ? "Ничего не найдено" : "Nothing found"}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {filteredDishes.map((dish) => (
                <CatalogDishCard
                  key={dish.id}
                  dish={dish}
                  lang={lang}
                  currency={dish.currency ?? restaurant.currency ?? ""}
                  cart={cart}
                  liked={liked}
                  onAddToCart={addToCart}
                  onToggleLike={toggleLike}
                  getLikeCount={getLikeCount}
                  onDishClick={(d) => { setSelectedDish(d); setSelectedDishCurrency(d.currency ?? restaurant.currency ?? ""); }}
                />
              ))}
            </div>
          )
        )}

        {/* ── HOME VIEW ──────────────────────────────────────────────────── */}
        {!isSearching && view === "home" && (
          <>
            {/* 0. Info showcase cards — dynamic, admin-managed via /admin/info-showcase */}
            <InfoShowcaseSection items={showcaseItems} lang={lang} theme={theme} />

            {/* 2. Banner slider (admin-managed via Supabase) */}
            <BannerSlider banners={banners} lang={lang} />

            {/* 3. "А вы это пробовали?" — admin-managed recommended dishes */}
            <TryThisSection
              dishes={hitDishes}
              lang={lang}
              defaultCurrency={restaurant.currency}
              onGoToDish={goToDish}
            />

            {/* 4. "Популярные блюда" — sorted by like count */}
            <PopularDishesSection
              dishes={popularDishes}
              lang={lang}
              liked={liked}
              getLikeCount={getLikeCount}
              onGoToDish={goToDish}
            />

            {/* 5. Info cards — reserve / contact */}
            <InfoCards
              lang={lang}
              theme={theme}
              whatsappPhone={restaurant.whatsappPhone}
              instagramUrl={restaurant.instagramUrl}
              phone={restaurant.phone}
              address={restaurant.address}
              workingHours={restaurant.workingHours}
              onGoToCatalog={goToCatalogGrid}
            />
          </>
        )}

        {/* ── CATALOG VIEW — category grid or dish cards ──────────────────── */}
        {!isSearching && view === "catalog" && (
          activeCatId ? (
            <>
              {/* Back + category header */}
              <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.lg }}>
                <button
                  onClick={() => { setActiveCatId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{ width: 36, height: 36, borderRadius: R.full, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-color)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}
                >
                  ‹
                </button>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
                  {resolve(categories.find((c) => c.id === activeCatId)?.name ?? "", lang)}
                </h2>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                  {categories.find((c) => c.id === activeCatId)?.dishes.length ?? 0}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {(categories.find((c) => c.id === activeCatId)?.dishes ?? []).map((dish) => (
                  <CatalogDishCard
                    key={dish.id}
                    id={`dish-${dish.id}`}
                    dish={dish}
                    lang={lang}
                    currency={dish.currency ?? restaurant.currency ?? ""}
                    cart={cart}
                    liked={liked}
                    onAddToCart={addToCart}
                    onToggleLike={toggleLike}
                    getLikeCount={getLikeCount}
                    onDishClick={(d) => { setSelectedDish(d); setSelectedDishCurrency(d.currency ?? restaurant.currency ?? ""); }}
                  />
                ))}
              </div>
            </>
          ) : categories.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 14 }}>
              {lang === "kz" ? "Мәзір бос" : lang === "ru" ? "Меню пустое" : "Menu is empty"}
            </p>
          ) : (
            <CategoryGrid
              categories={categories}
              lang={lang}
              theme={theme}
              onSelect={goToCatalogCategory}
            />
          )
        )}

        {/* ── MENU VIEW — compact list by section ─────────────────────────── */}
        {!isSearching && view === "menu" && (
          categories.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 64, fontSize: 14 }}>
              {lang === "kz" ? "Мәзір бос" : lang === "ru" ? "Меню пустое" : "Menu is empty"}
            </p>
          ) : <>
            {categories.map((cat) => (
              <section
                key={cat.id}
                ref={(el) => { catalogSectionRefs.current[cat.id] = el; }}
                style={{ marginBottom: 36 }}
              >
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: SP.sm + 2, marginBottom: SP.sm, paddingBottom: SP.sm, borderBottom: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: 22 }}>{cat.icon}</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "0.01em", color: "var(--text-color)" }}>
                    {capFirst(resolve(cat.name, lang))}
                  </h2>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                    {cat.dishes.length}
                  </span>
                </div>

                {/* Compact list rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cat.dishes.map((dish) => (
                    <MenuDishRow
                      key={dish.id}
                      dish={dish}
                      lang={lang}
                      currency={dish.currency ?? restaurant.currency ?? ""}
                      cart={cart}
                      addToCart={addToCart}
                      onDishClick={(d) => { setSelectedDish(d); setSelectedDishCurrency(d.currency ?? restaurant.currency ?? ""); }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
        {/* ── Platform footer ──────────────────────────────────────────── */}
        <div style={{ textAlign: "center", paddingTop: SP.lg }}>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "'Montserrat', system-ui, sans-serif",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            Powered by{" "}
            <a
              href="https://scanserve.qr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--text-muted)", textDecoration: "none", fontWeight: 600 }}
            >
              scanserve.qr
            </a>
          </span>
        </div>
      </main>

      </div>

      {/* ── Bottom category pills bar (menu view only) ───────────────────── */}
      {view === "menu" && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(82px + env(safe-area-inset-bottom, 0px))" as unknown as number,
            left: "max(calc(50vw - 240px), 0px)",
            right: "max(calc(50vw - 240px), 0px)",
            zIndex: 65,
            backgroundColor: theme === "dark" ? "rgba(11,11,17,0.82)" : "rgba(245,245,247,0.82)",
            borderTop: "1px solid var(--border-color)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          } as React.CSSProperties}
        >
          <div
            ref={stripRef}
            style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-x", padding: `8px ${SP.md}px` } as React.CSSProperties}
          >
            <div style={{ display: "flex", gap: 6, width: "fit-content" }}>
              <button
                onClick={() => { setActiveCatId(null); setScrollToId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: R.full, flexShrink: 0,
                  border: "1px solid var(--pill-border)",
                  backgroundColor: "transparent",
                  color: "var(--pill-text)",
                  fontSize: 13, fontWeight: 400,
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                {tAll}
              </button>
              {categories.map((cat) => {
                const active = cat.id === activeCatId;
                return (
                  <button
                    key={cat.id}
                    ref={(el) => { pillRefs.current[cat.id] = el; }}
                    onClick={() => goToMenuSection(cat.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", borderRadius: R.full, flexShrink: 0,
                      border: `1px solid ${active ? "transparent" : "var(--pill-border)"}`,
                      backgroundColor: active ? "var(--pill-active-bg)" : "transparent",
                      color: active ? "var(--pill-active-fg)" : "var(--pill-text)",
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{capFirst(resolve(cat.name, lang))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating navigation bar ──────────────────────────────────────── */}
      <FloatingNavBar
        lang={lang}
        theme={theme}
        cartCount={cartCount}
        activeTab={view === "catalog" ? "catalog" : view === "menu" ? "menu" : "home"}
        onHomeTab={goHome}
        onCatalogTab={goToCatalogGrid}
        onMenuTab={() => { setView("menu"); setActiveCatId(null); setScrollToId(null); setSearchOpen(false); }}
        onWaiterTab={() => setWaiterOpen(true)}
        onCartTab={() => setCartOpen(true)}
      />

      {/* ── Cart / Checkout drawer ────────────────────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQty={updateCartQty}
        onClearCart={() => setCart({})}
        lang={lang}
        theme={theme}
        restaurantName={restaurant.name}
        currency={restaurant.currency ?? ""}
        kaspiPhone={restaurant.kaspiPhone}
        whatsappPhone={restaurant.whatsappPhone}
        cardTransferOptions={restaurant.cardTransferOptions}
        clientId={clientId}
        onOrderPlaced={saveOrder}
        initialTableNumber={initialTableNumber}
      />

      {/* ── Orders history modal ──────────────────────────────────────────── */}
      <OrdersModal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        orders={orders}
        lang={lang}
        theme={theme}
        whatsappPhone={restaurant.whatsappPhone}
        onRefundRequest={handleRefundRequest}
        onPartialRefund={handlePartialRefund}
      />

      {/* ── Call Waiter modal ─────────────────────────────────────────────── */}
      <WaiterModal
        open={waiterOpen}
        onClose={() => setWaiterOpen(false)}
        lang={lang}
        theme={theme}
        restaurantName={restaurant.name}
        initialTableNumber={initialTableNumber}
        tables={restaurantTables}
      />

      {/* ── Modifier picker bottom sheet ──────────────────────────────────── */}
      {modPickerDish && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }}
            onClick={() => setModPickerDish(null)}
          />
          <div style={{
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: 480,
            background: "var(--bg-card)",
            borderRadius: "24px 24px 0 0",
            padding: "20px 20px 32px",
            maxHeight: "75vh",
            overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
                  {capFirst(resolve(modPickerDish.name, lang))}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  {lang === "ru" ? "Выберите добавки" : lang === "kz" ? "Қосымшаларды таңдаңыз" : "Select add-ons"}
                </p>
              </div>
              <button
                onClick={() => setModPickerDish(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modifier list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {modPickerDish.modifiers?.map(mod => {
                const on = selectedMods.has(mod.id);
                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedMods(prev => {
                      const next = new Set(prev);
                      on ? next.delete(mod.id) : next.add(mod.id);
                      return next;
                    })}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: R.md, cursor: "pointer",
                      border: `2px solid ${on ? "var(--cta-bg)" : "var(--border-color)"}`,
                      background: on ? "var(--bg-surface)" : "transparent",
                      transition: "all 0.15s", textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${on ? "var(--cta-bg)" : "var(--border-color)"}`,
                        background: on ? "var(--cta-bg)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {on && <span style={{ color: "var(--cta-fg)", fontSize: 12, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-color)" }}>{mod.name}</span>
                    </div>
                    {mod.price > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>
                        +{mod.price.toLocaleString("ru-RU")} {modPickerCur || restaurant.currency}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Total + confirm buttons */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {lang === "ru" ? "Итого" : lang === "kz" ? "Барлығы" : "Total"}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-color)" }}>
                  {(
                    modPickerDish.price +
                    (modPickerDish.modifiers ?? [])
                      .filter(m => selectedMods.has(m.id))
                      .reduce((s, m) => s + m.price, 0)
                  ).toLocaleString("ru-RU")} {modPickerCur || restaurant.currency}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    addToCart(modPickerDish, modPickerCur, 1, []);
                    setModPickerDish(null);
                  }}
                  style={{
                    flex: 1, padding: "14px 0", borderRadius: R.full,
                    border: "1.5px solid var(--border-color)",
                    background: "transparent", color: "var(--text-color)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                  }}
                >
                  {lang === "ru" ? "Без добавок" : lang === "kz" ? "Қосымшасыз" : "No add-ons"}
                </button>
                <button
                  onClick={() => {
                    const mods = (modPickerDish.modifiers ?? []).filter(m => selectedMods.has(m.id));
                    addToCart(modPickerDish, modPickerCur, 1, mods);
                    setModPickerDish(null);
                  }}
                  style={{
                    flex: 1, padding: "14px 0", borderRadius: R.full,
                    border: "none", background: "var(--cta-bg)", color: "var(--cta-fg)",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                  }}
                >
                  {lang === "ru" ? "Добавить" : lang === "kz" ? "Себетке қосу" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Product detail modal ──────────────────────────────────────────── */}
      <ProductDetailModal
        dish={selectedDish}
        lang={lang}
        currency={selectedDishCurrency}
        cart={cart}
        onClose={() => setSelectedDish(null)}
        onAddToCart={addToCart}
      />

      {/* ── Web Push subscription banner ──────────────────────────────────── */}
      <PushNotificationBanner lang={lang} theme={theme} />
    </div>
    </div>
  );
}

