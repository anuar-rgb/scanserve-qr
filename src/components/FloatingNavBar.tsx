"use client";

import { Home, LayoutGrid, Heart, Bell, ShoppingCart } from "lucide-react";
import type { Lang } from "./MenuTemplate";

type Tab = "home" | "catalog" | "likes" | "waiter";

const LABELS: Record<Tab, Record<Lang, string>> = {
  home:    { en: "Home",    ru: "Главная",  kz: "Басты"  },
  catalog: { en: "Catalog", ru: "Каталог",  kz: "Санат"  },
  likes:   { en: "Saved",   ru: "Избранное", kz: "Таңд." },
  waiter:  { en: "Waiter",  ru: "Официант", kz: "Даяшы"  },
};

const ICONS: Record<Tab, React.ElementType> = {
  home:    Home,
  catalog: LayoutGrid,
  likes:   Heart,
  waiter:  Bell,
};

export interface FloatingNavBarProps {
  lang?: Lang;
  theme?: "dark" | "light";
  cartCount?: number;
  activeTab?: Tab;
  onHomeTab?: () => void;
  onCatalogTab?: () => void;
  onLikesTab?: () => void;
  onWaiterTab?: () => void;
  onCartTab?: () => void;
}

const TABS: Tab[] = ["home", "catalog", "likes", "waiter"];

export function FloatingNavBar({
  lang = "en",
  theme = "dark",
  cartCount,
  activeTab = "home",
  onHomeTab,
  onCatalogTab,
  onLikesTab,
  onWaiterTab,
  onCartTab,
}: FloatingNavBarProps) {
  const isDark = theme === "dark";

  const pillBg     = isDark ? "rgba(22,22,26,0.94)" : "rgba(255,255,255,0.94)";
  const pillBorder = isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.07)";
  const pillShadow = isDark
    ? "0 8px 32px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.30)"
    : "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07)";

  const activeBg   = isDark ? "#EBEBEB" : "#111111";
  const activeFg   = isDark ? "#111111" : "#EBEBEB";
  const inactiveFg = isDark ? "rgba(200,200,210,0.38)" : "rgba(10,10,20,0.30)";
  const cartFg     = isDark ? "#DEDEDE" : "#111111";

  const handlers: Record<Tab, (() => void) | undefined> = {
    home:    onHomeTab,
    catalog: onCatalogTab,
    likes:   onLikesTab,
    waiter:  onWaiterTab,
  };

  return (
    <nav
      aria-label="Navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: "max(calc(50vw - 240px), 0px)",
        right: "max(calc(50vw - 240px), 0px)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        zIndex: 70,
        pointerEvents: "none",
      }}
    >
      {/* ── Main pill ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: pillBg,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: 999,
          border: pillBorder,
          boxShadow: pillShadow,
          padding: 6,
          height: 62,
          pointerEvents: "auto",
          overflow: "hidden",
        }}
      >
        {TABS.map((id) => {
          const isActive = activeTab === id;
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              onClick={handlers[id]}
              aria-label={LABELS[id][lang]}
              aria-current={isActive ? "page" : undefined}
              style={{
                flex: isActive ? "0 0 auto" : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: isActive ? activeBg : "transparent",
                border: "none",
                borderRadius: 999,
                height: "100%",
                padding: isActive ? "0 18px" : "0",
                cursor: "pointer",
                color: isActive ? activeFg : inactiveFg,
                transition:
                  "background 0.22s cubic-bezier(0.34,1.56,0.64,1), " +
                  "color 0.18s ease, " +
                  "padding 0.22s cubic-bezier(0.34,1.56,0.64,1), " +
                  "flex 0.22s ease",
                whiteSpace: "nowrap",
                minWidth: isActive ? 0 : 0,
                overflow: "hidden",
              }}
            >
              <Icon
                size={21}
                strokeWidth={isActive ? 2.3 : 1.7}
                style={{ flexShrink: 0, transition: "stroke-width 0.18s ease" }}
              />
              {isActive && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    lineHeight: 1,
                    animation: "fnb-label-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
                  }}
                >
                  {LABELS[id][lang]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Cart circle ─────────────────────────────────────────────────── */}
      <button
        onClick={onCartTab}
        aria-label={lang === "ru" ? "Корзина" : lang === "kz" ? "Себет" : "Cart"}
        style={{
          position: "relative",
          width: 62,
          height: 62,
          flexShrink: 0,
          borderRadius: 999,
          background: pillBg,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: pillBorder,
          boxShadow: pillShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: cartFg,
          pointerEvents: "auto",
          transition: "transform 0.14s ease",
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.93)"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.93)"; }}
        onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        <ShoppingCart size={22} strokeWidth={1.8} />

        {/* Badge */}
        {cartCount != null && cartCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 9,
              right: 9,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              backgroundColor: "#E53E3E",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
              pointerEvents: "none",
              boxShadow: "0 0 0 2px " + pillBg,
            }}
          >
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>

      {/* Label slide-in keyframe */}
      <style>{`
        @keyframes fnb-label-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </nav>
  );
}
