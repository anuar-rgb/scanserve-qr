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
// Uses orders.earned_bonuses (set at placement) when available.
// Idempotent: orders.bonuses_accrued flag prevents double-crediting.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { orderId?: string; restaurantId?: string };
  const { orderId, restaurantId } = body;

  if (!orderId || !restaurantId) {
    return NextResponse.json({ error: "orderId and restaurantId required" }, { status: 400 });
  }

  const supabase = db();

  // Try with earned_bonuses/bonuses_accrued; if columns missing, fall back to base select
  let order: {
    id: string;
    guest_id: string | null;
    items_json: unknown;
    total_price?: number;
    earned_bonuses?: number | null;
    bonuses_accrued?: boolean | null;
  } | null = null;

  const { data: orderFull, error: orderErrFull } = await supabase
    .from("orders")
    .select("id, guest_id, items_json, total_price, earned_bonuses, bonuses_accrued")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (orderErrFull) {
    // earned_bonuses or bonuses_accrued columns might not exist yet — try without them
    const { data: orderBase, error: orderErrBase } = await supabase
      .from("orders")
      .select("id, guest_id, items_json, total_price")
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single();
    if (orderErrBase || !orderBase) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    order = orderBase;
  } else {
    order = orderFull;
  }

  if (!order || !order.guest_id) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, noGuest: true });
  }

  // Idempotency guard — never credit twice for the same order
  if (order.bonuses_accrued) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, alreadyAccrued: true });
  }

  let bonusesEarned: number;
  let source: string;

  if (order.earned_bonuses != null && order.earned_bonuses > 0) {
    // Use the value frozen at order creation time (what the guest saw in checkout)
    bonusesEarned = order.earned_bonuses;
    source = "stored";
  } else {
    // Fallback: compute from items_json + current bonus_percent
    source = "computed";
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
      // Match CartDrawer formula: round per-unit price × bonus%, then × qty
      bonusesEarned += Math.round(item.price * pct / 100) * item.qty;
    }

    // Safety cap: bonuses cannot exceed 10% of order total (catches stale/wrong bonus_percent)
    const orderTotal = order.total_price ?? 0;
    const cap = Math.round(orderTotal * 0.10);
    if (bonusesEarned > cap) {
      console.warn(`[accrue-bonuses] computed ${bonusesEarned} but capping at ${cap} (10% of ${orderTotal})`);
      bonusesEarned = cap;
    }
  }

  if (bonusesEarned <= 0) {
    if (order.bonuses_accrued !== undefined) {
      await supabase.from("orders").update({ bonuses_accrued: true }).eq("id", orderId);
    }
    return NextResponse.json({ ok: true, bonusesEarned: 0, source });
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

  // Mark accrued to prevent double-crediting (only if column exists)
  if (order.bonuses_accrued !== undefined) {
    await supabase.from("orders").update({ bonuses_accrued: true }).eq("id", orderId);
  }

  return NextResponse.json({ ok: true, bonusesEarned, newBalance, source });
}
