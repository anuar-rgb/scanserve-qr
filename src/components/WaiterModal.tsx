"use client";

import { useState } from "react";
import { X, Bell, Lock, ChevronRight, TableProperties } from "lucide-react";
import type { Lang } from "./MenuTemplate";

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 10, md: 20, lg: 24, full: 999 } as const;

type WaiterAction = "clean" | "bill" | "come" | "other";

export interface TableOption {
  id: string;
  label: string;
}

const T: Record<string, Record<Lang, string>> = {
  title:         { en: "Call Waiter",              ru: "Вызов официанта",             kz: "Даяшы шақыру"                  },
  tableLabel:    { en: "Table / Area",              ru: "Стол / Место",                kz: "Үстел / Орын"                  },
  tableHint:     { en: "e.g. Table 5, VIP",         ru: "Напр.: Стол 5, VIP",          kz: "Мыс.: Үстел 5, VIP"            },
  tablePlaceholder: { en: "Select a table...",      ru: "Выберите стол...",            kz: "Үстел таңдаңыз..."             },
  tableRequired: { en: "Please select your table.", ru: "Выберите номер стола.",       kz: "Үстел нөмірін таңдаңыз."       },
  tablePickerTitle: { en: "Select a Table",         ru: "Выберите стол",               kz: "Үстел таңдаңыз"                },
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
  initialTableNumber?: string;
  tables?: TableOption[];
}

export function WaiterModal({
  open,
  onClose,
  lang,
  theme,
  whatsappPhone = "77012345678",
  restaurantName,
  initialTableNumber,
  tables,
}: WaiterModalProps) {
  const [tableNumber, setTableNumber] = useState(initialTableNumber ?? "");
  const [action, setAction]           = useState<WaiterAction | null>(null);
  const [customText, setCustomText]   = useState("");
  const [showError, setShowError]     = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);

  const isTableLocked = Boolean(initialTableNumber);
  const hasTables     = tables && tables.length > 0;

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F5F5F7";
  const surface = isDark ? "#1C1C1C" : "#ECEEF0";
  const textClr = isDark ? "#E0E0E0" : "#121212";
  const muted   = isDark ? "#9A9A9A" : "#6B7280";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";

  const canSend = tableNumber.trim().length > 0 && action !== null && (action !== "other" || customText.trim().length > 0);

  const handleClose = () => {
    setAction(null);
    setCustomText("");
    setShowError(false);
    setPickerOpen(false);
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
      {/* Main backdrop */}
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

      {/* Main sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "max(calc(50vw - 240px), 0px)",
          width: "min(100vw, 480px)",
          maxHeight: "82vh",
          background: bg,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          fontFamily: "'Montserrat', system-ui, sans-serif",
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

          {/* Table field */}
          <div style={{ marginBottom: SP.lg }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: muted,
              display: "block", marginBottom: SP.sm,
            }}>
              {tn("tableLabel", lang)}
            </span>

            {isTableLocked ? (
              /* Locked — table from URL param */
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "13px 14px",
                background: surface,
                border: `1.5px solid ${border}`,
                borderRadius: R.md,
              }}>
                <Lock size={14} style={{ color: muted, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: textClr }}>{tableNumber}</span>
              </div>
            ) : hasTables ? (
              /* Picker button — opens table card grid */
              <>
                <button
                  type="button"
                  onClick={() => { setPickerOpen(true); setShowError(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "13px 14px",
                    background: surface,
                    border: `1.5px solid ${showError ? "#E05555" : tableNumber ? textClr : border}`,
                    borderRadius: R.md,
                    color: tableNumber ? textClr : muted,
                    fontSize: 15, cursor: "pointer",
                    textAlign: "left", boxSizing: "border-box",
                    fontFamily: "inherit", fontWeight: tableNumber ? 600 : 400,
                    transition: "border-color 0.15s",
                  } as React.CSSProperties}
                >
                  <TableProperties size={15} style={{ color: muted, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{tableNumber || tn("tablePlaceholder", lang)}</span>
                  <ChevronRight size={16} style={{ color: muted, flexShrink: 0 }} />
                </button>
                {showError && (
                  <p style={{ fontSize: 12, color: "#E05555", margin: "6px 0 0", lineHeight: 1.4 }}>
                    {tn("tableRequired", lang)}
                  </p>
                )}
              </>
            ) : (
              /* Fallback: plain text input (no tables in DB) */
              <>
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
              </>
            )}
          </div>

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

      {/* ── Table picker overlay ─────────────────────────────────────────────── */}
      {hasTables && (
        <>
          {/* Picker backdrop */}
          <div
            onClick={() => setPickerOpen(false)}
            style={{
              position: "fixed", inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 95,
              opacity: pickerOpen ? 1 : 0,
              pointerEvents: pickerOpen ? "auto" : "none",
              transition: "opacity 0.25s",
            }}
          />

          {/* Picker sheet */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "max(calc(50vw - 240px), 0px)",
              width: "min(100vw, 480px)",
              maxHeight: "72vh",
              background: bg,
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              transform: pickerOpen ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
              fontFamily: "'Montserrat', system-ui, sans-serif",
              color: textClr,
            } as React.CSSProperties}
          >
            {/* Drag handle */}
            <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: border }} />
            </div>

            {/* Picker header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${SP.sm}px ${SP.md}px` }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{tn("tablePickerTitle", lang)}</h3>
              <button onClick={() => setPickerOpen(false)} style={iconBtn}><X size={15} /></button>
            </div>

            {/* Table cards grid */}
            <div style={{
              flex: 1, overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              padding: `${SP.sm}px ${SP.md}px ${SP.xl}px`,
            }}>
              {tables!.map(t => {
                const selected = tableNumber === t.label;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTableNumber(t.label); setPickerOpen(false); setShowError(false); }}
                    style={{
                      aspectRatio: "1",
                      borderRadius: R.md,
                      border: `2px solid ${selected ? textClr : border}`,
                      background: selected
                        ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)")
                        : surface,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      color: selected ? textClr : muted,
                      fontFamily: "inherit",
                      padding: 8,
                    } as React.CSSProperties}
                  >
                    <span style={{ fontSize: 22 }}>🪑</span>
                    <span style={{
                      fontSize: 12, fontWeight: selected ? 700 : 500,
                      lineHeight: 1.2, textAlign: "center",
                      color: selected ? textClr : textClr,
                      wordBreak: "break-word",
                    }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
