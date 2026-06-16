import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("login_staff_global", {
    p_username: username,
    p_password: password,
  });

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const user = data[0] as { id: string; role: string; display_name: string | null; restaurant_id: string };

  const { data: staffRow } = await supabase
    .from("staff_users")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (staffRow?.must_change_password) {
    return NextResponse.json({ mustChangePassword: true, userId: user.id });
  }

  const response = NextResponse.json({ ok: true, role: user.role, displayName: user.display_name });
  const cookieOpts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set("admin_session",       user.role,          { ...cookieOpts, httpOnly: true });
  response.cookies.set("admin_user_id",       user.id,            { ...cookieOpts, httpOnly: true });
  // non-httpOnly so client-side constants.ts can read it from document.cookie
  response.cookies.set("admin_restaurant_id", user.restaurant_id, { ...cookieOpts, httpOnly: false });
  return response;
}
