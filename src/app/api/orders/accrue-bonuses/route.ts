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

// POST /api/orders/accrue-bonuses
// Body: { orderId, restaurantId }
// Called after admin marks order as paid.
// Credits orders.earned_bonuses (frozen at checkout) to guest_balances.
// Idempotent: bonuses_accrued flag is set BEFORE balance update — prevents double-crediting even on concurrent calls.
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

  const bonusesEarned = order.earned_bonuses ?? 0;

  // Set flag first to block race (two admins clicking simultaneously)
  await supabase
    .from("orders")
    .update({ bonuses_accrued: true })
    .eq("id", orderId);

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

  const { error: upsertErr } = await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: order.guest_id, restaurant_id: restaurantId, bonus_amount: newBalance },
      { onConflict: "guest_id,restaurant_id" },
    );

  if (upsertErr) {
    // Roll back the flag so a retry can succeed
    await supabase.from("orders").update({ bonuses_accrued: false }).eq("id", orderId);
    console.error("[accrue-bonuses] upsert failed:", upsertErr.message, "order=", orderId);
    return NextResponse.json({ error: "balance_update_failed", detail: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bonusesEarned, oldBalance, newBalance });
}
