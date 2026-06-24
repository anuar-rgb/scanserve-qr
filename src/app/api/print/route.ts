// Node.js runtime required for net (TCP sockets) and Buffer
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { createClient } from "@supabase/supabase-js";
import { buildKitchenTicket, buildPreCheck, buildTestPage } from "@/lib/escpos";
import type { EscPosItem } from "@/lib/escpos";

// ── Supabase (server-side, uses service role if available) ────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ── TCP print ─────────────────────────────────────────────────────────────────

function sendToThermalPrinter(
  ip: string,
  port: number,
  data: Buffer,
  timeoutMs = 6000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      if (!socket.destroyed) socket.destroy();
      reject(new Error(msg));
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      if (!socket.destroyed) socket.destroy();
      resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => fail(`Принтер ${ip}:${port} — таймаут ${timeoutMs / 1000}с`));
    socket.on("error", (e) => fail(`Принтер ${ip}:${port} — ${e.message}`));

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        if (err) return fail(`Принтер ${ip}:${port} — ошибка записи: ${err.message}`);
        // Allow 800ms for the data to flush to the printer before closing
        setTimeout(ok, 800);
      });
    });
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrinterRow {
  id: string;
  printer_name: string;
  ip_address: string;
  port: number;
  categories: string[]; // array of category UUIDs; empty = catch-all
  is_active: boolean;
}

interface OrderItemJson {
  name: string;
  qty: number;
  price?: number;
  original_price?: number;
  modifiers?: { name: string }[];
  note?: string;
  category_id?: string;
}

interface PrintRequestBody {
  type: "kitchen" | "precheck" | "test";
  restaurantId: string;
  // For kitchen / precheck:
  order?: {
    id: string;
    type: string;
    created_at: string;
    table_number?: string | null;
    items_json?: unknown;
    total_price?: number;
    paid_amount?: number;
  };
  // For kitchen:
  tableLabel?: string;
  // For precheck:
  restaurantName?: string;
  waiterName?: string;
  // For test:
  printerId?: string;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = req.cookies.get("admin_session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PrintRequestBody;
  try {
    body = (await req.json()) as PrintRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // Fetch active printers for this restaurant
  const { data: printers, error: dbErr } = await sb
    .from("printer_settings")
    .select("id, printer_name, ip_address, port, categories, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const activePrinters = (printers ?? []) as PrinterRow[];

  // ── TEST ───────────────────────────────────────────────────────────────────
  if (type === "test") {
    const target = activePrinters.find((p) => p.id === body.printerId) ?? activePrinters[0];
    if (!target) return NextResponse.json({ noPrinters: true, results: [] });

    const data = buildTestPage(target.printer_name);
    try {
      await sendToThermalPrinter(target.ip_address, target.port, data);
      return NextResponse.json({ results: [{ printerName: target.printer_name, success: true }] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ results: [{ printerName: target.printer_name, success: false, error: msg }] });
    }
  }

  if (!body.order) return NextResponse.json({ error: "order required" }, { status: 400 });

  const order      = body.order;
  const rawItems   = Array.isArray(order.items_json) ? (order.items_json as OrderItemJson[]) : [];
  const escItems   = rawItems.map<EscPosItem>((it) => ({
    name:           it.name,
    qty:            it.qty,
    price:          it.price,
    original_price: it.original_price,
    modifiers:      it.modifiers,
    note:           it.note,
    categoryId:     it.category_id,
  }));

  if (activePrinters.length === 0) {
    return NextResponse.json({ noPrinters: true, results: [] });
  }

  // ── KITCHEN ────────────────────────────────────────────────────────────────
  if (type === "kitchen") {
    const tableLabel =
      body.tableLabel ??
      (order.type === "dine-in"  ? `Стол ${order.table_number ?? "—"}` :
       order.type === "delivery" ? "Доставка" : "С собой");

    // Route items to printers by category; catch-all printers get unmatched items
    const catchAlls  = activePrinters.filter((p) => !p.categories || p.categories.length === 0);
    const categoryPrinters = activePrinters.filter((p) => p.categories && p.categories.length > 0);

    // Build per-printer item lists
    const printerItems = new Map<string, EscPosItem[]>();
    for (const p of activePrinters) printerItems.set(p.id, []);

    for (const item of escItems) {
      const matched = categoryPrinters.filter(
        (p) => item.categoryId && p.categories.includes(item.categoryId),
      );
      if (matched.length > 0) {
        for (const p of matched) printerItems.get(p.id)!.push(item);
      } else {
        // No category match → send to catch-all printers
        for (const p of catchAlls) printerItems.get(p.id)!.push(item);
        // If no catch-all, send to all printers
        if (catchAlls.length === 0) {
          for (const p of activePrinters) printerItems.get(p.id)!.push(item);
        }
      }
    }

    const results = await Promise.all(
      activePrinters
        .filter((p) => (printerItems.get(p.id)?.length ?? 0) > 0)
        .map(async (p) => {
          const items = printerItems.get(p.id)!;
          const data = buildKitchenTicket({
            tableLabel,
            orderType: order.type,
            orderTime: order.created_at,
            orderId:   order.id,
            items,
            beep:      true,
          });
          try {
            await sendToThermalPrinter(p.ip_address, p.port, data);
            return { printerName: p.printer_name, success: true };
          } catch (e) {
            return { printerName: p.printer_name, success: false, error: e instanceof Error ? e.message : String(e) };
          }
        }),
    );

    return NextResponse.json({ noPrinters: false, results });
  }

  // ── PRECHECK ───────────────────────────────────────────────────────────────
  if (type === "precheck") {
    const tableLabel =
      body.tableLabel ??
      (order.type === "dine-in"  ? `Стол ${order.table_number ?? "—"}` :
       order.type === "delivery" ? "Доставка" : "С собой");

    const data = buildPreCheck({
      restaurantName: body.restaurantName ?? "Ресторан",
      tableLabel,
      waiterName:     body.waiterName ?? "—",
      orderId:        order.id,
      orderTime:      order.created_at,
      items:          escItems,
      totalPrice:     order.total_price ?? 0,
      paidAmount:     order.paid_amount ?? 0,
    });

    // Pre-check goes to the first catch-all printer (or first active printer)
    const target =
      activePrinters.find((p) => !p.categories || p.categories.length === 0) ??
      activePrinters[0];

    try {
      await sendToThermalPrinter(target.ip_address, target.port, data);
      return NextResponse.json({ noPrinters: false, results: [{ printerName: target.printer_name, success: true }] });
    } catch (e) {
      return NextResponse.json({
        noPrinters: false,
        results: [{ printerName: target.printer_name, success: false, error: e instanceof Error ? e.message : String(e) }],
      });
    }
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
