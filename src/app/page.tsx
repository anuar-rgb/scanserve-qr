"use client";

import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, BarChart3, Banknote, Bike, Check,
  Calculator as CalcIcon, Clock, CreditCard, FileCheck2, FileWarning, Gift, GraduationCap,
  Info, Loader2, Mail, MapPin, MessageSquareWarning, Monitor, Moon,
  Package, PhoneCall, PieChart, PlayCircle, Plug, Plus,
  Printer, QrCode, ReceiptText, Rocket, Send, ShieldCheck,
  Sparkles, Sun, Table2, Timer, TrendingUp, UserPlus, Users, UsersRound,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ─── Design tokens ────────────────────────────────────────────────────────────

const BRAND    = "#7c3aed";
const BRAND_2  = "#a855f7";
const BG_DARK  = "#050409";
const CARD_DARK  = "#0b0913";
const CARD_DARK2 = "#100c1d";
const BORDER_DARK  = "rgba(255,255,255,0.07)";
const FG_DARK      = "#eae7f6";
const FG_DARK_MUTED  = "#928aa8";
const BG_LIGHT     = "#ffffff";
const BORDER_LIGHT  = "rgba(18,16,26,0.09)";
const FG_LIGHT      = "#12101a";
const FG_LIGHT_MUTED = "#5c5570";
const SUCCESS = "#16a34a";
const DANGER  = "#dc2626";
const WHITE   = "#ffffff";
const G = "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(isDark: boolean): React.CSSProperties {
  return {
    background: isDark ? CARD_DARK : BG_LIGHT,
    border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
    borderRadius: 24,
  };
}

function muted(isDark: boolean): string {
  return isDark ? FG_DARK_MUTED : FG_LIGHT_MUTED;
}

function fg(isDark: boolean): string {
  return isDark ? FG_DARK : FG_LIGHT;
}

// ─── Dark mode context ────────────────────────────────────────────────────────

const DarkCtx = createContext({ isDark: false, toggle: () => {} });
function useDark() { return useContext(DarkCtx); }

// ─── Section analytics ────────────────────────────────────────────────────────

function useTrackSections() {
  const tracked = useRef(new Set<string>());
  const sessionId = useRef("");

  useEffect(() => {
    sessionId.current =
      sessionStorage.getItem("landing_sid") ?? crypto.randomUUID();
    sessionStorage.setItem("landing_sid", sessionId.current);
    const device = window.innerWidth < 768 ? "mobile" : "desktop";
    const referrer = document.referrer || "direct";

    fetch("/api/analytics/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, section: "page_view", device, referrer }),
    }).catch(() => {});

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !tracked.current.has(entry.target.id)) {
            tracked.current.add(entry.target.id);
            fetch("/api/analytics/landing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: sessionId.current, section: entry.target.id, device, referrer }),
            }).catch(() => {});
          }
        }
      },
      { threshold: 0.3 }
    );
    document.querySelectorAll("[data-track]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Reveal animation ─────────────────────────────────────────────────────────

function Reveal({
  children, delay = 0, className, style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.52, delay: delay / 1000, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Pill badge ───────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      borderRadius: 999,
      border: "1px solid rgba(124,58,237,0.28)",
      background: "rgba(124,58,237,0.12)",
      color: BRAND,
      padding: "5px 13px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {children}
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "#features",     label: "Возможности" },
  { href: "#how",          label: "Как работает" },
  { href: "#calculator",   label: "Калькулятор" },
  { href: "#integrations", label: "Интеграции" },
  { href: "#pricing",      label: "Тарифы" },
  { href: "#faq",          label: "FAQ" },
];

function Navbar() {
  const { isDark, toggle } = useDark();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerBg = scrolled
    ? isDark ? "rgba(5,4,9,0.90)" : "rgba(255,255,255,0.90)"
    : "transparent";

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: headerBg,
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled
          ? `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`
          : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 20px",
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        {/* Logo */}
        <a href="#hero" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <QrCode size={16} color={WHITE} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: fg(isDark), letterSpacing: "-0.025em" }}>
            ScanServe<span style={{ color: BRAND }}>.qr</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} style={{
              color: isDark ? "rgba(234,231,246,0.55)" : "rgba(18,16,26,0.55)",
              fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 8,
              textDecoration: "none", transition: "color 0.2s",
            }}>
              {label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={toggle}
            aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(18,16,26,0.07)",
              color: fg(isDark),
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <a
            href="#trial"
            className="hidden sm:inline-flex items-center gap-1.5"
            style={{
              background: G, color: WHITE, borderRadius: 999,
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              textDecoration: "none", border: "none",
            }}
          >
            Попробовать <ArrowRight size={13} />
          </a>
          {/* Burger */}
          <button
            className="lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Меню"
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(18,16,26,0.07)",
              color: fg(isDark),
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  width: 18, height: 2, borderRadius: 1,
                  background: fg(isDark), display: "block",
                  transform: menuOpen
                    ? i === 1 ? "scaleX(0)" : i === 0 ? "translateY(6px) rotate(45deg)" : "translateY(-6px) rotate(-45deg)"
                    : "none",
                  transition: "transform 0.25s",
                }} />
              ))}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: isDark ? "rgba(5,4,9,0.97)" : "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          borderTop: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
          padding: "12px 20px 20px",
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block", padding: "12px 0",
                borderBottom: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                color: isDark ? "rgba(234,231,246,0.7)" : "rgba(18,16,26,0.7)",
                fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}
            >
              {label}
            </a>
          ))}
          <a href="#trial" onClick={() => setMenuOpen(false)}
            style={{
              display: "block", textAlign: "center",
              background: G, color: WHITE, borderRadius: 999,
              padding: "12px 24px", marginTop: 16,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            Попробовать бесплатно
          </a>
        </div>
      )}
    </header>
  );
}

