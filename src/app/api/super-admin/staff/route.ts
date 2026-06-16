import { NextResponse } from "next/server";
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
  return request.cookies.get("super_admin_session")?.value === "authenticated";
}

const ADMIN_ROLES = ["owner", "manager", "supervisor"];

// GET /api/super-admin/staff?restaurantId=xxx
export async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = request.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, username, role, display_name, is_active, created_at")
    .eq("restaurant_id", restaurantId)
    .in("role", ADMIN_ROLES)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/super-admin/staff — create new staff user
// Body: { restaurantId, username, password, role, displayName }
export async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, username, password, role, displayName } = await request.json();
  if (!restaurantId || !username || !password || !role) {
    return NextResponse.json({ error: "restaurantId, username, password, role — обязательные поля" }, { status: 400 });
  }
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Недопустимая роль" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("create_staff_user", {
    p_restaurant_id: restaurantId,
    p_username:      username.trim(),
    p_password:      password,
    p_role:          role,
    p_display_name:  displayName?.trim() || null,
  });

  if (error) {
    const msg = error.message.includes("unique")
      ? "Пользователь с таким логином уже существует"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}

// PATCH /api/super-admin/staff — reset password
// Body: { userId, restaurantId, newPassword }
export async function PATCH(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, restaurantId, newPassword } = await request.json();
  if (!userId || !restaurantId || !newPassword) {
    return NextResponse.json({ error: "userId, restaurantId, newPassword обязательны" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.rpc("update_staff_password", {
    p_id:            userId,
    p_restaurant_id: restaurantId,
    p_new_password:  newPassword,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("staff_users").update({ must_change_password: false }).eq("id", userId);

  return NextResponse.json({ ok: true });
}

// DELETE /api/super-admin/staff — remove staff user
// Body: { userId }
export async function DELETE(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from("staff_users").delete().eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
