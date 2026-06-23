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

function requireAuth(request: NextRequest) {
  return request.cookies.get("super_admin_session")?.value === "authenticated";
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    restaurantId?: string;
    amount?: number;
    paymentMethod?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
  };

  if (!body.restaurantId || !body.amount || !body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "restaurantId, amount, periodStart, periodEnd required" }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("payment_history")
    .insert({
      restaurant_id: body.restaurantId,
      amount: body.amount,
      payment_method: body.paymentMethod ?? null,
      period_start: body.periodStart,
      period_end: body.periodEnd,
      status: "completed",
      notes: body.notes ?? null,
      created_by: "super-admin",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
