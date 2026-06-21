"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutGrid, ShoppingBag, FileText, AlignJustify, X,
  BarChart2, TrendingUp, Package, Monitor, Star, Tag,
  QrCode, BookOpen, Settings, Users, CreditCard, FilePen,
  Boxes, MessageSquare, PrinterIcon, LogOut, Sun, Moon,
  Clock, LogIn, AlertTriangle, CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations, type Dict } from "@/lib/i18n";
import { useIsOwner, useIsStrictOwner, useRole } from "@/lib/role-context";
import { useShift } from "@/lib/shift-context";
import { useCheckin } from "@/lib/checkin-context";
import { WaiterCallBell } from "./WaiterCallBell";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const QrScannerModal = dynamic(() => import("./QrScannerModal"), { ssr: false });

type AdminKey = keyof Dict["admin"];
type TabItem = {
  labelKey: AdminKey;
  icon: LucideIcon;
  href: string;
  ownerOnly?: boolean;
  strictOwner?: boolean;
  noWaiter?: boolean;
  staffOnly?: boolean;
};
type DrawerSection = {
  titleKey: AdminKey;
  ownerOnly?: boolean;
  strictOwner?: boolean;
  items: {
    labelKey: AdminKey;
    icon: LucideIcon;
    href: string;
    ownerOnly?: boolean;
    strictOwner?: boolean;
    noWaiter?: boolean;
  }[];
};

const BOTTOM_TABS: TabItem[] = [
  { labelKey: "navHall",         icon: LayoutGrid,  href: "/admin/hall" },
  { labelKey: "navOrders",       icon: ShoppingBag, href: "/admin/orders",         ownerOnly: true },
  { labelKey: "navCatalog",      icon: Package,     href: "/admin/dashboard",      ownerOnly: true },
  { labelKey: "navMyAttendance", icon: Clock,       href: "/admin/my-attendance",  staffOnly: true },
];

