import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = verifySession(session.value);
  if (!role) {
    const resp = NextResponse.json({ error: "Invalid session" }, { status: 401 });
    resp.cookies.delete("admin_session");
    resp.cookies.delete("admin_user_id");
    resp.cookies.delete("admin_restaurant_id");
    return resp;
  }

  const id           = request.cookies.get("admin_user_id")?.value ?? null;
  const restaurantId = request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID ?? null;

  let display_name: string | null = null;
  let plan_id: string | null = null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  if (id) {
    try {
      const { data } = await supabase
        .from("staff_users")
        .select("display_name, username, role")
        .eq("id", id)
        .single();

      if (!data) {
        const resp = NextResponse.json({ error: "User not found" }, { status: 401 });
        resp.cookies.delete("admin_session");
        resp.cookies.delete("admin_user_id");
        resp.cookies.delete("admin_restaurant_id");
        return resp;
      }

      display_name = data.display_name || data.username || null;
    } catch {}
  }

  if (restaurantId) {
    try {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("plan_id")
        .eq("id", restaurantId)
        .single();
      plan_id = rest?.plan_id ?? "standard";
    } catch {}
  }

  return NextResponse.json({ role, id, display_name, restaurant_id: restaurantId, plan_id });
}
