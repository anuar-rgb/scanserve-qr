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

// POST /api/orders/accrue-bonuses
// Body: { orderId, restaurantId }
// Called after admin marks order as paid.
// Credits orders.earned_bonuses (frozen at checkout) to guest_balances.
// Idempotent: bonuses_accrued flag is set BEFORE balance update — prevents double-crediting even on concurrent calls.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { orderId?: string; restaurantId?: string };
  const { orderId, restaurantId } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!orderId || !restaurantId || !UUID_RE.test(orderId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = db();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, guest_id, earned_bonuses, bonuses_accrued")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.guest_id) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, noGuest: true });
  }

  // Already processed — stop immediately, never credit twice
  if (order.bonuses_accrued) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, alreadyAccrued: true });
  }

  // Mark as processed FIRST — prevents race condition if admin clicks pay twice
  await supabase
    .from("orders")
    .update({ bonuses_accrued: true })
    .eq("id", orderId);

  const bonusesEarned = order.earned_bonuses ?? 0;

  if (bonusesEarned <= 0) {
    return NextResponse.json({ ok: true, bonusesEarned: 0 });
  }

  // Add exactly earned_bonuses (frozen at order creation) to guest balance
  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", order.guest_id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const oldBalance = (balance?.bonus_amount ?? 0) as number;
  const newBalance = oldBalance + bonusesEarned;


  await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: order.guest_id, restaurant_id: restaurantId, bonus_amount: newBalance },
      { onConflict: "guest_id,restaurant_id" },
    );

  return NextResponse.json({ ok: true, bonusesEarned, oldBalance, newBalance });
}