const DRAWER_NAV: DrawerSection[] = [
  {
    titleKey: "sectionOwner",
    strictOwner: true,
    items: [
      { labelKey: "navOwnerOverview", icon: TrendingUp, href: "/admin/owner-overview", strictOwner: true },
    ],
  },
  {
    titleKey: "sectionCRM",
    ownerOnly: true,
    items: [
      { labelKey: "navCRM", icon: MessageSquare, href: "/admin/crm", ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionAnalytics",
    ownerOnly: true,
    items: [
      { labelKey: "navOverview",   icon: BarChart2,   href: "/admin/analytics",  ownerOnly: true },
      { labelKey: "navReviews",    icon: Star,        href: "/admin/reviews",    ownerOnly: true },
      { labelKey: "navPromotions", icon: Tag,         href: "/admin/promotions", ownerOnly: true },
    ],
  },
  {
    titleKey: "sectionManagement",
    ownerOnly: true,
    items: [
      { labelKey: "navModifiers",  icon: Settings,     href: "/admin/modifiers",  ownerOnly: true },
      { labelKey: "navWarehouse",  icon: Boxes,        href: "/admin/warehouse",  ownerOnly: true },
      { labelKey: "navInvoices",   icon: FileText,     href: "/admin/invoices",   ownerOnly: true },
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
      { labelKey: "navStaff",        icon: Users,       href: "/admin/settings/staff",    ownerOnly: true },
      { labelKey: "navDocuments",    icon: FilePen,     href: "/admin/documents",         ownerOnly: true },
      { labelKey: "navPaymentBanks", icon: CreditCard,  href: "/admin/payment-banks",     strictOwner: true },
      { labelKey: "navPrinters",     icon: PrinterIcon, href: "/admin/settings/printers", ownerOnly: true },
      { labelKey: "navProfile",      icon: Settings,    href: "/admin/settings",          ownerOnly: true },
    ],
  },
];

export default function MobileBottomNav() {
  const pathname          = usePathname();
  const router            = useRouter();
  const { t, lang, setLang } = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted]           = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [blockedTables, setBlockedTables] = useState<string[] | null>(null);
  const [checkoutScanning, setCheckoutScanning] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const role         = useRole();
  const isOwner      = useIsOwner();
  const isStrictOwner = useIsStrictOwner();
  const { shift, closeShift } = useShift();
  const { isCheckedIn, checkout } = useCheckin();

  const STAFF_ROLES = new Set(["waiter","chef","bartender","hostess","courier","cleaner","doorman","sommelier","senior_waiter","runner","storekeeper","accountant"]);
  const isStaff = role !== null && STAFF_ROLES.has(role);

  useEffect(() => setMounted(true), []);

  // Animate drawer open/close
  useEffect(() => {
    if (drawerOpen) {
      requestAnimationFrame(() => setDrawerVisible(true));
    } else {
      setDrawerVisible(false);
    }
  }, [drawerOpen]);

  // Close drawer when navigating
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const isDark = !mounted || theme === "dark";

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
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
      router.replace("/admin/login");
    } else {
      toast.error(result.error ?? "Неверный QR-код");
    }
  }

  const visibleTabs = BOTTOM_TABS.filter((tab) => {
    if (tab.strictOwner && !isStrictOwner) return false;
    if (tab.ownerOnly  && !isOwner)        return false;
    if (tab.noWaiter   && role === "waiter") return false;
    if (tab.staffOnly  && isOwner)         return false;
    return true;
  });

  return (
    <>
      {/* ── Bottom tab bar ────────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800/60 flex items-stretch h-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {visibleTabs.slice(0, 3).map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                isActive
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold leading-none">{t.admin[tab.labelKey]}</span>
            </Link>
          );
        })}

        {/* More / hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <AlignJustify size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold leading-none">Ещё</span>
        </button>
      </nav>

      {/* ── Drawer backdrop ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
          style={{ opacity: drawerVisible ? 1 : 0 }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer panel ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 rounded-t-2xl max-h-[82dvh] flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: drawerVisible ? "translateY(0)" : "translateY(100%)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white text-xs font-bold select-none">А</div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Навигация</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!isOwner && <WaiterCallBell />}
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-4 space-y-4">
            {DRAWER_NAV.map((section) => {
              if (section.strictOwner && !isStrictOwner) return null;
              if (section.ownerOnly && !isOwner) return null;

              const visibleItems = section.items.filter((item) => {
                if (item.strictOwner && !isStrictOwner) return false;
                if (item.ownerOnly  && !isOwner)        return false;
                if (item.noWaiter   && role === "waiter") return false;
                return true;
              });
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.titleKey}>
                  <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
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
                          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors ${
                            isActive
                              ? "bg-violet-50 dark:bg-violet-600/15 text-violet-700 dark:text-violet-300"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          <Icon size={16} className={isActive ? "text-violet-600 dark:text-violet-400" : "text-zinc-400 dark:text-zinc-500"} />
                          {t.admin[item.labelKey]}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Drawer footer */}
          <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-3 space-y-1">
            {/* Shift status */}
            {shift && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 mb-1">
                <Clock size={14} className="text-emerald-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-emerald-700 dark:text-emerald-400 truncate">
                  Смена с {fmtTime(shift.opened_at)}
                </span>
                {isOwner && !confirmClose && (
                  <button onClick={() => setConfirmClose(true)} className="text-xs text-red-400 hover:text-red-500 font-medium transition-colors">
                    Закрыть
                  </button>
                )}
                {isOwner && confirmClose && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={handleCloseShift} className="text-xs font-semibold text-red-500">Да</button>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <button onClick={() => setConfirmClose(false)} className="text-xs text-zinc-400">Нет</button>
                  </div>
                )}
              </div>
            )}

            {/* Row: theme + language + checkout + signout */}
            <div className="flex items-center gap-2">
              {/* Theme */}
              <button
                onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[48px]"
              >
                {isDark ? <Moon size={16} /> : <Sun size={16} className="text-amber-500" />}
                <span>{isDark ? "Тёмная" : "Светлая"}</span>
              </button>

              {/* Language */}
              <div className="flex items-center gap-1 px-2 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/50">
                {(["ru", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      lang === l ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Checkout (staff only) */}
              {isStaff && isCheckedIn && (
                <button
                  onClick={() => setCheckoutScanning(true)}
                  disabled={checkoutBusy}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors min-h-[48px] disabled:opacity-60"
                >
                  <LogIn size={16} className="rotate-180 shrink-0" />
                </button>
              )}

              {/* Sign out */}
              <button
                onClick={signOut}
                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors min-h-[48px]"
              >
                <LogOut size={16} className="shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutScanning && (
        <QrScannerModal
          title="Завершение работы"
          hint="Отсканируйте QR-код у выхода для фиксации ухода"
          onScan={handleCheckoutScan}
          onClose={() => setCheckoutScanning(false)}
        />
      )}

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
