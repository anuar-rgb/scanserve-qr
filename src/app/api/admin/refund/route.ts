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

type RefundItem = {
  product_id?: string;
  name: string;
  qty: number;
  price: number;
};

// POST /api/admin/refund
// Body: { orderId, restaurantId, refundType: 'full'|'partial', refundItems?: RefundItem[], reason?: string }
export async function POST(req: NextRequest) {
  if (!getSessionRole(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    orderId?: string;
    restaurantId?: string;
    refundType?: "full" | "partial";
    refundItems?: RefundItem[];
    reason?: string;
  };

  const { orderId, restaurantId, refundType, refundItems = [], reason } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!orderId || !restaurantId || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  if (refundType !== "full" && refundType !== "partial") {
    return NextResponse.json({ error: "refundType must be full or partial" }, { status: 400 });
  }
  if (refundType === "partial" && (!refundItems || refundItems.length === 0)) {
    return NextResponse.json({ error: "refundItems required for partial refund" }, { status: 400 });
  }

  const supabase = db();

  // Fetch order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, guest_id, bonuses_deducted, earned_bonuses, bonuses_accrued, total_price, items_json, refund_status")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.refund_status) {
    return NextResponse.json({ error: "already_refunded", refundStatus: order.refund_status }, { status: 409 });
  }

  const guestId = order.guest_id as string | null;
  const bonusesDeducted = (order.bonuses_deducted as number | null) ?? 0;
  const earnedBonuses   = (order.earned_bonuses   as number | null) ?? 0;
  const bonusesAccrued  = (order.bonuses_accrued  as boolean | null) ?? false;
  const totalPrice      = (order.total_price       as number) ?? 0;

  let returnBonuses = 0;   // bonuses returned to guest (were spent on this order)
  let reverseEarned = 0;   // cashback to annul (was credited after payment)
  let newItemsJson: unknown[] | null = null;
  let newTotalPrice: number | null = null;

  if (refundType === "full") {
    returnBonuses = bonusesDeducted;
    reverseEarned = bonusesAccrued ? earnedBonuses : 0;
  } else {
    // Partial: calculate refund amount
    const refundAmount = refundItems.reduce((s, it) => s + it.price * it.qty, 0);

    // Spent bonuses: proportional to refund amount vs total
    returnBonuses = totalPrice > 0
      ? Math.round((refundAmount / totalPrice) * bonusesDeducted)
      : 0;

    // Earned bonuses: per-item lookup (NOT proportional — only dishes that had bonus_percent)
    if (bonusesAccrued) {
      const productIds = refundItems
        .map((it) => it.product_id)
        .filter((id): id is string => !!id && UUID_RE.test(id));

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, bonus_percent")
          .in("id", productIds);

        const bonusMap: Record<string, number> = {};
        for (const p of products ?? []) {
          if (p.bonus_percent && p.bonus_percent > 0) bonusMap[p.id] = Number(p.bonus_percent);
        }

        for (const item of refundItems) {
          if (!item.product_id || !bonusMap[item.product_id]) continue;
          reverseEarned += Math.round(item.qty * item.price * bonusMap[item.product_id] / 100);
        }
      }
    }

    // Update items_json: remove returned items
    const currentItems = Array.isArray(order.items_json) ? order.items_json as Array<Record<string, unknown>> : [];
    let remaining = [...currentItems];
    for (const ri of refundItems) {
      const idx = remaining.findIndex(
        (it) => it.name === ri.name && Number(it.price) === ri.price && (ri.product_id ? it.product_id === ri.product_id : true),
      );
      if (idx === -1) continue;
      const cur = remaining[idx];
      const curQty = Number(cur.qty ?? 1);
      if (curQty <= ri.qty) {
        remaining = remaining.filter((_, i) => i !== idx);
      } else {
        remaining = remaining.map((it, i) => i === idx ? { ...it, qty: curQty - ri.qty } : it);
      }
    }
    newItemsJson  = remaining;
    newTotalPrice = remaining.reduce((s, it) => s + Number(it.price ?? 0) * Number(it.qty ?? 1), 0);
  }

  const netBonusChange = returnBonuses - reverseEarned;

  // Update guest_balances if guest exists and net change is non-zero
  if (guestId && UUID_RE.test(guestId) && netBonusChange !== 0) {
    const { data: balance } = await supabase
      .from("guest_balances")
      .select("bonus_amount")
      .eq("guest_id", guestId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    const oldBalance = (balance?.bonus_amount ?? 0) as number;
    // Allow negative balance (overdraft) — guest owes the restaurant.
    // Debt is repaid automatically on next accrual (accrue-bonuses route).
    const newBalance = oldBalance + netBonusChange;

    const { error: balErr } = await supabase
      .from("guest_balances")
      .upsert(
        { guest_id: guestId, restaurant_id: restaurantId, bonus_amount: newBalance },
        { onConflict: "guest_id,restaurant_id" },
      );

    if (balErr) {
      console.error("[refund] guest_balances upsert failed:", balErr.message);
      return NextResponse.json({ error: "balance_update_failed", detail: balErr.message }, { status: 500 });
    }

    // Log bonus transactions
    const txRows = [];
    if (returnBonuses > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: restaurantId, order_id: orderId,
        type: "refund_spent", amount: returnBonuses,
        description: reason ? `Возврат (${refundType}): ${reason}` : `Возврат (${refundType})`,
      });
    }
    if (reverseEarned > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: restaurantId, order_id: orderId,
        type: "refund_earned", amount: -reverseEarned,
        description: reason ? `Аннулирование кешбэка (${refundType}): ${reason}` : `Аннулирование кешбэка (${refundType})`,
      });
    }
    if (txRows.length > 0) {
      await supabase.from("bonus_transactions").insert(txRows);
    }
  }

  // Update order
  const orderUpdate: Record<string, unknown> = {
    refund_status:      refundType,
    refunded_at:        new Date().toISOString(),
    refund_bonuses_ret: returnBonuses,
    refund_earned_rev:  reverseEarned,
  };
  if (refundType === "partial" && newItemsJson !== null) {
    orderUpdate.items_json  = newItemsJson;
    orderUpdate.total_price = newTotalPrice;
    // Update earned_bonuses to reflect the reversed cashback on returned items
    orderUpdate.earned_bonuses = Math.max(0, earnedBonuses - reverseEarned);
  }

  const { error: updateErr } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);

  if (updateErr) {
    console.error("[refund] order update failed:", updateErr.message);
    return NextResponse.json({ error: "order_update_failed", detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    refundType,
    returnBonuses,
    reverseEarned,
    netBonusChange,
    guestHadBonuses: !!guestId,
  });
}
