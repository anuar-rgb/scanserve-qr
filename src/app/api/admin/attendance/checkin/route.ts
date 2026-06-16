import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const RID = (r: NextRequest) => r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// POST — employee starts their work shift (requires QR token scan)
export async function POST(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ error: "No user ID in session" }, { status: 400 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const qrToken = body?.qrToken as string | undefined;
  const expected = process.env.QR_CHECKIN_SECRET;
  if (!expected || qrToken !== expected) {
    return NextResponse.json({ error: "Неверный QR-код заведения" }, { status: 403 });
  }

  const supabase = db();

  // Guard: prevent duplicate active sessions
  const { data: existingRows } = await supabase
    .from("employee_attendance")
    .select("id, check_in")
    .eq("employee_id", staffUserId)
    .eq("status", "active")
    .is("check_out", null)
    .limit(1);

  const existing = existingRows?.[0] ?? null;
  if (existing) {
    return NextResponse.json(
      { error: "Смена уже открыта", attendance: existing },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("employee_attendance")
    .insert({
      employee_id: staffUserId,
      restaurant_id: RID(request),
      check_in: new Date().toISOString(),
      status: "active",
    })
    .select("id, employee_id, check_in, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}