// ─── Hero phone mockup ────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div style={{
      borderRadius: 44, padding: 10,
      background: "linear-gradient(160deg, #4a3d69 0%, #17122a 45%, #2a2145 100%)",
      boxShadow: "0 40px 80px -30px rgba(76,29,149,0.75), 0 0 0 1px rgba(255,255,255,0.08)",
    }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 34, background: "#0b0817", color: WHITE }}>
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          height: 6, width: 64, borderRadius: 999, background: "rgba(255,255,255,0.22)", zIndex: 10,
        }} />
        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px 6px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
          <span>9:41</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={10} />
            <span>••••</span>
          </div>
        </div>
        {/* Content */}
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 2 }}>Стол 7 · Зал</p>
              <p style={{ fontSize: 14, fontWeight: 700 }}>АС ТӨРІ</p>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 999, background: BRAND,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <QrCode size={14} />
            </div>
          </div>
          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "8px 12px",
            fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 12,
          }}>
            🔍 Поиск по меню
          </div>
          {/* Cats */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {["Все", "Горячее", "Напитки"].map((c, i) => (
              <span key={c} style={{
                borderRadius: 999, padding: "4px 10px", fontSize: 9, fontWeight: 600,
                background: i === 0 ? BRAND : "rgba(255,255,255,0.07)",
                color: i === 0 ? WHITE : "rgba(255,255,255,0.5)",
              }}>{c}</span>
            ))}
          </div>
          {/* Dishes */}
          {[
            { name: "Плов по-казахски", price: "3 200 ₸" },
            { name: "Бургер с говядиной", price: "4 500 ₸" },
            { name: "Латте 300 мл",       price: "1 690 ₸" },
          ].map((d) => (
            <div key={d.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "8px", marginBottom: 6,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(124,58,237,0.3)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#c4b5fd" }}>{d.price}</p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 8px",
                fontSize: 10, fontWeight: 700,
              }}>+</div>
            </div>
          ))}
        </div>
        {/* Bottom CTA */}
        <div style={{
          marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#0f0b1e", padding: "12px 20px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: G, borderRadius: 999, padding: "10px 16px",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>Оформить заказ</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>9 390 ₸</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero POS mockup ──────────────────────────────────────────────────────────

function PosMockup() {
  const tables = [
    { name: "Стол 1", status: "free",     amount: null,       selected: false },
    { name: "Стол 2", status: "occupied", amount: "12 400 ₸", selected: false },
    { name: "Стол 3", status: "payment",  amount: null,       selected: false },
    { name: "Стол 4", status: "free",     amount: null,       selected: false },
    { name: "Стол 5", status: "occupied", amount: "6 900 ₸",  selected: false },
    { name: "Стол 6", status: "free",     amount: null,       selected: false },
    { name: "Стол 7", status: "occupied", amount: "24 150 ₸", selected: true  },
    { name: "Стол 8", status: "free",     amount: null,       selected: false },
    { name: "Стол 9", status: "payment",  amount: null,       selected: false },
  ];
  const orderItems = [
    { name: "Плов по-казахски ×2", price: "6 400 ₸" },
    { name: "Бургер ×1",           price: "4 500 ₸" },
    { name: "Латте ×3",            price: "5 070 ₸" },
    { name: "Салат Шопский",       price: "2 980 ₸" },
  ];

  function tableStyle(status: string, sel: boolean): React.CSSProperties {
    const base: React.CSSProperties = { borderRadius: 14, padding: "10px 12px", border: "1px solid" };
    if (sel)              return { ...base, background: "rgba(124,58,237,0.28)", borderColor: "rgba(124,58,237,0.55)" };
    if (status === "payment")  return { ...base, background: "rgba(22,163,74,0.14)",  borderColor: "rgba(22,163,74,0.32)" };
    if (status === "occupied") return { ...base, background: "rgba(124,58,237,0.10)", borderColor: "rgba(255,255,255,0.07)" };
    return { ...base, background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" };
  }

  return (
    <div style={{
      borderRadius: 20, padding: 6,
      background: "linear-gradient(160deg, #4a3d69 0%, #17122a 45%, #2a2145 100%)",
      boxShadow: "0 48px 90px -28px rgba(76,29,149,0.65), 0 0 0 1px rgba(255,255,255,0.07)",
    }}>
      <div style={{ borderRadius: 16, overflow: "hidden", background: "#0f0d1c", color: WHITE }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#13102a",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(124,58,237,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Monitor size={13} color={BRAND} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700 }}>POS</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>· Смена №128</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
            <UsersRound size={11} /> Айгуль · Официант
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex" }}>
          {/* Table grid */}
          <div style={{ flex: 1, padding: 12, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Основной зал</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
              {tables.map((t) => (
                <div key={t.name} style={tableStyle(t.status, t.selected)}>
                  <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 1, color: t.status === "payment" ? "#4ade80" : WHITE }}>{t.name}</p>
                  <p style={{ fontSize: 8, color: t.status === "free" ? "rgba(255,255,255,0.32)" : t.status === "payment" ? "#4ade80" : "rgba(255,255,255,0.48)" }}>
                    {t.status === "free" ? "Свободен" : t.status === "payment" ? "Оплата" : "Занят"}
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 700, marginTop: 3, color: t.selected ? "#c4b5fd" : "rgba(255,255,255,0.55)" }}>
                    {t.amount ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: 195, borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "12px 13px", display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 8 }}>Счёт · Стол 7</p>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              {orderItems.map((item) => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, flexShrink: 0 }}>{item.price}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.38)" }}>Чаевые 10%</span>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.38)" }}>1 895 ₸</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>Итого</span>
                <span style={{ fontSize: 10, fontWeight: 700 }}>20 845 ₸</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
              <div style={{ flex: 1, padding: "6px 4px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.65)", fontSize: 8, fontWeight: 600, textAlign: "center" }}>Разделить</div>
              <div style={{ flex: 1, padding: "6px 4px", borderRadius: 8, background: BRAND, color: WHITE, fontSize: 8, fontWeight: 600, textAlign: "center" }}>Оплатить</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { isDark } = useDark();

  return (
    <section style={{
      position: "relative", overflow: "hidden",
      paddingTop: 120, paddingBottom: 80,
      background: isDark ? BG_DARK : BG_LIGHT,
    }}>
      {/* Grid bg */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(to right, ${isDark ? "rgba(255,255,255,0.028)" : "rgba(18,16,26,0.05)"} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? "rgba(255,255,255,0.028)" : "rgba(18,16,26,0.05)"} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(115% 90% at 50% 20%, #000 30%, transparent 80%)",
      }} />
      {/* Glow */}
      <div style={{
        position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
        width: "70%", height: 500,
        background: "radial-gradient(60% 100% at 50% 0%, rgba(124,58,237,0.18), transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{ position: "absolute", top: -80, left: -100, width: 420, height: 420, borderRadius: 999, filter: "blur(70px)", background: "rgba(124,58,237,0.24)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", top: 120, right: -140, width: 460, height: 460, borderRadius: 999, filter: "blur(70px)", background: "rgba(124,58,237,0.18)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", position: "relative", zIndex: 1 }}>
        {/* Text center */}
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <Reveal>
            <Pill>Платформа для ресторанов Казахстана</Pill>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              marginTop: 24, fontSize: "clamp(2.2rem,6vw,4rem)", fontWeight: 800,
              lineHeight: 1.05, letterSpacing: "-0.03em", color: fg(isDark),
            }}>
              Ресторан под контролем.{" "}
              <span style={{
                background: "linear-gradient(100deg, #12101a 10%, #a855f7 55%, #7c3aed 90%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              }}>
                Один QR — вместо хаоса
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p style={{
              marginTop: 20, fontSize: 17, lineHeight: 1.65,
              color: muted(isDark), maxWidth: 620, margin: "20px auto 0",
            }}>
              Облачная платформа «всё в одном»: QR-меню без приложения, POS-терминал,
              аналитика, CRM, персонал и склад. Гость сканирует код и заказывает сам — без ошибок.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3" style={{ marginTop: 32 }}>
              <a href="#trial" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: G, color: WHITE, borderRadius: 999,
                padding: "14px 28px", fontSize: 15, fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 10px 30px -10px rgba(124,58,237,0.7)",
              }}>
                Попробовать бесплатно <ArrowRight size={15} />
              </a>
              <a href="#how" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                color: fg(isDark), border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                borderRadius: 999, padding: "14px 28px", fontSize: 15, fontWeight: 600,
                textDecoration: "none",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(18,16,26,0.03)",
              }}>
                Как это работает
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="flex flex-wrap items-center justify-center gap-6" style={{ marginTop: 28 }}>
              {[
                { icon: <Rocket size={14} />, text: "Запуск за 1 день" },
                { icon: <Timer size={14} />, text: "Обучение — 15 минут" },
                { icon: <CreditCard size={14} />, text: "Без привязки карты" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, color: muted(isDark), fontSize: 13 }}>
                  <span style={{ color: BRAND }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Mockup — POS tablet + phone */}
        <Reveal delay={200} style={{ marginTop: 56 }}>
          <div style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}>
            {/* POS tablet mockup */}
            <PosMockup />
            {/* Phone mockup overlapping bottom-right */}
            <div className="hidden md:block" style={{
              position: "absolute", bottom: -36, right: -36,
              width: 260, zIndex: 2,
              filter: "drop-shadow(0 24px 40px rgba(76,29,149,0.55))",
            }}>
              <PhoneMockup />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Problems ─────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    Icon: FileWarning,
    title: "Бумажное меню живёт своей жизнью",
    text: "Позиция закончилась или изменилась цена — вы снова платите за перепечатку. Гость выбирает то, чего нет на кухне.",
  },
  {
    Icon: MessageSquareWarning,
    title: "Официанты ошибаются в заказах",
    text: "Переспрашивают по три раза, путают модификаторы и столы. Итог — переделки, списания и недовольные гости.",
  },
  {
    Icon: PieChart,
    title: "Нет цифр и понимания гостей",
    text: "Вы не знаете реальный средний чек, какие блюда тянут выручку и кто ваши постоянные гости. Решения принимаются на ощупь.",
  },
];

