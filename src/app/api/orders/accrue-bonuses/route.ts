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
// Called after admin marks order as "completed".
// Credits earned bonuses to the guest's balance.
// Uses orders.earned_bonuses (set at placement) when available — avoids re-computing
// from current bonus_percent values which may have changed since the order was placed.
// Idempotent: orders.bonuses_accrued flag prevents double-crediting.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { orderId?: string; restaurantId?: string };
  const { orderId, restaurantId } = body;

  if (!orderId || !restaurantId) {
    return NextResponse.json({ error: "orderId and restaurantId required" }, { status: 400 });
  }

  const supabase = db();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, guest_id, items_json, earned_bonuses, bonuses_accrued")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.guest_id) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, noGuest: true });
  }

  // Idempotency guard — never credit twice for the same order
  if (order.bonuses_accrued) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, alreadyAccrued: true });
  }

  let bonusesEarned: number;

  if (order.earned_bonuses != null && order.earned_bonuses > 0) {
    // Use the value computed and frozen at order creation time
    bonusesEarned = order.earned_bonuses;
  } else {
    // Fallback: compute from items_json + current bonus_percent (for orders placed before this fix)
    const orderItems: OrderItem[] = Array.isArray(order.items_json) ? order.items_json as OrderItem[] : [];
    const productIds = [...new Set(orderItems.map(i => i.product_id).filter(Boolean) as string[])];

    const productBonusMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, bonus_percent")
        .in("id", productIds);
      for (const p of products ?? []) {
        if (p.bonus_percent) productBonusMap[p.id] = Number(p.bonus_percent);
      }
    }

    bonusesEarned = 0;
    for (const item of orderItems) {
      if (!item.product_id) continue;
      const pct = productBonusMap[item.product_id] ?? 0;
      if (pct <= 0) continue;
      // Same rounding order as CartDrawer: round per-unit then multiply by qty
      bonusesEarned += Math.round(item.price * pct / 100) * item.qty;
    }
  }

  if (bonusesEarned <= 0) {
    // Mark accrued even if 0 so we don't re-process
    await supabase.from("orders").update({ bonuses_accrued: true }).eq("id", orderId);
    return NextResponse.json({ ok: true, bonusesEarned: 0 });
  }

  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", order.guest_id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const currentBalance = (balance?.bonus_amount ?? 0) as number;
  const newBalance = currentBalance + bonusesEarned;

  await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: order.guest_id, restaurant_id: restaurantId, bonus_amount: newBalance },
      { onConflict: "guest_id,restaurant_id" },
    );

  // Mark order as accrued — prevents double-crediting on retry
  await supabase.from("orders").update({ bonuses_accrued: true }).eq("id", orderId);

  return NextResponse.json({ ok: true, bonusesEarned, newBalance });
}
