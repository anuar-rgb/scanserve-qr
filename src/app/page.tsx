"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  QrCode,
  Zap,
  BarChart3,
  Globe2,
  Smartphone,
  Palette,
  ArrowRight,
  Check,
  ChevronRight,
  Users,
  Clock,
  TrendingUp,
  Shield,
  Moon,
  Sun,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ─── Design constants ─────────────────────────────────────────────────────────

const BLUE = "#1D4ED8";
const BLUE_LIGHT = "#60A5FA";
const GRAPHITE = "#242424";
const PEARL = "#E7E9EB";
const WHITE = "#FFFFFF";
const DARK_BG = "#1A1A1A";
const DARK_CARD = "#1E1E1E";
const DARK_SURFACE = "#252525";

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
      body: JSON.stringify({
        sessionId: sessionId.current,
        section: "page_view",
        device,
        referrer,
      }),
    }).catch(() => {});

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            !tracked.current.has(entry.target.id)
          ) {
            tracked.current.add(entry.target.id);
            fetch("/api/analytics/landing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionId.current,
                section: entry.target.id,
                device,
                referrer,
              }),
            }).catch(() => {});
          }
        }
      },
      { threshold: 0.3 }
    );

    document
      .querySelectorAll("[data-track]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.52, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Eyebrow label ────────────────────────────────────────────────────────────

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-[0.14em] mb-4"
      style={{ color: dark ? BLUE_LIGHT : BLUE }}
    >
      {children}
    </p>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionTitle({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <h2
      className="text-4xl font-bold mb-4"
      style={{ color: dark ? PEARL : GRAPHITE, letterSpacing: "-0.02em" }}
    >
      {children}
    </h2>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { t } = useTranslations();
  const { isDark, toggle } = useDark();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: isDark ? "rgba(20,20,20,0.92)" : "rgba(231,233,235,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.09)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: BLUE }}>
          <QrCode size={16} color={WHITE} />
        </div>
        <span className="font-bold text-lg" style={{ color: isDark ? PEARL : GRAPHITE, letterSpacing: "-0.025em" }}>
          ScanServe<span style={{ color: BLUE }}>.qr</span>
        </span>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-8">
        {[
          { href: "#features", label: t.nav.features },
          { href: "#how-it-works", label: t.nav.howItWorks },
          { href: "#pricing", label: t.nav.pricing },
        ].map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="text-sm font-medium transition-colors"
            style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:opacity-70"
          style={{
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(36,36,36,0.07)",
            color: isDark ? PEARL : GRAPHITE,
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <LanguageSwitcher />
        <a
          href="#pricing"
          className="hidden sm:flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all hover:opacity-90"
          style={{ background: BLUE, color: WHITE }}
        >
          {t.nav.getStarted}
          <ArrowRight size={14} />
        </a>
      </div>
    </header>
  );
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative w-[260px] h-[520px] mx-auto select-none">
      {/* Glow shadow */}
      <div
        className="absolute inset-0 rounded-[3rem]"
        style={{
          background: `radial-gradient(ellipse, rgba(29,78,216,0.18) 0%, transparent 70%)`,
          filter: "blur(28px)",
          transform: "translateY(16px) scale(0.9)",
        }}
      />
      {/* Phone shell */}
      <div
        className="relative w-full h-full rounded-[2.5rem] overflow-hidden"
        style={{
          background: WHITE,
          border: "1px solid rgba(36,36,36,0.12)",
          boxShadow:
            "0 24px 60px rgba(36,36,36,0.16), 0 4px 12px rgba(36,36,36,0.08)",
          padding: "10px",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 rounded-b-2xl z-10"
          style={{ background: WHITE }}
        />
        {/* Screen */}
        <div
          className="w-full h-full rounded-[2rem] overflow-hidden"
          style={{ background: "#F5F5F7" }}
        >
          {/* Hero banner */}
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80"
            alt="Restaurant interior"
            className="w-full h-44 object-cover"
          />

          {/* Mock menu UI */}
          <div className="px-3.5 pt-3 space-y-2.5">
            {/* Restaurant header */}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ background: BLUE }}
              >
                A
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-900 leading-tight">АС ТӨРІ</p>
                <p className="text-[7px] text-gray-400">QR-меню ресторана</p>
              </div>
            </div>

            {/* Category pills */}
            <div className="flex gap-1 overflow-hidden">
              {["Салаты", "Горячее", "Напитки"].map((c, i) => (
                <span
                  key={c}
                  className="text-[7px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={
                    i === 0
                      ? { background: BLUE, color: WHITE }
                      : { background: "rgba(36,36,36,0.07)", color: "rgba(36,36,36,0.6)" }
                  }
                >
                  {c}
                </span>
              ))}
            </div>

            {/* Dish cards */}
            {[
              { name: "Цезарь с курицей", price: "2 800 ₸" },
              { name: "Стейк Рибай", price: "7 500 ₸" },
            ].map((d) => (
              <div
                key={d.name}
                className="flex items-center gap-2 p-2 rounded-xl"
                style={{
                  background: WHITE,
                  border: "1px solid rgba(36,36,36,0.07)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg shrink-0"
                  style={{ background: "#E7E9EB" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-gray-800 truncate">{d.name}</p>
                  <p className="text-[8px] font-bold" style={{ color: BLUE }}>
                    {d.price}
                  </p>
                </div>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: BLUE }}
                >
                  +
                </div>
              </div>
            ))}

            {/* Bottom nav mock */}
            <div
              className="flex justify-around pt-1.5"
              style={{ borderTop: "1px solid rgba(36,36,36,0.08)" }}
            >
              {["🏠", "📋", "🛒"].map((e, i) => (
                <span key={i} className="text-xs opacity-40">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live badge */}
      <div
        className="absolute -top-2 -right-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
        style={{
          background: WHITE,
          border: "1px solid rgba(36,36,36,0.09)",
          color: "#16a34a",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: "#22c55e" }}
        />
        Live
      </div>

      {/* Order badge */}
      <div
        className="absolute -bottom-2 -left-4 rounded-xl px-3 py-2 text-xs font-semibold"
        style={{
          background: WHITE,
          border: "1px solid rgba(36,36,36,0.09)",
          color: BLUE,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <span style={{ color: "rgba(36,36,36,0.5)" }}>Заказ #14</span>
        {" · "}
        <span style={{ color: "#16a34a", fontWeight: 700 }}>Принят ✓</span>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { t } = useTranslations();
  const { isDark } = useDark();

  return (
    <section
      className="relative min-h-screen flex items-center pt-20 bg-grid overflow-hidden"
      style={{ background: isDark ? DARK_BG : PEARL }}
    >
      <div className="relative z-10 max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-24">
        {/* Left: text */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-8"
            style={{
              background: "rgba(29,78,216,0.08)",
              border: "1px solid rgba(29,78,216,0.18)",
              color: BLUE,
              letterSpacing: "0.09em",
            }}
          >
            {t.hero.badge}
          </div>

          {/* Headline */}
          <h1
            className="font-extrabold leading-[1.05] tracking-tight mb-6"
            style={{
              color: isDark ? PEARL : GRAPHITE,
              fontSize: "clamp(2.6rem, 5vw, 3.8rem)",
              letterSpacing: "-0.03em",
            }}
          >
            {t.hero.title1}
            <br />
            <span style={{ color: BLUE }}>{t.hero.title2}</span>
            <br />
            {t.hero.title3}
          </h1>

          <p
            className="text-lg leading-relaxed mb-10"
            style={{ color: isDark ? "rgba(231,233,235,0.58)" : "rgba(36,36,36,0.58)", maxWidth: 480 }}
          >
            {t.hero.subtitle}
          </p>

          {/* CTA row */}
          <div className="flex flex-wrap gap-3 mb-12">
            <a
              href="#pricing"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: BLUE }}
            >
              {t.hero.ctaPrimary}
              <ArrowRight size={15} />
            </a>
            <a
              href="#features"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-black/5 active:scale-[0.98]"
              style={{
                color: GRAPHITE,
                border: "1px solid rgba(36,36,36,0.22)",
                background: "transparent",
              }}
            >
              {t.hero.ctaSecondary}
            </a>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap gap-5">
            {[t.hero.trust1, t.hero.trust2, t.hero.trust3].map((label) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "rgba(36,36,36,0.5)" }}
              >
                <Check size={13} style={{ color: BLUE }} />
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: phone mockup */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex justify-center lg:justify-end"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <PhoneMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function Stats() {
  const { t } = useTranslations();
  const { isDark } = useDark();

  const items = [
    { icon: <Users size={18} />, value: "2", label: t.stats.restaurants },
    { icon: <QrCode size={18} />, value: "12+", label: t.stats.activeMenus },
    { icon: <TrendingUp size={18} />, value: "16", label: t.stats.monthlyScans },
    { icon: <Clock size={18} />, value: "99.9%", label: t.stats.uptimeSla },
  ];

  return (
    <section
      style={{
        background: isDark ? DARK_CARD : WHITE,
        borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.08)",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.08)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map(({ icon, value, label }, i) => (
          <Reveal key={label} delay={i * 0.07} className="flex flex-col items-center text-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(29,78,216,0.12)", color: BLUE }}
            >
              {icon}
            </div>
            <div
              className="text-3xl font-black mb-1"
              style={{ color: isDark ? PEARL : GRAPHITE, letterSpacing: "-0.03em" }}
            >
              {value}
            </div>
            <div className="text-sm" style={{ color: isDark ? "rgba(231,233,235,0.5)" : "rgba(36,36,36,0.5)" }}>
              {label}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const { t } = useTranslations();
  const { isDark } = useDark();

  const items = [
    { icon: <QrCode size={20} />, title: t.features.qrTitle, desc: t.features.qrDesc },
    { icon: <Zap size={20} />, title: t.features.realtimeTitle, desc: t.features.realtimeDesc },
    { icon: <BarChart3 size={20} />, title: t.features.analyticsTitle, desc: t.features.analyticsDesc },
    { icon: <Globe2 size={20} />, title: t.features.multilingualTitle, desc: t.features.multilingualDesc },
    { icon: <Smartphone size={20} />, title: t.features.noappTitle, desc: t.features.noappDesc },
    { icon: <Palette size={20} />, title: t.features.brandingTitle, desc: t.features.brandingDesc },
  ];

  return (
    <section id="features" className="py-28 px-6" style={{ background: isDark ? DARK_BG : PEARL }}>
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <Eyebrow>{t.features.badge}</Eyebrow>
          <SectionTitle dark={isDark}>{t.features.title}</SectionTitle>
          <p className="text-lg max-w-xl mx-auto" style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}>
            {t.features.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ icon, title, desc }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 0.08}
              className="group p-6 rounded-2xl transition-all duration-200"
              style={{
                background: isDark ? DARK_CARD : WHITE,
                border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.08)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors"
                style={{ background: "rgba(29,78,216,0.12)", color: BLUE }}
              >
                {icon}
              </div>
              <h3
                className="font-semibold text-base mb-2"
                style={{ color: isDark ? PEARL : GRAPHITE }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}
              >
                {desc}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const { t } = useTranslations();
  const { isDark } = useDark();

  const steps = [
    { step: "01", title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc },
    { step: "02", title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc },
    { step: "03", title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc },
  ];

  return (
    <section
      id="how-it-works"
      className="py-28 px-6"
      style={{ background: isDark ? DARK_CARD : WHITE, borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.07)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <Eyebrow dark={isDark}>{t.howItWorks.badge}</Eyebrow>
          <SectionTitle dark={isDark}>{t.howItWorks.title}</SectionTitle>
          <p className="text-lg max-w-xl mx-auto" style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}>
            {t.howItWorks.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map(({ step, title, desc }, i) => (
            <Reveal key={step} delay={i * 0.10}>
              <div
                className="p-8 rounded-2xl h-full"
                style={{
                  background: isDark ? DARK_SURFACE : PEARL,
                  border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.07)",
                }}
              >
                <div
                  className="text-7xl font-black leading-none mb-6"
                  style={{ color: "rgba(29,78,216,0.15)", letterSpacing: "-0.06em", userSelect: "none" }}
                >
                  {step}
                </div>
                <div
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mb-4"
                  style={{ background: BLUE, color: WHITE }}
                >
                  {parseInt(step)}
                </div>
                <h3 className="font-bold text-xl mb-3" style={{ color: isDark ? PEARL : GRAPHITE }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}>
                  {desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problems ─────────────────────────────────────────────────────────────────

function Problems() {
  const { t } = useTranslations();
  const { isDark } = useDark();
  const p = t.problems;

  const items = [
    { icon: "📋", title: p.p1Title, desc: p.p1Desc, tag: p.p1Tag },
    { icon: "🗣️", title: p.p2Title, desc: p.p2Desc, tag: p.p2Tag },
    { icon: "📊", title: p.p3Title, desc: p.p3Desc, tag: p.p3Tag },
  ];

  return (
    <section
      className="py-28 px-6"
      style={{ background: isDark ? DARK_BG : PEARL, borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.07)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "#DC2626" }}>
            {p.badge}
          </p>
          <SectionTitle dark={isDark}>{p.title}</SectionTitle>
          <p className="text-lg max-w-xl mx-auto" style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}>
            {p.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4">
          {items.map(({ icon, title, desc, tag }, i) => (
            <Reveal key={title} delay={i * 0.09}>
              <div
                className="p-6 rounded-2xl relative overflow-hidden h-full"
                style={{
                  background: isDark ? DARK_CARD : WHITE,
                  border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(36,36,36,0.08)",
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #DC2626 0%, transparent 80%)" }} />
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-semibold text-base mb-2" style={{ color: isDark ? PEARL : GRAPHITE }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}>
                  {desc}
                </p>
                <span
                  className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-md"
                  style={{ background: "rgba(220,38,38,0.10)", color: "#DC2626", letterSpacing: "0.06em" }}
                >
                  {tag}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Proof (dark section) ─────────────────────────────────────────────────────

function Proof() {
  const { t } = useTranslations();
  const p = t.proof;

  const stats = [
    { val: p.stat1, label: p.stat1Label },
    { val: p.stat2, label: p.stat2Label },
    { val: p.stat3, label: p.stat3Label },
    { val: p.stat4, label: p.stat4Label },
  ];

  return (
    <section className="py-28 px-6" style={{ background: GRAPHITE }}>
      <div className="max-w-6xl mx-auto">
        <Reveal className="mb-14">
          <Eyebrow dark>{p.badge}</Eyebrow>
          <SectionTitle dark>{p.title}</SectionTitle>
          <p
            className="text-lg max-w-2xl"
            style={{ color: "rgba(231,233,235,0.55)" }}
          >
            {p.subtitle}
          </p>
        </Reveal>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          {stats.map(({ val, label }, i) => (
            <Reveal key={label} delay={i * 0.07}>
              <div
                className="text-4xl font-black mb-1.5"
                style={{
                  color: BLUE_LIGHT,
                  letterSpacing: "-0.03em",
                }}
              >
                {val}
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(231,233,235,0.45)" }}
              >
                {label}
              </div>
            </Reveal>
          ))}
        </div>

        {/* Testimonial */}
        <Reveal>
          <blockquote
            className="rounded-2xl p-8"
            style={{
              background: "rgba(231,233,235,0.05)",
              border: "1px solid rgba(231,233,235,0.10)",
              borderLeft: `3px solid ${BLUE}`,
            }}
          >
            <Shield
              size={20}
              style={{ color: BLUE_LIGHT, marginBottom: 16 }}
            />
            <p
              className="text-lg italic leading-relaxed mb-5"
              style={{ color: "rgba(231,233,235,0.85)" }}
            >
              {p.quote}
            </p>
            <footer
              className="text-sm font-semibold"
              style={{ color: "rgba(231,233,235,0.35)" }}
            >
              {p.quoteAuthor}
            </footer>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  const { t } = useTranslations();
  const { isDark } = useDark();
  const p = t.pricing;

  const plans = [
    {
      name: p.starterName,
      price: p.starterPrice,
      oldPrice: null as string | null,
      badge: null as string | null,
      period: p.starterPeriod,
      desc: p.starterDesc,
      cta: p.starterCta,
      highlight: false,
      features: [
        p.starterF1, p.starterF2, p.starterF3, p.starterF4, p.starterF5,
        p.starterF6, p.starterF7, p.starterF8, p.starterF9,
      ],
    },
    {
      name: p.proName,
      price: p.proPrice,
      oldPrice: null as string | null,
      badge: null as string | null,
      period: p.proPeriod,
      desc: p.proDesc,
      cta: p.proCta,
      highlight: true,
      features: [
        p.proF1, p.proF2, p.proF3, p.proF4, p.proF5,
        p.proF6, p.proF7, p.proF8, p.proF9,
      ],
    },
    {
      name: p.entName,
      price: p.entPrice,
      oldPrice: "15 780 ₸",
      badge: "-17%",
      period: p.entPeriod,
      desc: p.entDesc,
      cta: p.entCta,
      highlight: false,
      features: [
        p.entF1, p.entF2, p.entF3, p.entF4, p.entF5,
        p.entF6, p.entF7, p.entF8, p.entF9,
      ],
    },
  ];

  return (
    <section id="pricing" className="py-28 px-6" style={{ background: isDark ? DARK_BG : PEARL }}>
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <Eyebrow dark={isDark}>{p.badge}</Eyebrow>
          <SectionTitle dark={isDark}>{p.title}</SectionTitle>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: isDark ? "rgba(231,233,235,0.55)" : "rgba(36,36,36,0.55)" }}
          >
            {p.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map(({ name, price, oldPrice, badge, period, desc, cta, highlight, features }, i) => (
            <Reveal key={name} delay={i * 0.09}>
              <div
                className="rounded-2xl p-8 relative h-full flex flex-col"
                style={
                  highlight
                    ? { background: BLUE, border: `1px solid ${BLUE}`, boxShadow: "0 20px 60px rgba(29,78,216,0.28)" }
                    : { background: isDark ? DARK_CARD : WHITE, border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(36,36,36,0.09)" }
                }
              >
                {/* Popular badge */}
                {highlight && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
                    style={{ background: GRAPHITE, color: PEARL }}
                  >
                    {p.mostPopular}
                  </div>
                )}
                {/* Discount badge */}
                {badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
                    style={{ background: "#16A34A", color: WHITE }}
                  >
                    {badge}
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.10em] mb-3"
                    style={{
                      color: highlight ? "rgba(231,233,235,0.65)" : BLUE,
                    }}
                  >
                    {name}
                  </p>
                  <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                    {oldPrice && (
                      <span
                        className="text-base line-through"
                        style={{
                          color: highlight
                            ? "rgba(231,233,235,0.35)"
                            : "rgba(36,36,36,0.3)",
                        }}
                      >
                        {oldPrice}
                      </span>
                    )}
                    <span
                      className="text-4xl font-black"
                      style={{
                        color: highlight ? WHITE : GRAPHITE,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {price}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: highlight ? "rgba(231,233,235,0.55)" : isDark ? "rgba(231,233,235,0.4)" : "rgba(36,36,36,0.4)" }}
                    >
                      {period}
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: highlight ? "rgba(231,233,235,0.65)" : isDark ? "rgba(231,233,235,0.5)" : "rgba(36,36,36,0.5)" }}
                  >
                    {desc}
                  </p>
                </div>

                {/* CTA button */}
                <a
                  href="#"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold mb-8 transition-all hover:opacity-90"
                  style={highlight ? { background: WHITE, color: BLUE } : { background: BLUE, color: WHITE }}
                >
                  {cta}
                  <ChevronRight size={15} />
                </a>

                {/* Features list */}
                <ul className="space-y-3 mt-auto">
                  {features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-sm"
                      style={{ color: highlight ? "rgba(231,233,235,0.75)" : isDark ? "rgba(231,233,235,0.6)" : "rgba(36,36,36,0.6)" }}
                    >
                      <Check size={14} style={{ color: highlight ? "#93C5FD" : BLUE, flexShrink: 0, marginTop: 2 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  const { t } = useTranslations();

  return (
    <section
      className="py-28 px-6"
      style={{ background: DARK_BG }}
    >
      <Reveal className="max-w-2xl mx-auto text-center">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-8"
          style={{ background: BLUE }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <QrCode size={26} color={WHITE} />
        </motion.div>

        <h2
          className="text-4xl font-bold mb-5"
          style={{ color: PEARL, letterSpacing: "-0.02em" }}
        >
          {t.cta.title}
        </h2>
        <p
          className="text-lg mb-10"
          style={{ color: "rgba(231,233,235,0.5)" }}
        >
          {t.cta.subtitle}
        </p>

        <a
          href="#pricing"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: BLUE, color: WHITE }}
        >
          {t.cta.primary}
          <ArrowRight size={16} />
        </a>
      </Reveal>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { t } = useTranslations();

  const links = [
    t.footer.privacy,
    t.footer.terms,
    t.footer.contact,
    t.footer.status,
    t.footer.docs,
  ];

  return (
    <footer
      className="px-6 py-12"
      style={{
        background: DARK_BG,
        borderTop: "1px solid rgba(231,233,235,0.07)",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: BLUE }}
          >
            <QrCode size={13} color={WHITE} />
          </div>
          <span
            className="font-bold text-base"
            style={{ color: PEARL }}
          >
            ScanServe<span style={{ color: BLUE_LIGHT }}>.qr</span>
          </span>
        </div>

        {/* Links */}
        <div
          className="flex flex-wrap justify-center gap-6 text-sm"
          style={{ color: "rgba(231,233,235,0.30)" }}
        >
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="transition-colors hover:text-[rgba(231,233,235,0.75)]"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p
          className="text-sm"
          style={{ color: "rgba(231,233,235,0.25)" }}
        >
          {t.footer.copyright}
        </p>
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
    <div style={{ background: isDark ? DARK_BG : PEARL, minHeight: "100vh" }}>
      <Navbar />
      <main>
        <div id="hero" data-track>
          <Hero />
        </div>
        <div id="stats" data-track>
          <Stats />
        </div>
        <div id="features" data-track>
          <Features />
        </div>
        <div id="how-it-works" data-track>
          <HowItWorks />
        </div>
        <div id="problems" data-track>
          <Problems />
        </div>
        <div id="proof" data-track>
          <Proof />
        </div>
        <div id="pricing" data-track>
          <Pricing />
        </div>
        <div id="cta" data-track>
          <FinalCta />
        </div>
      </main>
      <div id="footer" data-track>
        <Footer />
      </div>
    </div>
    </DarkCtx.Provider>
  );
}
