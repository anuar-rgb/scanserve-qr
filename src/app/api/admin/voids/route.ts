import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RESTAURANT_ID } from "@/constants";
import { getSessionRole } from "@/lib/session";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/admin/voids — log a voided item
export async function POST(request: NextRequest) {
  if (!getSessionRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const {
    order_id, item_name, item_price, quantity,
    reason, void_type, voided_by, voided_by_name, table_number,
  } = body as Record<string, unknown>;

  if (!order_id || !item_name || !item_price || !quantity || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("order_voids")
    .insert({
      restaurant_id: RESTAURANT_ID,
      order_id,
      item_name,
      item_price: Number(item_price),
      quantity: Number(quantity),
      reason,
      void_type: (void_type as string) ?? "waste",
      voided_by: voided_by ?? null,
      voided_by_name: voided_by_name ?? null,
      table_number: table_number ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ void: data });
}

// GET /api/admin/voids?from=ISO&to=ISO — fetch voids for analytics
export async function GET(request: NextRequest) {
  if (!getSessionRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  let query = supabaseAdmin
    .from("order_voids")
    .select("id, order_id, item_name, item_price, quantity, reason, voided_by_name, table_number, created_at")
    .eq("restaurant_id", RESTAURANT_ID)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voids: data ?? [] });
}
