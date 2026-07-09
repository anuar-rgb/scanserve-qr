import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function requireAuth(request: NextRequest) {
  const session = request.cookies.get("super_admin_session");
  return session?.value === "authenticated";
}

export async function GET(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = new URL(request.url).searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const supabase = getSupabase();

  // Fetch crm_clients for this restaurant
  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select("id, phone, name, push_subscription, created_at, last_visit, guest_id")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clients || clients.length === 0) return NextResponse.json([]);

  // Enrich with guests table
  const guestIds = [...new Set(clients.filter(c => c.guest_id).map(c => c.guest_id as string))];
  const phones   = [...new Set(clients.filter(c => !c.guest_id && c.phone).map(c => c.phone as string))];

  const byId    = new Map<string, { id: string; name: string | null; phone: string }>();
  const byPhone = new Map<string, { id: string; name: string | null; phone: string }>();

  if (guestIds.length > 0) {
    const { data } = await supabase.from("guests").select("id,name,phone").in("id", guestIds);
    data?.forEach(g => byId.set(g.id, g));
  }
  if (phones.length > 0) {
    const { data } = await supabase.from("guests").select("id,name,phone").in("phone", phones);
    data?.forEach(g => byPhone.set(g.phone, g));
  }

  // Fetch bonus balances
  const allGuestIds = [...new Set([
    ...guestIds,
    ...Array.from(byPhone.values()).map(g => g.id),
  ])];

  const bonusMap = new Map<string, number>();
  if (allGuestIds.length > 0) {
    const { data } = await supabase
      .from("guest_balances")
      .select("guest_id, bonus_amount")
      .eq("restaurant_id", restaurantId)
      .in("guest_id", allGuestIds);
    data?.forEach(b => bonusMap.set(b.guest_id, b.bonus_amount ?? 0));
  }

  const result = clients.map(c => {
    const guest = c.guest_id ? byId.get(c.guest_id) : c.phone ? byPhone.get(c.phone) : undefined;
    const resolvedGuestId = guest?.id ?? c.guest_id ?? null;
    return {
      id:                c.id,
      name:              guest?.name  ?? c.name  ?? null,
      phone:             guest?.phone ?? c.phone ?? null,
      guest_id:          resolvedGuestId,
      push_subscription: !!c.push_subscription,
      created_at:        c.created_at,
      last_visit:        c.last_visit,
      bonus_amount:      resolvedGuestId ? (bonusMap.get(resolvedGuestId) ?? 0) : 0,
    };
  });

  return NextResponse.json(result);
}
