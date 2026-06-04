"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, X, Star, LogOut, Eye, EyeOff, ChevronRight,
  Phone, Receipt, ShieldCheck,
} from "lucide-react";
import { OrdersModal } from "./OrdersModal";
import type { Lang, Theme } from "./MenuTemplate";
import type { StoredOrder } from "./CartDrawer";

// ── Types ────────────────────────────────────────────────────────────────────

interface GuestSession {
  id: string;
  name: string | null;
  phone: string;
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
  /** Called when "История заказов" is tapped — parent should open OrdersModal */
  onOpenOrders: () => void;
  /** Marks new-order dot as seen when profile is opened */
  onSeen: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtCurrency(n: number, cur: string) {
  return `${n.toLocaleString("ru-RU")} ${cur}`;
}

const LS_KEY = "menu-guest-session";

function loadSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestSession;
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
  open,
  onClose,
  restaurantId,
  lang,
  theme,
  orders,
  whatsappPhone,
  onRefundRequest,
  onPartialRefund,
  onOpenOrders,
  onSeen,
}: ProfileSheetProps) {

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F5F5F7";
  const surface = isDark ? "#1E1E1E" : "#FFFFFF";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";
  const textPri = isDark ? "#E0E0E0" : "#111111";
  const textMut = isDark ? "#9A9A9A" : "#6B7280";
  const inputBg = isDark ? "#1A1A1A" : "#FFFFFF";

  // ── State ───────────────────────────────────────────────────────────────────
  const [session,     setSession]     = useState<GuestSession | null>(null);
  const [tab,         setTab]         = useState<"login" | "register">("login");
  const [name,        setName]        = useState("");
  const [phone,       setPhone]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [ordersOpen,  setOrdersOpen]  = useState(false);

  const firstOpenRef = useRef(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  // When sheet opens — clear error, mark seen
  useEffect(() => {
    if (!open) return;
    setError(null);
    onSeen();

    // Refresh balance in background
    if (session) {
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

    if (!firstOpenRef.current) firstOpenRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Auth actions ────────────────────────────────────────────────────────────

  // After login/register: if device already has a push subscription, re-link it to the guest
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
      }).catch(() => {/* fire-and-forget */});
    } catch { /* SW not available */ }
  }

  async function handleLogin() {
    if (!phone.trim() || !password) { setError("Заполните все поля"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/guest/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password, restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Ошибка входа"); return; }
      const s: GuestSession = { id: data.id, name: data.name, phone: data.phone, bonusAmount: data.bonusAmount };
      saveSession(s);
      setSession(s);
      setPhone(""); setPassword("");
      linkPushToGuest(data.id);
    } catch { setError("Нет соединения. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }

  async function handleRegister() {
    if (!phone.trim() || !password) { setError("Заполните все поля"); return; }
    if (password.length < 6)        { setError("Пароль — минимум 6 символов"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/guest/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, phone: phone.trim(), password, restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Ошибка регистрации"); return; }
      const s: GuestSession = { id: data.id, name: data.name, phone: data.phone, bonusAmount: data.bonusAmount };
      saveSession(s);
      setSession(s);
      setName(""); setPhone(""); setPassword("");
      linkPushToGuest(data.id);
    } catch { setError("Нет соединения. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setTab("login");
    setError(null);
  }

  // ── Common input style ────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
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
              ? (lang === "ru" ? "Мой профиль" : lang === "kz" ? "Менің профилім" : "My Profile")
              : (lang === "ru" ? "Войти / Зарегистрироваться" : lang === "kz" ? "Кіру / Тіркелу" : "Sign In / Sign Up")}
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
              session={session}
              orders={orders}
              isDark={isDark}
              surface={surface}
              border={border}
              textPri={textPri}
              textMut={textMut}
              lang={lang}
              onLogout={handleLogout}
              onOpenOrders={() => { onClose(); onOpenOrders(); }}
            />
          ) : (
            <AuthView
              tab={tab}
              setTab={setTab}
              name={name}           setName={setName}
              phone={phone}         setPhone={setPhone}
              password={password}   setPassword={setPassword}
              showPwd={showPwd}     setShowPwd={setShowPwd}
              loading={loading}
              error={error}
              inputStyle={inputStyle}
              isDark={isDark}
              surface={surface}
              border={border}
              textPri={textPri}
              textMut={textMut}
              lang={lang}
              onLogin={handleLogin}
              onRegister={handleRegister}
            />
          )}
        </div>
      </div>

      {/* Full OrdersModal — opened from within profile */}
      <OrdersModal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
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

// ── Auth view (tabs: login / register) ────────────────────────────────────────

function AuthView({
  tab, setTab,
  name, setName,
  phone, setPhone,
  password, setPassword,
  showPwd, setShowPwd,
  loading, error,
  inputStyle,
  isDark, surface, border, textPri, textMut,
  lang,
  onLogin, onRegister,
}: {
  tab: "login" | "register";
  setTab: (t: "login" | "register") => void;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPwd: boolean; setShowPwd: (v: boolean) => void;
  loading: boolean; error: string | null;
  inputStyle: (extra?: React.CSSProperties) => React.CSSProperties;
  isDark: boolean; surface: string; border: string; textPri: string; textMut: string;
  lang: Lang;
  onLogin: () => void; onRegister: () => void;
}) {
  const isRu = lang === "ru" || lang === "kz";

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
            {t === "login"
              ? (isRu ? "Вход" : "Sign In")
              : (isRu ? "Регистрация" : "Sign Up")}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "register" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
              {isRu ? "Имя (необязательно)" : "Name (optional)"}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isRu ? "Ваше имя" : "Your name"}
              style={inputStyle()}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
            {isRu ? "Номер телефона" : "Phone number"}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+7 700 000 00 00"
            style={inputStyle()}
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: textMut, display: "block", marginBottom: 6 }}>
            {isRu ? "Пароль" : "Password"}
            {tab === "register" && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                {isRu ? "(минимум 6 символов)" : "(min 6 chars)"}
              </span>
            )}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") tab === "login" ? onLogin() : onRegister(); }}
              placeholder={isRu ? "Введите пароль" : "Enter password"}
              style={inputStyle({ paddingRight: 48 })}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: "absolute", right: 14, top: "50%",
                transform: "translateY(-50%)",
                border: "none", background: "none",
                color: textMut, cursor: "pointer", padding: 4,
                display: "flex", alignItems: "center",
              }}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p style={{
            margin: 0, padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#EF4444", fontSize: 13,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={tab === "login" ? onLogin : onRegister}
          disabled={loading}
          style={{
            width: "100%", padding: "15px",
            borderRadius: 14, border: "none",
            background: loading ? "#6D28D9" : "#7C3AED",
            color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            marginTop: 4,
            fontFamily: "inherit",
            transition: "opacity 0.15s",
          }}
        >
          {loading
            ? (isRu ? "Подождите…" : "Please wait…")
            : tab === "login"
              ? (isRu ? "Войти" : "Sign In")
              : (isRu ? "Создать профиль" : "Create Profile")}
        </button>
      </div>

      {/* Switch tab hint */}
      <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: textMut }}>
        {tab === "login"
          ? (isRu ? "Ещё нет аккаунта?" : "No account yet?")
          : (isRu ? "Уже есть аккаунт?" : "Already have an account?")}{" "}
        <button
          onClick={() => setTab(tab === "login" ? "register" : "login")}
          style={{
            background: "none", border: "none",
            color: "#7C3AED", fontWeight: 700, fontSize: 13,
            cursor: "pointer", padding: 0, fontFamily: "inherit",
          }}
        >
          {tab === "login"
            ? (isRu ? "Зарегистрироваться" : "Sign up")
            : (isRu ? "Войти" : "Sign in")}
        </button>
      </p>
    </div>
  );
}

