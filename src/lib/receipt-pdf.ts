import type { StoredOrder } from "@/components/CartDrawer";

// jsPDF is dynamically imported so it doesn't bloat the initial bundle.

function buildDoc(jsPDF: typeof import("jspdf").jsPDF, order: StoredOrder) {
  const pageW  = 80;
  const perItem = 7;
  const pageH  = 102 + order.items.length * perItem;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, pageH] });

  const cx = pageW / 2;
  let y = 10;

  const hr = (dashed = false) => {
    doc.setDrawColor(160);
    doc.setLineWidth(0.25);
    if (dashed) {
      // approximate dashed line with short segments
      for (let x = 8; x < pageW - 8; x += 3) {
        doc.line(x, y, Math.min(x + 1.5, pageW - 8), y);
      }
    } else {
      doc.line(8, y, pageW - 8, y);
    }
    y += 4;
  };

  const row = (left: string, right: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(left,  8,          y);
    doc.text(right, pageW - 8,  y, { align: "right" });
    y += 5.5;
  };

  // ── Header ─────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(order.restaurantName, cx, y, { align: "center" });
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("RECEIPT", cx, y, { align: "center" });
  doc.setTextColor(0);
  y += 5;

  hr();

  // ── Meta ───────────────────────────────────────────────
  doc.setFontSize(8);
  row("ORDER",  order.id, true);

  const dateStr = new Date(order.timestamp).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  row("DATE",  dateStr);

  const typeLabel: Record<string, string> = {
    "dine-in":  "Dine-in",
    "pickup":   "Pickup",
    "delivery": "Delivery",
  };
  row("TYPE",  typeLabel[order.orderType] ?? order.orderType);

  if (order.tableNumber) row("TABLE", order.tableNumber);

  hr(true);

  // ── Items ──────────────────────────────────────────────
  doc.setFontSize(8);
  for (const item of order.items) {
    const label = `${item.name} × ${item.qty}`;
    const price = `${(item.price * item.qty).toLocaleString()} ${item.currency}`;

    // wrap long names
    const lines = doc.splitTextToSize(label, 42) as string[];
    doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 8, y);
  doc.text(`${order.total.toLocaleString()} ${order.currency}`, pageW - 8, y, { align: "right" });
  y += 9;

  // ── Footer ─────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text("Thank you for your visit!", cx, y, { align: "center" });

  return doc;
}

export async function downloadOrderPDF(order: StoredOrder): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = buildDoc(jsPDF, order);
  doc.save(`order-${order.id}.pdf`);
}

export async function shareOrderPDF(order: StoredOrder): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = buildDoc(jsPDF, order);

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
    // Fallback on desktop: just download
    doc.save(`order-${order.id}.pdf`);
  }
}
