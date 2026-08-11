import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// POST /api/admin/change-password
// Called on first login when must_change_password = true
// Body: { username, currentPassword, newPassword }
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`change-pw:ip:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const { username, currentPassword, newPassword } = body;

  if (username && !checkRateLimit(`change-pw:user:${username}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }

  if (!username || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Новый пароль — минимум 8 символов" }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "Новый пароль должен отличаться от временного" }, { status: 400 });
  }

  const supabase = db();
  const restaurantId = request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

  // Verify current password
  const { data: verified } = await supabase.rpc("verify_staff_password", {
    p_restaurant_id: restaurantId,
    p_username:      username,
    p_password:      currentPassword,
  });

  if (!verified || (Array.isArray(verified) && verified.length === 0)) {
    return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 401 });
  }

  const user = (verified as { id: string; role: string; display_name: string | null }[])[0];

  // Update password and clear the flag
  const { error: updateErr } = await supabase.rpc("update_staff_password", {
    p_id:            user.id,
    p_restaurant_id: restaurantId,
    p_new_password:  newPassword,
  });

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await supabase
    .from("staff_users")
    .update({ must_change_password: false })
    .eq("id", user.id);

  // Set session cookie — staff is now fully authenticated
  const response = NextResponse.json({ ok: true, role: user.role, displayName: user.display_name });
  const cookieOpts = {
    httpOnly: true,
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
    sameSite: "lax" as const,
    secure:   process.env.NODE_ENV === "production",
  };
  response.cookies.set("admin_session", signSession(user.role, restaurantId), cookieOpts);
  response.cookies.set("admin_user_id", user.id, cookieOpts);
  return response;
}
