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
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;

  if (!supabaseUrl || !serviceKey || !restaurantId) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("verify_staff_password", {
    p_restaurant_id: restaurantId,
    p_username:      username,
    p_password:      password,
  });

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const user = data[0] as { id: string; role: string; display_name: string | null };

  const response = NextResponse.json({ ok: true, role: user.role, displayName: user.display_name });
  const cookieOpts = {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set("admin_session", user.role, cookieOpts);
  response.cookies.set("admin_user_id", user.id, cookieOpts);
  return response;
}
