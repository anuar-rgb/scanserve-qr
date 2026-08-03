"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, Download, Share2, Minus, Plus, Copy, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "./MenuTemplate";
import type { StoredOrder } from "./MenuTemplate";
import { downloadOrderPDF, shareOrderPDF } from "@/lib/receipt-pdf";

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 10, md: 20, lg: 24, full: 999 } as const;

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;
const canRefund = (timestamp: number) => Date.now() - timestamp < REFUND_WINDOW_MS;

export interface OrdersModalProps {
  open: boolean;
  onClose: () => void;
  orders: StoredOrder[];
  lang: Lang;
  theme: "dark" | "light";
  whatsappPhone?: string;
  onRefundRequest: (orderId: string) => void;
  onPartialRefund: (orderId: string, itemIndex: number, qtyReturned: number) => void;
  highlightOrderId?: string;
}

export function OrdersModal({
  open, onClose, orders, lang, theme, whatsappPhone, onRefundRequest, onPartialRefund,
  highlightOrderId,
}: OrdersModalProps) {
  const [pdfLoading, setPdfLoading]             = useState<string | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [refundItemIndex, setRefundItemIndex]   = useState<number | null>(null);
  const [refundReason, setRefundReason]         = useState("");
  const [refundContact, setRefundContact]       = useState("");
  const [showFieldError, setShowFieldError]     = useState(false);

  // Partial refund qty-picker dialog
  const [partialDialog, setPartialDialog] = useState<{
    order: StoredOrder;
    itemIndex: number;
    qty: number;
  } | null>(null);
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [refundSent,       setRefundSent]       = useState(false);
  const [copiedId,         setCopiedId]         = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted order when modal opens
  useEffect(() => {
    if (!open || !highlightOrderId) return;
    const timer = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-order-id="${highlightOrderId}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 380); // wait for slide-up animation
    return () => clearTimeout(timer);
  }, [open, highlightOrderId]);

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F5F5F7";
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
    // Qty picker
    qtyTitle:     lang === "kz" ? "Қанша қайтару?"                              : lang === "ru" ? "Сколько вернуть?"                         : "How many to return?",
    maxLbl:       lang === "kz" ? "Макс."                                       : lang === "ru" ? "Макс."                                    : "Max",
    confirmBtn:   lang === "kz" ? "Растау"                                      : lang === "ru" ? "Подтвердить"                              : "Confirm",
    cancelBtn:    lang === "kz" ? "Бас тарту"                                   : lang === "ru" ? "Отмена"                                   : "Cancel",
    pcs:          lang === "kz" ? "дана"                                        : lang === "ru" ? "шт."                                      : "pcs.",
    closeBtn:        lang === "kz" ? "Жабу"                                     : lang === "ru" ? "Закрыть"                                  : "Close",
    backBtn:         lang === "kz" ? "Тапсырыстарға оралу"                      : lang === "ru" ? "Вернуться к заказам"                       : "Back to Orders",
    refundConfirmed: lang === "kz" ? "Өтінім расталды ✓"                        : lang === "ru" ? "Возврат подтверждён ✓"                     : "Refund Confirmed ✓",
    refundExpired:   lang === "kz" ? "⏱ Қайтару мерзімі аяқталды"               : lang === "ru" ? "⏱ Время возврата истекло"                   : "⏱ Refund window expired",
    idCopied:        lang === "kz" ? "Тапсырыс нөмірі көшірілді"                : lang === "ru" ? "Номер заказа скопирован"                     : "Order ID copied",
    preorderLabel:   lang === "kz" ? "Алдын ала тапсырыс уақыты"                : lang === "ru" ? "Дата и время выдачи"                        : "Scheduled for",
  };

  const WA: Record<string, Record<Lang, string>> = {
    fullHeader:    { en: "FULL ORDER CANCELLATION",  ru: "ПОЛНЫЙ ВОЗВРАТ ЗАКАЗА",        kz: "ТОЛЫҚ ТАПСЫРЫСТЫ ҚАЙТАРУ"   },
    partialHeader: { en: "PARTIAL REFUND",           ru: "ЧАСТИЧНЫЙ ВОЗВРАТ",             kz: "ЖАРТЫЛАЙ ҚАЙТАРУ"           },
    orderLbl:      { en: "Order",                    ru: "Заказ",                         kz: "Тапсырыс"                   },
    dateLbl:       { en: "Date",                     ru: "Дата",                          kz: "Күн"                        },
    totalLbl:      { en: "Total",                    ru: "Итого",                         kz: "Барлығы"                    },
    itemLbl:       { en: "Item",                     ru: "Позиция",                       kz: "Тауар"                      },
    reason:        { en: "Reason",                   ru: "Причина",                       kz: "Себебі"                     },
    returnTo:      { en: "Return to",                ru: "Возврат на",                    kz: "Қайтару реквизиті"          },
    refundedQty:   { en: "Returned",                 ru: "Возвращено",                    kz: "Қайтарылды"                 },
    refundAmt:     { en: "Refund amount",            ru: "Сумма возврата",                kz: "Қайтарылатын сома"          },
    newTotal:      { en: "New total",                ru: "Новый итог",                    kz: "Жаңа жиыны"                 },
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

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => c === id ? null : c), 2000);
      toast.success(t.idCopied);
    } catch {
      // clipboard not available
    }
  };

  const sorted = [...orders].sort((a, b) => b.timestamp - a.timestamp);
  const refundingOrder = refundingOrderId ? sorted.find((o) => o.id === refundingOrderId) ?? null : null;
  const isPartial      = refundItemIndex !== null;
  const refundingItem  = (refundingOrder && isPartial) ? refundingOrder.items[refundItemIndex!] : null;

  const openRefundForm = (order: StoredOrder, itemIndex?: number) => {
    if (order.status === "refund-requested") return;
    if (!canRefund(order.timestamp)) return;
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
    setRefundSent(false);
  };

  // ── Partial qty-picker confirm ─────────────────────────────────────────────
  const handlePartialConfirm = () => {
    if (!partialDialog) return;
    const { order, itemIndex, qty } = partialDialog;
    if (!canRefund(order.timestamp)) {
      toast.error(t.refundExpired);
      closePartialDialog();
      return;
    }
    const item = order.items[itemIndex];
    if (!item) { setPartialDialog(null); return; }

    const refundAmountVal = item.price * qty;
    const newTotal = Math.max(0, order.total - refundAmountVal);

    if (whatsappPhone) {
      const lines = [
        `*${wm("partialHeader")} — ${order.restaurantName}*`,
        `• ${wm("orderLbl")}: ${order.id}`,
        `• ${wm("dateLbl")}: ${formatDate(order.timestamp)}`,
        `• ${wm("itemLbl")}: ${item.name}`,
        `• ${wm("refundedQty")}: ${qty} ${t.pcs}`,
        `• ${wm("refundAmt")}: ${refundAmountVal.toLocaleString()} ${item.currency}`,
        `• ${wm("newTotal")}: ${newTotal.toLocaleString()} ${order.currency}`,
      ];
      const clean = whatsappPhone.replace(/\D/g, "");
      const url = `https://wa.me/${clean}?text=${encodeURIComponent(lines.join("\n"))}`;
      if (isMobile) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else {
      toast.error("WhatsApp не настроен. Добавьте номер в Брендинге.");
    }

    onPartialRefund(order.id, itemIndex, qty);
    setPartialConfirmed(true);
  };

  const closePartialDialog = () => {
    setPartialDialog(null);
    setPartialConfirmed(false);
  };

  // ── Full / legacy partial refund form submit ───────────────────────────────
  const handleSendRefund = (order: StoredOrder) => {
    if (!canRefund(order.timestamp)) {
      toast.error(t.refundExpired);
      return;
    }
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
        lines.push(`• ${wm("itemLbl")}: ${refundingItem.name} × ${refundingItem.qty}`);
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
      const url = `https://wa.me/${clean}?text=${encodeURIComponent(lines.join("\n"))}`;
      if (isMobile) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else {
      toast.error("WhatsApp не настроен. Добавьте номер в Брендинге.");
    }

    if (!isPartial) onRefundRequest(order.id);
    setRefundSent(true);
  };

  const handleDownload = async (order: StoredOrder) => {
    setPdfLoading(order.id + "_dl");
    try { await downloadOrderPDF(order, lang); } finally { setPdfLoading(null); }
  };

  const handleShare = async (order: StoredOrder) => {
    setPdfLoading(order.id + "_sh");
    try { await shareOrderPDF(order, lang); } finally { setPdfLoading(null); }
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
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
        zIndex: 90, display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        fontFamily: "'Montserrat', system-ui, sans-serif",
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
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: `0 ${SP.md}px ${SP.xl}px` }}>
          {refundingOrder ? (
            /* ── Full-order Refund Form ── */
            <div style={{ paddingTop: SP.sm }}>

              {/* Item chip — shown only for legacy partial refund via form */}
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

              {refundSent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#6DB86D" : "#2E7D32", textAlign: "center", margin: `0 0 ${SP.xs}px` }}>
                    {t.refundConfirmed}
                  </p>
                  <button
                    onClick={handleBack}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: R.full,
                      border: `1.5px solid ${border}`, background: "transparent",
                      color: muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t.closeBtn}
                  </button>
                </div>
              ) : (
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
              )}
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
                  const isRequested  = order.status === "refund-requested";
                  const isExpired    = !isRequested && !canRefund(order.timestamp);
                  const isHighlighted = order.id === highlightOrderId;
                  return (
                    <div
                      key={order.id}
                      data-order-id={order.id}
                      style={{
                        background: card,
                        borderRadius: R.md,
                        border: isHighlighted
                          ? `2px solid #10B981`
                          : `1px solid ${border}`,
                        overflow: "hidden",
                        boxShadow: isHighlighted
                          ? "0 0 0 3px rgba(16,185,129,0.18)"
                          : undefined,
                      }}
                    >
                      {/* Order meta */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", background: surface, borderBottom: `1px solid ${border}`,
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                              {/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id)
                                ? order.id.substring(0, 8).toUpperCase()
                                : order.id}
                            </p>
                            <button
                              onClick={() => handleCopyId(order.id)}
                              title="Copy order ID"
                              style={{
                                width: 20, height: 20, borderRadius: 6,
                                border: "none", background: "transparent",
                                color: copiedId === order.id ? (isDark ? "#6DB86D" : "#2E7D32") : muted,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", padding: 0, flexShrink: 0,
                                transition: "color 0.2s",
                              }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
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

                      {/* Preorder highlight block */}
                      {order.timingMode === "preorder" && (order.preorderDate || order.preorderTime) && (
                        <div style={{
                          margin: "10px 14px 0",
                          padding: "10px 12px",
                          borderRadius: R.sm,
                          background: isDark ? "rgba(251,191,36,0.12)" : "rgba(245,158,11,0.10)",
                          border: `1px solid ${isDark ? "rgba(251,191,36,0.35)" : "rgba(217,119,6,0.35)"}`,
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <Calendar size={18} style={{ color: isDark ? "#FCD34D" : "#B45309", flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: isDark ? "#FCD34D" : "#B45309", margin: "0 0 2px" }}>
                              {t.preorderLabel}
                            </p>
                            <p style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#FDE68A" : "#92400E", margin: 0 }}>
                              {[order.preorderDate, order.preorderTime?.slice(0, 5)].filter(Boolean).join(lang === "en" ? " at " : " в ")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Items — each with a per-item partial refund button */}
                      <div style={{ padding: "10px 14px 6px" }}>
                        {order.items.length === 0 && (
                          <p style={{ fontSize: 12, color: muted, margin: "0 0 8px", fontStyle: "italic" }}>
                            {lang === "kz" ? "Тауарлар жоқ" : lang === "ru" ? "Нет позиций" : "No items"}
                          </p>
                        )}
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: SP.xs }}>
                            <span style={{ color: muted, fontSize: 13, flex: 1, minWidth: 0 }}>
                              {item.name} × {item.qty}
                              {item.discountPct && item.discountPct > 0 && (
                                <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, backgroundColor: "#FF4D6D", color: "#fff", verticalAlign: "middle", whiteSpace: "nowrap" }}>-{item.discountPct}%</span>
                              )}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }}>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <span style={{ textDecoration: "line-through", color: muted, fontWeight: 400, marginRight: 4, fontSize: 11 }}>{(item.originalPrice * item.qty).toLocaleString()}</span>
                              )}
                              {(item.price * item.qty).toLocaleString()} {item.currency}
                            </span>
                            {!isRequested && !isExpired && (
                              <button
                                onClick={() => setPartialDialog({ order, itemIndex: i, qty: 1 })}
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
                        {(order.bonusesDeducted ?? 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, color: "#10B981" }}>
                            <span>🌟 Бонусы</span>
                            <span style={{ fontWeight: 600 }}>−{order.bonusesDeducted!.toLocaleString()} {order.currency}</span>
                          </div>
                        )}
                        {(order.promoDiscount ?? 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, color: "#7C3AED" }}>
                            <span>🏷️ {order.promoCode}</span>
                            <span style={{ fontWeight: 600 }}>−{order.promoDiscount!.toLocaleString()} {order.currency}</span>
                          </div>
                        )}
                        <div style={{ borderTop: `1px solid ${border}`, paddingTop: SP.xs, marginTop: SP.xs, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                          <span>{t.total}</span>
                          <span>{order.total.toLocaleString()} {order.currency}</span>
                        </div>
                        {(order.earnedBonuses ?? 0) > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, fontWeight: 600, color: "#10B981" }}>
                            <span>⭐</span>
                            <span>+{order.earnedBonuses!.toLocaleString()} бонусов</span>
                          </div>
                        )}
                      </div>

                      {/* Full-order refund button */}
                      <div style={{ padding: "6px 14px 12px" }}>
                        <button
                          onClick={() => openRefundForm(order)}
                          disabled={isRequested || isExpired}
                          style={{
                            width: "100%", padding: "8px 0", borderRadius: R.full,
                            border: `1px solid ${(isRequested || isExpired) ? border : "#E05555"}`,
                            background: "transparent",
                            color: (isRequested || isExpired) ? muted : "#E05555",
                            fontSize: 12, fontWeight: 700,
                            cursor: (isRequested || isExpired) ? "default" : "pointer",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {isRequested ? `✓ ${t.requested}` : isExpired ? t.refundExpired : t.refundAll}
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

      {/* ── Partial Refund Qty-Picker Dialog ────────────────────────────────── */}
      {partialDialog && (() => {
        const item = partialDialog.order.items[partialDialog.itemIndex];
        if (!item) return null;
        const maxQty = item.qty;
        const currentQty = partialDialog.qty;
        const refundPreview = item.price * currentQty;

        return (
          <div
            onClick={closePartialDialog}
            style={{
              position: "fixed", inset: 0, zIndex: 110,
              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: SP.md,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(320px, 92vw)",
                background: card, borderRadius: R.lg,
                padding: SP.lg, boxShadow: "0 12px 48px rgba(0,0,0,0.45)",
                border: `1px solid ${border}`,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                color: textClr,
              }}
            >
              {/* Item name */}
              <p style={{ fontSize: 15, fontWeight: 700, margin: `0 0 ${SP.xs}px`, textAlign: "center" }}>
                {item.name}
              </p>
              <p style={{ fontSize: 12, color: muted, textAlign: "center", margin: `0 0 ${SP.lg}px` }}>
                {t.qtyTitle}
              </p>

              {/* Counter */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: SP.md, marginBottom: SP.sm,
              }}>
                <button
                  onClick={() => setPartialDialog((d) => d ? { ...d, qty: Math.max(1, d.qty - 1) } : d)}
                  style={{
                    width: 40, height: 40, borderRadius: R.full,
                    border: `1.5px solid ${border}`, background: surface,
                    color: textClr, fontSize: 20, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: currentQty <= 1 ? "default" : "pointer",
                    opacity: currentQty <= 1 ? 0.35 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <Minus size={16} />
                </button>

                <span style={{ fontSize: 28, fontWeight: 800, minWidth: 48, textAlign: "center" }}>
                  {currentQty}
                </span>

                <button
                  onClick={() => setPartialDialog((d) => d ? { ...d, qty: Math.min(maxQty, d.qty + 1) } : d)}
                  style={{
                    width: 40, height: 40, borderRadius: R.full,
                    border: `1.5px solid ${border}`, background: surface,
                    color: textClr, fontSize: 20, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: currentQty >= maxQty ? "default" : "pointer",
                    opacity: currentQty >= maxQty ? 0.35 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Max hint + price preview */}
              <p style={{ fontSize: 11, color: muted, textAlign: "center", margin: `0 0 ${SP.sm}px` }}>
                {t.maxLbl}: {maxQty} {t.pcs}
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#FCD34D" : "#B45309", textAlign: "center", margin: `0 0 ${SP.lg}px` }}>
                −{refundPreview.toLocaleString()} {item.currency}
              </p>

              {/* Buttons */}
              {partialConfirmed ? (
                <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#6DB86D" : "#2E7D32", textAlign: "center", margin: `0 0 ${SP.xs}px` }}>
                    {t.refundConfirmed}
                  </p>
                  <button
                    onClick={closePartialDialog}
                    style={{
                      padding: "11px 0", borderRadius: R.full,
                      border: `1.5px solid ${border}`, background: "transparent",
                      color: muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t.closeBtn}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: SP.sm }}>
                  <button
                    onClick={closePartialDialog}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: R.full,
                      border: `1.5px solid ${border}`, background: "transparent",
                      color: muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    onClick={handlePartialConfirm}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: R.full,
                      border: "none", background: textClr,
                      color: bg, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {t.confirmBtn}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
