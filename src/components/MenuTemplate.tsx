"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SlideTag } from "@/lib/db-types";
import { AnimatePresence, motion } from "framer-motion";
import { Sun, Moon, ChevronDown, Heart, Search, X, Clock } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { CartDrawer, type CartMap, type StoredOrder } from "./CartDrawer";
import { WaiterModal } from "./WaiterModal";
import { OrdersModal } from "./OrdersModal";

export type { StoredOrder };

// ── Types ─────────────────────────────────────────────────────────────────────

export type Lang = "en" | "ru" | "kz";
export type LS = { en: string; ru: string; kz: string };

export function resolve(s: string | LS, lang: Lang): string {
  if (typeof s === "string") return s;
  return s[lang] ?? s.en;
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
  isNew?: boolean;
  isPromo?: boolean;
  isRecommended?: boolean;
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

export interface MenuTemplateProps {
  restaurant: RestaurantInfo;
  categories: MenuCategory[];
  lang?: Lang;
  heroBanner?: HeroBanner;
  heroSlides?: HeroSlide[];
  banners?: Banner[];
  featuredItems?: FeaturedItem[];
  featuredTitle?: string | LS;
  ctaLabel?: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 6, md: 12, lg: 16, full: 999 } as const;
const HEADER_H = 64; // slim single-row fixed header

// ── Theme ─────────────────────────────────────────────────────────────────────

type Theme = "dark" | "light";

const DARK_VARS = {
  "--bg-color":       "#121212",
  "--bg-surface":     "#1C1C1C",
  "--bg-card":        "#1E1E1E",
  "--bg-shell":       "#0D0D0D",
  "--text-color":     "#E0E0E0",
  "--text-muted":     "#9A9A9A",
  "--border-color":   "#2A2A2A",
  "--pill-active-bg": "#E0E0E0",
  "--pill-active-fg": "#121212",
  "--pill-border":    "#333333",
  "--pill-text":      "#9A9A9A",
  "--cta-bg":         "#E0E0E0",
  "--cta-fg":         "#121212",
  "--card-shadow":    "none",
};

const LIGHT_VARS = {
  "--bg-color":       "#F8F9FA",
  "--bg-surface":     "#ECEEF0",
  "--bg-card":        "#FFFFFF",
  "--bg-shell":       "#D0D4D9",
  "--text-color":     "#121212",
  "--text-muted":     "#6B7280",
  "--border-color":   "#DDE1E6",
  "--pill-active-bg": "#121212",
  "--pill-active-fg": "#FFFFFF",
  "--pill-border":    "#D0D4D9",
  "--pill-text":      "#5C6370",
  "--cta-bg":         "#121212",
  "--cta-fg":         "#FFFFFF",
  "--card-shadow":    "0 2px 16px rgba(0,0,0,0.07)",
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
                {resolve(item.name, lang)}
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
              background: "var(--bg-surface)",
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
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "28px 12px 10px",
                background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
              }}>
                {banner.title && (
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: "0 0 2px", lineHeight: 1.2 }}>
                    {resolve(banner.title, lang)}
                  </p>
                )}
                {banner.subtitle && (
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, margin: 0 }}>
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
          <span style={{ fontSize: 18 }}>🔥</span>
        </div>

        <div style={{
          display: "flex", gap: 12, overflowX: "auto",
          marginLeft: -SP.md, marginRight: -SP.md,
          paddingLeft: SP.md, paddingRight: SP.md,
          paddingBottom: SP.sm, scrollbarWidth: "none",
        } as React.CSSProperties}>
          {dishes.map((dish, idx) => {
            const palette = CARD_PALETTES[idx % CARD_PALETTES.length];
            return (
              <button
                key={dish.id}
                onClick={() => openDetail(dish)}
                style={{
                  flexShrink: 0, width: 190, height: 150,
                  borderRadius: 18, background: palette.bg,
                  boxShadow: `0 6px 20px ${palette.glow}`,
                  position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: 14, border: "none", cursor: "pointer",
                  textAlign: "left",
                } as React.CSSProperties}
              >
                {dish.badge && (
                  <span style={{
                    position: "absolute", top: 12, left: 12,
                    fontSize: 9, fontWeight: 700, padding: "3px 8px",
                    borderRadius: R.full,
                    backgroundColor: "rgba(255,255,255,0.20)",
                    color: "rgba(255,255,255,0.95)",
                    letterSpacing: "0.04em",
                  }}>
                    {dish.badge}
                  </span>
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
                  {resolve(dish.name, lang)}
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
                {displayDish.badge && (
                  <span style={{
                    display: "inline-block", marginBottom: 6,
                    fontSize: 9, fontWeight: 700, padding: "3px 8px",
                    borderRadius: R.full,
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-muted)",
                    letterSpacing: "0.04em",
                    border: "1px solid var(--border-color)",
                  }}>
                    {displayDish.badge}
                  </span>
                )}
                <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>
                  {resolve(displayDish.name, lang)}
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

// ── Chef Recommends ───────────────────────────────────────────────────────────

function ChefRecommendsSection({
  dishes,
  lang,
  defaultCurrency,
  cart,
  onAddToCart,
}: {
  dishes: Dish[];
  lang: Lang;
  defaultCurrency?: string;
  cart: CartMap;
  onAddToCart: (dish: Dish, currency: string, delta: number) => void;
}) {
  if (!dishes.length) return null;
  const highlights = dishes;

  const tTitle =
    lang === "kz" ? "Аспаз ұсынады"
    : lang === "ru" ? "Рекомендует шеф-повар"
    : "Chef Recommends";

  return (
    <section style={{ marginBottom: SP.lg + 4, borderBottom: "1px solid var(--border-color)", paddingBottom: SP.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.md }}>
        <div style={{ width: 3, height: 20, borderRadius: R.full, backgroundColor: "var(--text-color)", flexShrink: 0 }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>{tTitle}</h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        <span style={{ fontSize: 18 }}>👨‍🍳</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {highlights.map((dish) => {
          const currency = dish.currency ?? defaultCurrency ?? "";
          const qty = cart[dish.id]?.qty ?? 0;
          return (
            <div key={dish.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "var(--bg-card)", borderRadius: R.md,
              border: "1px solid var(--border-color)", padding: "12px 14px",
            }}>
              {/* Photo or emoji square */}
              <div style={{
                width: 60, height: 60, borderRadius: R.md, flexShrink: 0,
                background: "var(--bg-surface)", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32,
              }}>
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : dish.emoji}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 3px", color: "var(--text-color)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
                  {resolve(dish.name, lang)}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {resolve(dish.desc, lang)}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
                  {dish.price.toLocaleString()} {currency}
                </p>
              </div>

              {/* Quick-add */}
              {qty > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onAddToCart(dish, currency, -1)} style={{ width: 28, height: 28, borderRadius: R.full, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => onAddToCart(dish, currency, +1)} style={{ width: 28, height: 28, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              ) : (
                <button onClick={() => onAddToCart(dish, currency, +1)} style={{ width: 36, height: 36, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
              )}
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
}: {
  lang: Lang;
  theme: "dark" | "light";
  whatsappPhone?: string;
  instagramUrl?: string;
  phone?: string;
  address?: string | LS;
  workingHours?: string | LS;
}) {
  const isDark = theme === "dark";
  const [contactOpen, setContactOpen] = useState(false);

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
    background: isDark ? "var(--bg-card)" : "var(--bg-surface)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 4, cursor: "pointer",
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => openWA(bookingMsg)} style={cardBase}>
          <span style={{ fontSize: 22 }}>📅</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tBook}</span>
        </button>
        <button onClick={() => openWA(preorderMsg)} style={cardBase}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-color)", textAlign: "center", lineHeight: 1.2 }}>{tPreorder}</span>
        </button>
        <button onClick={() => openWA(deliveryMsg)} style={cardBase}>
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
          background: isDark ? "var(--bg-card)" : "var(--bg-surface)",
          padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 14,
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
          {address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
              <div>
                <p style={rowLabel}>{tAddress}</p>
                <p style={rowValue}>{resolve(address, lang)}</p>
              </div>
            </div>
          )}
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
    </section>
  );
}

// ── Category Grid ─────────────────────────────────────────────────────────────

const CARD_PALETTES = [
  { bg: "linear-gradient(145deg, #2C1810 0%, #6B3D22 100%)", glow: "rgba(107,61,34,0.50)" },
  { bg: "linear-gradient(145deg, #0D1F0D 0%, #245C24 100%)", glow: "rgba(36,92,36,0.50)" },
  { bg: "linear-gradient(145deg, #0D1A2C 0%, #1E3F6B 100%)", glow: "rgba(30,63,107,0.50)" },
  { bg: "linear-gradient(145deg, #2C2210 0%, #6B5415 100%)", glow: "rgba(107,84,21,0.50)" },
  { bg: "linear-gradient(145deg, #1A0D2C 0%, #42246B 100%)", glow: "rgba(66,36,107,0.50)" },
  { bg: "linear-gradient(145deg, #2C0D0D 0%, #6B2424 100%)", glow: "rgba(107,36,36,0.50)" },
];

function CategoryGrid({
  categories,
  lang,
  onSelect,
}: {
  categories: MenuCategory[];
  lang: Lang;
  onSelect: (id: string) => void;
}) {
  const [pressedId, setPressedId] = useState<string | null>(null);

  const dishesLabel = (n: number) =>
    lang === "kz" ? `${n} тағам`
    : lang === "ru" ? `${n} блюд`
    : `${n} dishes`;

  return (
    <section style={{ marginBottom: SP.lg }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {categories.map((cat, idx) => {
          const palette = CARD_PALETTES[idx % CARD_PALETTES.length];
          const pressed = pressedId === cat.id;
          return (
            <button
              key={cat.id}
              onPointerDown={() => setPressedId(cat.id)}
              onPointerUp={() => setPressedId(null)}
              onPointerLeave={() => setPressedId(null)}
              onClick={() => onSelect(cat.id)}
              style={{
                position: "relative",
                height: 140,
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                padding: "14px 14px",
                background: palette.bg,
                overflow: "hidden",
                boxShadow: pressed
                  ? `0 4px 14px ${palette.glow}`
                  : `0 8px 28px ${palette.glow}`,
                transform: pressed ? "scale(0.96)" : "scale(1)",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                textAlign: "left",
              } as React.CSSProperties}
            >
              {/* Top: name + subtitle */}
              <div>
                <p style={{
                  color: "rgba(255,255,255,0.95)",
                  fontWeight: 700,
                  fontSize: 15,
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: "0.01em",
                }}>
                  {resolve(cat.name, lang)}
                </p>
                <p style={{
                  color: "rgba(255,255,255,0.42)",
                  fontSize: 11,
                  margin: "3px 0 0",
                  fontWeight: 500,
                }}>
                  {dishesLabel(cat.dishes.length)}
                </p>
              </div>

              {/* Floating icon badge */}
              <div style={{
                position: "absolute",
                bottom: 12,
                right: 12,
                width: 38,
                height: 38,
                borderRadius: R.full,
                backgroundColor: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                pointerEvents: "none",
              } as React.CSSProperties}>
                {cat.icon}
              </div>

              {/* Bottom-right: count badge */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{
                  backgroundColor: "rgba(255,255,255,0.14)",
                  color: "rgba(255,255,255,0.88)",
                  borderRadius: R.full,
                  padding: "4px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}>
                  {cat.dishes.length}
                </span>
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

// ── Horizontal Dish Section ───────────────────────────────────────────────────

function HorizontalDishSection({
  dishes,
  title,
  icon,
  lang,
  defaultCurrency,
  liked,
  onToggleLike,
  tagOverride,
  cart,
  onAddToCart,
}: {
  dishes: Dish[];
  title: string;
  icon: string;
  lang: Lang;
  defaultCurrency?: string;
  liked: Record<string, boolean>;
  onToggleLike: (id: string) => void;
  tagOverride?: string;
  cart?: CartMap;
  onAddToCart?: (dish: Dish, currency: string, delta: number) => void;
}) {
  if (!dishes.length) return null;

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
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingLeft: SP.md,
          paddingRight: SP.md,
          paddingBottom: SP.sm,
          scrollbarWidth: "none",
          marginLeft: -SP.md,
          marginRight: -SP.md,
        } as React.CSSProperties}
      >
        {dishes.map((dish) => {
          const isLiked = !!liked[dish.id];
          const count = seedLikes(dish.id) + (isLiked ? 1 : 0);
          const currency = dish.currency ?? defaultCurrency ?? "";
          const qty = cart?.[dish.id]?.qty ?? 0;
          const tag = tagOverride ?? dish.badge;

          return (
            <div
              key={dish.id}
              style={{
                flexShrink: 0,
                width: 152,
                borderRadius: R.lg,
                overflow: "hidden",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <div
                style={{
                  height: 96,
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {dish.imageUrl ? (
                  <img
                    src={dish.imageUrl}
                    alt={resolve(dish.name, lang)}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : dish.emoji}
                {tag && (
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
                    {tag}
                  </span>
                )}
                {dish.discountLabel && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: SP.xs,
                      left: SP.xs,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "3px 7px",
                      borderRadius: R.sm,
                      backgroundColor: "#E05555",
                      color: "#fff",
                      letterSpacing: "0.03em",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {dish.discountLabel}
                  </span>
                )}
              </div>

              <div style={{ padding: SP.sm }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    margin: "0 0 4px",
                    lineHeight: 1.3,
                    color: "var(--text-color)",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}
                >
                  {resolve(dish.name, lang)}
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px", color: "var(--text-color)" }}>
                  {dish.price.toLocaleString()} {currency}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleLike(dish.id); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      color: isLiked ? "#E05555" : "var(--text-muted)",
                    }}
                  >
                    <Heart size={12} fill={isLiked ? "#E05555" : "none"} stroke={isLiked ? "#E05555" : "currentColor"} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>
                  </button>
                  {onAddToCart && (
                    qty > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <button onClick={() => onAddToCart(dish, currency, -1)} style={{ width: 20, height: 20, borderRadius: R.full, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-color)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>−</button>
                        <span style={{ fontSize: 11, fontWeight: 700, minWidth: 12, textAlign: "center" }}>{qty}</span>
                        <button onClick={() => onAddToCart(dish, currency, +1)} style={{ width: 20, height: 20, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => onAddToCart(dish, currency, +1)} style={{ width: 24, height: 24, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>+</button>
                    )
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
}: {
  dish: Dish;
  lang: Lang;
  currency: string;
  cart: CartMap;
  liked: Record<string, boolean>;
  onAddToCart: (dish: Dish, currency: string, delta: number) => void;
  onToggleLike: (id: string) => void;
  getLikeCount: (id: string) => number;
}) {
  const isLiked = !!liked[dish.id];
  const count   = getLikeCount(dish.id);
  const qty     = cart[dish.id]?.qty ?? 0;
  const badgeLabel = dish.badge ?? (dish.isNew ? "NEW" : null);

  return (
    <div
      style={{
        borderRadius: R.lg,
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-card)",
        boxShadow: "var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.2s, border-color 0.2s",
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
        } as React.CSSProperties}
      >
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt={resolve(dish.name, lang)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : dish.emoji}
        {badgeLabel && (
          <span
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              fontSize: 8,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: R.sm,
              backgroundColor: "var(--text-color)",
              color: "var(--bg-color)",
              letterSpacing: "0.03em",
              lineHeight: 1.4,
              whiteSpace: "nowrap",
            }}
          >
            {badgeLabel}
          </span>
        )}
        {dish.discountLabel && (
          <span
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: R.sm,
              backgroundColor: "#E05555",
              color: "#fff",
              letterSpacing: "0.03em",
              lineHeight: 1.4,
              whiteSpace: "nowrap",
            }}
          >
            {dish.discountLabel}
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
          {resolve(dish.name, lang)}
        </p>

        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
          {dish.price.toLocaleString()} {currency}
        </p>

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
          {qty > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => onAddToCart(dish, currency, -1)}
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
                onClick={() => onAddToCart(dish, currency, +1)}
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
              onClick={() => onAddToCart(dish, currency, +1)}
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
      </div>
    </div>
  );
}

// ── Hero Slider ───────────────────────────────────────────────────────────────

const TAG_COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  white:  { bg: "rgba(255,255,255,0.88)", fg: "#111" },
  yellow: { bg: "#F9D94A",               fg: "#111" },
  green:  { bg: "#4ADE80",               fg: "#111" },
  red:    { bg: "#F87171",               fg: "#111" },
  blue:   { bg: "#60A5FA",               fg: "#111" },
  orange: { bg: "#FB923C",               fg: "#111" },
  purple: { bg: "#A78BFA",               fg: "#111" },
};

const SLIDE_DURATION = 5000;
const SLIDE_TICK     = 50;

function HeroSliderInner({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx]           = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((next: number) => {
    const n = ((next % slides.length) + slides.length) % slides.length;
    setIdx(n);
    setProgress(0);
  }, [slides.length]);

  useEffect(() => {
    setProgress(0);
    if (slides[idx]?.type === "video") return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + (SLIDE_TICK / SLIDE_DURATION) * 100;
        if (next >= 100) { go(idx + 1); return 0; }
        return next;
      });
    }, SLIDE_TICK);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [idx, go, slides]);

  const slide = slides[idx];
  if (!slide) return null;

  return (
    <div
      style={{
        position: "relative", width: "100%", height: "min(480px, 125vw)", overflow: "hidden",
        borderRadius: "0 0 20px 20px", backgroundColor: "#000",
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
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress((v.currentTime / v.duration) * 100);
              }}
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

      {/* Bottom overlay: tag + title + description + progress bars */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 6,
          padding: "56px 16px 12px",
          background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.0) 100%)",
          pointerEvents: "none",
          display: "flex", flexDirection: "column", gap: 0,
        }}
      >
        {/* Tag badges */}
        {slide.tags && slide.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {slide.tags.map((tag, i) => {
              const palette = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.white;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    backgroundColor: palette.bg,
                    color: palette.fg,
                    fontSize: 10, fontWeight: 800,
                    padding: "3px 10px", borderRadius: 99,
                    letterSpacing: "0.06em", lineHeight: 1.5,
                    textTransform: "uppercase",
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
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: "0 0 3px", textShadow: "0 1px 8px rgba(0,0,0,0.5)", lineHeight: 1.2 }}>
            {slide.title}
          </p>
        )}

        {/* Description / categories */}
        {slide.description && (
          <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, margin: "0 0 10px", lineHeight: 1.4 }}>
            {slide.description}
          </p>
        )}

        {/* Dot / pill indicators — centered */}
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
                    backgroundColor: isPast ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.28)",
                    overflow: "hidden",
                    transition: "width 0.25s ease",
                    flexShrink: 0,
                  }}
                >
                  {isActive && (
                    <div
                      style={{
                        height: "100%", borderRadius: 99,
                        backgroundColor: "rgba(255,255,255,0.95)",
                        width: `${progress}%`,
                      }}
                    />
                  )}
                </div>
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
        position: "relative", width: "100%", height: "min(480px, 125vw)", overflow: "hidden",
        backgroundImage: `url(${fallback.imageUrl})`,
        backgroundSize: "cover", backgroundPosition: "center",
        borderRadius: "0 0 20px 20px",
      } as React.CSSProperties}
    >
      {(fallback.title || fallback.subtitle) && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "40px 16px 16px",
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)",
        }}>
          {fallback.title && (
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: "0 0 2px", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              {resolve(fallback.title, lang)}
            </p>
          )}
          {fallback.subtitle && (
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: 0 }}>
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
  featuredItems,
  featuredTitle,
}: MenuTemplateProps) {
  const [theme, setTheme]           = useState<Theme>("dark");
  const [lang, setLang]             = useState<Lang>(initLang);
  const [view, setView]             = useState<"home" | "catalog" | "menu">("home");
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
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
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [contentX, setContentX]             = useState(0);
  const [contentTrans, setContentTrans]     = useState("none");

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

  // Track whether user has scrolled past the hero banner
  useEffect(() => {
    const BANNER_H = 240;
    const onScroll = () => setHeaderScrolled(window.scrollY > BANNER_H);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const addToCart = (dish: Dish, effectiveCurrency: string, delta: number) => {
    setCart((prev) => {
      const current = prev[dish.id]?.qty ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [dish.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dish.id]: { dish, qty: next, currency: effectiveCurrency } };
    });
  };

  const updateCartQty = (dishId: string, delta: number) => {
    setCart((prev) => {
      const entry = prev[dishId];
      if (!entry) return prev;
      const next = Math.max(0, entry.qty + delta);
      if (next === 0) {
        const { [dishId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dishId]: { ...entry, qty: next } };
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
  const allDishes         = categories.flatMap((c) => c.dishes);
  const promoDishes       = allDishes.filter((d) => d.isPromo);
  const recommendedDishes = allDishes.filter((d) => d.isRecommended);
  const newDishes         = allDishes.filter((d) => d.isNew);

  const tAll = lang === "kz" ? "Барлығы" : lang === "ru" ? "Все" : "All";
  const tNew = lang === "kz" ? "Жаңалықтар" : lang === "ru" ? "Новинки" : "New Arrivals";

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

  const themeVars = (theme === "dark" ? DARK_VARS : LIGHT_VARS) as React.CSSProperties;

  const onImage  = !!heroBanner?.imageUrl;
  const overImage = onImage && !searchOpen && view === "home" && !headerScrolled;

  return (
    <div
      style={{
        ...themeVars,
        minHeight: "100vh",
        backgroundColor: "var(--bg-shell)",
        color: "var(--text-color)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
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
        paddingBottom: 120,
        overflowX: "hidden",
      }}
    >
      {/* ── Fixed global header ────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "max(calc(50vw - 240px), 0px)",
          width: "min(100vw, 480px)",
          zIndex: 100,
          backgroundColor: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderBottom: "none",
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
              {/* Logo + Name — no box around the icon */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                  stroke={overImage ? "rgba(255,255,255,0.95)" : "var(--text-color)"}
                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0 } as React.CSSProperties}>
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                  <path d="M7 2v20" />
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
                </svg>
                <h1 style={{
                  fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: "0.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: overImage ? "rgba(255,255,255,0.95)" : "var(--text-color)",
                  textShadow: overImage ? "0 1px 6px rgba(0,0,0,0.4)" : "none",
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
                    color: overImage ? "rgba(255,255,255,0.8)" : "var(--text-muted)", cursor: "pointer",
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
                    color: overImage ? "rgba(255,255,255,0.8)" : "var(--text-muted)", cursor: "pointer",
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
                      color: overImage ? "rgba(255,255,255,0.95)" : "var(--text-color)",
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
                    color: overImage ? "rgba(255,255,255,0.8)" : "var(--text-muted)", cursor: "pointer",
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                />
              ))}
            </div>
          )
        )}

        {/* ── HOME VIEW ──────────────────────────────────────────────────── */}
        {!isSearching && view === "home" && (
          <>
            {/* 1. DB promotional banners */}
            <BannerSlider banners={banners} lang={lang} />

            {/* 2. Promo slider — dishes flagged is_promo */}
            <PromoSlider
              dishes={promoDishes}
              lang={lang}
            />

            {/* 3. Chef recommends — dishes flagged is_recommended */}
            <ChefRecommendsSection
              dishes={recommendedDishes}
              lang={lang}
              defaultCurrency={restaurant.currency}
              cart={cart}
              onAddToCart={addToCart}
            />

            {/* 3. New arrivals */}
            {newDishes.length > 0 && (
              <HorizontalDishSection
                dishes={newDishes}
                title={tNew}
                icon="✨"
                lang={lang}
                defaultCurrency={restaurant.currency}
                liked={liked}
                onToggleLike={toggleLike}
                tagOverride="NEW"
                cart={cart}
                onAddToCart={addToCart}
              />
            )}

            {/* 4. FeaturedItems prop (demo page) */}
            {featuredItems && featuredItems.length > 0 && (
              <FeaturedSection
                items={featuredItems}
                title={featuredTitle}
                lang={lang}
                defaultCurrency={restaurant.currency}
              />
            )}

            {/* 5. Info cards — reserve / contact */}
            <InfoCards
              lang={lang}
              theme={theme}
              whatsappPhone={restaurant.whatsappPhone}
              instagramUrl={restaurant.instagramUrl}
              phone={restaurant.phone}
              address={restaurant.address}
              workingHours={restaurant.workingHours}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(categories.find((c) => c.id === activeCatId)?.dishes ?? []).map((dish) => (
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
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-color)" }}>
                    {resolve(cat.name, lang)}
                  </h2>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                    {cat.dishes.length}
                  </span>
                </div>

                {/* Compact list rows */}
                {cat.dishes.map((dish) => {
                  const currency = dish.currency ?? restaurant.currency ?? "";
                  const qty = cart[dish.id]?.qty ?? 0;
                  return (
                    <div key={dish.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-color)" }}>
                      {/* Emoji thumbnail */}
                      <div style={{ width: 60, height: 60, borderRadius: R.md, flexShrink: 0, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, position: "relative" }}>
                        {dish.emoji}
                        {(dish.badge || dish.isNew) && (
                          <span style={{ position: "absolute", top: -4, left: -4, fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: R.sm, backgroundColor: "var(--text-color)", color: "var(--bg-color)", letterSpacing: "0.03em", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                            {dish.badge ?? "NEW"}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px", color: "var(--text-color)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
                          {resolve(dish.name, lang)}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                          {resolve(dish.desc, lang)}
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
                          {dish.price.toLocaleString()} {currency}
                        </p>
                      </div>

                      {/* Cart control */}
                      {qty > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => addToCart(dish, currency, -1)} style={{ width: 28, height: 28, borderRadius: R.full, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span>
                          <button onClick={() => addToCart(dish, currency, +1)} style={{ width: 28, height: 28, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(dish, currency, +1)} style={{ width: 34, height: 34, borderRadius: R.full, border: "none", background: "var(--text-color)", color: "var(--bg-color)", cursor: "pointer", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border-color)",
          padding: SP.md + 4,
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Powered by ScanServe.qr
      </footer>
      </div>

      {/* ── Bottom category pills bar (menu view only) ───────────────────── */}
      {view === "menu" && (
        <div
          style={{
            position: "fixed",
            bottom: 60,
            left: "max(calc(50vw - 240px), 0px)",
            right: "max(calc(50vw - 240px), 0px)",
            zIndex: 65,
            backgroundColor: "var(--bg-color)",
            borderTop: "1px solid var(--border-color)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          } as React.CSSProperties}
        >
          <div
            ref={stripRef}
            style={{ overflowX: "auto", scrollbarWidth: "none", padding: `8px ${SP.md}px` } as React.CSSProperties}
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
                    <span>{resolve(cat.name, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom navigation bar ─────────────────────────────────────────── */}
      <BottomNav
        lang={lang}
        theme={theme}
        cartCount={cartCount}
        activeTab={view === "catalog" ? "categories" : view === "menu" ? "menu" : "home"}
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
        whatsappPhone={restaurant.whatsappPhone}
      />
    </div>
    </div>
  );
}

