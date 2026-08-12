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

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  if (!origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code, restaurantId } = await req.json().catch(() => ({})) as {
    code?: string;
    restaurantId?: string;
  };

  if (!code || !restaurantId) {
    return NextResponse.json({ error: "code and restaurantId required" }, { status: 400 });
  }

  const supabase = db();

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id, used_count, max_uses, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!promo || !promo.is_active) {
    return NextResponse.json({ ok: true });
  }

  const currentCount = promo.used_count ?? 0;

  // Skip write if limit already reached
  if (promo.max_uses !== null && currentCount >= promo.max_uses) {
    return NextResponse.json({ ok: true });
  }

  // Atomic optimistic-lock increment:
  // WHERE used_count = currentCount — prevents two simultaneous calls both
  //   writing currentCount+1 from the same snapshot (one will find 0 rows and skip)
  // WHERE used_count < max_uses — prevents exceeding the limit even if the
  //   guard above was passed concurrently
  let query = supabase
    .from("promo_codes")
    .update({ used_count: currentCount + 1 })
    .eq("id", promo.id)
    .eq("used_count", currentCount);

  if (promo.max_uses !== null) {
    query = query.lt("used_count", promo.max_uses);
  }

  await query;

  return NextResponse.json({ ok: true });
}
