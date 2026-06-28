import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionRole } from "@/lib/session";

// GET — returns the staff check-in QR token (owner / manager only)
export async function GET(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role || (role !== "owner" && role !== "manager" && role !== "supervisor" && role !== "cashier")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.QR_CHECKIN_SECRET;
  if (!token) {
    return NextResponse.json({ error: "QR_CHECKIN_SECRET not configured" }, { status: 500 });
  }

  return NextResponse.json({ token });
}
