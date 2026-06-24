"use client";

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

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const { t } = useTranslations();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: "rgba(8,8,15,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
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
        style={{
          background: "var(--surface)",
          padding: "12px",
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-2xl" style={{ background: "var(--surface)" }} />
        {/* Screen */}
        <div className="w-full h-full rounded-[2rem] overflow-hidden" style={{ background: "#111" }}>
          <iframe
            src="/as-tori"
            className="w-[375px] h-[812px] border-0 pointer-events-none"
            style={{
              transform: "scale(0.665)",
              transformOrigin: "top left",
            }}
            loading="lazy"
            tabIndex={-1}
          />
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
      {/* Demo link */}
      <a
        href="/as-tori"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute -bottom-3 -left-3 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
        }}
      >
        <Smartphone size={12} />
        Открыть демо-меню
      </a>
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
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8"
            style={{
              background: "rgba(108,71,255,0.12)",
              border: "1px solid rgba(108,71,255,0.25)",
              color: "#a78bfa",
            }}
          >
            <Star size={14} fill="currentColor" />
            {t.hero.badge}
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
            <span className="text-gradient">{t.hero.title1}</span>
            <br />
            <span style={{ color: "var(--foreground)" }}>{t.hero.title2}</span>
            <br />
            <span style={{ color: "var(--foreground)" }}>{t.hero.title3}</span>
          </h1>

          <p
            className="text-lg leading-relaxed mb-10"
            style={{ color: "var(--muted)", maxWidth: "480px" }}
          >
            {t.hero.subtitle}
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <a href="#pricing" className="btn-primary">
              {t.hero.ctaPrimary}
              <ArrowRight size={16} />
            </a>
            <a href="#features" className="btn-ghost">
              {t.hero.ctaSecondary}
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6">
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
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
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
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-bold mb-1 text-gradient">{value}</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {label}
            </div>
          </div>
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
        <div className="text-center mb-16">
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
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ icon, title, desc }) => (
            <div key={title} className="card-base p-6">
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
            </div>
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
        <div className="text-center mb-16">
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
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div
            className="hidden md:block absolute top-10 left-[33%] right-[33%] h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(108,71,255,0.4), transparent)",
            }}
          />
          {steps.map(({ step, title, desc }) => (
            <div key={step} className="card-base p-8 text-center">
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
            </div>
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
      period: p.starterPeriod,
      desc: p.starterDesc,
      cta: p.starterCta,
      highlight: false,
      features: [p.starterF1, p.starterF2, p.starterF3, p.starterF4, p.starterF5],
    },
    {
      name: p.proName,
      price: p.proPrice,
      period: p.proPeriod,
      desc: p.proDesc,
      cta: p.proCta,
      highlight: true,
      features: [p.proF1, p.proF2, p.proF3, p.proF4, p.proF5, p.proF6],
    },
    {
      name: p.entName,
      price: p.entPrice,
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
        <div className="text-center mb-16">
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
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map(({ name, price, period, desc, cta, highlight, features }) => (
            <div
              key={name}
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

              <div className="mb-6">
                <div
                  className="text-sm font-medium mb-3"
                  style={{ color: "var(--accent)" }}
                >
                  {name}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
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
            </div>
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
      <div className="max-w-3xl mx-auto text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
          style={{ background: "var(--accent)" }}
        >
          <QrCode size={32} color="#fff" />
        </div>
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
      </div>
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
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
