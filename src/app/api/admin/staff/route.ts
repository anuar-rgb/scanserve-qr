import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function getRestaurantId(request: NextRequest) {
  return request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;
}

const POS_ROLES = new Set(["cashier", "waiter", "chef", "bartender", "supervisor"]);

// GET /api/admin/staff — list all staff for this restaurant
// POS roles (cashier, waiter, chef, …) get a minimal name-only view for rotation display
export async function GET(request: NextRequest) {
  const sessionRole = getSessionRole(request);
  const isAdmin = sessionRole === "owner" || sessionRole === "manager";
  const isPOS   = sessionRole != null && POS_ROLES.has(sessionRole);

  if (!isAdmin && !isPOS) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = serverSupabase();

  if (isPOS && !isAdmin) {
    // POS roles only need names for rotation — no sensitive columns
    const { data, error } = await supabase
      .from("staff_users")
      .select("id, username, display_name")
      .eq("restaurant_id", getRestaurantId(request))
      .eq("is_active", true)
      .order("display_name", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ staff: data });
  }

  // Admin view — full columns
  let query = supabase
    .from("staff_users")
    .select("id, username, role, display_name, is_active, phone, created_at")
    .eq("restaurant_id", getRestaurantId(request))
    .order("created_at", { ascending: true });

  // Managers cannot see owner accounts
  if (sessionRole === "manager") {
    query = query.neq("role", "owner");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

// POST /api/admin/staff — create new staff member
export async function POST(request: NextRequest) {
  const sessionRole = getSessionRole(request);
  if (sessionRole !== "owner" && sessionRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, password, role, display_name, phone } = await request.json();

  if (!username?.trim() || !password?.trim() || !role) {
    return NextResponse.json({ error: "username, password and role are required" }, { status: 400 });
  }

  // Managers cannot create owner accounts
  if (sessionRole === "manager" && role === "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const VALID_ROLES = [
    "owner", "manager", "cashier", "waiter", "chef",
    "bartender", "hostess", "courier", "cleaner", "doorman",
    "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
  ];
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = serverSupabase();
  const { data, error } = await supabase.rpc("create_staff_user", {
    p_restaurant_id: getRestaurantId(request),
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

  const ADMIN_ROLES = ["owner", "manager", "supervisor"];
  // Save phone; only require password change for admin roles
  await supabase
    .from("staff_users")
    .update({
      must_change_password: ADMIN_ROLES.includes(role),
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
    })
    .eq("id", data as string)
    .eq("restaurant_id", getRestaurantId(request));

  return NextResponse.json({ id: data }, { status: 201 });
}
