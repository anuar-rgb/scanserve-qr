import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type AdminRole = "owner" | "admin";

export async function GET(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // "1" is the legacy cookie value — treat as owner for backward compat
  const role: AdminRole = session.value === "admin" ? "admin" : "owner";
  return NextResponse.json({ role });
}
