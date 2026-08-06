import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySuperAdminSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = request.cookies.get("super_admin_session");
  if (!session?.value || !verifySuperAdminSession(session.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
