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
    .select("id, used_count")
    .eq("restaurant_id", restaurantId)
    .ilike("code", code.trim())
    .maybeSingle();

  if (promo) {
    await supabase
      .from("promo_codes")
      .update({ used_count: (promo.used_count ?? 0) + 1 })
      .eq("id", promo.id);
  }

  return NextResponse.json({ ok: true });
}
