import { NextResponse } from "next/server";
import { verifySuperAdminSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  if (!verifySuperAdminSession(request.cookies.get("super_admin_session")?.value ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guestId = new URL(request.url).searchParams.get("guestId");
  if (!guestId) return NextResponse.json({ error: "guestId required" }, { status: 400 });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(guestId)) {
    return NextResponse.json({ error: "Invalid guestId" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, restaurant_id, total_price, status, type, created_at, bonuses_deducted, earned_bonuses, bonuses_accrued, refund_status")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false })
    .limit(100);

  const restaurantIds = [...new Set((orders ?? []).map((o) => o.restaurant_id).filter(Boolean))];
  const restaurantMap = new Map<string, string>();

  if (restaurantIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name")
      .in("id", restaurantIds);
    restaurants?.forEach((r) => restaurantMap.set(r.id, r.name));
  }

  return NextResponse.json(
    (orders ?? []).map((o) => ({
      id:               o.id,
      restaurant_id:    o.restaurant_id,
      restaurant_name:  restaurantMap.get(o.restaurant_id) ?? "Неизвестно",
      total_price:      o.total_price,
      status:           o.status,
      type:             o.type,
      created_at:       o.created_at,
      bonuses_deducted: o.bonuses_deducted ?? 0,
      earned_bonuses:   o.earned_bonuses ?? 0,
      bonuses_accrued:  o.bonuses_accrued ?? false,
      refund_status:    o.refund_status ?? null,
    })),
  );
}
