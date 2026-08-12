import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Idempotency guard: each orderId is processed at most once per server instance.
// Cleared hourly to prevent unbounded memory growth.
const processedOrders = new Set<string>();
if (typeof setInterval !== "undefined") {
  setInterval(() => processedOrders.clear(), 60 * 60 * 1000);
}

// POST /api/orders/decrement-limits
// Body: { orderId: string }
//
// Called fire-and-forget after a guest places an order.
// Fetches the order's items_json, then decrements remaining_qty for each product
// that has a limit set (remaining_qty IS NOT NULL).
// Uses the decrement_product_qty SQL function for atomic GREATEST(0, qty - n) —
// prevents race conditions when two orders for the same limited product are placed simultaneously.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`decrement-limits:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { orderId?: string };
  const { orderId } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId обязателен" }, { status: 400 });
  }

  // Idempotency: skip if this order's limits were already decremented
  if (processedOrders.has(orderId)) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  processedOrders.add(orderId);

  const supabase = db();

  // Fetch the order to get its items
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("items_json")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  type OrderItem = { product_id?: string; qty: number };
  const orderItems = (order.items_json ?? []) as OrderItem[];

  // Aggregate qty by product_id
  const qtyByProduct: Record<string, number> = {};
  for (const item of orderItems) {
    if (!item.product_id) continue;
    qtyByProduct[item.product_id] = (qtyByProduct[item.product_id] ?? 0) + item.qty;
  }

  const productIds = Object.keys(qtyByProduct);
  if (productIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Fetch only IDs of limited-stock products — remaining_qty is computed server-side
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .not("remaining_qty", "is", null);

  if (!products || products.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Atomic decrement via PostgreSQL function — no read, no TOCTOU race.
  // decrement_product_qty does: UPDATE SET remaining_qty = GREATEST(0, remaining_qty - p_qty)
  // Row-level locking inside the UPDATE serializes concurrent calls for the same product.
  let updated = 0;
  for (const prod of products as { id: string }[]) {
    const deduct = qtyByProduct[prod.id] ?? 0;
    if (deduct <= 0) continue;
    const { error } = await supabase.rpc("decrement_product_qty", {
      p_product_id: prod.id,
      p_qty:        deduct,
    });
    if (!error) updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
