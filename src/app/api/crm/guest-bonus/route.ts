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

// GET /api/crm/guest-bonus?phone=...&restaurantId=...
// Returns { guestId, bonusAmount } or { guestId: null, bonusAmount: null } if not found
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone        = searchParams.get("phone");
  const restaurantId = searchParams.get("restaurantId");

  if (!phone || !restaurantId) {
    return NextResponse.json({ error: "phone and restaurantId required" }, { status: 400 });
  }

  const supabase = db();

  const { data: guest } = await supabase
    .from("guests")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ guestId: null, bonusAmount: null });
  }

  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", guest.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return NextResponse.json({
    guestId:     guest.id,
    bonusAmount: balance?.bonus_amount ?? 0,
  });
}

// PUT /api/crm/guest-bonus
// Body: { guestId, restaurantId, newAmount }
// Owner-only: sets the balance to a specific value
export async function PUT(req: NextRequest) {
  const role = req.cookies.get("admin_session")?.value;
  if (role !== "owner") {
    return NextResponse.json({ error: "Недостаточно прав. Только владелец может изменять бонусный баланс." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    guestId?: string;
    restaurantId?: string;
    newAmount?: number;
  };

  const { guestId, restaurantId, newAmount } = body;

  if (!guestId || !restaurantId || newAmount === undefined || newAmount === null) {
    return NextResponse.json({ error: "guestId, restaurantId, newAmount required" }, { status: 400 });
  }

  const amount = Math.max(0, Math.floor(Number(newAmount)));
  if (isNaN(amount)) {
    return NextResponse.json({ error: "newAmount must be a number" }, { status: 400 });
  }

  const supabase = db();

  const { error } = await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: guestId, restaurant_id: restaurantId, bonus_amount: amount },
      { onConflict: "guest_id,restaurant_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bonusAmount: amount });
}
