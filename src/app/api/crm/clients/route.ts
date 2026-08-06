import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

type GuestRow = { id: string; name: string | null; phone: string; email: string | null };

export async function GET(request: NextRequest) {
  if (!getSessionRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const restaurantId = request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID;

  if (!supabaseUrl || !serviceKey || !restaurantId) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const url    = new URL(request.url);
  const limit  = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const { data: rows, error, count } = await supabase
    .from("crm_clients")
    .select("id,phone,name,push_subscription,created_at,last_visit,guest_id", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = rows ?? [];

  // ── Priority 1: enrich via explicit guest_id ──────────────────────────────
  const guestIds = [...new Set(
    clients
      .filter((c): c is typeof c & { guest_id: string } => !!c.guest_id)
      .map(c => c.guest_id)
  )];

  // ── Priority 1b: enrich phone-only records that match guests by phone ──────
  const phonesWithoutLink = [...new Set(
    clients
      .filter(c => !c.guest_id && c.phone)
      .map(c => c.phone as string)
  )];

  const byId    = new Map<string, GuestRow>();
  const byPhone = new Map<string, GuestRow>();

  if (guestIds.length > 0) {
    const { data: gRows } = await supabase
      .from("guests")
      .select("id,name,phone,email")
      .in("id", guestIds);
    gRows?.forEach(g => byId.set(g.id, g));
  }

  if (phonesWithoutLink.length > 0) {
    const { data: gRows } = await supabase
      .from("guests")
      .select("id,name,phone,email")
      .in("phone", phonesWithoutLink);
    gRows?.forEach(g => byPhone.set(g.phone, g));
  }

  // ── Merge: guest data takes priority over crm_clients data ────────────────
  const enriched = clients.map(c => {
    const guest = c.guest_id
      ? byId.get(c.guest_id)
      : c.phone
      ? byPhone.get(c.phone)
      : undefined;

    return {
      id:                c.id,
      push_subscription: c.push_subscription,
      created_at:        c.created_at,
      last_visit:        c.last_visit,
      // Priority: guest.name > crm.name
      name:     guest?.name  ?? c.name  ?? null,
      // Priority: guest.phone > crm.phone
      phone:    guest?.phone ?? c.phone ?? null,
      email:    guest?.email ?? null,
      // Pass guest_id (resolved or original) so admin can display profile badge
      guest_id: guest?.id    ?? c.guest_id ?? null,
    };
  });

  return NextResponse.json({ clients: enriched, total: count });
}
