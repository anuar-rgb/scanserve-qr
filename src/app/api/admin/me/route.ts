import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type AdminRole = "owner" | "manager" | "cashier" | "waiter" | "chef";

const VALID_ROLES: AdminRole[] = ["owner", "manager", "cashier", "waiter", "chef"];

export async function GET(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = VALID_ROLES.includes(session.value as AdminRole)
    ? (session.value as AdminRole)
    : "owner"; // legacy cookie ("1" or old "admin") → owner
  return NextResponse.json({ role });
}
