import type { StoredOrder } from "@/components/CartDrawer";
import type { Lang } from "@/lib/i18n";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";
import kz from "@/locales/kz.json";

// jsPDF is dynamically imported so it doesn't bloat the initial bundle.

const DICTS = { en, ru, kz } as const;

async function loadRobotoBase64(): Promise<string> {
  const resp = await fetch("/fonts/Roboto-Regular.ttf");
  const buf  = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildDoc(
  jsPDF: typeof import("jspdf").jsPDF,
  order: StoredOrder,
  lang: Lang,
  fontB64: string,
) {
  const r = DICTS[lang].receipt;

  const pageW  = 80;
  const perItem = 7;
  const pageH  = 102 + order.items.length * perItem;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, pageH] });

  // Embed Roboto for Cyrillic / Kazakh support
  doc.addFileToVFS("Roboto-Regular.ttf", fontB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", fontB64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const cx = pageW / 2;
  let y = 10;

  const hr = (dashed = false) => {
    doc.setDrawColor(160);
    doc.setLineWidth(0.25);
    if (dashed) {
      for (let x = 8; x < pageW - 8; x += 3) {
        doc.line(x, y, Math.min(x + 1.5, pageW - 8), y);
      }
    } else {
      doc.line(8, y, pageW - 8, y);
    }
    y += 4;
  };

  const row = (left: string, right: string, bold = false) => {
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.text(left,  8,          y);
    doc.text(right, pageW - 8,  y, { align: "right" });
    y += 5.5;
  };

  // ── Header ─────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("Roboto", "bold");
  doc.text(order.restaurantName, cx, y, { align: "center" });
  y += 4;

  doc.setFontSize(7);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(120);
  doc.text(r.title, cx, y, { align: "center" });
  doc.setTextColor(0);
  y += 5;

  hr();

  // ── Meta ───────────────────────────────────────────────
  doc.setFontSize(8);
  row(r.order, order.id, true);

  const dateStr = new Date(order.timestamp).toLocaleString(
    lang === "en" ? "en-US" : "ru-RU",
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
  );
  row(r.date, dateStr);

  const typeMap: Record<string, string> = {
    "dine-in":  r.dineIn,
    "pickup":   r.pickup,
    "delivery": r.delivery,
  };
  row(r.type, typeMap[order.orderType] ?? order.orderType);

  if (order.tableNumber) row(r.table, order.tableNumber);

  hr(true);

  // ── Items ──────────────────────────────────────────────
  doc.setFontSize(8);
  for (const item of order.items) {
    const label = `${item.name} × ${item.qty}`;
    const price = `${(item.price * item.qty).toLocaleString()} ${item.currency}`;

    const lines = doc.splitTextToSize(label, 42) as string[];
    doc.setFont("Roboto", "normal");
    lines.forEach((line: string, i: number) => {
      doc.text(line, 8, y + i * 4.5);
    });
    doc.text(price, pageW - 8, y, { align: "right" });
    y += Math.max(lines.length, 1) * 4.5 + 1.5;
  }

  y += 1;
  hr();

  // ── Total ──────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text(r.total, 8, y);
  doc.text(`${order.total.toLocaleString()} ${order.currency}`, pageW - 8, y, { align: "right" });
  y += 9;

  // ── Footer ─────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(100);
  doc.text(r.thanks, cx, y, { align: "center" });

  return doc;
}

export async function downloadOrderPDF(order: StoredOrder, lang: Lang = "en"): Promise<void> {
  const [{ jsPDF }, fontB64] = await Promise.all([
    import("jspdf"),
    loadRobotoBase64(),
  ]);
  const doc = buildDoc(jsPDF, order, lang, fontB64);
  doc.save(`order-${order.id}.pdf`);
}

export async function shareOrderPDF(order: StoredOrder, lang: Lang = "en"): Promise<void> {
  const [{ jsPDF }, fontB64] = await Promise.all([
    import("jspdf"),
    loadRobotoBase64(),
  ]);
  const doc = buildDoc(jsPDF, order, lang, fontB64);

  const blob   = doc.output("blob");
  const file   = new File([blob], `order-${order.id}.pdf`, { type: "application/pdf" });
  const nav    = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({
      title: `Receipt ${order.id}`,
      text:  `${order.restaurantName} — ${order.id}`,
      files: [file],
    });
  } else {
    doc.save(`order-${order.id}.pdf`);
  }
}
