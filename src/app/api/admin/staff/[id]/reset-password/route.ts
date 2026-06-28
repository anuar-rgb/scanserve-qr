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

// POST /api/admin/staff/[id]/reset-password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionRole = (await import("@/lib/session")).getSessionRole(request);
  if (sessionRole !== "owner" && sessionRole !== "manager" && sessionRole !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { password } = await request.json();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Пароль должен содержать минимум 8 символов" }, { status: 400 });
  }

  const supabase = serverSupabase();
  const { data, error } = await supabase.rpc("update_staff_password", {
    p_id:            id,
    p_restaurant_id: request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!,
    p_new_password:  password,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  // Force employee to set their own password on next login
  await supabase
    .from("staff_users")
    .update({ must_change_password: true })
    .eq("id", id)
    .eq("restaurant_id", request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!);

  return NextResponse.json({ ok: true });
}
