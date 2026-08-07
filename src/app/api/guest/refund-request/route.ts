import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// POST /api/guest/refund-request
// Body: { orderId, restaurantId, guestId, itemName, itemPrice, itemQty, productId?, refundType }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    orderId?: string;
    restaurantId?: string;
    guestId?: string;
    itemName?: string;
    itemPrice?: number;
    itemQty?: number;
    productId?: string;
    refundType?: "full" | "partial";
  };

  const { orderId, restaurantId, guestId, itemName, itemPrice = 0, itemQty = 1, productId, refundType = "partial" } = body;

  if (!orderId || !restaurantId || !guestId || !itemName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = db();

  // Verify order belongs to this guest
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, guest_id, status, created_at")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.guest_id !== guestId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ALLOWED_STATUSES = ["pending", "open", "completed"];
  if (!ALLOWED_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: "Order is not eligible for refund" }, { status: 409 });
  }
  // Enforce 3-hour window from order creation
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const orderAge = Date.now() - new Date(order.created_at as string).getTime();
  if (orderAge > THREE_HOURS_MS) {
    return NextResponse.json({ error: "refund_window_expired" }, { status: 409 });
  }

  // Check for duplicate pending requests
  if (refundType === "full") {
    const { data: existing } = await supabase
      .from("refund_requests")
      .select("id")
      .eq("order_id", orderId)
      .eq("refund_type", "full")
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "already_requested" }, { status: 409 });
    }
  } else if (refundType === "partial") {
    const { data: existing } = await supabase
      .from("refund_requests")
      .select("id")
      .eq("order_id", orderId)
      .eq("item_name", itemName)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "already_requested" }, { status: 409 });
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("refund_requests")
    .insert({
      restaurant_id: restaurantId,
      order_id: orderId,
      guest_id: guestId,
      item_name: itemName,
      item_price: itemPrice,
      item_qty: itemQty,
      product_id: productId ?? null,
      refund_type: refundType,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[refund-request] insert failed:", insertErr?.message);
    return NextResponse.json({ error: "insert_failed", detail: insertErr?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, requestId: inserted.id });
}

// GET /api/guest/refund-request?orderId=...&restaurantId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const restaurantId = searchParams.get("restaurantId");

  if (!orderId || !restaurantId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const supabase = db();

  const { data } = await supabase
    .from("refund_requests")
    .select("id, item_name, item_qty, refund_type, status, created_at")
    .eq("order_id", orderId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
