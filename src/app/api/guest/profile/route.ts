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

// GET /api/guest/profile?guestId=...&restaurantId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guestId     = searchParams.get("guestId");
  const restaurantId = searchParams.get("restaurantId");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guestId || !restaurantId || !UUID_RE.test(guestId) || !UUID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = db();

  const [guestRes, balanceRes] = await Promise.all([
    supabase.from("guests").select("id, name, phone").eq("id", guestId).maybeSingle(),
    supabase.from("guest_balances")
      .select("bonus_amount")
      .eq("guest_id", guestId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
  ]);

  if (!guestRes.data) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  return NextResponse.json({
    id:          guestRes.data.id,
    name:        guestRes.data.name,
    phone:       guestRes.data.phone,
    bonusAmount: balanceRes.data?.bonus_amount ?? 0,
  });
}
