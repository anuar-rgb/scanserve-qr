import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const validUser = process.env.SUPER_ADMIN_USERNAME;
  const validPass = process.env.SUPER_ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("super_admin_session", "authenticated", {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
