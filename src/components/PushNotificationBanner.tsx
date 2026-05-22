"use client";

import { useEffect, useState } from "react";
import type { Lang } from "./MenuTemplate";

const STORAGE_KEY = "scanserve-push-dismissed";

const T: Record<string, Record<Lang, string>> = {
  headline: {
    en: "Get exclusive offers & bonuses",
    ru: "Получайте акции и бонусы",
    kz: "Акциялар мен бонустар алыңыз",
  },
  sub: {
    en: "Subscribe to push notifications — be the first to know about deals.",
    ru: "Подпишитесь на уведомления — узнавайте об акциях первыми.",
    kz: "Хабарламаларға жазылыңыз — акцияларды бірінші біліңіз.",
  },
  phonePlaceholder: {
    en: "Phone (optional)",
    ru: "Телефон (необязательно)",
    kz: "Телефон (міндетті емес)",
  },
  allow: { en: "Subscribe", ru: "Подписаться", kz: "Жазылу" },
  dismiss: { en: "Not now", ru: "Не сейчас", kz: "Кейінірек" },
  success: {
    en: "You're subscribed!",
    ru: "Вы подписаны!",
    kz: "Сіз жазылдыңыз!",
  },
  denied: {
    en: "Notifications blocked",
    ru: "Уведомления заблокированы",
    kz: "Хабарламалар бұғатталды",
  },
};

const tn = (key: string, lang: Lang) => T[key]?.[lang] ?? T[key]?.en ?? key;

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

interface PushNotificationBannerProps {
  lang: Lang;
  theme: "dark" | "light";
}

export function PushNotificationBanner({ lang, theme }: PushNotificationBannerProps) {
  const [visible, setVisible]       = useState(false);
  const [state, setState]           = useState<"idle" | "loading" | "success" | "denied">("idle");
  const [phone, setPhone]           = useState("");
  const isDark  = theme === "dark";
  const bg      = isDark ? "#1C1C1C" : "#FFFFFF";
  const textClr = isDark ? "#E0E0E0" : "#121212";
  const muted   = isDark ? "#9A9A9A" : "#6B7280";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      sessionStorage.getItem(STORAGE_KEY) ||
      Notification.permission === "denied"
    ) return;

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (!sub) {
          // Show banner after 3s to not interrupt on load
          const timer = setTimeout(() => setVisible(true), 3000);
          return () => clearTimeout(timer);
        }
      })
      .catch(() => {/* SW not supported */});
  }, []);

  const handleAllow = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
      const phoneVal = phone.trim() || null;
      await fetch("/api/crm/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subscription: sub.toJSON(), phone: phoneVal }),
      });
      setState("success");
      sessionStorage.setItem(STORAGE_KEY, "1");
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setState("denied");
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        left: "max(calc(50vw - 232px), 8px)",
        width: "min(calc(100vw - 16px), 464px)",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        zIndex: 70,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "'Montserrat', system-ui, sans-serif",
        color: textClr,
        animation: "slideUpFadeIn 0.4s cubic-bezier(0.32,0.72,0,1) both",
      } as React.CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {state === "success" ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#10B981" }}>
              {tn("success", lang)}
            </p>
          ) : state === "denied" ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#E05555" }}>
              {tn("denied", lang)}
            </p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                {tn("headline", lang)}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: muted, lineHeight: 1.4 }}>
                {tn("sub", lang)}
              </p>
            </>
          )}
        </div>
        {state === "idle" && (
          <button
            onClick={handleDismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: muted, fontSize: 18, lineHeight: 1, padding: 2, flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {(state === "idle" || state === "loading") && (
        <input
          type="tel"
          placeholder={tn("phonePlaceholder", lang)}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 12,
            border: `1px solid ${border}`,
            background: isDark ? "#252525" : "#F5F5F7",
            color: textClr,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {(state === "idle" || state === "loading") && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleAllow}
            disabled={state === "loading"}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 999, border: "none",
              background: textClr, color: bg,
              fontSize: 13, fontWeight: 700, cursor: state === "loading" ? "default" : "pointer",
              opacity: state === "loading" ? 0.7 : 1,
              fontFamily: "inherit",
            }}
          >
            {state === "loading" ? "…" : tn("allow", lang)}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: "10px 16px", borderRadius: 999,
              border: `1px solid ${border}`, background: "transparent",
              color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {tn("dismiss", lang)}
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUpFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
