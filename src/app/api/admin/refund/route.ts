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

  // Atomic claim: SET refund_status first while WHERE refund_status IS NULL.
  // Only one concurrent admin click succeeds — the other sees 0 rows and gets 409.
  // This eliminates the TOCTOU race where two requests both read refund_status=null
  // and both proceed to update the guest balance.
  const { data: claimed } = await supabase
    .from("orders")
    .update({ refund_status: refundType, refunded_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .is("refund_status", null)
    .select("id, guest_id, bonuses_deducted, earned_bonuses, bonuses_accrued, total_price, items_json");

  if (!claimed || claimed.length === 0) {
    const { data: exists } = await supabase
      .from("orders")
      .select("id, refund_status")
      .eq("id", orderId)
      .maybeSingle();
    if (!exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ error: "already_refunded", refundStatus: exists.refund_status }, { status: 409 });
  }

  const order = claimed[0];
  const guestId         = order.guest_id as string | null;
  const bonusesDeducted = (order.bonuses_deducted as number | null) ?? 0;
  const earnedBonuses   = (order.earned_bonuses   as number | null) ?? 0;
  const bonusesAccrued  = (order.bonuses_accrued  as boolean | null) ?? false;
  const totalPrice      = (order.total_price       as number) ?? 0;

  let returnBonuses = 0;
  let reverseEarned = 0;
  let newItemsJson: unknown[] | null = null;
  let newTotalPrice: number | null   = null;

  if (refundType === "full") {
    returnBonuses = bonusesDeducted;
    reverseEarned = bonusesAccrued ? earnedBonuses : 0;
  } else {
    const refundAmount = refundItems.reduce((s, it) => s + it.price * it.qty, 0);

    returnBonuses = totalPrice > 0
      ? Math.round((refundAmount / totalPrice) * bonusesDeducted)
      : 0;

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

    const currentItems = Array.isArray(order.items_json)
      ? order.items_json as Array<Record<string, unknown>>
      : [];
    let remaining = [...currentItems];
    for (const ri of refundItems) {
      const idx = remaining.findIndex(
        (it) => it.name === ri.name && Number(it.price) === ri.price &&
                (ri.product_id ? it.product_id === ri.product_id : true),
      );
      if (idx === -1) continue;
      const curQty = Number(remaining[idx].qty ?? 1);
      if (curQty <= ri.qty) {
        remaining = remaining.filter((_, i) => i !== idx);
      } else {
        remaining = remaining.map((it, i) => i === idx ? { ...it, qty: curQty - ri.qty } : it);
      }
    }
    newItemsJson  = remaining;
    newTotalPrice = Math.max(0, totalPrice - refundAmount + returnBonuses);
  }

  const netBonusChange = returnBonuses - reverseEarned;

  if (guestId && UUID_RE.test(guestId) && netBonusChange !== 0) {
    // Atomic balance adjustment — prevents lost updates vs concurrent refund or accrual
    const { error: rpcErr } = await supabase.rpc("adjust_guest_balance", {
      p_guest_id:      guestId,
      p_restaurant_id: restaurantId,
      p_delta:         netBonusChange,
    });

    if (rpcErr) {
      // Rollback the refund claim so the admin can retry
      await supabase
        .from("orders")
        .update({ refund_status: null, refunded_at: null })
        .eq("id", orderId);
      console.error("[refund] adjust_guest_balance failed:", rpcErr.message);
      return NextResponse.json({ error: "balance_update_failed", detail: rpcErr.message }, { status: 500 });
    }

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

  // Write bonus amounts (and partial-specific fields) — refund_status already set in claim step
  const orderUpdate: Record<string, unknown> = {
    refund_bonuses_ret: returnBonuses,
    refund_earned_rev:  reverseEarned,
  };
  if (refundType === "partial" && newItemsJson !== null) {
    orderUpdate.items_json       = newItemsJson;
    orderUpdate.total_price      = newTotalPrice;
    orderUpdate.earned_bonuses   = Math.max(0, earnedBonuses - reverseEarned);
    orderUpdate.bonuses_deducted = Math.max(0, bonusesDeducted - returnBonuses);
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
