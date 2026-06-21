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
    .select("id, username, role, display_name, is_active, created_at, plain_password")
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
  if (password.length < 8) {
    return NextResponse.json({ error: "Пароль минимум 8 символов" }, { status: 400 });
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

  // Store plain-text password so super-admin can distribute credentials
  if (data) {
    await supabase.from("staff_users").update({ plain_password: password }).eq("id", data);
  }

  return NextResponse.json({ id: data }, { status: 201 });
}

// PATCH /api/super-admin/staff
// Case A: { userId, restaurantId, newPassword } → full password reset (hash + plain_password)
// Case B: { userId, plainPassword }             → update only the displayed plain_password (no hash change)
export async function PATCH(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: "userId обязателен" }, { status: 400 });

  const supabase = getSupabase();

  // Case B: only update the plain_password display field
  if ("plainPassword" in body) {
    const { plainPassword } = body as { userId: string; plainPassword: string };
    const { error } = await supabase
      .from("staff_users")
      .update({ plain_password: plainPassword || null })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Case A: full password reset
  const { restaurantId, newPassword } = body as { restaurantId: string; newPassword: string };
  if (!restaurantId || !newPassword) {
    return NextResponse.json({ error: "restaurantId и newPassword обязательны" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_staff_password", {
    p_id:            userId,
    p_restaurant_id: restaurantId,
    p_new_password:  newPassword,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("staff_users")
    .update({ must_change_password: false, plain_password: newPassword })
    .eq("id", userId);

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
