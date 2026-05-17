import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const ownerUsername = process.env.OWNER_USERNAME;
  const ownerPassword = process.env.OWNER_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  let role: "owner" | "admin" | null = null;

  if (ownerUsername && ownerPassword && username === ownerUsername && password === ownerPassword) {
    role = "owner";
  } else if (adminUsername && adminPassword && username === adminUsername && password === adminPassword) {
    role = "admin";
  }

  if (!role) {
    if (!ownerUsername && !adminUsername) {
      return NextResponse.json({ error: "Admin credentials are not configured on the server." }, { status: 500 });
    }
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set("admin_session", role, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
