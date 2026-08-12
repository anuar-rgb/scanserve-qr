"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const POS_ONLY_ROLES = new Set([
  "cashier", "waiter", "chef", "bartender", "hostess", "courier", "cleaner",
  "doorman", "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
]);
const ROLE_HOME: Record<string, string> = {
  courier:     "/admin/delivery",
  storekeeper: "/admin/warehouse",
  accountant:  "/admin/billing",
  cashier:     "/admin/invoices",
  cleaner:     "/admin/my-attendance",
  doorman:     "/admin/my-attendance",
};
function homeForRole(role: string): string {
  return ROLE_HOME[role] ?? (POS_ONLY_ROLES.has(role) ? "/admin/hall" : "/admin/analytics");
}

export default function AdminLogin() {
  const router = useRouter();

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Change-password step (first login)
  const [mode,        setMode]        = useState<"login" | "change">("login");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [changing,    setChanging]    = useState(false);

  const inputStyle: React.CSSProperties = {
    width:       "100%",
    background:  "rgba(255,255,255,0.06)",
    border:      "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color:       "#E0E0E0",
    padding:     "12px 14px",
    fontSize:    15,
    outline:     "none",
    boxSizing:   "border-box",
  };

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res  = await fetch("/api/admin/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json() as { ok?: boolean; role?: string; mustChangePassword?: boolean; error?: string };

    if (res.ok && data.mustChangePassword) {
      // Staff must set their own password before proceeding
      setMode("change");
      setLoading(false);
      return;
    }

    if (res.ok) {
      window.location.href = homeForRole(data.role ?? "");
    } else {
      setError(data.error ?? "Login failed.");
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPwd) { setError("Пароли не совпадают"); return; }
    if (newPassword.length < 8)    { setError("Минимум 8 символов"); return; }

    setChanging(true);
    setError("");

    const res  = await fetch("/api/admin/change-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, currentPassword: password, newPassword }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };

    if (res.ok) {
      // must_change_password only applies to owner/manager/supervisor
      window.location.href = "/admin/analytics";
    } else {
      setError(data.error ?? "Ошибка. Попробуйте ещё раз.");
      setChanging(false);
    }
  }

  return (
    <div
      style={{
        minHeight:       "100dvh",
        background:      "#0e0e0e",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         20,
        fontFamily:      "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width:      "100%",
          maxWidth:   380,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 20,
          border:     "1px solid rgba(255,255,255,0.08)",
          padding:    "36px 28px",
        }}
      >
        <h1 style={{ color: "#E0E0E0", fontSize: 22, fontWeight: 700, textAlign: "center", margin: "0 0 6px" }}>
          ScanServe
        </h1>
        <p style={{ color: "rgba(224,224,224,0.45)", fontSize: 14, textAlign: "center", margin: "0 0 28px" }}>
          Admin Panel
        </p>

        {/* ── Normal login ─────────────────────────────────────────────────── */}
        {mode === "login" && (
          <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
            {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background:   "#E0E0E0",
                color:        "#121212",
                border:       "none",
                borderRadius: 10,
                padding:      "13px 0",
                fontSize:     15,
                fontWeight:   700,
                cursor:       loading ? "wait" : "pointer",
                marginTop:    4,
                opacity:      loading ? 0.7 : 1,
                transition:   "opacity 0.15s",
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        {/* ── First login: set own password ─────────────────────────────── */}
        {mode === "change" && (
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          10,
              padding:      "12px 14px",
              background:   "rgba(124,58,237,0.12)",
              borderRadius: 10,
              border:       "1px solid rgba(124,58,237,0.3)",
            }}>
              <ShieldCheck size={18} style={{ color: "#A78BFA", flexShrink: 0 }} />
              <div>
                <p style={{ color: "#C4B5FD", fontSize: 13, fontWeight: 700, margin: 0 }}>
                  Задайте свой пароль
                </p>
                <p style={{ color: "rgba(196,181,253,0.7)", fontSize: 12, margin: "3px 0 0", lineHeight: 1.4 }}>
                  Администратор задал временный пароль. Придумайте свой — он будет известен только вам.
                </p>
              </div>
            </div>

            <input
              type="password"
              placeholder="Новый пароль (мин. 6 символов)"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError(""); }}
              autoComplete="new-password"
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Повторите новый пароль"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setError(""); }}
              autoComplete="new-password"
              required
              style={inputStyle}
            />

            {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={changing}
              style={{
                background:   "#7C3AED",
                color:        "#fff",
                border:       "none",
                borderRadius: 10,
                padding:      "13px 0",
                fontSize:     15,
                fontWeight:   700,
                cursor:       changing ? "wait" : "pointer",
                marginTop:    4,
                opacity:      changing ? 0.7 : 1,
                transition:   "opacity 0.15s",
              }}
            >
              {changing ? "Сохраняем…" : "Сохранить и войти"}
            </button>

            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setNewPassword(""); setConfirmPwd(""); }}
              style={{
                background:   "none",
                border:       "none",
                color:        "rgba(224,224,224,0.4)",
                fontSize:     13,
                cursor:       "pointer",
                padding:      0,
              }}
            >
              ← Назад
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
