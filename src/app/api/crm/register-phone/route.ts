import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — called from guest checkout (pickup/delivery).
// Body: { phone: string, name?: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = body?.phone ? String(body.phone).trim() : null;
  if (!phone) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
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

  const name = body?.name ? String(body.name).trim() : null;

  const { error } = await supabase
    .from("crm_clients")
    .upsert(
      {
        restaurant_id: restaurantId,
        phone,
        ...(name ? { name } : {}),
        last_visit: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,phone" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
