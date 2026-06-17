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

type OrderItem = {
  product_id?: string;
  price: number;
  qty: number;
};

// POST /api/orders/accrue-bonuses
// Body: { orderId, restaurantId }
// Called after admin marks order as "completed" — computes and credits earned bonuses to guest
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { orderId?: string; restaurantId?: string };
  const { orderId, restaurantId } = body;

  if (!orderId || !restaurantId) {
    return NextResponse.json({ error: "orderId and restaurantId required" }, { status: 400 });
  }

  const supabase = db();

  // Fetch order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, guest_id, items_json, used_bonuses, bonuses_deducted, bonuses_accrued")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotency: skip if already accrued
  if (order.bonuses_accrued) {
    return NextResponse.json({ ok: true, alreadyDone: true, bonusesEarned: 0 });
  }

  // If no guest linked — mark done and exit
  if (!order.guest_id) {
    await supabase.from("orders").update({ bonuses_accrued: true, bonuses_earned: 0 }).eq("id", orderId);
    return NextResponse.json({ ok: true, bonusesEarned: 0, noGuest: true });
  }

  // Parse items_json
  const orderItems: OrderItem[] = Array.isArray(order.items_json) ? order.items_json as OrderItem[] : [];

  // Collect unique product_ids
  const productIds = [...new Set(orderItems.map(i => i.product_id).filter(Boolean) as string[])];

  // Fetch bonus_percent for each product
  const productBonusMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, bonus_percent")
      .in("id", productIds);
    for (const p of products ?? []) {
      if (p.bonus_percent) productBonusMap[p.id] = p.bonus_percent;
    }
  }

  // Compute earned bonuses
  let bonusesEarned = 0;
  for (const item of orderItems) {
    if (!item.product_id) continue;
    const pct = productBonusMap[item.product_id] ?? 0;
    if (pct <= 0) continue;
    bonusesEarned += Math.round(item.price * item.qty * pct / 100);
  }

  const bonusesDeducted = (order.bonuses_deducted as number) ?? 0;

  // Update guest balance: +earned -deducted (floor at 0)
  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", order.guest_id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const currentBalance = (balance?.bonus_amount ?? 0) as number;
  const newBalance = Math.max(0, currentBalance + bonusesEarned - bonusesDeducted);

  await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: order.guest_id, restaurant_id: restaurantId, bonus_amount: newBalance },
      { onConflict: "guest_id,restaurant_id" },
    );

  // Mark order as accrued
  await supabase
    .from("orders")
    .update({ bonuses_accrued: true, bonuses_earned: bonusesEarned })
    .eq("id", orderId);

  return NextResponse.json({ ok: true, bonusesEarned, bonusesDeducted, newBalance });
}
