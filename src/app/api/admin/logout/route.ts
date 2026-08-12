import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const base = {
    path:     "/",
    maxAge:   0,
    sameSite: "lax" as const,
    secure:   process.env.NODE_ENV === "production",
  };
  response.cookies.set("admin_session",       "", { ...base, httpOnly: true });
  response.cookies.set("admin_user_id",       "", { ...base, httpOnly: true });
  response.cookies.set("admin_restaurant_id", "", { ...base, httpOnly: false });
  return response;
}
