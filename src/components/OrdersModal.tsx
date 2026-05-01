"use client";

import { useState } from "react";
import { X, ChevronLeft, Download, Share2 } from "lucide-react";
import type { Lang } from "./MenuTemplate";
import type { StoredOrder } from "./MenuTemplate";
import { downloadOrderPDF, shareOrderPDF } from "@/lib/receipt-pdf";

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 6, md: 12, lg: 16, full: 999 } as const;

export interface OrdersModalProps {
  open: boolean;
  onClose: () => void;
  orders: StoredOrder[];
  lang: Lang;
  theme: "dark" | "light";
  whatsappPhone?: string;
  onRefundRequest: (orderId: string) => void;
}

export function OrdersModal({
  open, onClose, orders, lang, theme, whatsappPhone, onRefundRequest,
}: OrdersModalProps) {
  const [pdfLoading, setPdfLoading]             = useState<string | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundItemIndex, setRefundItemIndex]   = useState<number | null>(null);
  const [refundReason, setRefundReason]         = useState("");
  const [refundContact, setRefundContact]       = useState("");
  const [showFieldError, setShowFieldError]     = useState(false);

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F8F9FA";
  const surface = isDark ? "#1C1C1C" : "#ECEEF0";
  const card    = isDark ? "#1E1E1E" : "#FFFFFF";
  const textClr = isDark ? "#E0E0E0" : "#121212";
  const muted   = isDark ? "#9A9A9A" : "#6B7280";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";

  const t = {
    title:        lang === "kz" ? "Менің тапсырыстарым"                        : lang === "ru" ? "Мои заказы"                               : "My Orders",
    empty:        lang === "kz" ? "Тапсырыстар жоқ"                             : lang === "ru" ? "Нет заказов"                              : "No orders yet",
    emptyHint:    lang === "kz" ? "Тапсырыс беріңіз, ол осында сақталады"       : lang === "ru" ? "Сделайте заказ — он сохранится здесь"      : "Place an order and it will appear here",
    refundAll:    lang === "kz" ? "🔄 Толық қайтару"                            : lang === "ru" ? "🔄 Полный возврат"                         : "🔄 Full Refund",
    refundItem:   lang === "kz" ? "↩ Қайтару"                                   : lang === "ru" ? "↩ Вернуть"                                : "↩ Refund",
    requested:    lang === "kz" ? "Сұраным жіберілді"                           : lang === "ru" ? "Запрос отправлен"                         : "Requested",
    total:        lang === "kz" ? "Барлығы"                                     : lang === "ru" ? "Итого"                                    : "Total",
    orderLbl:     lang === "kz" ? "Тапсырыс"                                    : lang === "ru" ? "Заказ"                                    : "Order",
    itemLbl:      lang === "kz" ? "Тауар"                                       : lang === "ru" ? "Позиция"                                  : "Item",
    // Refund form
    refundTitle:  lang === "kz" ? "Қайтару өтінімі"                             : lang === "ru" ? "Запрос на возврат"                        : "Refund Request",
    reasonLabel:  lang === "kz" ? "Қайтару себебі"                              : lang === "ru" ? "Причина возврата"                         : "Reason for Refund",
    reasonHint:   lang === "kz" ? "Себебін жазыңыз..."                          : lang === "ru" ? "Опишите причину..."                       : "Describe the reason...",
    contactLabel: lang === "kz" ? "Карта / Телефон нөмірі"                      : lang === "ru" ? "Номер карты / телефона"                   : "Card Number / Phone Number",
    contactHint:  lang === "kz" ? "+7 7XX XXX XX XX немесе карта нөмірі"        : lang === "ru" ? "+7 7XX XXX XX XX или номер карты"          : "+7 7XX XXX XX XX or card number",
    warning:      lang === "kz" ? "Банк деректемелерін мұқият тексеріңіз — қайтарымның сәтті болуы соған байланысты." : lang === "ru" ? "Внимательно проверьте реквизиты — от этого зависит успешность возврата." : "Please double-check your bank details carefully to ensure a successful refund.",
    sendRefund:   lang === "kz" ? "WhatsApp арқылы жіберу"                      : lang === "ru" ? "Отправить в WhatsApp"                     : "Send via WhatsApp",
    fillAll:      lang === "kz" ? "Барлық өрістерді толтырыңыз"                 : lang === "ru" ? "Заполните все поля"                       : "Please fill in all fields",
  };

  const WA: Record<string, Record<Lang, string>> = {
    fullHeader:    { en: "FULL ORDER CANCELLATION",  ru: "ПОЛНЫЙ ВОЗВРАТ ЗАКАЗА",        kz: "ТОЛЫҚ ТАПСЫРЫСТЫ ҚАЙТАРУ"  },
    partialHeader: { en: "PARTIAL REFUND REQUEST",   ru: "ЧАСТИЧНЫЙ ВОЗВРАТ",             kz: "ЖАРТЫЛАЙ ҚАЙТАРУ"          },
    orderLbl:      { en: "Order",                    ru: "Заказ",                         kz: "Тапсырыс"                  },
    dateLbl:       { en: "Date",                     ru: "Дата",                          kz: "Күн"                       },
    totalLbl:      { en: "Total",                    ru: "Итого",                         kz: "Барлығы"                   },
    itemLbl:       { en: "Item",                     ru: "Позиция",                       kz: "Тауар"                     },
    reason:        { en: "Reason",                   ru: "Причина",                       kz: "Себебі"                    },
    returnTo:      { en: "Return to",                ru: "Возврат на",                    kz: "Қайтару реквизиті"         },
  };
  const wm = (key: string): string => WA[key]?.[lang] ?? WA[key]?.en ?? key;

  const typeLabel = (type: string) =>
    type === "dine-in" ? (lang === "kz" ? "Мекемеде"    : lang === "ru" ? "В заведении" : "Dine-in")
    : type === "pickup" ? (lang === "kz" ? "Өзіңіз алу" : lang === "ru" ? "Самовывоз"   : "Pickup")
    : (lang === "kz" ? "Жеткізу" : lang === "ru" ? "Доставка" : "Delivery");

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const sorted = [...orders].sort((a, b) => b.timestamp - a.timestamp);
  const refundingOrder = refundingOrderId ? sorted.find((o) => o.id === refundingOrderId) ?? null : null;
  const isPartial      = refundItemIndex !== null;
  const refundingItem  = (refundingOrder && isPartial) ? refundingOrder.items[refundItemIndex!] : null;

  const openRefundForm = (order: StoredOrder, itemIndex?: number) => {
    if (order.status === "refund-requested") return;
    setRefundReason("");
    setRefundContact("");
    setShowFieldError(false);
    setRefundItemIndex(itemIndex ?? null);
    setRefundingOrderId(order.id);
  };

  const handleBack = () => {
    setRefundingOrderId(null);
    setRefundItemIndex(null);
    setRefundReason("");
    setRefundContact("");
    setShowFieldError(false);
  };

  const handleSendRefund = (order: StoredOrder) => {
    if (!refundReason.trim() || !refundContact.trim()) {
      setShowFieldError(true);
      return;
    }
    setShowFieldError(false);

    if (whatsappPhone) {
      const lines: string[] = [];
      if (isPartial && refundingItem) {
        lines.push(`*${wm("partialHeader")} — ${order.restaurantName}*`);
        lines.push(`• ${wm("orderLbl")}: ${order.id}`);
        lines.push(`• ${wm("dateLbl")}: ${formatDate(order.timestamp)}`);
        lines.push(`• ${wm("itemLbl")}: ${refundingItem.name} × ${refundingItem.qty} — ${(refundingItem.price * refundingItem.qty).toLocaleString()} ${refundingItem.currency}`);
        lines.push(``);
        lines.push(`• ${wm("reason")}: ${refundReason.trim()}`);
        lines.push(`• ${wm("returnTo")}: ${refundContact.trim()}`);
      } else {
        lines.push(`*${wm("fullHeader")} — ${order.restaurantName}*`);
        lines.push(`• ${wm("orderLbl")}: ${order.id}`);
        lines.push(`• ${wm("dateLbl")}: ${formatDate(order.timestamp)}`);
        lines.push(`• ${wm("totalLbl")}: ${order.total.toLocaleString()} ${order.currency}`);
        lines.push(``);
        lines.push(`• ${wm("reason")}: ${refundReason.trim()}`);
        lines.push(`• ${wm("returnTo")}: ${refundContact.trim()}`);
      }

      const clean = whatsappPhone.replace(/\D/g, "");
      window.open(`https://wa.me/${clean}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
    }

    if (!isPartial) onRefundRequest(order.id);
    setRefundingOrderId(null);
    setRefundItemIndex(null);
    setRefundReason("");
    setRefundContact("");
  };

  const handleDownload = async (order: StoredOrder) => {
    setPdfLoading(order.id + "_dl");
    try { await downloadOrderPDF(order); } finally { setPdfLoading(null); }
  };

  const handleShare = async (order: StoredOrder) => {
    setPdfLoading(order.id + "_sh");
    try { await shareOrderPDF(order); } finally { setPdfLoading(null); }
  };

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: R.full,
    border: `1px solid ${border}`, background: surface, color: textClr,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  };

  const inputBase = (filled: boolean): React.CSSProperties => ({
    display: "block", width: "100%", marginTop: SP.sm,
    padding: "13px 14px",
    background: surface,
    border: `1.5px solid ${filled ? textClr : border}`,
    borderRadius: R.md, color: textClr, fontSize: 15,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: muted,
    display: "block", marginBottom: SP.sm,
  };

  return (
    <>
      <div
        onClick={refundingOrder ? undefined : onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)", zIndex: 80,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s",
        }}
      />

      <div style={{
        position: "fixed", bottom: 0,
        left: "max(calc(50vw - 240px), 0px)", width: "min(100vw, 480px)",
        maxHeight: "88vh", background: bg,
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
        zIndex: 90, display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: textClr, overflow: "hidden",
      } as React.CSSProperties}>

        {/* Drag handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: border }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${SP.sm}px ${SP.md}px`, flexShrink: 0 }}>
          {refundingOrder ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
                <button onClick={handleBack} style={iconBtn}><ChevronLeft size={15} /></button>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t.refundTitle}</h2>
                  <p style={{ fontSize: 11, color: muted, margin: 0 }}>
                    {t.orderLbl}: {refundingOrder.id}
                    {refundingItem && ` — ${refundingItem.name}`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} style={iconBtn}><X size={15} /></button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t.title}</h2>
              <button onClick={onClose} style={iconBtn}><X size={15} /></button>
            </>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: `0 ${SP.md}px ${SP.xl}px` }}>
          {refundingOrder ? (
            /* ── Refund Form ── */
            <div style={{ paddingTop: SP.sm }}>

              {/* Item chip — shown only for partial refund */}
              {refundingItem && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", marginBottom: SP.md,
                  background: isDark ? "rgba(251,191,36,0.12)" : "rgba(217,119,6,0.10)",
                  border: `1px solid ${isDark ? "rgba(251,191,36,0.35)" : "rgba(217,119,6,0.35)"}`,
                  borderRadius: R.full,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#FCD34D" : "#B45309" }}>
                    {refundingItem.name} × {refundingItem.qty}
                  </span>
                  <span style={{ fontSize: 12, color: isDark ? "#FCD34D" : "#B45309", opacity: 0.8 }}>
                    {(refundingItem.price * refundingItem.qty).toLocaleString()} {refundingItem.currency}
                  </span>
                </div>
              )}

              {/* Warning notice */}
              <div style={{
                padding: SP.md, marginBottom: SP.lg,
                background: isDark ? "rgba(255,193,7,0.10)" : "rgba(255,152,0,0.10)",
                border: `1.5px solid ${isDark ? "rgba(255,193,7,0.35)" : "rgba(255,152,0,0.45)"}`,
                borderRadius: R.md,
                display: "flex", alignItems: "flex-start", gap: SP.sm,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>⚠️</span>
                <p style={{ fontSize: 13, color: isDark ? "#FFD54F" : "#BF6900", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {t.warning}
                </p>
              </div>

              {/* Reason */}
              <label style={{ display: "block", marginBottom: SP.lg }}>
                <span style={labelStyle}>{t.reasonLabel}</span>
                <textarea
                  autoFocus
                  value={refundReason}
                  onChange={(e) => { setRefundReason(e.target.value); setShowFieldError(false); }}
                  placeholder={t.reasonHint}
                  rows={3}
                  style={{ ...inputBase(refundReason.trim().length > 0), resize: "none" } as React.CSSProperties}
                />
              </label>

              {/* Card / Phone */}
              <label style={{ display: "block", marginBottom: showFieldError ? SP.sm : SP.lg }}>
                <span style={labelStyle}>{t.contactLabel}</span>
                <input
                  type="text"
                  value={refundContact}
                  onChange={(e) => { setRefundContact(e.target.value); setShowFieldError(false); }}
                  placeholder={t.contactHint}
                  style={inputBase(refundContact.trim().length > 0)}
                />
              </label>

              {showFieldError && (
                <p style={{ fontSize: 12, color: "#E05555", margin: `0 0 ${SP.md}px`, lineHeight: 1.4 }}>
                  {t.fillAll}
                </p>
              )}

              <button
                onClick={() => handleSendRefund(refundingOrder)}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: R.full, border: "none",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  letterSpacing: "0.02em", background: textClr, color: bg,
                }}
              >
                {t.sendRefund}
              </button>
            </div>
          ) : (
            /* ── Orders List ── */
            sorted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "52px 0", color: muted }}>
                <p style={{ fontSize: 44, margin: "0 0 12px" }}>📋</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: textClr, margin: "0 0 6px" }}>{t.empty}</p>
                <p style={{ fontSize: 13, margin: 0 }}>{t.emptyHint}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
                {sorted.map((order) => {
                  const isRequested = order.status === "refund-requested";
                  return (
                    <div key={order.id} style={{ background: card, borderRadius: R.md, border: `1px solid ${border}`, overflow: "hidden" }}>
                      {/* Order meta */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", background: surface, borderBottom: `1px solid ${border}`,
                      }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>{order.id}</p>
                          <p style={{ fontSize: 11, color: muted, margin: 0 }}>{formatDate(order.timestamp)}</p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {/* Download PDF */}
                          <button
                            onClick={() => handleDownload(order)}
                            disabled={pdfLoading !== null}
                            title="Download receipt"
                            style={{
                              width: 28, height: 28, borderRadius: R.full,
                              border: `1px solid ${border}`, background: surface,
                              color: pdfLoading === order.id + "_dl" ? muted : textClr,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: pdfLoading !== null ? "wait" : "pointer",
                              flexShrink: 0, opacity: pdfLoading === order.id + "_dl" ? 0.5 : 1,
                              transition: "opacity 0.15s",
                            }}
                          >
                            <Download size={13} />
                          </button>

                          {/* Share PDF */}
                          <button
                            onClick={() => handleShare(order)}
                            disabled={pdfLoading !== null}
                            title="Share receipt"
                            style={{
                              width: 28, height: 28, borderRadius: R.full,
                              border: `1px solid ${border}`, background: surface,
                              color: pdfLoading === order.id + "_sh" ? muted : textClr,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: pdfLoading !== null ? "wait" : "pointer",
                              flexShrink: 0, opacity: pdfLoading === order.id + "_sh" ? 0.5 : 1,
                              transition: "opacity 0.15s",
                            }}
                          >
                            <Share2 size={13} />
                          </button>

                          {/* Type / status badge */}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 8px",
                            borderRadius: R.full, letterSpacing: "0.04em",
                            backgroundColor: isRequested
                              ? "rgba(224,85,85,0.15)" : (isDark ? "rgba(109,184,109,0.15)" : "rgba(46,125,50,0.10)"),
                            color: isRequested ? "#E05555" : (isDark ? "#6DB86D" : "#2E7D32"),
                            border: `1px solid ${isRequested ? "#E05555" : (isDark ? "#6DB86D" : "#2E7D32")}`,
                          }}>
                            {isRequested ? `✓ ${t.requested}` : typeLabel(order.orderType)}
                          </span>
                        </div>
                      </div>

                      {/* Items — each with a per-item refund button */}
                      <div style={{ padding: "10px 14px 6px" }}>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: SP.xs }}>
                            <span style={{ color: muted, fontSize: 13, flex: 1 }}>{item.name} × {item.qty}</span>
                            <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                              {(item.price * item.qty).toLocaleString()} {item.currency}
                            </span>
                            {!isRequested && (
                              <button
                                onClick={() => openRefundForm(order, i)}
                                style={{
                                  flexShrink: 0,
                                  padding: "2px 8px",
                                  borderRadius: R.full,
                                  border: `1px solid ${isDark ? "rgba(251,191,36,0.45)" : "rgba(217,119,6,0.45)"}`,
                                  background: isDark ? "rgba(251,191,36,0.08)" : "rgba(217,119,6,0.07)",
                                  color: isDark ? "#FCD34D" : "#B45309",
                                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                                  letterSpacing: "0.01em", whiteSpace: "nowrap",
                                }}
                              >
                                {t.refundItem}
                              </button>
                            )}
                          </div>
                        ))}
                        <div style={{ borderTop: `1px solid ${border}`, paddingTop: SP.xs, marginTop: SP.xs, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                          <span>{t.total}</span>
                          <span>{order.total.toLocaleString()} {order.currency}</span>
                        </div>
                      </div>

                      {/* Full-order refund button */}
                      <div style={{ padding: "6px 14px 12px" }}>
                        <button
                          onClick={() => openRefundForm(order)}
                          disabled={isRequested}
                          style={{
                            width: "100%", padding: "8px 0", borderRadius: R.full,
                            border: `1px solid ${isRequested ? border : "#E05555"}`,
                            background: "transparent",
                            color: isRequested ? muted : "#E05555",
                            fontSize: 12, fontWeight: 700,
                            cursor: isRequested ? "default" : "pointer",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {isRequested ? `✓ ${t.requested}` : t.refundAll}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
