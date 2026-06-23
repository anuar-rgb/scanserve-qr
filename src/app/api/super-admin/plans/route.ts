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

function requireAuth(request: NextRequest) {
  return request.cookies.get("super_admin_session")?.value === "authenticated";
}

export async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db()
    .from("subscription_plans")
    .select("id, name, monthly_price, max_staff, max_orders_month, features, is_active")
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
