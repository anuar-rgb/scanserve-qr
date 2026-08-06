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

  // Fetch all in parallel
  const [txRes, guestRes, balancesRes] = await Promise.all([
    supabase
      .from("bonus_transactions")
      .select("id, type, amount, description, created_at, restaurant_id, order_id")
      .eq("guest_id", guestId)
      .order("created_at", { ascending: true }),
    supabase
      .from("guests")
      .select("id, name, phone, email")
      .eq("id", guestId)
      .maybeSingle(),
    supabase
      .from("guest_balances")
      .select("restaurant_id, bonus_amount")
      .eq("guest_id", guestId),
  ]);

  const rawTxs = txRes.data ?? [];
  const guest  = guestRes.data;

  // Fetch restaurant names for all referenced restaurants
  const restaurantIds = [...new Set(rawTxs.map(t => t.restaurant_id).filter(Boolean))];
  const restaurantMap = new Map<string, string>();

  if (restaurantIds.length > 0) {
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id, name")
      .in("id", restaurantIds);
    restaurants?.forEach(r => restaurantMap.set(r.id, r.name));
  }

  // Compute running balance per restaurant (oldest → newest)
  const runningBalance: Record<string, number> = {};
  const txsWithBalance = rawTxs.map(tx => {
    const rid = tx.restaurant_id;
    runningBalance[rid] = (runningBalance[rid] ?? 0) + tx.amount;
    return {
      id:              tx.id,
      type:            tx.type,
      amount:          tx.amount,
      description:     tx.description,
      created_at:      tx.created_at,
      restaurant_id:   rid,
      restaurant_name: restaurantMap.get(rid) ?? "Неизвестно",
      order_id:        tx.order_id,
      balance_after:   runningBalance[rid],
    };
  });

  // Reverse to show newest first
  txsWithBalance.reverse();

  // Build balances per restaurant
  const balances = (balancesRes.data ?? []).map(b => ({
    restaurant_id:   b.restaurant_id,
    restaurant_name: restaurantMap.get(b.restaurant_id) ?? "Неизвестно",
    bonus_amount:    b.bonus_amount ?? 0,
  }));

  return NextResponse.json({
    guest: {
      name:  guest?.name  ?? null,
      phone: guest?.phone ?? null,
      email: guest?.email ?? null,
    },
    transactions: txsWithBalance,
    balances,
  });
}
