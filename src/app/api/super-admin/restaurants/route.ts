import { NextResponse } from "next/server";
import { verifySuperAdminSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function requireAuth(request: NextRequest) {
  return verifySuperAdminSession(request.cookies.get("super_admin_session")?.value ?? "");
}

export async function GET(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, numeric_id, name, slug, logo, owner_name, owner_phone, admin_name, admin_phone, restaurant_phone, monthly_payment_status, payment_due_date, plan_id, created_at, is_2gis_enabled, custom_2gis_api_key, guest_balances(count)")
    .order("numeric_id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (data ?? []).map((r) => {
    const { guest_balances, ...rest } = r as typeof r & { guest_balances: { count: number }[] };
    return { ...rest, guest_count: guest_balances?.[0]?.count ?? 0 };
  });

  return NextResponse.json(mapped);
}

export async function PATCH(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, ...fields } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = [
    "owner_name", "owner_phone",
    "admin_name", "admin_phone", "restaurant_phone",
    "monthly_payment_status", "payment_due_date", "plan_id",
    "is_2gis_enabled", "custom_2gis_api_key",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) {
      // Convert empty strings to null for nullable fields (prevents Postgres type errors)
      const v = fields[key];
      update[key] = v === "" ? null : v;
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("restaurants")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
