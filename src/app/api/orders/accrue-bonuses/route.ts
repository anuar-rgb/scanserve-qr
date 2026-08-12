import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";
import { log } from "@/lib/log";

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
// Idempotent: atomically claims bonuses_accrued with WHERE bonuses_accrued = false —
// prevents double-crediting even when two admin clicks arrive simultaneously.
export async function POST(req: NextRequest) {
  if (!getSessionRole(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { orderId?: string; restaurantId?: string };
  const { orderId, restaurantId } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!orderId || !restaurantId || !UUID_RE.test(orderId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = db();

  // Atomic claim: UPDATE WHERE bonuses_accrued = false atomically sets the flag AND
  // returns order data. Only one concurrent request succeeds — the other sees 0 rows.
  // This eliminates the TOCTOU race of the previous read → check → set pattern.
  const { data: claimed } = await supabase
    .from("orders")
    .update({ bonuses_accrued: true })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("bonuses_accrued", false)
    .select("id, guest_id, earned_bonuses");

  if (!claimed || claimed.length === 0) {
    // Either already accrued or order doesn't exist / wrong restaurant
    const { data: exists } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (!exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ ok: true, bonusesEarned: 0, alreadyAccrued: true });
  }

  const order = claimed[0];

  if (!order.guest_id) {
    return NextResponse.json({ ok: true, bonusesEarned: 0, noGuest: true });
  }

  const bonusesEarned = order.earned_bonuses ?? 0;

  if (bonusesEarned <= 0) {
    return NextResponse.json({ ok: true, bonusesEarned: 0 });
  }

  // Atomic balance increment via PostgreSQL function — prevents lost updates when two
  // accruals for different orders of the same guest run simultaneously (concurrent admin pays).
  const { data: newBalanceResult, error: rpcErr } = await supabase.rpc("adjust_guest_balance", {
    p_guest_id:      order.guest_id,
    p_restaurant_id: restaurantId,
    p_delta:         bonusesEarned,
  });

  if (rpcErr) {
    // Roll back the flag so a retry can succeed
    await supabase.from("orders").update({ bonuses_accrued: false }).eq("id", orderId);
    log.error("accrue_bonuses:rpc_failed", { error: rpcErr.message, orderId });
    return NextResponse.json({ error: "balance_update_failed", detail: rpcErr.message }, { status: 500 });
  }

  const newBalance = newBalanceResult as number;
  const oldBalance = newBalance - bonusesEarned;

  const desc = oldBalance < 0
    ? `Кешбэк за заказ (включая погашение задолженности ${Math.abs(oldBalance)} б)`
    : "Кешбэк за заказ";
  await supabase.from("bonus_transactions").insert({
    guest_id:      order.guest_id,
    restaurant_id: restaurantId,
    order_id:      orderId,
    type:          "earned",
    amount:        bonusesEarned,
    description:   desc,
  });

  return NextResponse.json({ ok: true, bonusesEarned, oldBalance, newBalance });
}
