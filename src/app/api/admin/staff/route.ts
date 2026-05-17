import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function getRestaurantId() {
  return process.env.NEXT_PUBLIC_RESTAURANT_ID!;
}

function requireOwner(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value;
  return role === "owner" || role === "manager";
}

// GET /api/admin/staff — list all staff for this restaurant
export async function GET(request: NextRequest) {
  if (!requireOwner(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, username, role, display_name, is_active, created_at")
    .eq("restaurant_id", getRestaurantId())
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

// POST /api/admin/staff — create new staff member
export async function POST(request: NextRequest) {
  if (!requireOwner(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, password, role, display_name } = await request.json();

  if (!username?.trim() || !password?.trim() || !role) {
    return NextResponse.json({ error: "username, password and role are required" }, { status: 400 });
  }

  const VALID_ROLES = ["owner", "manager", "cashier", "waiter", "chef"];
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = serverSupabase();
  const { data, error } = await supabase.rpc("create_staff_user", {
    p_restaurant_id: getRestaurantId(),
    p_username:      username.trim(),
    p_password:      password,
    p_role:          role,
    p_display_name:  display_name?.trim() || null,
  });

  if (error) {
    const msg = error.message.includes("unique")
      ? "Пользователь с таким логином уже существует"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
