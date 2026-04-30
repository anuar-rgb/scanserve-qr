"use client";

import { useState } from "react";
import { Home, LayoutGrid, Utensils, ShoppingCart, Bell } from "lucide-react";
import type { Lang } from "./MenuTemplate";

type Tab = "home" | "categories" | "menu" | "waiter" | "cart";

const LABELS: Record<Tab, Record<Lang, string>> = {
  home:       { en: "Home",       ru: "Главная",  kz: "Басты"  },
  categories: { en: "Categories", ru: "Каталог",  kz: "Санат"  },
  menu:       { en: "Menu",       ru: "Меню",     kz: "Мәзір"  },
  waiter:     { en: "Waiter",     ru: "Вызов",    kz: "Даяшы"  },
  cart:       { en: "Cart",       ru: "Корзина",  kz: "Себет"  },
};

const TABS: { id: Tab; Icon: React.ElementType }[] = [
  { id: "home",       Icon: Home         },
  { id: "categories", Icon: LayoutGrid   },
  { id: "menu",       Icon: Utensils     },
  { id: "waiter",     Icon: Bell         },
  { id: "cart",       Icon: ShoppingCart },
];

export interface BottomNavProps {
  lang?: Lang;
  theme?: "dark" | "light";
  cartCount?: number;
  activeTab?: Tab;
  onHomeTab?: () => void;
  onCatalogTab?: () => void;
  onMenuTab?: () => void;
  onWaiterTab?: () => void;
  onCartTab?: () => void;
}

export function BottomNav({ lang = "en", theme = "dark", cartCount, activeTab, onHomeTab, onCatalogTab, onMenuTab, onWaiterTab, onCartTab }: BottomNavProps) {
  const [internalActive, setInternalActive] = useState<Tab>("home");
  const active = activeTab ?? internalActive;

  const isDark = theme === "dark";
  const glassBg   = isDark ? "rgba(14,14,14,0.92)" : "rgba(248,249,250,0.94)";
  const borderTop = isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.10)";
  const mutedClr  = isDark ? "rgba(224,224,224,0.35)" : "rgba(18,18,18,0.30)";
  // Strict B&W pill: dark bg in light mode, light bg in dark mode
  const pillBg    = isDark ? "#E0E0E0" : "#121212";
  const pillFg    = isDark ? "#121212" : "#E0E0E0";

  const handleTab = (tab: Tab) => {
    if (tab !== "waiter") setInternalActive(tab);
    if (tab === "home") {
      onHomeTab?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "categories") {
      onCatalogTab?.();
    } else if (tab === "menu") {
      onMenuTab?.();
    } else if (tab === "waiter") {
      onWaiterTab?.();
    } else if (tab === "cart") {
      onCartTab?.();
    }
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "max(calc(50vw - 240px), 0px)",
        right: "max(calc(50vw - 240px), 0px)",
        height: 60,
        background: glassBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop,
        display: "flex",
        alignItems: "stretch",
        zIndex: 70,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      } as React.CSSProperties}
    >
      {TABS.map(({ id, Icon }) => {
        const isActive = active === id;

        return (
          <button
            key={id}
            onClick={() => handleTab(id)}
            aria-label={LABELS[id][lang]}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: isActive ? pillFg : mutedClr,
              transition: "color 0.15s",
              position: "relative",
              padding: "4px 4px",
            }}
          >
            {/* Active B&W pill */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 5,
                  bottom: 5,
                  left: "10%",
                  right: "10%",
                  borderRadius: 12,
                  backgroundColor: pillBg,
                  transition: "background-color 0.15s",
                }}
              />
            )}

            {/* Icon + optional cart badge */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
              {id === "cart" && cartCount != null && cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 999,
                    backgroundColor: "#E53E3E",
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                    pointerEvents: "none",
                  }}
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </div>

            {/* Label */}
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
                letterSpacing: "0.01em",
                position: "relative",
                zIndex: 1,
              }}
            >
              {LABELS[id][lang]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
