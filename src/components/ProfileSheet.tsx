"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, X, Star, LogOut, ChevronRight,
  Mail, Phone, Receipt, ShieldCheck, ArrowLeft, RefreshCw,
  Bell, BellOff, CheckCircle2,
} from "lucide-react";
import { OrdersModal } from "./OrdersModal";
import type { Lang, Theme } from "./MenuTemplate";
import type { StoredOrder } from "./CartDrawer";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GuestSession {
  id: string;
  name: string | null;
  phone: string | null;
  email: string;
  bonusAmount: number;
}

export interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  lang: Lang;
  theme: Theme;
  orders: StoredOrder[];
  whatsappPhone?: string;
  onRefundRequest: (orderId: string) => void;
  onPartialRefund: (orderId: string, itemIndex: number, qty: number) => void;
  onOpenOrders: () => void;
  onSeen: () => void;
  isDemo?: boolean;
}

const DEMO_SESSION: GuestSession = {
  id: "demo-guest-id",
  name: "Мади Бекенов",
  phone: "+7 (705) 555-77-88",
  email: "demo@scanserve.qr",
  bonusAmount: 340,
};

// ── Translations ────────────────────────────────────────────────────────────

const PT: Record<string, Record<string, string>> = {
  myProfile:          { en: "My Profile",                         ru: "Мой профиль",                              kz: "Менің профилім" },
  enterCode:          { en: "Enter Code",                         ru: "Введите код",                              kz: "Кодты енгізіңіз" },
  signInUp:           { en: "Sign In / Sign Up",                  ru: "Войти / Зарегистрироваться",               kz: "Кіру / Тіркелу" },
  demoError:          { en: "This is a demo — registration is disabled", ru: "Это демо — регистрация недоступна", kz: "Бұл демо — тіркелу мүмкін емес" },
  invalidEmail:       { en: "Please enter a valid email",         ru: "Введите корректный Email",                 kz: "Дұрыс Email енгізіңіз" },
  enterName:          { en: "Please enter your name",             ru: "Введите имя",                              kz: "Атыңызды енгізіңіз" },
  enterPhone:         { en: "Please enter your phone number",     ru: "Введите номер телефона",                   kz: "Телефон нөмірін енгізіңіз" },
  noConnection:       { en: "No connection. Please try again.",   ru: "Нет соединения. Попробуйте ещё раз.",      kz: "Байланыс жоқ. Қайталап көріңіз." },
  enterOtpCode:       { en: "Please enter the 6-digit code from email", ru: "Введите 6-значный код из письма",    kz: "Хаттан 6 таңбалы кодты енгізіңіз" },
  invalidCode:        { en: "Invalid code or it has expired",     ru: "Неверный код или срок действия истёк",     kz: "Код қате немесе мерзімі өтті" },
  genericError:       { en: "Error",                              ru: "Ошибка",                                   kz: "Қате" },
  signIn:             { en: "Sign In",                            ru: "Вход",                                     kz: "Кіру" },
  signUp:             { en: "Sign Up",                            ru: "Регистрация",                              kz: "Тіркелу" },
  yourName:           { en: "Your name",                          ru: "Ваше имя",                                 kz: "Атыңыз" },
  namePlaceholder:    { en: "Name",                               ru: "Имя",                                      kz: "Аты" },
  phoneNumber:        { en: "Phone number",                       ru: "Номер телефона",                           kz: "Телефон нөмірі" },
  yourEmail:          { en: "Your Email",                         ru: "Ваш Email",                                kz: "Email-іңіз" },
  sending:            { en: "Sending…",                           ru: "Отправляем…",                              kz: "Жіберуде…" },
  getCode:            { en: "Get Code",                           ru: "Получить код",                             kz: "Код алу" },
  signUpGetCode:      { en: "Sign Up & Get Code",                 ru: "Зарегистрироваться и получить код",        kz: "Тіркелу және код алу" },
  noAccountYet:       { en: "No account yet?",                    ru: "Ещё нет аккаунта?",                        kz: "Аккаунт жоқ па?" },
  haveAccount:        { en: "Already have an account?",           ru: "Уже есть аккаунт?",                        kz: "Аккаунтыңыз бар ма?" },
  signUpLink:         { en: "Sign up",                            ru: "Зарегистрироваться",                       kz: "Тіркелу" },
  signInLink:         { en: "Sign in",                            ru: "Войти",                                    kz: "Кіру" },
  back:               { en: "Back",                               ru: "Назад",                                    kz: "Артқа" },
  codeSentPrefix:     { en: "Code sent to",                       ru: "Код отправлен на",                         kz: "Код жіберілді:" },
  checkSpam:          { en: "Check your inbox (and spam folder).",ru: "Проверьте почту (и папку «Спам»).",        kz: "Поштаңызды тексеріңіз («Спам» қалтасын да)." },
  codeFromEmail:      { en: "Code from email",                    ru: "Код из письма",                            kz: "Хаттан код" },
  verifying:          { en: "Verifying…",                         ru: "Проверяем…",                               kz: "Тексеруде…" },
  confirm:            { en: "Confirm",                            ru: "Подтвердить",                              kz: "Растау" },
  resendIn:           { en: "Resend in",                          ru: "Отправить снова через",                    kz: "Қайта жіберу:" },
  resend:             { en: "Resend code",                        ru: "Отправить снова",                          kz: "Кодты қайта жіберу" },
  hi:                 { en: "Hi",                                 ru: "Привет",                                   kz: "Сәлем" },
  bonusPoints:        { en: "Bonus Points",                       ru: "Бонусные баллы",                           kz: "Бонустық ұпайлар" },
  atThisVenue:        { en: "at this venue",                      ru: "в этом заведении",                         kz: "осы мекемеде" },
  notificationsOn:    { en: "Order notifications enabled",        ru: "Уведомления о заказах включены",           kz: "Тапсырыс хабарламалары қосылды" },
  notificationsOff:   { en: "Notifications blocked",             ru: "Уведомления отключены",                    kz: "Хабарламалар өшірілді" },
  notifDeniedHint:    { en: "You previously denied. To enable — allow manually in browser settings:", ru: "Вы ранее отказали. Чтобы включить — разрешите вручную в настройках браузера:", kz: "Сіз бұрын бас тарттыңыз. Қосу үшін — браузер параметрлерінде рұқсат беріңіз:" },
  notifStep1:         { en: "Tap the 🔒 icon in the address bar", ru: "Нажмите на значок 🔒 в адресной строке",  kz: "Мекенжай жолындағы 🔒 белгішесін түртіңіз" },
  notifStep2:         { en: "Select \"Site settings\"",          ru: "Выберите «Настройки сайта»",               kz: "«Сайт параметрлері» тармағын таңдаңыз" },
  notifStep3:         { en: "Set \"Notifications\" to \"Allow\"", ru: "В строке «Уведомления» выберите «Разрешить»", kz: "«Хабарламалар» жолынан «Рұқсат ету» таңдаңыз" },
  notifStep4:         { en: "Reload the page",                    ru: "Перезагрузите страницу",                   kz: "Бетті жаңартыңыз" },
  enableNotif:        { en: "Enable order notifications",         ru: "Включить уведомления о заказах",           kz: "Тапсырыс хабарламаларын қосу" },
  enablingNotif:      { en: "Enabling…",                          ru: "Подключаем…",                              kz: "Қосуда…" },
  orderHistory:       { en: "Order History",                      ru: "История заказов",                          kz: "Тапсырыс тарихы" },
  all:                { en: "All",                                ru: "Все",                                       kz: "Барлығы" },
  noOrders:           { en: "No orders yet",                      ru: "Заказов пока нет",                         kz: "Тапсырыстар жоқ" },
  items:              { en: "items",                              ru: "позиций",                                   kz: "тауар" },
  table:              { en: "Table",                              ru: "Стол",                                      kz: "Үстел" },
  refund:             { en: "Refund",                             ru: "Возврат",                                   kz: "Қайтару" },
  showAll:            { en: "Show all",                           ru: "Показать все",                              kz: "Барлығын көрсету" },
  ordersWord:         { en: "orders",                             ru: "заказа",                                    kz: "тапсырыс" },
  bonuses:            { en: "bonuses",                            ru: "бонусов",                                   kz: "бонус" },
  signOut:            { en: "Sign out",                           ru: "Выйти из аккаунта",                         kz: "Шығу" },
};

