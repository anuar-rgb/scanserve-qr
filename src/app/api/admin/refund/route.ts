import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole, getSessionRestaurantId } from "@/lib/session";

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

type OrderItem = RefundItem & {
  currency: string;
  [key: string]: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function calcEarnedBonuses(
  supabase: ReturnType<typeof db>,
  items: OrderItem[],
): Promise<number> {
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean) as string[])];
  if (!ids.length) return 0;

  const { data: products } = await supabase
    .from("products")
    .select("id, bonus_percent")
    .in("id", ids);

  const pctMap: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.bonus_percent) pctMap[p.id] = Number(p.bonus_percent);
  }

  let total = 0;
  for (const item of items) {
    if (!item.product_id) continue;
    const pct = pctMap[item.product_id] ?? 0;
    if (pct > 0) total += Math.round(item.price * pct / 100) * item.qty;
  }
  return total;
}

// POST /api/admin/refund
// Body: { orderId, refundType: 'full'|'partial', refundItems?: RefundItem[] }
export async function POST(req: NextRequest) {
  const role        = getSessionRole(req);
  const sessionRid  = getSessionRestaurantId(req);
  if (!role || !sessionRid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    orderId?: string;
    refundType?: "full" | "partial";
    refundItems?: RefundItem[];
  };

  const { orderId, refundType, refundItems } = body;

  if (!orderId || (refundType !== "full" && refundType !== "partial")) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  if (refundType === "partial" && (!refundItems || refundItems.length === 0)) {
    return NextResponse.json({ error: "refundItems required for partial refund" }, { status: 400 });
  }

  const supabase = db();

  // Fetch order — scoped to session restaurant to prevent IDOR
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, restaurant_id, guest_id, bonuses_deducted, earned_bonuses, bonuses_accrued, total_price, items_json, refund_status, refund_bonuses_ret, refund_earned_rev, status")
    .eq("id", orderId)
    .eq("restaurant_id", sessionRid)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.refund_status) {
    return NextResponse.json({ error: "already_refunded" }, { status: 409 });
  }

  const guestId         = order.guest_id as string | null;
  const bonusesDeducted = (order.bonuses_deducted as number | null) ?? 0;
  const earnedBonuses   = (order.earned_bonuses   as number | null) ?? 0;
  const bonusesAccrued  = (order.bonuses_accrued  as boolean | null) ?? false;
  const totalPrice      = (order.total_price       as number) ?? 0;
  const currentItems    = Array.isArray(order.items_json) ? (order.items_json as OrderItem[]) : [];

  let returnBonuses = 0;
  let reverseEarned = 0;
  let newItemsJson:     OrderItem[] | null = null;
  let newTotalPrice:    number | null = null;
  let newEarnedBonuses: number | null = null;

  if (refundType === "full") {
    returnBonuses = bonusesDeducted;
    reverseEarned = bonusesAccrued ? earnedBonuses : 0;
  } else {
    // Partial: calculate refund amount from selected items
    const refundAmount = (refundItems ?? []).reduce(
      (sum, it) => sum + it.price * it.qty,
      0,
    );

    returnBonuses = totalPrice > 0
      ? Math.round((refundAmount / totalPrice) * bonusesDeducted)
      : 0;

    // Per-item reversal of earned bonuses (only if already accrued)
    if (bonusesAccrued) {
      const productIds = [...new Set(
        (refundItems ?? []).map((it) => it.product_id).filter(Boolean) as string[],
      )];

      let pctMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, bonus_percent")
          .in("id", productIds);
        for (const p of products ?? []) {
          if (p.bonus_percent) pctMap[p.id] = Number(p.bonus_percent);
        }
      }

      for (const item of refundItems ?? []) {
        if (!item.product_id || !pctMap[item.product_id]) continue;
        reverseEarned += Math.round(item.qty * item.price * pctMap[item.product_id] / 100);
      }
    }

    // Remove returned items from items_json
    let remaining = [...currentItems];
    for (const ri of refundItems ?? []) {
      const idx = remaining.findIndex(
        (it) => it.name === ri.name && Number(it.price) === Number(ri.price),
      );
      if (idx === -1) continue;
      const curQty = Number(remaining[idx].qty ?? 1);
      if (curQty <= ri.qty) {
        remaining = remaining.filter((_, i) => i !== idx);
      } else {
        remaining = remaining.map((it, i) =>
          i === idx ? { ...it, qty: curQty - ri.qty } : it,
        );
      }
    }

    newItemsJson     = remaining;
    newTotalPrice    = Math.max(0, totalPrice - (refundItems ?? []).reduce((s, it) => s + it.price * it.qty, 0) + returnBonuses);
    newEarnedBonuses = await calcEarnedBonuses(supabase, remaining);
  }

  // Only reverse balance if bonuses were actually accrued to the account
  const reverseEarnedForBalance = (refundType === "partial" && !bonusesAccrued) ? 0 : reverseEarned;
  const netBonusChange = returnBonuses - reverseEarnedForBalance;

  // Update guest_balances
  if (guestId && UUID_RE.test(guestId) && netBonusChange !== 0) {
    const { data: balance } = await supabase
      .from("guest_balances")
      .select("bonus_amount")
      .eq("guest_id", guestId)
      .eq("restaurant_id", sessionRid)
      .maybeSingle();

    const newBalance = ((balance?.bonus_amount ?? 0) as number) + netBonusChange;

    const { error: balErr } = await supabase
      .from("guest_balances")
      .upsert(
        { guest_id: guestId, restaurant_id: sessionRid, bonus_amount: newBalance },
        { onConflict: "guest_id,restaurant_id" },
      );

    if (balErr) {
      return NextResponse.json(
        { error: "balance_update_failed", detail: balErr.message },
        { status: 500 },
      );
    }

    const txRows = [];
    if (returnBonuses > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: sessionRid, order_id: orderId,
        type: "refund_spent", amount: returnBonuses,
        description: `Возврат (${refundType === "full" ? "полный" : "частичный"})`,
      });
    }
    if (reverseEarnedForBalance > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: sessionRid, order_id: orderId,
        type: "refund_earned", amount: -reverseEarnedForBalance,
        description: `Аннулирование кешбэка (${refundType === "full" ? "полный" : "частичный"})`,
      });
    }
    if (txRows.length > 0) {
      await supabase.from("bonus_transactions").insert(txRows);
    }
  }

  // Build order update
  const orderUpdate: Record<string, unknown> = {};

  if (refundType === "full") {
    orderUpdate.refund_status      = "full";
    orderUpdate.refunded_at        = new Date().toISOString();
    orderUpdate.refund_bonuses_ret = returnBonuses;
    orderUpdate.refund_earned_rev  = reverseEarned;
    if (bonusesAccrued && earnedBonuses > 0) {
      orderUpdate.earned_bonuses = 0;
    }
  } else {
    if (newItemsJson !== null) {
      orderUpdate.items_json       = newItemsJson;
      orderUpdate.total_price      = newTotalPrice;
      orderUpdate.earned_bonuses   = newEarnedBonuses ?? 0;
      orderUpdate.bonuses_deducted = Math.max(0, bonusesDeducted - returnBonuses);
    }
    // All items returned → treat as full
    if (newItemsJson !== null && newItemsJson.length === 0) {
      orderUpdate.refund_status = "full";
      orderUpdate.refunded_at   = new Date().toISOString();
    } else if (newItemsJson !== null) {
      orderUpdate.refund_status = "partial";
      orderUpdate.refunded_at   = new Date().toISOString();
    }
    orderUpdate.refund_bonuses_ret = (order.refund_bonuses_ret as number ?? 0) + returnBonuses;
    orderUpdate.refund_earned_rev  = (order.refund_earned_rev  as number ?? 0) + reverseEarned;
  }

  const { error: updateErr } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);

  if (updateErr) {
    return NextResponse.json(
      { error: "order_update_failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, returnBonuses, reverseEarned, netBonusChange });
}
