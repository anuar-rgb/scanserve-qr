"use client";

import { QRCodeSVG } from "qrcode.react";

const MENU_URL = "https://scanserve-qr-production.up.railway.app/as-tori?source=qr";

const TH = {
  bg: "#0C0407",
  surface: "#190810",
  surface2: "#22101A",
  gold: "#C9973A",
  goldLight: "#DEB96A",
  goldDim: "rgba(201,151,58,0.12)",
  goldBorder: "rgba(201,151,58,0.35)",
  text: "#F5ECD7",
  muted: "rgba(245,236,215,0.5)",
};

function DiamondPattern() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity: 0.07 }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="qr-diamond" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M20 4 L36 20 L20 36 L4 20 Z"
            fill="none"
            stroke={TH.gold}
            strokeWidth="0.8"
          />
          <circle cx="20" cy="20" r="1.5" fill={TH.gold} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#qr-diamond)" />
    </svg>
  );
}

function CornerOrnament({ flip }: { flip?: boolean }) {
  const transform = flip ? "scale(-1,-1)" : undefined;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform }}>
      <path d="M4 4 L28 4" stroke={TH.gold} strokeWidth="2" strokeLinecap="round" />
      <path d="M4 4 L4 28" stroke={TH.gold} strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="4" r="3" fill={TH.gold} />
      <path d="M12 4 L12 12 L4 12" fill="none" stroke={TH.gold} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

export default function AsToriQrPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: TH.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <DiamondPattern />

      {/* Glow orb */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: `radial-gradient(circle, rgba(201,151,58,0.08) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          background: TH.surface,
          border: `1px solid ${TH.goldBorder}`,
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "420px",
          width: "100%",
          boxShadow: `0 0 0 1px rgba(201,151,58,0.08), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,151,58,0.15)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
          zIndex: 1,
        }}
      >
        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: "12px", left: "12px" }}>
          <CornerOrnament />
        </div>
        <div style={{ position: "absolute", top: "12px", right: "12px", transform: "scaleX(-1)" }}>
          <CornerOrnament />
        </div>
        <div style={{ position: "absolute", bottom: "12px", left: "12px", transform: "scaleY(-1)" }}>
          <CornerOrnament />
        </div>
        <div style={{ position: "absolute", bottom: "12px", right: "12px", transform: "scale(-1,-1)" }}>
          <CornerOrnament />
        </div>

        {/* Restaurant name */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.25em",
              color: TH.gold,
              textTransform: "uppercase",
              marginBottom: "8px",
              fontFamily: "var(--font-geist-sans, sans-serif)",
              fontWeight: 600,
            }}
          >
            Қазақ дәстүрлі тағамдары
          </div>
          <h1
            style={{
              fontSize: "clamp(32px, 8vw, 48px)",
              fontWeight: 700,
              color: TH.goldLight,
              letterSpacing: "0.12em",
              margin: 0,
              textShadow: `0 0 40px rgba(222,185,106,0.4)`,
            }}
          >
            АС ТӨРІ
          </h1>
          {/* Decorative line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "12px",
              justifyContent: "center",
            }}
          >
            <div style={{ height: "1px", width: "40px", background: `linear-gradient(to right, transparent, ${TH.gold})` }} />
            <div style={{ width: "5px", height: "5px", background: TH.gold, transform: "rotate(45deg)" }} />
            <div style={{ height: "1px", width: "40px", background: `linear-gradient(to left, transparent, ${TH.gold})` }} />
          </div>
        </div>

        {/* QR code frame */}
        <div
          style={{
            position: "relative",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "16px",
            boxShadow: `0 0 0 1px ${TH.goldBorder}, 0 0 0 5px ${TH.surface}, 0 0 0 6px ${TH.goldBorder}`,
          }}
        >
          <QRCodeSVG
            value={MENU_URL}
            size={220}
            level="H"
            marginSize={0}
            imageSettings={{
              src: "",
              height: 0,
              width: 0,
              excavate: false,
            }}
          />
        </div>

        {/* Scan text */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
          <p
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: TH.text,
              margin: 0,
              letterSpacing: "0.04em",
            }}
          >
            Мәзірді қарау үшін скан жасаңыз
          </p>
          <p
            style={{
              fontSize: "13px",
              color: TH.muted,
              margin: 0,
              fontFamily: "var(--font-geist-sans, sans-serif)",
            }}
          >
            Scan to view menu&nbsp;&nbsp;·&nbsp;&nbsp;Отсканируйте меню
          </p>
        </div>

        {/* URL */}
        <div
          style={{
            padding: "8px 16px",
            background: TH.goldDim,
            border: `1px solid rgba(201,151,58,0.2)`,
            borderRadius: "8px",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: "11px",
            color: TH.gold,
            letterSpacing: "0.02em",
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {MENU_URL}
        </div>

        {/* ScanServe badge */}
        <div
          style={{
            fontFamily: "var(--font-geist-sans, sans-serif)",
            fontSize: "11px",
            color: "rgba(245,236,215,0.25)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Powered by ScanServe.qr
        </div>
      </div>
    </div>
  );
}
