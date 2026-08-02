"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart2, Star, Tag, Package, Monitor,
  QrCode, BookOpen, Settings, LogOut, Sun, Moon, ShoppingBag, LayoutGrid, CreditCard, FileText, TrendingUp, Users, Clock, MessageSquare, LogIn, PrinterIcon, FilePen, Boxes, AlertTriangle, CalendarDays, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations, type Dict } from "@/lib/i18n";
import { useIsOwner, useIsStrictOwner, useRole, usePlanId } from "@/lib/role-context";
import { useShift } from "@/lib/shift-context";
import { useCheckin } from "@/lib/checkin-context";
import { WaiterCallBell } from "./WaiterCallBell";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const QrScannerModal = dynamic(() => import("./QrScannerModal"), { ssr: false });

type AdminKey = keyof Dict["admin"];

type NavSection = {
  titleKey: AdminKey;
  ownerOnly?: true;
  strictOwner?: true;
  courierSection?: true;
  noPOS?: true;
  storekeeperAccess?: true;
  accountantAccess?: true;
  items: { labelKey: AdminKey; icon: LucideIcon; href: string; ownerOnly?: true; strictOwner?: true; noWaiter?: true; planFeature?: string; courierAccess?: true }[];
};

const NAV: NavSection[] = [
  {
    titleKey: "sectionCRM",
    ownerOnly: true,
    items: [
      { labelKey: "navCRM", icon: MessageSquare, href: "/admin/crm", ownerOnly: true, planFeature: "crm" },
    ],
  },
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
      { labelKey: "navPromotions", icon: Tag,         href: "/admin/promotions", ownerOnly: true, planFeature: "promotions" },
    ],
  },
  {
    titleKey: "sectionWarehouse",
    storekeeperAccess: true,
    items: [
      { labelKey: "navWarehouse", icon: Boxes, href: "/admin/warehouse" },
    ],
  },
  {
    titleKey: "sectionFinance",
    accountantAccess: true,
    items: [
      { labelKey: "navBilling", icon: CreditCard, href: "/admin/billing" },
    ],
  },
  {
    titleKey: "sectionPOS",
    noPOS: true,
    items: [
      { labelKey: "navHall",     icon: LayoutGrid, href: "/admin/hall"                },
      { labelKey: "navInvoices", icon: FileText,   href: "/admin/invoices", noWaiter: true },
    ],
  },
  {
    titleKey: "sectionManagement",
    ownerOnly: true,
    items: [
      { labelKey: "navCatalog",    icon: Package,      href: "/admin/dashboard",  ownerOnly: true },
      { labelKey: "navModifiers", icon: Settings,     href: "/admin/modifiers",  ownerOnly: true },
      { labelKey: "navAttendance", icon: CalendarDays, href: "/admin/attendance", ownerOnly: true },
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
      { labelKey: "navStaff",        icon: Users,        href: "/admin/settings/staff",     ownerOnly: true },
      { labelKey: "navDocuments",    icon: FilePen,      href: "/admin/documents",          ownerOnly: true },
      { labelKey: "navPaymentBanks", icon: CreditCard,  href: "/admin/payment-banks",      strictOwner: true },
      { labelKey: "navPrinters",     icon: PrinterIcon, href: "/admin/settings/printers",  ownerOnly: true },
      { labelKey: "navProfile",      icon: Settings,    href: "/admin/settings",            ownerOnly: true },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const role = useRole();
  const isOwner = useIsOwner();
  const isStrictOwner = useIsStrictOwner();
  const planId = usePlanId();
  const isStarter = planId === "starter";

  const roleLabel: Record<string, string> = {
    owner:      "Owner Platform",
    manager:    "Manager Platform",
    supervisor: "Supervisor Platform",
    cashier:    "Cashier Terminal",
    waiter:     "Waiter Terminal",
    chef:       "Chef Terminal",
  };
  const platformLabel = role ? (roleLabel[role] ?? "Staff Terminal") : "Staff Terminal";
  const { shift, closeShift } = useShift();
  const { isCheckedIn, checkout } = useCheckin();
  const [confirmClose, setConfirmClose] = useState(false);
  const [blockedTables, setBlockedTables] = useState<string[] | null>(null);
  const [checkoutScanning, setCheckoutScanning] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const STAFF_ROLES = new Set(["waiter", "chef", "bartender", "hostess", "courier", "cleaner", "doorman", "sommelier", "senior_waiter", "runner", "storekeeper", "accountant"]);
  const isStaff = role !== null && STAFF_ROLES.has(role);

  useEffect(() => setMounted(true), []);

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function handleCloseShift() {
    const result = await closeShift();
    if (result.blocked) {
      setBlockedTables(result.tables);
    } else {
      setConfirmClose(false);
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank");
      } else if (result.noWhatsappSet) {
        toast.info("Смена закрыта. Укажите номер WhatsApp в настройках для автоотчёта.");
      }
    }
  }

  async function handleCheckoutScan(token: string) {
    setCheckoutScanning(false);
    setCheckoutBusy(true);
    const result = await checkout(token);
    setCheckoutBusy(false);
    if (result.ok) {
      toast.success("Смена завершена. До свидания!");
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/login");
    } else {
      toast.error(result.error ?? "Неверный QR-код");
    }
  }

  const isDark = !mounted || theme === "dark";

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
  }

  const isCourier = role === "courier";
  const NO_POS_ROLES = new Set(["courier", "storekeeper", "cleaner", "doorman"]);
  const visibleSections = NAV.filter((s) => {
    if (s.strictOwner && !isStrictOwner) return false;
    if (s.ownerOnly && !isOwner) return false;
    if (s.noPOS && NO_POS_ROLES.has(role ?? "")) return false;
    if (s.courierSection) return isCourier || isOwner;
    if (s.storekeeperAccess) return role === "storekeeper" || isOwner;
    if (s.accountantAccess) return role === "accountant" || isOwner;
    return true;
  });

  return (
  <>
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setConfirmClose(false); }}
      className={`fixed inset-y-0 left-0 hidden md:flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/60 z-20 overflow-hidden ${
        expanded ? "w-60" : "w-16"
      }`}
      style={{ transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)" }}
    >
      {/* Brand */}
      <div className="px-3 py-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
            S
          </div>
          <div className={`min-w-0 flex-1 transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight whitespace-nowrap">ScanServe</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight whitespace-nowrap">
              {platformLabel}
            </p>
          </div>
          {!isOwner && expanded && <WaiterCallBell />}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        {visibleSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.strictOwner && !isStrictOwner) return false;
            if (item.ownerOnly && !isOwner) return false;
            if (item.noWaiter && role === "waiter") return false;
            if (item.courierAccess) return isCourier || isOwner;
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.titleKey}>
              <p className={`px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 whitespace-nowrap transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 h-0 mb-0 overflow-hidden"}`}>
                {t.admin[section.titleKey]}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const locked = isStarter && !!item.planFeature;
                  if (locked) {
                    return (
                      <button
                        key={item.href}
                        title={expanded ? undefined : String(t.admin[item.labelKey])}
                        onClick={() => toast.info("Доступно в тарифе Стандарт", { description: "Обновите подписку для доступа к этой функции" })}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap opacity-50 cursor-not-allowed ${
                          expanded ? "" : "justify-center"
                        } text-zinc-500 dark:text-zinc-600`}
                      >
                        <Lock size={16} className="shrink-0 text-zinc-400 dark:text-zinc-600" />
                        <span className={`transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                          {t.admin[item.labelKey]}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={expanded ? undefined : String(t.admin[item.labelKey])}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        expanded ? "" : "justify-center"
                      } ${
                        isActive
                          ? "bg-violet-50 dark:bg-violet-600/15 text-violet-700 dark:text-violet-300"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={`shrink-0 ${isActive ? "text-violet-600 dark:text-violet-400" : "text-zinc-400 dark:text-zinc-500"}`}
                      />
                      <span className={`transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                        {t.admin[item.labelKey]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800/60 p-2 space-y-0.5">
        {/* Theme toggle */}
        <button
          onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
          title={expanded ? undefined : (isDark ? "Dark mode" : "Light mode")}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors whitespace-nowrap ${expanded ? "" : "justify-center"}`}
        >
          {isDark
            ? <Moon size={16} className="text-zinc-500 shrink-0" />
            : <Sun size={16} className="text-amber-500 shrink-0" />
          }
          {expanded && (
            <>
              <span>{isDark ? t.admin.darkMode : t.admin.lightMode}</span>
              <div
                className={`ml-auto w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 transition-all duration-200 ${
                  isDark ? "bg-violet-600 justify-end" : "bg-zinc-300 justify-start"
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
              </div>
            </>
          )}
        </button>

        {/* Language switcher */}
        {expanded && (
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
        )}

        {/* Shift status */}
        {shift && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 whitespace-nowrap ${expanded ? "" : "justify-center"}`}>
            <Clock size={14} className="text-emerald-500 shrink-0" />
            {expanded && (
              <>
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
              </>
            )}
          </div>
        )}

        {/* Завершить работу — only for waiter / chef */}
        {isStaff && isCheckedIn && (
          <button
            onClick={() => setCheckoutScanning(true)}
            disabled={checkoutBusy}
            title={expanded ? undefined : "Завершить работу"}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-60 whitespace-nowrap ${expanded ? "" : "justify-center"}`}
          >
            <LogIn size={16} className="shrink-0 rotate-180" />
            {expanded && (checkoutBusy ? "Проверяем…" : "Завершить работу")}
          </button>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          title={expanded ? undefined : String(t.admin.signOut)}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors whitespace-nowrap ${expanded ? "" : "justify-center"}`}
        >
          <LogOut size={16} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
          <span className={`transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
            {t.admin.signOut}
          </span>
        </button>
      </div>

      {checkoutScanning && (
        <QrScannerModal
          title="Завершение работы"
          hint="Отсканируйте QR-код у выхода для фиксации ухода"
          onScan={handleCheckoutScan}
          onClose={() => setCheckoutScanning(false)}
        />
      )}
    </aside>

    {/* Blocked shift-close modal */}
    {blockedTables !== null && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-3">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Невозможно закрыть смену!
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
              В плане зала обнаружены незакрытые столы ({blockedTables.length}). Пожалуйста, рассчитайте всех гостей и закройте все активные чеки, чтобы сформировать окончательный отчёт.
            </p>
          </div>
          {blockedTables.length > 0 && (
            <div className="px-5 py-3 bg-red-50 dark:bg-red-500/10 border-t border-red-100 dark:border-red-500/20">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Остались открытыми столы:</p>
              <div className="flex flex-wrap gap-1.5">
                {blockedTables.map((t) => (
                  <span key={t} className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => { setBlockedTables(null); setConfirmClose(false); }}
              className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-xl transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
            >
              Понятно, закрою столы
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
