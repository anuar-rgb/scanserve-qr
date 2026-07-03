"use client";

import { useEffect, useRef } from "react";
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
  Star,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

// ─── Scroll-reveal helper ──────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] as const },
};

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
      initial={fadeUp.initial}
      whileInView={fadeUp.whileInView}
      viewport={fadeUp.viewport}
      transition={{ ...fadeUp.transition, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Aurora background ──────────────────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 520, height: 520, top: "-8%", left: "-8%",
          background: "radial-gradient(circle, rgba(108,71,255,0.22) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 480, height: 480, top: "20%", right: "-10%",
          background: "radial-gradient(circle, rgba(14,165,233,0.16) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 420, height: 420, bottom: "-5%", left: "30%",
          background: "radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function useTrackSections() {
  const tracked = useRef(new Set<string>());
  const sessionId = useRef("");

  useEffect(() => {
    sessionId.current = sessionStorage.getItem("landing_sid") ?? crypto.randomUUID();
    sessionStorage.setItem("landing_sid", sessionId.current);

    const device = window.innerWidth < 768 ? "mobile" : "desktop";
    const referrer = document.referrer || "direct";

    fetch("/api/analytics/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, section: "page_view", device, referrer }),
    }).catch(() => {});

    const observer = new IntersectionObserver((entries) => {
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
    }, { threshold: 0.3 });

    const sections = document.querySelectorAll("[data-track]");
    sections.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const { t } = useTranslations();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[rgba(245,245,247,0.78)] dark:bg-[rgba(8,8,15,0.85)]"
      style={{
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: "var(--accent)" }}
        >
          <QrCode size={18} color="#fff" />
        </div>
        <span className="font-bold text-lg tracking-tight">
          ScanServe<span style={{ color: "var(--accent)" }}>.qr</span>
        </span>
      </div>

      <nav className="hidden md:flex items-center gap-8">
        <a href="#features" className="nav-link">{t.nav.features}</a>
        <a href="#how-it-works" className="nav-link">{t.nav.howItWorks}</a>
        <a href="#pricing" className="nav-link">{t.nav.pricing}</a>
      </nav>

      <div className="flex items-center gap-3">
        <a
          href="#"
          className="hidden sm:block text-sm font-medium transition-colors"
          style={{ color: "var(--muted)" }}
        >
          {t.nav.signIn}
        </a>
        <ThemeSwitcher />
        <LanguageSwitcher />
        <a href="#pricing" className="btn-primary text-sm py-2 px-4">
          {t.nav.getStarted}
        </a>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative w-[280px] h-[560px] mx-auto">
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-[3rem]"
        style={{
          background: "radial-gradient(circle, rgba(108,71,255,0.35) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
      {/* Phone frame */}
      <div
        className="relative w-full h-full rounded-[2.5rem] overflow-hidden glow-border"
        style={{ background: "var(--surface)", padding: "12px" }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-2xl z-10" style={{ background: "var(--surface)" }} />
        {/* Screen */}
        <div className="w-full h-full rounded-[2rem] overflow-hidden relative" style={{ background: "#111" }}>
          {/* Hero image */}
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80"
            alt="Restaurant"
            className="w-full h-48 object-cover"
          />
          {/* Fake menu UI overlay */}
          <div className="px-4 pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white text-[10px] font-bold">A</div>
              <div>
                <p className="text-[11px] font-bold text-white leading-tight">АС ТӨРІ</p>
                <p className="text-[8px] text-zinc-500">QR-меню ресторана</p>
              </div>
            </div>
            {/* Category pills */}
            <div className="flex gap-1.5">
              {["Салаты", "Горячее", "Напитки"].map((c) => (
                <span key={c} className="text-[8px] font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">{c}</span>
              ))}
            </div>
            {/* Dish cards */}
            {[
              { name: "Цезарь с курицей", price: "2 800 ₸" },
              { name: "Стейк Рибай", price: "7 500 ₸" },
              { name: "Том Ям", price: "3 200 ₸" },
            ].map((d) => (
              <div key={d.name} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white truncate">{d.name}</p>
                  <p className="text-[9px] text-violet-400 font-bold">{d.price}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px]">+</div>
              </div>
            ))}
            {/* Bottom nav mock */}
            <div className="flex justify-around pt-2 border-t border-zinc-800/50">
              {["🏠", "📋", "🛒"].map((e, i) => (
                <span key={i} className="text-sm opacity-60">{e}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Live badge */}
      <div
        className="absolute -top-3 -right-3 rounded-xl px-3 py-2 text-xs font-semibold"
        style={{
          background: "rgba(34,197,94,0.15)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "#4ade80",
        }}
      >
        ✓ Live
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useTranslations();

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-grid overflow-hidden pt-20">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(108,71,255,0.15) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8"
            style={{
              background: "rgba(108,71,255,0.12)",
              border: "1px solid rgba(108,71,255,0.25)",
              color: "#a78bfa",
            }}
          >
            <Star size={14} fill="currentColor" />
            {t.hero.badge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            <span className="text-gradient">{t.hero.title1}</span>
            <br />
            <span style={{ color: "var(--foreground)" }}>{t.hero.title2}</span>
            <br />
            <span style={{ color: "var(--foreground)" }}>{t.hero.title3}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg leading-relaxed mb-10"
            style={{ color: "var(--muted)", maxWidth: "480px" }}
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="flex flex-wrap gap-4 mb-12"
          >
            <a href="#pricing" className="btn-primary">
              {t.hero.ctaPrimary}
              <ArrowRight size={16} />
            </a>
            <a href="#features" className="btn-ghost">
              {t.hero.ctaSecondary}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.36 }}
            className="flex flex-wrap items-center gap-6"
          >
            {[t.hero.trust1, t.hero.trust2, t.hero.trust3].map((label) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--muted)" }}
              >
                <Check size={14} style={{ color: "var(--accent)" }} />
                {label}
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex justify-center lg:justify-end"
        >
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <PhoneMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function Stats() {
  const { t } = useTranslations();

  const stats = [
    { value: "2", label: t.stats.restaurants },
    { value: "12+", label: t.stats.activeMenus },
    { value: "16", label: t.stats.monthlyScans },
    { value: "99.9%", label: t.stats.uptimeSla },
  ];

  return (
    <section
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map(({ value, label }, i) => (
          <Reveal key={label} delay={i * 0.08} className="text-center">
            <div className="text-3xl font-bold mb-1 text-gradient">{value}</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {label}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  const { t } = useTranslations();

  const items = [
    { icon: <QrCode size={22} />, title: t.features.qrTitle, desc: t.features.qrDesc },
    { icon: <Zap size={22} />, title: t.features.realtimeTitle, desc: t.features.realtimeDesc },
    { icon: <BarChart3 size={22} />, title: t.features.analyticsTitle, desc: t.features.analyticsDesc },
    { icon: <Globe2 size={22} />, title: t.features.multilingualTitle, desc: t.features.multilingualDesc },
    { icon: <Smartphone size={22} />, title: t.features.noappTitle, desc: t.features.noappDesc },
    { icon: <Palette size={22} />, title: t.features.brandingTitle, desc: t.features.brandingDesc },
  ];

  return (
    <section id="features" className="py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-5"
            style={{
              background: "rgba(108,71,255,0.1)",
              border: "1px solid rgba(108,71,255,0.2)",
              color: "#a78bfa",
            }}
          >
            {t.features.badge}
          </div>
          <h2 className="text-4xl font-bold mb-4">{t.features.title}</h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "var(--muted)" }}
          >
            {t.features.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ icon, title, desc }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.08} className="card-base p-6">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(108,71,255,0.15)",
                  color: "var(--accent)",
                }}
              >
                {icon}
              </div>
              <h3
                className="font-semibold text-lg mb-2"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--muted)" }}
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

// ─── How it works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const { t } = useTranslations();

  const steps = [
    { step: "01", title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc },
    { step: "02", title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc },
    { step: "03", title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc },
  ];

  return (
    <section
      id="how-it-works"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
      className="py-28 px-6"
    >
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-5"
            style={{
              background: "rgba(108,71,255,0.1)",
              border: "1px solid rgba(108,71,255,0.2)",
              color: "#a78bfa",
            }}
          >
            {t.howItWorks.badge}
          </div>
          <h2 className="text-4xl font-bold mb-4">{t.howItWorks.title}</h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "var(--muted)" }}
          >
            {t.howItWorks.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div
            className="hidden md:block absolute top-10 left-[33%] right-[33%] h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(108,71,255,0.4), transparent)",
            }}
          />
          {steps.map(({ step, title, desc }, i) => (
            <Reveal key={step} delay={i * 0.12} className="card-base p-8 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 glow-border"
                style={{ background: "rgba(108,71,255,0.1)" }}
              >
                <span
                  className="text-xl font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  {step}
                </span>
              </div>
              <h3
                className="font-semibold text-xl mb-3"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--muted)" }}
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

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  const { t } = useTranslations();
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
      features: [p.starterF1, p.starterF2, p.starterF3, p.starterF4, p.starterF5, p.starterF6, p.starterF7, p.starterF8, p.starterF9],
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
      features: [p.proF1, p.proF2, p.proF3, p.proF4, p.proF5, p.proF6, p.proF7, p.proF8, p.proF9],
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
      features: [p.entF1, p.entF2, p.entF3, p.entF4, p.entF5, p.entF6],
    },
  ];

  return (
    <section id="pricing" className="py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-5"
            style={{
              background: "rgba(108,71,255,0.1)",
              border: "1px solid rgba(108,71,255,0.2)",
              color: "#a78bfa",
            }}
          >
            {p.badge}
          </div>
          <h2 className="text-4xl font-bold mb-4">{p.title}</h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "var(--muted)" }}
          >
            {p.subtitle}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map(({ name, price, oldPrice, badge, period, desc, cta, highlight, features }, i) => (
            <Reveal
              key={name}
              delay={i * 0.1}
              className={`rounded-2xl p-8 relative ${
                highlight ? "glow-border" : "card-base"
              }`}
              style={highlight ? { background: "rgba(108,71,255,0.08)" } : {}}
            >
              {highlight && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {p.mostPopular}
                </div>
              )}
              {badge && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
                  style={{ background: "#10B981", color: "#fff" }}
                >
                  {badge}
                </div>
              )}

              <div className="mb-6">
                <div
                  className="text-sm font-medium mb-3"
                  style={{ color: "var(--accent)" }}
                >
                  {name}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  {oldPrice && (
                    <span className="text-lg line-through" style={{ color: "var(--muted)" }}>
                      {oldPrice}
                    </span>
                  )}
                  <span
                    className="text-4xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {price}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {period}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {desc}
                </p>
              </div>

              <a
                href="#"
                className={`${
                  highlight ? "btn-primary" : "btn-ghost"
                } w-full justify-center mb-8`}
              >
                {cta}
                <ChevronRight size={16} />
              </a>

              <ul className="space-y-3">
                {features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    <Check
                      size={15}
                      style={{ color: "var(--accent)", flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCta() {
  const { t } = useTranslations();

  return (
    <section
      className="py-28 px-6"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <Reveal className="max-w-3xl mx-auto text-center">
        <motion.div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
          style={{ background: "var(--accent)" }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <QrCode size={32} color="#fff" />
        </motion.div>
        <h2 className="text-4xl font-bold mb-5 text-gradient">{t.cta.title}</h2>
        <p className="text-lg mb-10" style={{ color: "var(--muted)" }}>
          {t.cta.subtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="#pricing" className="btn-primary">
            {t.cta.primary}
            <ArrowRight size={16} />
          </a>
          <a href="#how-it-works" className="btn-ghost">
            {t.cta.secondary}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

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
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
      className="px-6 py-12"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "var(--accent)" }}
          >
            <QrCode size={14} color="#fff" />
          </div>
          <span className="font-bold text-base">
            ScanServe<span style={{ color: "var(--accent)" }}>.qr</span>
          </span>
        </div>

        <div
          className="flex flex-wrap justify-center gap-6 text-sm"
          style={{ color: "var(--muted)" }}
        >
          {links.map((link) => (
            <a key={link} href="#" className="hover:text-white transition-colors">
              {link}
            </a>
          ))}
        </div>

        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t.footer.copyright}
        </p>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  useTrackSections();

  return (
    <>
      <AuroraBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <main>
          <div id="hero" data-track><Hero /></div>
          <div id="stats" data-track><Stats /></div>
          <div id="features" data-track><Features /></div>
          <div id="how-it-works" data-track><HowItWorks /></div>
          <div id="pricing" data-track><Pricing /></div>
          <div id="cta" data-track><FinalCta /></div>
        </main>
        <div id="footer" data-track><Footer /></div>
      </div>
    </>
  );
}
