import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const RID = (r: NextRequest) =>
  r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

const ALLOWED_ROLES = new Set(["owner", "manager", "supervisor", "courier"]);

// GET /api/admin/delivery-orders
// Returns active delivery orders for the restaurant
export async function GET(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, delivery_status, delivery_address, customer_phone, customer_name, customer_city, customer_comments, items_json, total_price, payment_method, created_at, order_type, tips_amount")
    .eq("restaurant_id", RID(request))
    .eq("type", "delivery")
    .not("status", "in", '("closed","cancelled")')
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// PATCH /api/admin/delivery-orders
// Update delivery_status for an order
export async function PATCH(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    orderId?: string;
    deliveryStatus?: string;
  } | null;

  if (!body?.orderId || !body?.deliveryStatus) {
    return NextResponse.json({ error: "orderId and deliveryStatus required" }, { status: 400 });
  }

  const VALID_STATUSES = ["ready", "accepted", "in_transit", "delivered"];
  if (!VALID_STATUSES.includes(body.deliveryStatus)) {
    return NextResponse.json({ error: "Invalid deliveryStatus" }, { status: 400 });
  }

  // Only owner/manager/supervisor can mark as ready (kitchen done)
  if (body.deliveryStatus === "ready" && !["owner", "manager", "supervisor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();
  const update: Record<string, string> = { delivery_status: body.deliveryStatus };

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", body.orderId)
    .eq("restaurant_id", RID(request));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/admin/delivery-orders/close — manager closes delivered order
export async function POST(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role || !["owner", "manager", "supervisor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const supabase = db();
  const { error } = await supabase
    .from("orders")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", body.orderId)
    .eq("restaurant_id", RID(request))
    .eq("delivery_status", "delivered");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
