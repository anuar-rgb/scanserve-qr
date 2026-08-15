import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  const role = getSessionRole(request);
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = request.cookies.get("admin_user_id")?.value;
  const primaryRestaurantId = request.cookies.get("admin_restaurant_id")?.value;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db()
    .from("restaurants")
    .select("id, name, slug")
    .eq("owner_id", userId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If no branches linked via owner_id yet, fall back to the session's primary restaurant
  if (!data || data.length === 0) {
    if (!primaryRestaurantId) return NextResponse.json({ branches: [] });
    const { data: primary } = await db()
      .from("restaurants")
      .select("id, name, slug")
      .eq("id", primaryRestaurantId)
      .single();
    return NextResponse.json({ branches: primary ? [primary] : [] });
  }

  return NextResponse.json({ branches: data });
}
