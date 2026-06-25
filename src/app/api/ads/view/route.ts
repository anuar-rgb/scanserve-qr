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

// POST — record ad impression (called from guest menu)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    adId?: string;
    restaurantId?: string;
    device?: string;
  };

  if (!body.adId || !body.restaurantId) {
    return NextResponse.json({ error: "adId and restaurantId required" }, { status: 400 });
  }

  await db().from("ad_views").insert({
    ad_id: body.adId,
    restaurant_id: body.restaurantId,
    device: body.device ?? null,
  });

  return NextResponse.json({ ok: true });
}

// GET — stats for super-admin
export async function GET(req: NextRequest) {
  const session = req.cookies.get("super_admin_session")?.value;
  if (session !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = db();
  const { data: views } = await supabase
    .from("ad_views")
    .select("ad_id, restaurant_id, device, created_at")
    .gte("created_at", since);

  const { data: ads } = await supabase
    .from("advertisements")
    .select("id, title, image_url");

  const adMap = new Map((ads ?? []).map(a => [a.id, a]));
  const stats: Record<string, { title: string; image_url: string; views: number; mobile: number; desktop: number; restaurants: Set<string> }> = {};

  for (const v of (views ?? [])) {
    if (!stats[v.ad_id]) {
      const ad = adMap.get(v.ad_id);
      stats[v.ad_id] = {
        title: ad?.title ?? "Без названия",
        image_url: ad?.image_url ?? "",
        views: 0, mobile: 0, desktop: 0,
        restaurants: new Set(),
      };
    }
    const s = stats[v.ad_id];
    s.views++;
    if (v.device === "mobile") s.mobile++;
    else s.desktop++;
    s.restaurants.add(v.restaurant_id);
  }

  const result = Object.entries(stats).map(([adId, s]) => ({
    adId,
    title: s.title,
    imageUrl: s.image_url,
    totalViews: s.views,
    mobile: s.mobile,
    desktop: s.desktop,
    restaurantsReached: s.restaurants.size,
  })).sort((a, b) => b.totalViews - a.totalViews);

  return NextResponse.json({ totalImpressions: (views ?? []).length, ads: result });
}
