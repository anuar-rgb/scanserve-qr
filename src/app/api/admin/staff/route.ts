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

function requireOwner(request: NextRequest) {
  const role = getSessionRole(request);
  return role === "owner" || role === "manager" || role === "supervisor";
}

// GET /api/admin/staff — list all staff for this restaurant
export async function GET(request: NextRequest) {
  const sessionRole = getSessionRole(request);
  if (sessionRole !== "owner" && sessionRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = serverSupabase();
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

  // Save phone + must_change_password flag (RPC doesn't accept extra fields)
  await supabase
    .from("staff_users")
    .update({
      must_change_password: true,
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
    })
    .eq("id", data as string)
    .eq("restaurant_id", getRestaurantId(request));

  return NextResponse.json({ id: data }, { status: 201 });
}
