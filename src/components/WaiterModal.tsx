"use client";

import { useState } from "react";
import { X, Bell } from "lucide-react";
import type { Lang } from "./MenuTemplate";

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 6, md: 12, lg: 16, full: 999 } as const;

type WaiterAction = "clean" | "bill" | "come" | "other";

const T: Record<string, Record<Lang, string>> = {
  title:         { en: "Call Waiter",              ru: "Вызов официанта",             kz: "Даяшы шақыру"                  },
  tableLabel:    { en: "Table / Area",              ru: "Стол / Место",                kz: "Үстел / Орын"                  },
  tableHint:     { en: "e.g. Table 5, VIP",         ru: "Напр.: Стол 5, VIP",          kz: "Мыс.: Үстел 5, VIP"            },
  tableRequired: { en: "Please enter your table number or area name.", ru: "Укажите номер стола или название места.", kz: "Үстел нөмірін немесе орын атауын енгізіңіз." },
  actionClean:   { en: "Clean the Table",           ru: "Убрать со стола",             kz: "Столды жинау"                  },
  actionBill:    { en: "Bring Bill",                ru: "Принесите счёт",              kz: "Шот әкеліңіз"                  },
  actionCome:    { en: "Please come here",          ru: "Подойдите к столу",           kz: "Келіп жіберіңізші"             },
  actionOther:   { en: "Other",                     ru: "Другое",                      kz: "Басқа"                         },
  otherHint:     { en: "Describe your request...",  ru: "Опишите запрос...",           kz: "Сұрауыңызды жазыңыз..."        },
  send:          { en: "Send via WhatsApp",         ru: "Отправить в WhatsApp",        kz: "WhatsApp-қа жіберу"            },
  chooseAction:  { en: "Choose a request",          ru: "Выберите запрос",             kz: "Сұрауды таңдаңыз"              },
};

const tn = (key: string, lang: Lang): string => T[key]?.[lang] ?? T[key]?.en ?? key;

const ACTIONS: { id: WaiterAction; emoji: string; key: string }[] = [
  { id: "clean", emoji: "🧹", key: "actionClean" },
  { id: "bill",  emoji: "🧾", key: "actionBill"  },
  { id: "come",  emoji: "👋", key: "actionCome"  },
  { id: "other", emoji: "✏️", key: "actionOther" },
];

export interface WaiterModalProps {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  theme: "dark" | "light";
  whatsappPhone?: string;
  restaurantName: string;
}

