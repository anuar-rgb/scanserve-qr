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

// GET /api/likes?restaurantId=xxx&sessionId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurantId");
  const sessionId = searchParams.get("sessionId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const supabase = db();
  const { data, error } = await supabase
    .from("dish_likes")
    .select("dish_id, session_id")
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const sessionLikes: string[] = [];
  for (const row of data ?? []) {
    counts[row.dish_id] = (counts[row.dish_id] ?? 0) + 1;
    if (sessionId && row.session_id === sessionId) sessionLikes.push(row.dish_id);
  }

  return NextResponse.json({ counts, sessionLikes });
}

// POST /api/likes — toggle like/unlike
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    dishId?: string;
    restaurantId?: string;
    sessionId?: string;
  };
  const { dishId, restaurantId, sessionId } = body;
  if (!dishId || !restaurantId || !sessionId) {
    return NextResponse.json({ error: "dishId, restaurantId, sessionId required" }, { status: 400 });
  }

  const supabase = db();

  const { data: existing } = await supabase
    .from("dish_likes")
    .select("id")
    .eq("dish_id", dishId)
    .eq("session_id", sessionId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await supabase.from("dish_likes").delete().eq("id", existing.id);
    liked = false;
  } else {
    await supabase.from("dish_likes").insert({ dish_id: dishId, session_id: sessionId, restaurant_id: restaurantId });
    liked = true;
  }

  return NextResponse.json({ liked });
}