function Problems() {
  const { isDark } = useDark();
  return (
    <section id="problems" style={{ padding: "96px 20px", background: isDark ? BG_DARK : BG_LIGHT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <Pill>Знакомо?</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Три вещи, которые каждый день съедают прибыль
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 90}>
              <div style={{ ...card(isDark), padding: 28, height: "100%" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: "rgba(124,58,237,0.14)", color: BRAND,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ marginTop: 20, fontSize: 16, fontWeight: 600, color: fg(isDark) }}>{title}</h3>
                <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: muted(isDark) }}>{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: QrCode,      title: "QR-меню без приложения",   text: "Гость сканирует код на столе и сразу заказывает в браузере. Ничего скачивать не нужно." },
  { Icon: Monitor,     title: "POS-терминал",              text: "Схема столов, перенос заказов, разделение счёта и чаевые — всё в одном экране." },
  { Icon: Gift,        title: "Программа лояльности",      text: "Бонусы, промокоды и push-уведомления гостям — возвращают без затрат на рекламу." },
  { Icon: BarChart3,   title: "Аналитика и Z-отчёты",     text: "Выручка, средний чек, популярные блюда и закрытие смены — в реальном времени." },
  { Icon: Users,       title: "База гостей (CRM)",         text: "История заказов, предпочтения и сегментация — вы наконец знаете своих гостей." },
  { Icon: UsersRound,  title: "6 ролей персонала",        text: "Официант, кассир, повар, курьер, управляющий и другие — у каждого свой доступ." },
  { Icon: Package,     title: "Склад и каталог меню",     text: "Остатки, списания и себестоимость. Блюда с фото, модификаторами и стоп-листом." },
];

