import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const url    = new URL(request.url);
  const limit  = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const { data, error, count } = await supabase
    .from("crm_clients")
    .select("id,phone,name,push_subscription,created_at,last_visit", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: data, total: count });
}
