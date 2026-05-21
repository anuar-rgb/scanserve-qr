import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — called from guest menu, no auth required.
// Body: { subscription: PushSubscriptionJSON, phone?: string, name?: string }
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

  const phone = body.phone ? String(body.phone).trim() : null;
  const name  = body.name  ? String(body.name).trim()  : null;

  // Upsert by (restaurant_id, phone) if phone provided, otherwise insert new row.
  if (phone) {
    const { error } = await supabase
      .from("crm_clients")
      .upsert(
        {
          restaurant_id:     restaurantId,
          phone,
          name,
          push_subscription: body.subscription,
          last_visit:        new Date().toISOString(),
        },
        { onConflict: "restaurant_id,phone" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Anonymous subscription — always insert a new row
    const { error } = await supabase.from("crm_clients").insert({
      restaurant_id:     restaurantId,
      push_subscription: body.subscription,
      last_visit:        new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
