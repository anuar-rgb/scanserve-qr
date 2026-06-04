import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — called from guest menu, no auth required.
// Body: { subscription: PushSubscriptionJSON, phone?: string, name?: string, guestId?: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;

  if (!supabaseUrl || !serviceKey || !restaurantId) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const phone    = body.phone   ? String(body.phone).trim()   : null;
  const name     = body.name    ? String(body.name).trim()    : null;
  const guestId  = body.guestId ? String(body.guestId).trim() : null;
  const now      = new Date().toISOString();

  // If guestId provided (guest is logged in), look up their phone and upsert with full profile link
  if (guestId) {
    const { data: guest } = await supabase
      .from("guests")
      .select("id, phone, name")
      .eq("id", guestId)
      .maybeSingle();

    if (guest) {
      // Try to find an existing anonymous record by matching the push endpoint (device-specific)
      const endpoint = (body.subscription as { endpoint?: string })?.endpoint ?? null;
      if (endpoint) {
        const { data: existing } = await supabase
          .from("crm_clients")
          .select("id, phone")
          .eq("restaurant_id", restaurantId)
          .filter("push_subscription->>endpoint", "eq", endpoint)
          .maybeSingle();

        if (existing && !existing.phone) {
          // Anonymous record found — update it with guest data
          await supabase
            .from("crm_clients")
            .update({
              phone:      guest.phone ?? null,
              name:       guest.name  ?? name ?? null,
              guest_id:   guest.id,
              last_visit: now,
            })
            .eq("id", existing.id);
          return NextResponse.json({ ok: true });
        }
      }

      // No anonymous record or it already has a phone — upsert by phone
      if (guest.phone) {
        await supabase
          .from("crm_clients")
          .upsert(
            {
              restaurant_id:     restaurantId,
              phone:             guest.phone,
              name:              guest.name ?? name ?? null,
              push_subscription: body.subscription,
              guest_id:          guest.id,
              last_visit:        now,
            },
            { onConflict: "restaurant_id,phone" },
          );
        return NextResponse.json({ ok: true });
      }
    }
  }

  // Upsert by (restaurant_id, phone) if phone provided
  if (phone) {
    const { error } = await supabase
      .from("crm_clients")
      .upsert(
        {
          restaurant_id:     restaurantId,
          phone,
          name,
          push_subscription: body.subscription,
          last_visit:        now,
        },
        { onConflict: "restaurant_id,phone" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Anonymous subscription — insert a new row
    const { error } = await supabase.from("crm_clients").insert({
      restaurant_id:     restaurantId,
      push_subscription: body.subscription,
      last_visit:        now,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