function Features() {
  const { isDark } = useDark();
  return (
    <section id="features" style={{ padding: "96px 20px", background: isDark ? CARD_DARK2 : "#f8f6ff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <Pill>Возможности</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Всё, что нужно ресторану — в одной платформе
          </h2>
          <p style={{ marginTop: 12, fontSize: 16, color: muted(isDark), maxWidth: 560, margin: "12px auto 0" }}>
            Без зоопарка сервисов: меню, касса, гости, персонал и склад работают в одном аккаунте.
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 70}>
              <div style={{ ...card(isDark), padding: 24, height: "100%" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: "rgba(124,58,237,0.14)", color: BRAND,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} />
                </div>
                <h3 style={{ marginTop: 16, fontWeight: 600, fontSize: 15, color: fg(isDark) }}>{title}</h3>
                <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: muted(isDark) }}>{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    Icon: UserPlus, num: "01", time: "10 минут", title: "Регистрация",
    text: "Создаёте аккаунт, добавляете заведение и загружаете меню с фото. QR-коды для столов генерируются автоматически — остаётся распечатать.",
  },
  {
    Icon: GraduationCap, num: "02", time: "15 минут", title: "Обучение команды",
    text: "Интерфейс на русском и понятен с первого раза. Показываете официантам и кассиру — дальше они работают сами.",
  },
  {
    Icon: PlayCircle, num: "03", time: "с 1-го дня", title: "Работа и рост",
    text: "Гости заказывают через QR, касса принимает оплату, а вы смотрите аналитику и базу гостей в реальном времени с телефона.",
  },
];

function HowItWorks() {
  const { isDark } = useDark();
  return (
    <section id="how" style={{ padding: "96px 20px", background: isDark ? BG_DARK : BG_LIGHT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <Pill>Как это работает</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Полный запуск — за один день
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {HOW_STEPS.map(({ Icon, num, time, title, text }, i) => (
            <Reveal key={num} delay={i * 100}>
              <div style={{ ...card(isDark), padding: 28, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 16, background: G, color: WHITE,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={22} />
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "rgba(124,58,237,0.22)", letterSpacing: "-0.05em" }}>
                    {num}
                  </span>
                </div>
                <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: fg(isDark) }}>{title}</h3>
                  <span style={{
                    borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                    background: "rgba(124,58,237,0.14)", color: BRAND,
                  }}>{time}</span>
                </div>
                <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: muted(isDark) }}>{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Calculator ───────────────────────────────────────────────────────────────

const PLAN_COST = 30780;
const ERROR_RATE = 0.04;
const ERROR_FIX  = 0.8;
const FOOD_COST  = 0.35;
const TURN_GAIN  = 0.05;
const MENU_PRINT = 2 * 2 * 1200;

function fmtT(v: number) {
  return Math.round(v).toLocaleString("ru-RU");
}

function RangeSlider({
  label, value, min, max, step, suffix, onChange, isDark,
}: {
  label: string; value: number; min: number; max: number; step: number;
  suffix: string; onChange: (v: number) => void; isDark: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: muted(isDark) }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: BRAND }}>{fmtT(value)} {suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: BRAND }}
      />
    </label>
  );
}

function Calculator() {
  const { isDark } = useDark();
  const [tables,   setTables]   = useState(24);
  const [avgCheck, setAvgCheck] = useState(6500);
  const [turns,    setTurns]    = useState(3);

  const r = useMemo(() => {
    const revenue     = tables * turns * 30 * avgCheck;
    const errorSaving = revenue * ERROR_RATE * FOOD_COST * ERROR_FIX;
    const extraProfit = revenue * TURN_GAIN * (1 - FOOD_COST);
    const printSaving = (tables * MENU_PRINT) / 12;
    const total = errorSaving + extraProfit + printSaving;
    return { revenue, errorSaving, extraProfit, printSaving, total, net: total - PLAN_COST, share: (PLAN_COST / revenue) * 100 };
  }, [tables, avgCheck, turns]);

  return (
    <section id="calculator" style={{ padding: "96px 20px", background: isDark ? CARD_DARK2 : "#f8f6ff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <Pill><CalcIcon size={12} /> Калькулятор</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Сколько ваше заведение теряет каждый месяц
          </h2>
          <p style={{ marginTop: 12, fontSize: 16, color: muted(isDark), maxWidth: 520, margin: "12px auto 0" }}>
            Подвиньте три ползунка — покажем консервативную оценку выгоды от перехода на ScanServe QR.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-5">
          <Reveal>
            <div style={{ ...card(isDark), padding: 32, display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
              <RangeSlider label="Столов в зале" value={tables} min={4} max={80} step={1} suffix="шт" onChange={setTables} isDark={isDark} />
              <RangeSlider label="Средний чек" value={avgCheck} min={1500} max={30000} step={500} suffix="₸" onChange={setAvgCheck} isDark={isDark} />
              <RangeSlider label="Посадок на стол в день" value={turns} min={1} max={8} step={1} suffix="раз" onChange={setTurns} isDark={isDark} />
              <div style={{
                marginTop: "auto", borderRadius: 16, padding: 16,
                background: isDark ? CARD_DARK2 : "#f8f6ff",
                border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
              }}>
                <p style={{ fontSize: 12, color: muted(isDark) }}>Выручка при таких параметрах</p>
                <p style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: fg(isDark) }}>{fmtT(r.revenue)} ₸/мес</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div style={{
              ...card(isDark),
              padding: 32, height: "100%", display: "flex", flexDirection: "column",
              background: isDark
                ? `radial-gradient(80% 120% at 50% 0%, rgba(124,58,237,0.22), transparent 70%), ${CARD_DARK}`
                : `radial-gradient(80% 120% at 50% 0%, rgba(124,58,237,0.1), transparent 70%), ${BG_LIGHT}`,
              borderColor: "rgba(124,58,237,0.32)",
              boxShadow: "0 34px 80px -40px rgba(124,58,237,0.45)",
            }}>
              <p style={{ fontSize: 12, color: muted(isDark) }}>Потенциальная выгода</p>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, letterSpacing: "-0.04em", color: fg(isDark) }}>
                  {fmtT(r.total)}
                </span>
                <span style={{ fontSize: 22, fontWeight: 600, color: muted(isDark) }}>₸/мес</span>
              </div>

              <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
                {[
                  { label: "Меньше списаний из-за ошибок в заказах", value: r.errorSaving },
                  { label: "Прибыль с допродаж и ускорения оборота",  value: r.extraProfit },
                  { label: "Экономия на печати бумажного меню",       value: r.printSaving },
                ].map(({ label, value }) => (
                  <li key={label} style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                    borderBottom: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                    padding: "12px 0", fontSize: 13,
                  }}>
                    <span style={{ color: muted(isDark) }}>{label}</span>
                    <span style={{ flexShrink: 0, fontWeight: 600, color: fg(isDark) }}>+{fmtT(value)} ₸</span>
                  </li>
                ))}
                <li style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", fontSize: 13 }}>
                  <span style={{ color: muted(isDark) }}>Тариф «Стандарт»</span>
                  <span style={{ flexShrink: 0, fontWeight: 600, color: fg(isDark) }}>−{fmtT(PLAN_COST)} ₸</span>
                </li>
              </ul>

              <div style={{
                marginTop: 16, borderRadius: 16, padding: 16,
                background: isDark ? CARD_DARK2 : "#f8f6ff",
                border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
              }}>
                <div>
                  <p style={{ fontSize: 11, color: muted(isDark) }}>Чистая выгода</p>
                  <p style={{ marginTop: 2, fontSize: 16, fontWeight: 700, color: SUCCESS }}>
                    +{fmtT(r.net)} ₸/мес
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: muted(isDark) }}>Подписка от выручки</p>
                  <p style={{ marginTop: 2, fontSize: 16, fontWeight: 700, color: fg(isDark) }}>
                    {r.share.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} %
                  </p>
                </div>
              </div>

              <a href="#trial" style={{
                marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: G, color: WHITE, borderRadius: 999, padding: "14px 24px",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}>
                Проверить на своём заведении <ArrowRight size={15} />
              </a>

              <p style={{ marginTop: 12, fontSize: 11, color: muted(isDark), display: "flex", gap: 6, lineHeight: 1.5 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                Оценочный расчёт. Не гарантия результата.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Integrations ─────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    Icon: QrCode, title: "Kaspi QR и Kaspi Pay", featured: true,
    text: "Гость сканирует QR на столе, открывает меню, собирает заказ и оплачивает через Kaspi — вместе с чаевыми и отзывом. Оплата сразу привязывается к счёту стола в POS.",
    tags: ["Kaspi QR", "Kaspi Рестораны", "Чаевые", "Отзывы"],
  },
  {
    Icon: ReceiptText, title: "Фискализация и ОФД", featured: false,
    text: "Чек уходит в ОФД по требованиям РК: онлайн-ККМ, признаки товара из Национального каталога. Z-отчёт формируется автоматически в конце смены.",
    tags: ["Онлайн-ККМ", "ОФД", "Нац. каталог", "Z-отчёт"],
  },
  {
    Icon: Banknote, title: "Эквайринг и терминалы", featured: false,
    text: "Работаем с картами и терминалами казахстанских банков. Наличные, карта, Kaspi и смешанная оплата — в одном счёте.",
    tags: ["Halyk", "Kaspi", "Freedom", "Смешанная оплата"],
  },
  {
    Icon: Bike, title: "Доставка и самовывоз", featured: false,
    text: "Заказы из Wolt, Glovo, Yandex Eats и с вашего QR-сайта падают в одну очередь на кухню — без второго планшета.",
    tags: ["Wolt", "Glovo", "Yandex Eats", "Свой сайт"],
  },
  {
    Icon: Printer, title: "Кухня и оборудование", featured: false,
    text: "Печать на кухню и бар, экран повара (KDS), фискальный принтер, сканер штрихкодов на складе, весы для фасовки.",
    tags: ["KDS", "Принтеры", "Сканер", "Весы"],
  },
  {
    Icon: Table2, title: "Учёт и выгрузки", featured: false,
    text: "Выгрузка продаж, себестоимости и списаний в 1С и Excel. Открытое API и вебхуки — если нужна своя интеграция.",
    tags: ["1С", "Excel", "API", "Вебхуки"],
  },
];

function Integrations() {
  const { isDark } = useDark();
  return (
    <section id="integrations" style={{ padding: "96px 20px", background: isDark ? BG_DARK : BG_LIGHT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 48 }}>
          <Pill><Plug size={12} /> Интеграции</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Встраивается в то, чем вы уже пользуетесь
          </h2>
          <p style={{ marginTop: 12, fontSize: 16, color: muted(isDark), maxWidth: 540, margin: "12px auto 0" }}>
            Оплаты, фискализация и доставка — по правилам Казахстана. Ничего не нужно менять в кассе и бухгалтерии.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {INTEGRATIONS.map(({ Icon, title, featured, text, tags }, i) => (
            <Reveal key={title} delay={i * 70}>
              <div style={{
                ...card(isDark),
                padding: 24, height: "100%", display: "flex", flexDirection: "column",
                ...(featured ? {
                  background: isDark
                    ? `radial-gradient(90% 100% at 0% 0%, rgba(124,58,237,0.2), transparent 65%), ${CARD_DARK}`
                    : `radial-gradient(90% 100% at 0% 0%, rgba(124,58,237,0.1), transparent 65%), ${BG_LIGHT}`,
                  borderColor: "rgba(124,58,237,0.32)",
                } : {}),
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  border: `1px solid rgba(124,58,237,0.3)`,
                  background: featured ? G : "rgba(124,58,237,0.12)",
                  color: featured ? WHITE : BRAND,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} />
                </div>
                <h3 style={{ marginTop: 20, fontSize: 15, fontWeight: 600, color: fg(isDark) }}>{title}</h3>
                <p style={{ marginTop: 10, flex: 1, fontSize: 13, lineHeight: 1.65, color: muted(isDark) }}>{text}</p>
                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{
                      borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 500,
                      background: isDark ? CARD_DARK2 : "#f8f6ff",
                      border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                      color: muted(isDark),
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120} style={{ marginTop: 28, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: muted(isDark), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <FileCheck2 size={14} style={{ color: SUCCESS }} />
            Нужной интеграции нет в списке? Подключим за 3–5 рабочих дней — расскажите на созвоне.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results() {
  const { isDark } = useDark();
  return (
    <section id="results" style={{ padding: "96px 20px", background: isDark ? CARD_DARK2 : "#f8f6ff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <Reveal>
              <Pill>Результаты</Pill>
            </Reveal>
            <Reveal delay={80}>
              <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
                Ресторан в Алматы убрал ошибки официантов за неделю
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <div style={{
                ...card(isDark), position: "relative", marginTop: 28, padding: 28,
              }}>
                <div style={{
                  position: "absolute", top: -16, left: 28,
                  width: 36, height: 36, borderRadius: 8,
                  background: G, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 18, color: WHITE, fontWeight: 700 }}>"</span>
                </div>
                <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: fg(isDark) }}>
                  «Официанты переспрашивали заказ по 3 раза. Теперь гость всё указывает сам»
                </p>
                <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 999, background: G,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: WHITE,
                  }}>АЛ</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: fg(isDark) }}>Управляющий ресторана</p>
                    <p style={{ fontSize: 12, color: muted(isDark) }}>Алматы · 120 посадочных мест</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: metrics */}
          <div className="grid sm:grid-cols-3 lg:grid-cols-1 gap-5">
            {[
              { val: "80%",    label: "меньше ошибок в заказах" },
              { val: "×3",     label: "быстрее обслуживание гостей" },
              { val: "1 день", label: "на полный запуск заведения" },
            ].map(({ val, label }, i) => (
              <Reveal key={val} delay={i * 100}>
                <div style={{ ...card(isDark), padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
                  <p style={{
                    fontSize: "clamp(2.2rem,4vw,2.8rem)", fontWeight: 800,
                    background: G, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                    flexShrink: 0,
                  }}>{val}</p>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: muted(isDark) }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

type Billing = "monthly" | "yearly";

const PLANS = [
  {
    name: "Стартер", monthly: 15780, audience: "Малым кафе и кофейням", popular: false, custom: null,
    features: ["QR-меню без приложения", "Каталог меню с фото", "Базовый POS: столы и счёт", "Отчёт по выручке за день", "До 3 сотрудников"],
  },
  {
    name: "Стандарт", monthly: 30780, audience: "Полноценному ресторану", popular: true, custom: null,
    features: ["Всё из тарифа «Стартер»", "POS: разделение счёта, чаевые", "Программа лояльности и push", "Аналитика и Z-отчёты", "База гостей (CRM)", "6 ролей персонала", "Склад и себестоимость"],
  },
  {
    name: "Сеть", monthly: null, audience: "Сетям от 3 заведений", popular: false, custom: "по запросу",
    features: ["Все возможности «Стандарта»", "Единая панель по всем точкам", "Сводные отчёты и сравнение точек", "Общая база гостей и лояльность", "Персональный менеджер", "Помощь с переносом меню"],
  },
];

function Pricing() {
  const { isDark } = useDark();
  const [billing, setBilling] = useState<Billing>("monthly");
  const yearly = billing === "yearly";
  const saving = Math.round((PLANS[1].monthly! * 0.17) * 12);

  return (
    <section id="pricing" style={{ padding: "96px 20px", background: isDark ? BG_DARK : BG_LIGHT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 40 }}>
          <Pill>Тарифы</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Прозрачные цены в тенге
          </h2>
          <p style={{ marginTop: 12, fontSize: 16, color: muted(isDark) }}>
            7 дней бесплатно, без привязки карты. Меняйте или отменяйте тариф в любой момент.
          </p>

          {/* Billing toggle */}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", borderRadius: 999,
              border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
              background: isDark ? CARD_DARK2 : "#f8f6ff",
              padding: 4,
            }}>
              {(["monthly", "yearly"] as Billing[]).map((key) => (
                <button key={key} type="button" onClick={() => setBilling(key)}
                  style={{
                    borderRadius: 999, padding: "8px 20px", fontSize: 13, fontWeight: 600,
                    border: "none", cursor: "pointer", transition: "all 0.2s",
                    background: billing === key ? G : "transparent",
                    color: billing === key ? WHITE : muted(isDark),
                    boxShadow: billing === key ? "0 10px 28px -10px rgba(124,58,237,0.7)" : "none",
                  }}
                >
                  {key === "monthly" ? "Помесячно" : "За год −17%"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: SUCCESS, opacity: yearly ? 1 : 0, transition: "opacity 0.2s" }}>
              Экономия {fmtT(saving)} ₸ в год на тарифе «Стандарт»
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map(({ name, monthly, audience, popular, custom, features }, i) => {
            const price = monthly === null ? null : yearly ? Math.ceil(monthly * 0.83) : monthly;
            return (
              <Reveal key={name} delay={i * 90}>
                <div style={{
                  ...card(isDark),
                  padding: 28, position: "relative", display: "flex", flexDirection: "column",
                  ...(popular ? {
                    borderColor: "rgba(124,58,237,0.55)",
                    boxShadow: "0 30px 70px -30px rgba(124,58,237,0.65)",
                    marginTop: -16,
                  } : {}),
                }}>
                  {popular && (
                    <span style={{
                      position: "absolute", top: -12, left: 24,
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: G, color: WHITE, borderRadius: 999,
                      padding: "4px 12px", fontSize: 11, fontWeight: 700,
                    }}>
                      <Sparkles size={12} /> Популярный
                    </span>
                  )}

                  <h3 style={{ fontSize: 17, fontWeight: 600, color: fg(isDark) }}>{name}</h3>
                  <p style={{ marginTop: 4, fontSize: 13, color: muted(isDark) }}>{audience}</p>

                  <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 6 }}>
                    {price === null ? (
                      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: fg(isDark) }}>{custom}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: fg(isDark) }}>{fmtT(price)}</span>
                        <span style={{ fontSize: 22, fontWeight: 600, color: muted(isDark) }}>₸</span>
                      </>
                    )}
                  </div>
                  <p style={{ marginTop: 4, fontSize: 12, color: muted(isDark), minHeight: 36 }}>
                    {price === null ? "Считаем по числу точек и столов" : yearly ? "в месяц при оплате за год" : "в месяц"}
                    {price !== null && yearly && monthly && (
                      <span> · вместо <s>{fmtT(monthly)}</s> ₸</span>
                    )}
                  </p>

                  <ul style={{ marginTop: 24, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    {features.map((f) => (
                      <li key={f} style={{ display: "flex", gap: 10, fontSize: 13 }}>
                        <Check size={14} style={{ color: popular ? BRAND : SUCCESS, flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: muted(isDark) }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <a href="#trial" style={{
                    marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    borderRadius: 999, padding: "12px 20px", fontSize: 14, fontWeight: 600,
                    textDecoration: "none",
                    ...(popular
                      ? { background: G, color: WHITE, boxShadow: "0 10px 28px -10px rgba(124,58,237,0.7)" }
                      : { border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`, color: fg(isDark), background: "transparent" }),
                  }}>
                    {price === null ? "Обсудить сеть" : "Попробовать 7 дней"}
                  </a>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Нужно ли гостю скачивать приложение?",
    a: "Нет. Гость сканирует QR-код на столе камерой телефона и сразу открывает меню в браузере. Ничего устанавливать и регистрироваться не нужно.",
  },
  {
    q: "Сколько времени занимает запуск?",
    a: "Один день. Регистрация и загрузка меню — около 10 минут, QR-коды генерируются автоматически, обучение команды занимает 15 минут.",
  },
  {
    q: "Нужно ли покупать оборудование?",
    a: "Нет. POS работает в браузере на любом планшете, ноутбуке или телефоне. Если у вас уже есть касса и принтер — продолжаете работать на них.",
  },
  {
    q: "Что входит в бесплатный период?",
    a: "7 дней полного доступа к функциям тарифа «Стандарт» без привязки карты. Если не подойдёт — просто не продлеваете, никаких списаний.",
  },
  {
    q: "Мы работаем в нескольких заведениях — это поддерживается?",
    a: "Да. Вы управляете сетью из одного аккаунта: отдельное меню и персонал для каждого заведения, сводная аналитика по всем точкам.",
  },
];

function Faq() {
  const { isDark } = useDark();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ padding: "96px 20px", background: isDark ? CARD_DARK2 : "#f8f6ff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 40 }}>
          <Pill>FAQ</Pill>
          <h2 style={{ marginTop: 16, fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: fg(isDark), letterSpacing: "-0.02em" }}>
            Частые вопросы
          </h2>
        </Reveal>

        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <Reveal key={q} delay={i * 60}>
              <div style={{ ...card(isDark), overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 16, padding: "20px 24px", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", fontSize: 14, fontWeight: 600, color: fg(isDark),
                  }}
                >
                  {q}
                  <div style={{
                    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                    border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: BRAND,
                    transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.3s",
                  }}>
                    <Plus size={14} />
                  </div>
                </button>
                {open === i && (
                  <p style={{ padding: "0 24px 20px", fontSize: 13, lineHeight: 1.7, color: muted(isDark) }}>
                    {a}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Lead Form + CTA ──────────────────────────────────────────────────────────

const CITIES = ["Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Другой город"];
const TABLE_RANGES = ["до 10 столов", "10–25 столов", "25–50 столов", "более 50 столов"];

function LeadForm() {
  const { isDark } = useDark();
  const [form, setForm] = useState({ name: "", venue: "", phone: "+7 ", city: "", tables: "", comment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Укажите имя";
    if (!form.venue.trim()) e.venue = "Укажите заведение";
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) e.phone = "Формат: +7 700 000 00 00";
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setServerError(false);
    try {
      const res = await fetch("/api/landing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, plan: "trial-7" }),
      });
      if (!res.ok) throw new Error("server");
      setForm({ name: "", venue: "", phone: "+7 ", city: "", tables: "", comment: "" });
      setDone(true);
    } catch {
      setServerError(true);
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", borderRadius: 14, padding: "12px 16px", fontSize: 14, outline: "none",
    border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
    background: isDark ? CARD_DARK2 : "#f8f6ff",
    color: fg(isDark), marginTop: 6, boxSizing: "border-box",
  };

  return (
    <form onSubmit={onSubmit} noValidate style={{ ...card(isDark), padding: 28 }}>
      <h3 style={{ fontSize: 19, fontWeight: 700, color: fg(isDark) }}>Заявка на 7 дней бесплатно</h3>
      <p style={{ marginTop: 6, fontSize: 13, color: muted(isDark) }}>
        Заполните три поля — остальное по желанию. Без привязки карты.
      </p>

      <div className="grid sm:grid-cols-2 gap-4" style={{ marginTop: 20 }}>
        <label>
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Ваше имя *</span>
          <input
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ануарбек" autoComplete="name"
            style={{ ...fieldStyle, ...(errors.name ? { borderColor: DANGER } : {}) }}
          />
          {errors.name && <span style={{ fontSize: 12, color: DANGER, marginTop: 4, display: "block" }}>{errors.name}</span>}
        </label>

        <label>
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Заведение *</span>
          <input
            value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
            placeholder="Kaffa Almaty" autoComplete="organization"
            style={{ ...fieldStyle, ...(errors.venue ? { borderColor: DANGER } : {}) }}
          />
          {errors.venue && <span style={{ fontSize: 12, color: DANGER, marginTop: 4, display: "block" }}>{errors.venue}</span>}
        </label>

        <label>
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Телефон или WhatsApp *</span>
          <input
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+7 700 000 00 00" inputMode="tel" autoComplete="tel"
            style={{ ...fieldStyle, ...(errors.phone ? { borderColor: DANGER } : {}) }}
          />
          {errors.phone && <span style={{ fontSize: 12, color: DANGER, marginTop: 4, display: "block" }}>{errors.phone}</span>}
        </label>

        <label>
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Город</span>
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={fieldStyle}>
            <option value="">Не указывать</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Размер заведения</span>
          <select value={form.tables} onChange={(e) => setForm({ ...form, tables: e.target.value })} style={fieldStyle}>
            <option value="">Не указывать</option>
            {TABLE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span style={{ fontSize: 13, fontWeight: 500, color: fg(isDark) }}>Комментарий</span>
          <textarea
            value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
            rows={3} placeholder="Например: работаем на Kaspi QR, нужен перенос меню"
            style={{ ...fieldStyle, resize: "none" }}
          />
        </label>
      </div>

      {serverError && (
        <p style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: DANGER }}>
          <AlertCircle size={14} /> Не удалось отправить заявку. Попробуйте ещё раз.
        </p>
      )}

      <button type="submit" disabled={loading} style={{
        marginTop: 20, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: G, color: WHITE, borderRadius: 999, padding: "14px 24px",
        fontSize: 14, fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}>
        {loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Отправляем…</> : <>Получить доступ на 7 дней <ArrowRight size={15} /></>}
      </button>

      <p style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: muted(isDark) }}>
        Нажимая кнопку, вы соглашаетесь на обработку данных для связи по заявке.
      </p>

      {done && (
        <div
          role="dialog" aria-modal="true" aria-label="Заявка принята"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(5,4,9,0.80)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          }}
          onClick={() => setDone(false)}
        >
          <div
            style={{
              ...card(isDark), padding: "40px 36px", textAlign: "center",
              maxWidth: 440, width: "100%", position: "relative",
              boxShadow: "0 32px 80px -20px rgba(124,58,237,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDone(false)}
              aria-label="Закрыть"
              style={{
                position: "absolute", top: 14, right: 14, background: "none", border: "none",
                cursor: "pointer", color: muted(isDark), fontSize: 18, lineHeight: 1,
                padding: "4px 8px", borderRadius: 8,
              }}
            >✕</button>

            <div style={{
              width: 64, height: 64, borderRadius: 999, background: G,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
            }}>
              <Check size={30} color={WHITE} />
            </div>

            <h3 style={{ marginTop: 20, fontSize: 22, fontWeight: 700, color: fg(isDark) }}>
              Заявка принята!
            </h3>
            <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: muted(isDark), maxWidth: 340, margin: "12px auto 0" }}>
              Свяжемся в течение рабочего дня — поможем загрузить меню, настроить столы и включим 7 дней бесплатного доступа.
            </p>

            <button
              onClick={() => setDone(false)}
              style={{
                marginTop: 24, padding: "13px 32px", borderRadius: 999,
                background: G, color: WHITE, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              Отлично, спасибо! <Check size={14} />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function Cta() {
  const { isDark } = useDark();

  return (
    <section id="trial" style={{ padding: "80px 20px", background: isDark ? BG_DARK : BG_LIGHT }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{
            borderRadius: 28, padding: "48px 32px",
            border: "1px solid rgba(124,58,237,0.30)",
            background: isDark
              ? `radial-gradient(70% 120% at 0% 0%, rgba(124,58,237,0.26), transparent 70%), ${CARD_DARK}`
              : `radial-gradient(70% 120% at 0% 0%, rgba(124,58,237,0.1), transparent 70%), ${BG_LIGHT}`,
            boxShadow: "0 40px 90px -40px rgba(124,58,237,0.50)",
          }}>
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <Pill>Пробный период</Pill>
                <h2 style={{ marginTop: 16, fontSize: "clamp(1.7rem,3.6vw,2.5rem)", fontWeight: 800, lineHeight: 1.2, color: fg(isDark) }}>
                  Попробуйте ScanServe QR в своём заведении
                </h2>
                <p style={{ marginTop: 16, fontSize: 15, color: muted(isDark), maxWidth: 440, lineHeight: 1.65 }}>
                  Оставьте заявку — подключим QR-меню и POS, поможем перенести меню и покажем первые цифры по выручке уже на второй день.
                </p>

                <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "7 дней бесплатно, без привязки карты",
                    "Загрузим меню и настроим столы за вас",
                    "Обучение команды — онлайн, 40 минут",
                    "Отмена в один клик, данные останутся вашими",
                  ].map((p) => (
                    <li key={p} style={{ display: "flex", gap: 10, fontSize: 14, color: muted(isDark) }}>
                      <Check size={15} style={{ color: SUCCESS, flexShrink: 0, marginTop: 2 }} />
                      {p}
                    </li>
                  ))}
                </ul>

                <ul style={{
                  marginTop: 24, paddingTop: 20,
                  borderTop: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  {[
                    { Icon: Clock,       label: "Ответим в течение рабочего дня" },
                    { Icon: PhoneCall,   label: "Звонок или WhatsApp — как удобно" },
                    { Icon: ShieldCheck, label: "Данные только для связи по заявке" },
                  ].map(({ Icon, label }) => (
                    <li key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: muted(isDark) }}>
                      <Icon size={14} style={{ color: BRAND, flexShrink: 0 }} />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <LeadForm />
            </div>
          </div>
        </Reveal>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { isDark } = useDark();

  return (
    <footer style={{
      borderTop: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
      background: isDark ? BG_DARK : BG_LIGHT,
      padding: "56px 20px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: G, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QrCode size={13} color={WHITE} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: fg(isDark) }}>
                ScanServe<span style={{ color: BRAND }}>.qr</span>
              </span>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: muted(isDark), maxWidth: 220 }}>
              Облачная платформа управления рестораном: QR-меню, POS, аналитика, CRM, персонал и склад.
            </p>
          </div>

          {/* Product */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: fg(isDark) }}>Продукт</p>
            <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { href: "#features",     label: "Возможности" },
                { href: "#how",          label: "Как это работает" },
                { href: "#pricing",      label: "Тарифы" },
                { href: "#faq",          label: "FAQ" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <a href={href} style={{ fontSize: 13, color: muted(isDark), textDecoration: "none" }}>{label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: fg(isDark) }}>Компания</p>
            <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { href: "#results",  label: "Кейсы" },
                { href: "#problems", label: "Кому подходит" },
                { href: "#trial",    label: "Пробный период" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <a href={href} style={{ fontSize: 13, color: muted(isDark), textDecoration: "none" }}>{label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: fg(isDark) }}>Контакты</p>
            <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { Icon: Mail,   href: "mailto:hello@scanserve.kz", label: "hello@scanserve.kz" },
                { Icon: Send,   href: "https://t.me/scanserve",    label: "Telegram-поддержка" },
                { Icon: MapPin, href: undefined,                   label: "Алматы, Казахстан" },
              ].map(({ Icon, href, label }) => (
                <li key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={13} style={{ color: BRAND, flexShrink: 0 }} />
                  {href
                    ? <a href={href} style={{ fontSize: 13, color: muted(isDark), textDecoration: "none" }}>{label}</a>
                    : <span style={{ fontSize: 13, color: muted(isDark) }}>{label}</span>
                  }
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: 40, paddingTop: 20,
          borderTop: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`,
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <p style={{ fontSize: 12, color: muted(isDark) }}>
            © {new Date().getFullYear()} ScanServe QR. Все права защищены.
          </p>
          <p style={{ fontSize: 12, color: muted(isDark) }}>Сделано для рынка Казахстана.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("landing-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  function toggle() {
    setIsDark((d) => {
      const next = !d;
      localStorage.setItem("landing-theme", next ? "dark" : "light");
      return next;
    });
  }

  useTrackSections();

  return (
    <DarkCtx.Provider value={{ isDark, toggle }}>
      <div style={{ background: isDark ? BG_DARK : BG_LIGHT, minHeight: "100vh" }}>
        <Navbar />
        <main>
          <div id="hero"         data-track><Hero /></div>
          <div id="problems"     data-track><Problems /></div>
          <div id="features"     data-track><Features /></div>
          <div id="how"          data-track><HowItWorks /></div>
          <div id="calculator"   data-track><Calculator /></div>
          <div id="integrations" data-track><Integrations /></div>
          <div id="results"      data-track><Results /></div>
          <div id="pricing"      data-track><Pricing /></div>
          <div id="faq"          data-track><Faq /></div>
          <div id="trial"        data-track><Cta /></div>
        </main>
        <div id="footer" data-track><Footer /></div>
      </div>
    </DarkCtx.Provider>
  );
}
