"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart2, Star, Tag, Package, Sparkles, Monitor,
  QrCode, BookOpen, Settings, LogOut, Sun, Moon, ShoppingBag, LayoutGrid, CreditCard, FileText, TrendingUp, Users, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations, type Dict } from "@/lib/i18n";
import { useIsOwner, useIsStrictOwner, useRole } from "@/lib/role-context";
import { useShift } from "@/lib/shift-context";

type AdminKey = keyof Dict["admin"];

type NavSection = {
  titleKey: AdminKey;
  ownerOnly?: true;
  strictOwner?: true;
  items: { labelKey: AdminKey; icon: LucideIcon; href: string; ownerOnly?: true; strictOwner?: true; noWaiter?: true }[];
};

const NAV: NavSection[] = [
  {
    titleKey: "sectionOwner",
    strictOwner: true,
    items: [
      { labelKey: "navOwnerOverview", icon: TrendingUp, href: "/admin/owner-overview", strictOwner: true },
    ],
  },
  {
    titleKey: "sectionAnalytics",
    ownerOnly: true,
    items: [
      { labelKey: "navOverview",   icon: BarChart2,   href: "/admin/analytics",  ownerOnly: true },
      { labelKey: "navOrders",     icon: ShoppingBag, href: "/admin/orders",     ownerOnly: true },
      { labelKey: "navReviews",    icon: Star,        href: "/admin/reviews",    ownerOnly: true },
      { labelKey: "navPromotions", icon: Tag,         href: "/admin/promotions", ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionPOS",
    items: [
      { labelKey: "navHall",     icon: LayoutGrid, href: "/admin/hall"                },
      { labelKey: "navInvoices", icon: FileText,   href: "/admin/invoices", noWaiter: true },
    ],
  },
  {
    titleKey: "sectionManagement",
    ownerOnly: true,
    items: [
      { labelKey: "navCatalog",    icon: Package,  href: "/admin/dashboard",  ownerOnly: true },
      { labelKey: "navModifiers", icon: Settings, href: "/admin/modifiers",  ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionStorefront",
    ownerOnly: true,
    items: [
      { labelKey: "navMainScreen", icon: Monitor, href: "/admin/storefront", ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionQR",
    ownerOnly: true,
    items: [
      { labelKey: "navIntegration", icon: QrCode,   href: "/admin/qr",       ownerOnly: true },
      { labelKey: "navTraining",    icon: BookOpen, href: "/admin/training", ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionSettings",
    ownerOnly: true,
    items: [
      { labelKey: "navStaff",        icon: Users,      href: "/admin/settings/staff", ownerOnly: true },
      { labelKey: "navPaymentBanks", icon: CreditCard, href: "/admin/payment-banks",  strictOwner: true },
      { labelKey: "navProfile",      icon: Settings,   href: "/admin/settings",       ownerOnly: true },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const role = useRole();
  const isOwner = useIsOwner();
  const isStrictOwner = useIsStrictOwner();

  const roleLabel: Record<string, string> = {
    owner:   "Owner Platform",
    manager: "Manager Platform",
    cashier: "Cashier Terminal",
    waiter:  "Waiter Terminal",
    chef:    "Chef Terminal",
  };
  const platformLabel = role ? (roleLabel[role] ?? "Staff Terminal") : "Staff Terminal";
  const { shift, closeShift } = useShift();
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => setMounted(true), []);

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function handleCloseShift() {
    await closeShift();
    setConfirmClose(false);
  }

  const isDark = !mounted || theme === "dark";

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const visibleSections = NAV.filter((s) => {
    if (s.strictOwner && !isStrictOwner) return false;
    if (s.ownerOnly && !isOwner) return false;
    return true;
  });

  return (
    <aside className="fixed inset-y-0 left-0 w-60 hidden md:flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/60 z-20 transition-colors duration-200">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
            А
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">АС ТӨРІ</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">
              {platformLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {visibleSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.strictOwner && !isStrictOwner) return false;
            if (item.ownerOnly && !isOwner) return false;
            if (item.noWaiter && role === "waiter") return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.titleKey}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                {t.admin[section.titleKey]}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-violet-50 dark:bg-violet-600/15 text-violet-700 dark:text-violet-300"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isActive ? "text-violet-600 dark:text-violet-400" : "text-zinc-400 dark:text-zinc-500"}
                      />
                      {t.admin[item.labelKey]}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800/60 p-2.5 space-y-0.5">
        {/* Theme toggle */}
        <button
          onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
        >
          {isDark
            ? <Moon size={14} className="text-zinc-500 shrink-0" />
            : <Sun size={14} className="text-amber-500 shrink-0" />
          }
          <span>{isDark ? t.admin.darkMode : t.admin.lightMode}</span>
          <div
            className={`ml-auto w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 transition-all duration-200 ${
              isDark ? "bg-violet-600 justify-end" : "bg-zinc-300 justify-start"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
          </div>
        </button>

        {/* Language switcher */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
            Lang
          </span>
          <div className="ml-auto flex items-center gap-1">
            {(["en", "ru"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  lang === l
                    ? "bg-violet-600 text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Shift status */}
        {shift && (
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <Clock size={12} className="text-emerald-500 shrink-0" />
            <span className="flex-1 min-w-0 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              Смена с {fmtTime(shift.opened_at)}
            </span>
            {isOwner && !confirmClose && (
              <button
                onClick={() => setConfirmClose(true)}
                className="ml-auto shrink-0 text-[10px] text-red-400 hover:text-red-500 transition-colors"
              >
                Закрыть
              </button>
            )}
            {isOwner && confirmClose && (
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCloseShift}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-600"
                >
                  Да
                </button>
                <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">·</span>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600"
                >
                  Нет
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
          {t.admin.signOut}
        </button>
      </div>
    </aside>
  );
}
