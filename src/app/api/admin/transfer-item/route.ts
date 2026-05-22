import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RESTAURANT_ID } from "@/constants";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/admin/transfer-item — move a single item from one order to another table
export async function POST(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
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
    .select("id, items_json, total_price")
    .eq("id", source_order_id)
    .eq("restaurant_id", RESTAURANT_ID)
    .single();

  if (fetchError || !sourceOrder) {
    return NextResponse.json({ error: "Source order not found" }, { status: 404 });
  }

  const sourceItems: Array<{ name: string; price: number; qty: number; [key: string]: unknown }> =
    Array.isArray(sourceOrder.items_json) ? [...sourceOrder.items_json] : [];

  const idx = Number(item_idx);
  if (isNaN(idx) || idx < 0 || idx >= sourceItems.length) {
    return NextResponse.json({ error: "Invalid item index" }, { status: 400 });
  }

  const transferredItem = sourceItems[idx];
  const updatedSourceItems = sourceItems.filter((_, i) => i !== idx);
  const newSourceTotal = updatedSourceItems.reduce((sum, it) => sum + it.price * it.qty, 0);

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
    // Append item to existing order
    const targetItems: unknown[] = Array.isArray(existingTargetOrder.items_json)
      ? [...existingTargetOrder.items_json, transferredItem]
      : [transferredItem];
    const newTargetTotal = (targetItems as Array<{ price: number; qty: number }>)
      .reduce((sum, it) => sum + it.price * it.qty, 0);

    const { error: targetUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ items_json: targetItems, total_price: newTargetTotal })
      .eq("id", existingTargetOrder.id)
      .eq("restaurant_id", RESTAURANT_ID);

    if (targetUpdateError) {
      return NextResponse.json({ error: targetUpdateError.message }, { status: 500 });
    }
    targetOrderId = existingTargetOrder.id;
  } else {
    // Create new order for the free table
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
        opened_by: (user_id as string) ?? null,
      })
      .select("id")
      .single();

    if (createError || !newOrder) {
      return NextResponse.json({ error: createError?.message ?? "Failed to create order" }, { status: 500 });
    }
    targetOrderId = newOrder.id;
  }

  // 3. Remove item from source order (do this after target is confirmed safe)
  const { error: sourceUpdateError } = await supabaseAdmin
    .from("orders")
    .update({ items_json: updatedSourceItems, total_price: newSourceTotal })
    .eq("id", source_order_id)
    .eq("restaurant_id", RESTAURANT_ID);

  if (sourceUpdateError) {
    return NextResponse.json({ error: sourceUpdateError.message }, { status: 500 });
  }

  // 4. Log to order_transfers — Supabase client returns {data,error}, never throws
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