// ── Logged-in profile view ────────────────────────────────────────────────────

function LoggedInView({
  session, orders,
  isDark, surface, border, textPri, textMut,
  lang,
  onLogout, onOpenOrders,
}: {
  session: GuestSession;
  orders: StoredOrder[];
  isDark: boolean; surface: string; border: string; textPri: string; textMut: string;
  lang: Lang;
  onLogout: () => void;
  onOpenOrders: () => void;
}) {
  const isRu       = lang === "ru" || lang === "kz";
  const displayName = session.name?.trim() || session.phone;
  const initials    = displayName.slice(0, 2).toUpperCase();
  const recentOrders = orders.slice(0, 3);

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
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPri, lineHeight: 1.2 }}>
            {isRu ? `Привет, ${session.name || ""}!` : `Hi, ${session.name || ""}!`}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: textMut, display: "flex", alignItems: "center", gap: 5 }}>
            <Phone size={12} />
            {session.phone}
          </p>
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
            {isRu ? "Бонусные баллы" : "Bonus Points"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 900, color: isDark ? "#DDD6FE" : "#4C1D95", lineHeight: 1 }}>
            {session.bonusAmount.toLocaleString("ru-RU")}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: isDark ? "#A78BFA" : "#7C3AED" }}>
            {isRu ? "в этом заведении" : "at this venue"}
          </p>
        </div>
        <ShieldCheck size={18} color={isDark ? "#A78BFA" : "#7C3AED"} style={{ marginLeft: "auto" }} />
      </div>

      {/* Order history section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textPri }}>
            {isRu ? "История заказов" : "Order History"}
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
              {isRu ? "Все" : "All"} <ChevronRight size={14} />
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
              {isRu ? "Заказов пока нет" : "No orders yet"}
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
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textPri }}>
                    {fmtDate(order.timestamp)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: textMut }}>
                    {order.items.length} {isRu ? "позиций" : "items"}
                    {order.tableNumber ? ` · ${isRu ? "Стол" : "Table"} ${order.tableNumber}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textPri }}>
                    {fmtCurrency(order.total, order.currency)}
                  </p>
                  {order.status === "refund-requested" && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>
                      {isRu ? "Возврат" : "Refund"}
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
                {isRu ? `Показать все ${orders.length} заказа` : `Show all ${orders.length} orders`}
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
        {isRu ? "Выйти из аккаунта" : "Sign out"}
      </button>
    </div>
  );
}
