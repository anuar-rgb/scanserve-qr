import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RESTAURANT_ID } from "@/constants";
import { getSessionRole } from "@/lib/session";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ItemRow = { name: string; price: number; qty: number; product_id?: string; [key: string]: unknown };

async function calcEarnedBonuses(items: ItemRow[]): Promise<number> {
  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean) as string[])];
  if (productIds.length === 0) return 0;

  const { data: products } = await supabaseAdmin
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

// POST /api/admin/transfer-item — move a single item from one order to another table
export async function POST(request: NextRequest) {
  if (!getSessionRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const {
    source_order_id,
    item_idx,
    target_table_label,
    source_table_label,
    user_id,
    user_name,
  } = body as Record<string, unknown>;

  if (!source_order_id || item_idx === undefined || !target_table_label) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Read source order
  const { data: sourceOrder, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id, items_json, total_price, guest_id, opened_by")
    .eq("id", source_order_id)
    .eq("restaurant_id", RESTAURANT_ID)
    .single();

  if (fetchError || !sourceOrder) {
    return NextResponse.json({ error: "Source order not found" }, { status: 404 });
  }

  const sourceItems: ItemRow[] =
    Array.isArray(sourceOrder.items_json) ? [...sourceOrder.items_json] : [];

  const idx = Number(item_idx);
  if (isNaN(idx) || idx < 0 || idx >= sourceItems.length) {
    return NextResponse.json({ error: "Invalid item index" }, { status: 400 });
  }

  const transferredItem = sourceItems[idx];
  const updatedSourceItems = sourceItems.filter((_, i) => i !== idx);
  const newSourceTotal = updatedSourceItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  const newSourceBonuses = await calcEarnedBonuses(updatedSourceItems);

  // 2. Find existing pending dine-in order for the target table
  const { data: existingTargetOrder } = await supabaseAdmin
    .from("orders")
    .select("id, items_json, total_price")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("type", "dine-in")
    .eq("status", "pending")
    .eq("table_number", target_table_label)
    .maybeSingle();

  let targetOrderId: string;

  if (existingTargetOrder) {
    const targetItems: ItemRow[] = Array.isArray(existingTargetOrder.items_json)
      ? [...existingTargetOrder.items_json, transferredItem]
      : [transferredItem];
    const newTargetTotal = targetItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    const newTargetBonuses = await calcEarnedBonuses(targetItems);

    const { error: targetUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ items_json: targetItems, total_price: newTargetTotal, earned_bonuses: newTargetBonuses > 0 ? newTargetBonuses : null })
      .eq("id", existingTargetOrder.id)
      .eq("restaurant_id", RESTAURANT_ID);

    if (targetUpdateError) {
      return NextResponse.json({ error: targetUpdateError.message }, { status: 500 });
    }
    targetOrderId = existingTargetOrder.id;
  } else {
    const itemBonuses = await calcEarnedBonuses([transferredItem]);

    const { data: newOrder, error: createError } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: RESTAURANT_ID,
        type: "dine-in",
        status: "pending",
        order_type: "asap",
        table_number: target_table_label,
        items_json: [transferredItem],
        total_price: transferredItem.price * transferredItem.qty,
        earned_bonuses: itemBonuses > 0 ? itemBonuses : null,
        opened_by: (user_id as string) ?? null,
        guest_id: sourceOrder.guest_id ?? null,
      })
      .select("id")
      .single();

    if (createError || !newOrder) {
      return NextResponse.json({ error: createError?.message ?? "Failed to create order" }, { status: 500 });
    }
    targetOrderId = newOrder.id;
  }

  // 3. Update source order — delete if empty (so it doesn't pollute guest history),
  //    otherwise recalculate bonuses/total.
  if (updatedSourceItems.length === 0) {
    const { error: deleteErr } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", source_order_id)
      .eq("restaurant_id", RESTAURANT_ID);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
  } else {
    const { error: sourceUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        items_json: updatedSourceItems,
        total_price: newSourceTotal,
        earned_bonuses: newSourceBonuses > 0 ? newSourceBonuses : null,
      })
      .eq("id", source_order_id)
      .eq("restaurant_id", RESTAURANT_ID);

    if (sourceUpdateError) {
      return NextResponse.json({ error: sourceUpdateError.message }, { status: 500 });
    }
  }

  // 4. Log to order_transfers
  await supabaseAdmin.from("order_transfers").insert({
    restaurant_id: RESTAURANT_ID,
    source_order_id,
    target_order_id: targetOrderId,
    item_name: transferredItem.name,
    item_price: transferredItem.price,
    item_qty: transferredItem.qty,
    from_table: (source_table_label as string) ?? null,
    to_table: target_table_label,
    transferred_by: (user_id as string) ?? null,
    transferred_by_name: (user_name as string) ?? null,
  });

  return NextResponse.json({ target_order_id: targetOrderId });
}