function pt(key: string, lang: Lang): string {
  return PT[key]?.[lang] ?? PT[key]?.en ?? key;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtCurrency(n: number, cur: string) {
  return `${n.toLocaleString("ru-RU")} ${cur}`;
}

const LS_KEY = "menu-guest-session";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

function loadSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GuestSession;
    // Legacy sessions (password-based) had phone but no email — treat as logged out
    if (!s.email) return null;
    return s;
  } catch { return null; }
}

function saveSession(s: GuestSession) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

function clearSession() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileSheet({
  open, onClose, restaurantId, lang, theme,
  orders, whatsappPhone,
  onRefundRequest, onPartialRefund, onOpenOrders, onSeen,
  isDemo = false,
}: ProfileSheetProps) {

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F5F5F7";
  const surface = isDark ? "#1E1E1E" : "#FFFFFF";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";
  const textPri = isDark ? "#E0E0E0" : "#111111";
  const textMut = isDark ? "#9A9A9A" : "#6B7280";
  const inputBg = isDark ? "#1A1A1A" : "#FFFFFF";

  // ── Session ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<GuestSession | null>(isDemo ? DEMO_SESSION : null);

  // ── Auth form state ──────────────────────────────────────────────────────
  const [tab,          setTab]          = useState<"login" | "register">("login");
  const [step,         setStep]         = useState<"form" | "otp">("form");
  const [email,        setEmail]        = useState("");
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [otp,          setOtp]          = useState("");
  const [isRegister,   setIsRegister]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [resendTimer,  setResendTimer]  = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDemo) setSession(loadSession());
  }, [isDemo]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    onSeen();
    if (session && !isDemo) {
      fetch(`/api/guest/profile?guestId=${session.id}&restaurantId=${restaurantId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.bonusAmount !== undefined) {
            const updated = { ...session, bonusAmount: d.bonusAmount };
            setSession(updated);
            saveSession(updated);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startResendTimer() {
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
    return {
      width: "100%", padding: "14px 16px",
      borderRadius: 14,
      border: `1.5px solid ${border}`,
      background: inputBg, color: textPri,
      fontSize: 15, outline: "none",
      boxSizing: "border-box",
      fontFamily: "inherit",
      ...extra,
    };
  }

  // ── Link push subscription to guest after auth ───────────────────────────
  async function linkPushToGuest(guestId: string) {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      fetch("/api/crm/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), guestId }),
      }).catch(() => {});
    } catch {}
  }

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (isDemo) {
      setError(pt("demoError", lang));
      return;
    }
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !trimEmail.includes("@")) {
      setError(pt("invalidEmail", lang)); return;
    }
    if (tab === "register") {
      if (!name.trim())  { setError(pt("enterName", lang)); return; }
      if (!phone.trim()) { setError(pt("enterPhone", lang)); return; }
    }

    setLoading(true); setError(null);
    try {
      const sb = getSupabaseBrowser();
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email: trimEmail,
        options: { shouldCreateUser: true },
      });
      if (otpErr) { setError(otpErr.message); return; }
      setIsRegister(tab === "register");
      setStep("otp");
      startResendTimer();
    } catch { setError(pt("noConnection", lang)); }
    finally   { setLoading(false); }
  }

  // ── Step 2: Verify OTP code ──────────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otp.trim();
    if (code.length < 6) { setError(pt("enterOtpCode", lang)); return; }

    setLoading(true); setError(null);
    try {
      const sb = getSupabaseBrowser();
      const { data, error: verifyErr } = await sb.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (verifyErr || !data.session) {
        setError(pt("invalidCode", lang)); return;
      }

      const accessToken = data.session.access_token;
      const res = await fetch("/api/guest/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          name:       isRegister ? name.trim()  : undefined,
          phone:      isRegister ? phone.trim() : undefined,
          restaurantId,
          isRegister,
        }),
      });
      const d = await res.json() as { error?: string; id: string; name: string | null; phone: string | null; email: string; bonusAmount: number };
      if (!res.ok) { setError(d.error ?? pt("genericError", lang)); return; }

      // Sign out from Supabase Auth (we manage our own session)
      await sb.auth.signOut();

      const s: GuestSession = {
        id: d.id, name: d.name, phone: d.phone,
        email: d.email, bonusAmount: d.bonusAmount,
      };
      saveSession(s);
      setSession(s);

      // Reset form
      setStep("form"); setOtp(""); setEmail(""); setName(""); setPhone("");

      linkPushToGuest(d.id);
    } catch { setError(pt("noConnection", lang)); }
    finally   { setLoading(false); }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setTab("login"); setStep("form");
    setEmail(""); setName(""); setPhone(""); setOtp("");
    setError(null);
  }

  function handleBack() {
    setStep("form"); setOtp(""); setError(null);
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(0);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 80,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0,
          left: "max(calc(50vw - 240px), 0px)",
          width: "min(100vw, 480px)",
          maxHeight: "88vh",
          background: bg,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
          zIndex: 90,
          display: "flex", flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        } as React.CSSProperties}
      >
        {/* Drag handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: border }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px 8px", flexShrink: 0,
        }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: textPri }}>
            {session
              ? pt("myProfile", lang)
              : step === "otp"
                ? pt("enterCode", lang)
                : pt("signInUp", lang)}
          </p>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 999,
              border: "none", background: surface,
              color: textMut, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 32px" }}>
          {session ? (
            <LoggedInView
              session={isDemo ? DEMO_SESSION : session}
              orders={isDemo ? [] : orders}
              isDark={isDark}
              surface={surface}
              border={border}
              textPri={textPri}
              textMut={textMut}
              lang={lang}
              isDemo={isDemo}
              onLogout={handleLogout}
              onOpenOrders={() => { onClose(); onOpenOrders(); }}
            />
          ) : step === "otp" ? (
            <OtpView
              email={email}
              otp={otp}
              setOtp={setOtp}
              loading={loading}
              error={error}
              resendTimer={resendTimer}
              inputStyle={inputStyle}
              isDark={isDark}
              surface={surface}
              border={border}
              textPri={textPri}
              textMut={textMut}
              lang={lang}
              onVerify={handleVerifyOtp}
              onBack={handleBack}
              onResend={async () => {
                setError(null);
                const sb = getSupabaseBrowser();
                await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
                startResendTimer();
              }}
            />
          ) : (
            <AuthView
              tab={tab}
              setTab={(t) => { setTab(t); setError(null); }}
              email={email}     setEmail={setEmail}
              name={name}       setName={setName}
              phone={phone}     setPhone={setPhone}
              loading={loading}
              error={error}
              inputStyle={inputStyle}
              isDark={isDark}
              surface={surface}
              border={border}
              textPri={textPri}
              textMut={textMut}
              lang={lang}
              onSend={handleSendOtp}
            />
          )}
        </div>
      </div>

      <OrdersModal
        open={false}
        onClose={() => {}}
        orders={orders}
        lang={lang}
        theme={theme}
        whatsappPhone={whatsappPhone}
        onRefundRequest={onRefundRequest}
        onPartialRefund={onPartialRefund}
      />
    </>
  );
}

// ── Phone mask: +7 (XXX) XXX-XX-XX ──────────────────────────────────────────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^[78]/, "").slice(0, 10);
  if (!digits) return "";
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 8);
  const p4 = digits.slice(8, 10);
  let out = `+7 (${p1}`;
  if (digits.length >= 4) out += `) ${p2}`;
  else if (digits.length === 3) out += `)`;
  if (digits.length >= 7) out += `-${p3}`;
  if (digits.length >= 9) out += `-${p4}`;
  return out;
}

// ── Auth form (step = "form") ─────────────────────────────────────────────────

function AuthView({
  tab, setTab,
  email, setEmail,
  name, setName,
  phone, setPhone,
  loading, error,
  inputStyle,
  isDark, surface, textPri, textMut, lang,
  onSend,
}: {
  tab: "login" | "register"; setTab: (t: "login" | "register") => void;
  email: string; setEmail: (v: string) => void;
  name: string;  setName:  (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  loading: boolean; error: string | null;
  inputStyle: (extra?: React.CSSProperties) => React.CSSProperties;
  isDark: boolean; surface: string; border?: string; textPri: string; textMut: string; lang: Lang;
  onSend: () => void;
}) {
  return (
    <div>
      {/* Tab switcher */}
      <div style={{
        display: "flex",
        background: isDark ? "#1A1A1A" : "#EBEBED",
        borderRadius: 14, padding: 4, gap: 4, marginBottom: 24,
      }}>
        {(["login", "register"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "10px 0",
              borderRadius: 10, border: "none",
              background: tab === t ? surface : "transparent",
              color: tab === t ? textPri : textMut,
              fontSize: 14, fontWeight: tab === t ? 700 : 500,
              cursor: "pointer",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {t === "login" ? pt("signIn", lang) : pt("signUp", lang)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Name — register only */}
        {tab === "register" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
              {pt("yourName", lang)}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={pt("namePlaceholder", lang)}
              style={inputStyle()}
              autoComplete="name"
            />
          </div>
        )}

        {/* Phone — register only */}
        {tab === "register" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
              {pt("phoneNumber", lang)}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                const newRaw = e.target.value;
                const newDigits = newRaw.replace(/\D/g, "").replace(/^[78]/, "").slice(0, 10);
                const oldDigits = phone.replace(/\D/g, "").replace(/^[78]/, "");
                if (newRaw.length < phone.length && newDigits.length >= oldDigits.length && oldDigits.length > 0) {
                  setPhone(formatPhone(oldDigits.slice(0, -1)));
                } else {
                  setPhone(formatPhone(newRaw));
                }
              }}
              placeholder="+7 (700) 000-00-00"
              style={inputStyle()}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        )}

        {/* Email — always */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
            {pt("yourEmail", lang)}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSend(); }}
            placeholder="example@mail.com"
            style={inputStyle()}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        {error && (
          <p style={{
            margin: 0, padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#EF4444", fontSize: 13,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={onSend}
          disabled={loading}
          style={{
            width: "100%", padding: "15px",
            borderRadius: 14, border: "none",
            background: "#7C3AED",
            color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            marginTop: 4, fontFamily: "inherit",
            transition: "opacity 0.15s",
          }}
        >
          {loading
            ? pt("sending", lang)
            : tab === "login"
              ? pt("getCode", lang)
              : pt("signUpGetCode", lang)}
        </button>
      </div>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: textMut }}>
        {tab === "login" ? pt("noAccountYet", lang) : pt("haveAccount", lang)}{" "}
        <button
          onClick={() => setTab(tab === "login" ? "register" : "login")}
          style={{
            background: "none", border: "none",
            color: "#7C3AED", fontWeight: 700, fontSize: 13,
            cursor: "pointer", padding: 0, fontFamily: "inherit",
          }}
        >
          {tab === "login" ? pt("signUpLink", lang) : pt("signInLink", lang)}
        </button>
      </p>
    </div>
  );
}

// ── OTP verification step ─────────────────────────────────────────────────────

function OtpView({
  email, otp, setOtp,
  loading, error,
  resendTimer,
  inputStyle,
  isDark, surface: _surface, border: _border, textPri: _textPri, textMut, lang,
  onVerify, onBack, onResend,
}: {
  email: string;
  otp: string; setOtp: (v: string) => void;
  loading: boolean; error: string | null;
  resendTimer: number;
  inputStyle: (extra?: React.CSSProperties) => React.CSSProperties;
  isDark: boolean; surface: string; border: string; textPri: string; textMut: string; lang: Lang;
  onVerify: () => void;
  onBack: () => void;
  onResend: () => void;
}) {
  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none",
          color: textMut, fontSize: 13, cursor: "pointer",
          padding: 0, fontFamily: "inherit", marginBottom: 24,
        }}
      >
        <ArrowLeft size={14} />
        {pt("back", lang)}
      </button>

      {/* Info */}
      <div style={{
        background: isDark ? "#1E2D1E" : "#F0FDF4",
        border: `1px solid ${isDark ? "#2A3D2A" : "#BBF7D0"}`,
        borderRadius: 14, padding: "14px 16px", marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: isDark ? "#86EFAC" : "#15803D", lineHeight: 1.5 }}>
          <Mail size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
          {pt("codeSentPrefix", lang)} {email}. {pt("checkSpam", lang)}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
            {pt("codeFromEmail", lang)}
          </label>
          <input
            type="text"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={e => { if (e.key === "Enter") onVerify(); }}
            placeholder="000000"
            style={inputStyle({ letterSpacing: "0.3em", textAlign: "center", fontSize: 22, fontWeight: 700 })}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />
        </div>

        {error && (
          <p style={{
            margin: 0, padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#EF4444", fontSize: 13,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={onVerify}
          disabled={loading || otp.length < 6}
          style={{
            width: "100%", padding: "15px",
            borderRadius: 14, border: "none",
            background: "#7C3AED",
            color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: (loading || otp.length < 6) ? "default" : "pointer",
            opacity: (loading || otp.length < 6) ? 0.6 : 1,
            fontFamily: "inherit", transition: "opacity 0.15s",
          }}
        >
          {loading ? pt("verifying", lang) : pt("confirm", lang)}
        </button>

        {/* Resend */}
        <div style={{ textAlign: "center", marginTop: 4 }}>
          {resendTimer > 0 ? (
            <p style={{ fontSize: 13, color: textMut, margin: 0 }}>
              <RefreshCw size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              {pt("resendIn", lang)} {resendTimer}с
            </p>
          ) : (
            <button
              onClick={onResend}
              style={{
                background: "none", border: "none",
                color: "#7C3AED", fontWeight: 600, fontSize: 13,
                cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              {pt("resend", lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Logged-in profile view ────────────────────────────────────────────────────

function LoggedInView({
  session, orders,
  isDark, surface, border, textPri: _textPri, textMut, lang,
  isDemo,
  onLogout, onOpenOrders,
}: {
  session: GuestSession;
  orders: StoredOrder[];
  isDark: boolean; surface: string; border: string; textPri: string; textMut: string; lang: Lang;
  isDemo?: boolean;
  onLogout: () => void;
  onOpenOrders: () => void;
}) {
  const displayName  = session.name?.trim() || session.email;
  const initials     = isDemo ? "МБ" : displayName.slice(0, 2).toUpperCase();
  const recentOrders = orders.slice(0, 3);

  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) { setPushPerm("unsupported"); return; }
    setPushPerm(Notification.permission);
  }, []);

  async function handleEnablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPerm(permission);
      if (permission === "granted" && VAPID_PUBLIC_KEY) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
        });
        await fetch("/api/crm/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), guestId: session.id }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    finally { setPushLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Avatar + greeting */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{initials}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-color)", lineHeight: 1.2 }}>
            {pt("hi", lang)}, {session.name || ""}!
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: textMut, display: "flex", alignItems: "center", gap: 5 }}>
            <Mail size={12} />
            {session.email}
          </p>
          {session.phone && (
            <p style={{ margin: "2px 0 0", fontSize: 13, color: textMut, display: "flex", alignItems: "center", gap: 5 }}>
              <Phone size={12} />
              {session.phone}
            </p>
          )}
        </div>
      </div>

      {/* Bonus balance card */}
      <div style={{
        background: isDark ? "#2D1F5E" : "#EDE9FE",
        borderRadius: 18, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "#7C3AED",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Star size={20} color="#fff" fill="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: isDark ? "#A78BFA" : "#6D28D9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {pt("bonusPoints", lang)}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 900, color: isDark ? "#DDD6FE" : "#4C1D95", lineHeight: 1 }}>
            {session.bonusAmount.toLocaleString("ru-RU")}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: isDark ? "#A78BFA" : "#7C3AED" }}>
            {pt("atThisVenue", lang)}
          </p>
        </div>
        <ShieldCheck size={18} color={isDark ? "#A78BFA" : "#7C3AED"} style={{ marginLeft: "auto" }} />
      </div>

      {/* Push notifications status */}
      {pushPerm !== "unsupported" && (
        pushPerm === "granted" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: isDark ? "#0D2B1F" : "#F0FDF4",
            border: `1px solid ${isDark ? "#1A4D35" : "#BBF7D0"}`,
            borderRadius: 14, padding: "12px 16px",
          }}>
            <CheckCircle2 size={18} color="#10B981" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isDark ? "#6EE7B7" : "#065F46" }}>
              {pt("notificationsOn", lang)}
            </p>
          </div>
        ) : pushPerm === "denied" ? (
          <div style={{
            background: isDark ? "#2B1D0A" : "#FFFBEB",
            border: `1px solid ${isDark ? "#4D3210" : "#FDE68A"}`,
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <BellOff size={16} color={isDark ? "#FCD34D" : "#D97706"} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? "#FCD34D" : "#92400E" }}>
                {pt("notificationsOff", lang)}
              </p>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: isDark ? "#FDE68A" : "#78350F", lineHeight: 1.5 }}>
              {pt("notifDeniedHint", lang)}
            </p>
            <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {[pt("notifStep1", lang), pt("notifStep2", lang), pt("notifStep3", lang), pt("notifStep4", lang)].map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: isDark ? "#FDE68A" : "#78350F", lineHeight: 1.4 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <button
            onClick={handleEnablePush}
            disabled={pushLoading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "13px",
              borderRadius: 14, border: "none",
              background: isDark ? "#1E1030" : "#EDE9FE",
              color: isDark ? "#A78BFA" : "#5B21B6",
              fontSize: 14, fontWeight: 700,
              cursor: pushLoading ? "default" : "pointer",
              opacity: pushLoading ? 0.7 : 1,
              fontFamily: "inherit",
            }}
          >
            <Bell size={15} />
            {pushLoading ? pt("enablingNotif", lang) : pt("enableNotif", lang)}
          </button>
        )
      )}

      {/* Order history */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMut }}>
            {pt("orderHistory", lang)}
          </p>
          {orders.length > 0 && (
            <button
              onClick={onOpenOrders}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none",
                color: "#7C3AED", fontSize: 13, fontWeight: 600,
                cursor: "pointer", padding: 0, fontFamily: "inherit",
              }}
            >
              {pt("all", lang)} <ChevronRight size={14} />
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div style={{
            background: surface, borderRadius: 14,
            border: `1px solid ${border}`,
            padding: "20px 16px", textAlign: "center",
          }}>
            <Receipt size={28} color={textMut} style={{ margin: "0 auto 8px", display: "block" }} />
            <p style={{ margin: 0, fontSize: 13, color: textMut }}>
              {pt("noOrders", lang)}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentOrders.map(order => (
              <div
                key={order.id}
                style={{
                  background: surface, borderRadius: 14,
                  border: `1px solid ${border}`,
                  padding: "12px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textMut }}>
                    {fmtDate(order.timestamp)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: textMut }}>
                    {order.items.length} {pt("items", lang)}
                    {order.tableNumber ? ` · ${pt("table", lang)} ${order.tableNumber}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMut }}>
                    {fmtCurrency(order.total, order.currency)}
                  </p>
                  {(order.earnedBonuses ?? 0) > 0 && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#10B981", fontWeight: 600 }}>
                      +{order.earnedBonuses} {pt("bonuses", lang)}
                    </p>
                  )}
                  {order.status === "refund-requested" && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>
                      {pt("refund", lang)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {orders.length > 3 && (
              <button
                onClick={onOpenOrders}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: 14,
                  border: `1px solid ${border}`,
                  background: "none", color: "#7C3AED",
                  fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {pt("showAll", lang)} {orders.length} {pt("ordersWord", lang)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "13px",
          borderRadius: 14,
          border: `1px solid ${isDark ? "#3A1F1F" : "#FEE2E2"}`,
          background: isDark ? "rgba(239,68,68,0.07)" : "#FEF2F2",
          color: "#EF4444",
          fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <LogOut size={15} />
        {pt("signOut", lang)}
      </button>
    </div>
  );
}
