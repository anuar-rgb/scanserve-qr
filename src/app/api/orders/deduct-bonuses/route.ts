import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// POST /api/orders/deduct-bonuses
// Body: { guestId, restaurantId, amount }
//
// Uses a PostgreSQL function (deduct_guest_bonuses) that performs an atomic
// conditional UPDATE — so concurrent requests for the same guest are serialized
// by row-level locking and cannot both succeed when balance is insufficient.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`deduct-bonuses:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

  // Single atomic operation: locks the row, checks balance >= amount, deducts.
  // Concurrent calls are serialized by PostgreSQL row-level locking.
  const { data, error } = await supabase.rpc("deduct_guest_bonuses", {
    p_guest_id:      guestId,
    p_restaurant_id: restaurantId,
    p_amount:        deduct,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; new_balance?: number };

  if (!result.ok) {
    return NextResponse.json(
      { error: "Недостаточно бонусов на балансе", code: result.error },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, newBalance: result.new_balance });
}
