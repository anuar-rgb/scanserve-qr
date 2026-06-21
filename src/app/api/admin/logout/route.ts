import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("admin_session");
  response.cookies.delete("admin_user_id");
  response.cookies.delete("admin_restaurant_id");
  return response;
}
