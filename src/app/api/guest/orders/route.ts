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

// GET /api/guest/orders?guestId=...&restaurantId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guestId = searchParams.get("guestId");
  const restaurantId = searchParams.get("restaurantId");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guestId || !restaurantId || !UUID_RE.test(guestId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = db();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();

  const restaurantName = restaurant?.name ?? "";

  const { data: orders } = await supabase
    .from("orders")
    .select("id, type, order_type, preorder_date, preorder_time, table_number, items_json, total_price, status, created_at, earned_bonuses, bonuses_deducted, promo_code, promo_discount, refund_status")
    .eq("guest_id", guestId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);

  const mapped = (orders ?? [])
    .filter((o) => {
      // Exclude ghost orders left by item transfers (empty items + zero total)
      const items = Array.isArray(o.items_json) ? o.items_json : [];
      if (items.length === 0 && o.total_price === 0) return false;
      return true;
    })
    .map((o) => {
    const itemsRaw = Array.isArray(o.items_json) ? o.items_json as { name?: string; qty?: number; price?: number; original_price?: number; discountPct?: number }[] : [];
    return {
      id: o.id,
      clientId: guestId,
      timestamp: new Date(o.created_at).getTime(),
      restaurantName,
      orderType: o.type as "dine-in" | "pickup" | "delivery",
      timingMode: o.order_type as "asap" | "preorder" | undefined,
      preorderDate: o.preorder_date ?? undefined,
      preorderTime: o.preorder_time ?? undefined,
      tableNumber: o.table_number ?? undefined,
      items: itemsRaw.map((it) => ({
        name: it.name ?? "",
        qty: it.qty ?? 1,
        price: it.price ?? 0,
        currency: "₸",
        originalPrice: it.original_price ?? undefined,
        discountPct: it.discountPct ?? undefined,
      })),
      total: o.total_price,
      currency: "₸",
      status: o.status === "refund-requested" ? "refund-requested" as const : "pending" as const,
      isActive: o.status === "pending",
      earnedBonuses: o.earned_bonuses ?? undefined,
      bonusesDeducted: o.bonuses_deducted ?? undefined,
      promoCode: o.promo_code ?? undefined,
      promoDiscount: o.promo_discount ?? undefined,
    };
  });

  return NextResponse.json(mapped);
}
