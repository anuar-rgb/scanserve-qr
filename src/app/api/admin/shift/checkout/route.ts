import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const RID = (r: NextRequest) => r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// POST — staff checks out (requires QR token scan)
export async function POST(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ error: "No user ID in session" }, { status: 400 });

  // Verify QR token
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const qrToken = body?.qrToken as string | undefined;
  const expected = process.env.QR_CHECKIN_SECRET;
  if (!expected || qrToken !== expected) {
    return NextResponse.json({ error: "Неверный QR-код заведения" }, { status: 403 });
  }

  const supabase = db();

  // Find the current open shift
  const { data: shift } = await supabase
    .from("shifts")
    .select("id")
    .eq("restaurant_id", RID(request))
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) {
    return NextResponse.json({ error: "Нет открытой смены" }, { status: 404 });
  }

  const { error } = await supabase
    .from("shift_checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("shift_id", shift.id)
    .eq("staff_user_id", staffUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync: close active employee_attendance record (best effort)
  try {
    const now = new Date();
    const { data: activeAtt } = await supabase
      .from("employee_attendance")
      .select("id, check_in")
      .eq("employee_id", staffUserId)
      .eq("restaurant_id", RID(request))
      .eq("status", "active")
      .is("check_out", null)
      .order("check_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAtt) {
      const totalHours = (now.getTime() - new Date(activeAtt.check_in).getTime()) / 3_600_000;
      await supabase
        .from("employee_attendance")
        .update({ check_out: now.toISOString(), total_hours: Math.round(totalHours * 100) / 100, status: "completed" })
        .eq("id", activeAtt.id);
    }
  } catch (_) { /* attendance sync failure must not block shift checkout */ }

  return NextResponse.json({ ok: true });
}
