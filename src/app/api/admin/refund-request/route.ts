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

type ItemRow = { name: string; price: number; qty: number; product_id?: string; [key: string]: unknown };

async function calcEarnedBonuses(supabase: ReturnType<typeof db>, items: ItemRow[]): Promise<number> {
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean) as string[])];
  if (productIds.length === 0) return 0;

  const { data: products } = await supabase
    .from("products")
    .select("id, bonus_percent")
    .in("id", productIds);

  const pctMap: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.bonus_percent) pctMap[p.id] = Number(p.bonus_percent);
  }

  let total = 0;
  for (const item of items) {
    if (!item.product_id) continue;
    const pct = pctMap[item.product_id] ?? 0;
    if (pct <= 0) continue;
    total += Math.round(item.price * pct / 100) * item.qty;
  }
  return total;
}

// GET /api/admin/refund-request?orderId=...
export async function GET(req: NextRequest) {
  if (!getSessionRole(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const supabase = db();
  const { data } = await supabase
    .from("refund_requests")
    .select("id, order_id, item_name, item_price, item_qty, product_id, refund_type, status, admin_note, created_at")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return NextResponse.json(data ?? []);
}

// POST /api/admin/refund-request
// Body: { requestId, action: 'approve'|'reject', adminNote? }
export async function POST(req: NextRequest) {
  const role = getSessionRole(req);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = role;

  const body = await req.json().catch(() => ({})) as {
    requestId?: string;
    action?: "approve" | "reject";
    adminNote?: string;
  };

  const { requestId, action, adminNote } = body;

  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = db();

  // Fetch the refund request
  const { data: rr, error: rrErr } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (rrErr || !rr) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (rr.status !== "pending") {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  if (action === "reject") {
    await supabase
      .from("refund_requests")
      .update({ status: "rejected", admin_note: adminNote ?? null, resolved_at: new Date().toISOString(), resolved_by: adminId })
      .eq("id", requestId);

    return NextResponse.json({ ok: true, action: "rejected" });
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────────

  // Fetch the order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, restaurant_id, guest_id, bonuses_deducted, earned_bonuses, bonuses_accrued, total_price, items_json, refund_status, status")
    .eq("id", rr.order_id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const guestId       = order.guest_id as string | null;
  const restaurantId  = rr.restaurant_id as string;
  const bonusesDeducted = (order.bonuses_deducted as number | null) ?? 0;
  const earnedBonuses   = (order.earned_bonuses   as number | null) ?? 0;
  const bonusesAccrued  = (order.bonuses_accrued  as boolean | null) ?? false;
  const totalPrice      = (order.total_price       as number) ?? 0;
  const currentItems: ItemRow[] = Array.isArray(order.items_json) ? (order.items_json as ItemRow[]) : [];

  let returnBonuses = 0;
  let reverseEarned = 0;
  let newItemsJson: ItemRow[] | null = null;
  let newTotalPrice: number | null = null;
  let newEarnedBonuses: number | null = null;

  const orderStatus = (order.status as string) ?? "pending";

  if (rr.refund_type === "full") {
    returnBonuses = bonusesDeducted;
    reverseEarned = bonusesAccrued ? earnedBonuses : 0;
  } else {
    // Partial: find and remove item from items_json
    const refundQty   = rr.item_qty as number;
    const refundPrice = Number(rr.item_price);
    const refundName  = rr.item_name as string;
    const refundAmount = refundPrice * refundQty;

    returnBonuses = totalPrice > 0
      ? Math.round((refundAmount / totalPrice) * bonusesDeducted)
      : 0;

    if (bonusesAccrued && rr.product_id && UUID_RE.test(rr.product_id as string)) {
      const { data: product } = await supabase
        .from("products")
        .select("bonus_percent")
        .eq("id", rr.product_id)
        .maybeSingle();

      const pct = product?.bonus_percent ? Number(product.bonus_percent) : 0;
      if (pct > 0) reverseEarned = Math.round(refundQty * refundPrice * pct / 100);
    }

    // Remove item from items_json
    let remaining = [...currentItems];
    const idx = remaining.findIndex(
      (it) => it.name === refundName && Number(it.price) === refundPrice,
    );
    if (idx !== -1) {
      const curQty = Number(remaining[idx].qty ?? 1);
      if (curQty <= refundQty) {
        remaining = remaining.filter((_, i) => i !== idx);
      } else {
        remaining = remaining.map((it, i) => i === idx ? { ...it, qty: curQty - refundQty } : it);
      }
    }

    newItemsJson  = remaining;
    newTotalPrice = remaining.reduce((s, it) => s + Number(it.price ?? 0) * Number(it.qty ?? 1), 0);
    newEarnedBonuses = Math.max(0, earnedBonuses - reverseEarned);
  }

  const netBonusChange = returnBonuses - reverseEarned;

  // Update guest_balances
  if (guestId && UUID_RE.test(guestId) && netBonusChange !== 0) {
    const { data: balance } = await supabase
      .from("guest_balances")
      .select("bonus_amount")
      .eq("guest_id", guestId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    const oldBalance = (balance?.bonus_amount ?? 0) as number;
    const newBalance = Math.max(0, oldBalance + netBonusChange);

    const { error: balErr } = await supabase
      .from("guest_balances")
      .upsert(
        { guest_id: guestId, restaurant_id: restaurantId, bonus_amount: newBalance },
        { onConflict: "guest_id,restaurant_id" },
      );

    if (balErr) {
      return NextResponse.json({ error: "balance_update_failed", detail: balErr.message }, { status: 500 });
    }

    const txRows = [];
    if (returnBonuses > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: restaurantId, order_id: rr.order_id,
        type: "refund_spent", amount: returnBonuses,
        description: `Возврат по запросу гостя (${rr.refund_type})`,
      });
    }
    if (reverseEarned > 0) {
      txRows.push({
        guest_id: guestId, restaurant_id: restaurantId, order_id: rr.order_id,
        type: "refund_earned", amount: -reverseEarned,
        description: `Аннулирование кешбэка по запросу гостя (${rr.refund_type})`,
      });
    }
    if (txRows.length > 0) {
      await supabase.from("bonus_transactions").insert(txRows);
    }
  }

  // Update the order
  const orderUpdate: Record<string, unknown> = {};

  if (rr.refund_type === "full") {
    orderUpdate.refund_status      = "full";
    orderUpdate.refunded_at        = new Date().toISOString();
    orderUpdate.refund_bonuses_ret = returnBonuses;
    orderUpdate.refund_earned_rev  = reverseEarned;
    // Active (unpaid) order — cancel it so the table frees up immediately
    if (orderStatus === "pending") {
      orderUpdate.status     = "cancelled";
      orderUpdate.closed_at  = new Date().toISOString();
    }
  } else {
    // For partial from active order: update items, total, earned_bonuses
    if (newItemsJson !== null) {
      orderUpdate.items_json       = newItemsJson;
      orderUpdate.total_price      = newTotalPrice;
      if (newEarnedBonuses !== null) {
        orderUpdate.earned_bonuses = newEarnedBonuses;
      }
    }
    // All items removed via partial refunds — treat as full cancellation
    if (newItemsJson !== null && newItemsJson.length === 0) {
      orderUpdate.refund_status = "full";
      orderUpdate.refunded_at   = new Date().toISOString();
      orderUpdate.status        = "cancelled";
      orderUpdate.closed_at     = new Date().toISOString();
    }
  }

  if (Object.keys(orderUpdate).length > 0) {
    const { error: updateErr } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", rr.order_id);

    if (updateErr) {
      return NextResponse.json({ error: "order_update_failed", detail: updateErr.message }, { status: 500 });
    }
  }

  // Recalculate earned_bonuses for full refund on active order
  if (rr.refund_type === "full" && bonusesAccrued && earnedBonuses > 0) {
    await supabase
      .from("orders")
      .update({ earned_bonuses: 0 })
      .eq("id", rr.order_id);
  }

  // Mark request as approved
  await supabase
    .from("refund_requests")
    .update({ status: "approved", admin_note: adminNote ?? null, resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq("id", requestId);

  // Auto-reject any other pending requests for the same order (if full refund)
  if (rr.refund_type === "full") {
    await supabase
      .from("refund_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("order_id", rr.order_id)
      .eq("status", "pending")
      .neq("id", requestId);
  }

  return NextResponse.json({ ok: true, action: "approved", returnBonuses, reverseEarned, netBonusChange });
}
