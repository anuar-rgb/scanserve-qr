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

// POST /api/orders/deduct-bonuses
// Body: { guestId, restaurantId, amount }
// Called immediately when a guest places an order with bonuses applied —
// before admin confirms payment — so balance is updated right away and
// cannot be double-spent on a concurrent order.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    guestId?: string;
    restaurantId?: string;
    amount?: number;
  };
  const { guestId, restaurantId, amount } = body;

  if (!guestId || !restaurantId || !amount || Number(amount) <= 0) {
    return NextResponse.json(
      { error: "guestId, restaurantId и amount (> 0) обязательны" },
      { status: 400 },
    );
  }

  const deduct = Math.floor(Number(amount));
  if (isNaN(deduct) || deduct <= 0) {
    return NextResponse.json({ error: "amount должно быть положительным числом" }, { status: 400 });
  }

  const supabase = db();

  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", guestId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const currentBalance = (balance?.bonus_amount ?? 0) as number;

  if (currentBalance < deduct) {
    return NextResponse.json(
      { error: "Недостаточно бонусов на балансе", currentBalance, requested: deduct },
      { status: 422 },
    );
  }

  const newBalance = currentBalance - deduct;

  const { error } = await supabase
    .from("guest_balances")
    .upsert(
      { guest_id: guestId, restaurant_id: restaurantId, bonus_amount: newBalance },
      { onConflict: "guest_id,restaurant_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, newBalance });
}