export function WaiterModal({
  open,
  onClose,
  lang,
  theme,
  whatsappPhone = "77012345678",
  restaurantName,
}: WaiterModalProps) {
  const [tableNumber, setTableNumber] = useState("");
  const [action, setAction]           = useState<WaiterAction | null>(null);
  const [customText, setCustomText]   = useState("");
  const [showError, setShowError]     = useState(false);

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F8F9FA";
  const surface = isDark ? "#1C1C1C" : "#ECEEF0";
  const textClr = isDark ? "#E0E0E0" : "#121212";
  const muted   = isDark ? "#9A9A9A" : "#6B7280";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";

  const canSend = action !== null && (action !== "other" || customText.trim().length > 0);

  const handleClose = () => {
    setAction(null);
    setCustomText("");
    setShowError(false);
    onClose();
  };

  const handleSend = () => {
    if (!tableNumber.trim()) { setShowError(true); return; }
    if (!action) return;
    setShowError(false);

    const WA: Record<string, Record<Lang, string>> = {
      header:  { en: "WAITER CALL",         ru: "ВЫЗОВ ОФИЦИАНТА",  kz: "ДАЯШЫ ШАКЫРУ"   },
      table:   { en: "Table",               ru: "Стол",             kz: "Устел"           },
      request: { en: "Request",             ru: "Запрос",           kz: "Сурау"           },
    };
    const wm = (key: string): string => WA[key]?.[lang] ?? WA[key]?.en ?? key;

    const actionLabel =
      action === "clean" ? tn("actionClean", lang)
      : action === "bill" ? tn("actionBill", lang)
      : action === "come" ? tn("actionCome", lang)
      : customText.trim();

    const lines = [
      `[!] *${wm("header")}* — ${restaurantName}`,
      `• ${wm("table")}: ${tableNumber.trim()}`,
      `• ${wm("request")}: ${actionLabel}`,
    ];

    const text = encodeURIComponent(lines.join("\n"));
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
    handleClose();
  };

  const primaryBtn = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "14px 0", borderRadius: R.full, border: "none",
    fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    letterSpacing: "0.02em", transition: "background 0.2s, color 0.2s",
    background: disabled ? border : textClr,
    color: disabled ? muted : bg,
  });

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: R.full,
    border: `1px solid ${border}`, background: surface, color: textClr,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
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
          position: "fixed",
          bottom: 0,
          left: "max(calc(50vw - 240px), 0px)",
          width: "min(100vw, 480px)",
          maxHeight: "82vh",
          background: bg,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: textClr,
          overflow: "hidden",
        } as React.CSSProperties}
      >
        {/* Drag handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: border }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${SP.sm}px ${SP.md}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
            <Bell size={18} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tn("title", lang)}</h2>
          </div>
          <button onClick={handleClose} style={iconBtn}><X size={15} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: `${SP.sm}px ${SP.md}px ${SP.lg}px` }}>

          {/* Table number */}
          <label style={{ display: "block", marginBottom: SP.lg }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: muted,
              display: "block", marginBottom: SP.sm,
            }}>
              {tn("tableLabel", lang)}
            </span>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => { setTableNumber(e.target.value); setShowError(false); }}
              placeholder={tn("tableHint", lang)}
              style={{
                display: "block", width: "100%",
                padding: "13px 14px",
                background: surface,
                border: `1.5px solid ${showError ? "#E05555" : tableNumber.trim() ? textClr : border}`,
                borderRadius: R.md, color: textClr, fontSize: 15,
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
                fontFamily: "inherit",
              } as React.CSSProperties}
            />
            {showError && (
              <p style={{ fontSize: 12, color: "#E05555", margin: "6px 0 0", lineHeight: 1.4 }}>
                {tn("tableRequired", lang)}
              </p>
            )}
          </label>

          {/* Action label */}
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase", color: muted,
            margin: `0 0 ${SP.sm}px`,
          }}>
            {tn("chooseAction", lang)}
          </p>

          {/* 2×2 action grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.sm, marginBottom: SP.lg }}>
            {ACTIONS.map(({ id, emoji, key }) => {
              const sel = action === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAction(id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 8,
                    padding: "16px 12px",
                    background: sel
                      ? (isDark ? "rgba(245,245,245,0.10)" : "rgba(0,0,0,0.05)")
                      : surface,
                    border: `2px solid ${sel ? textClr : border}`,
                    borderRadius: R.lg,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    color: textClr,
                  }}
                >
                  <span style={{ fontSize: 28 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, lineHeight: 1.3, textAlign: "center" }}>
                    {tn(key, lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Free-text input for "Other" */}
          {action === "other" && (
            <label style={{ display: "block", marginBottom: SP.lg }}>
              <textarea
                autoFocus
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={tn("otherHint", lang)}
                rows={3}
                style={{
                  display: "block", width: "100%",
                  padding: "13px 14px",
                  background: surface,
                  border: `1.5px solid ${customText.trim() ? textClr : border}`,
                  borderRadius: R.md, color: textClr, fontSize: 15,
                  outline: "none", boxSizing: "border-box",
                  resize: "none",
                  transition: "border-color 0.15s",
                  fontFamily: "inherit",
                } as React.CSSProperties}
              />
            </label>
          )}
        </div>

        {/* Send button */}
        <div style={{ padding: SP.md, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={handleSend} disabled={!canSend} style={primaryBtn(!canSend)}>
            {tn("send", lang)}
          </button>
        </div>
      </div>
    </>
  );
}
