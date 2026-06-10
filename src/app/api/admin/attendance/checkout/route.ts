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

// POST — employee ends their work shift (requires QR token scan)
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

  const { data: activeRows, error: findErr } = await supabase
    .from("employee_attendance")
    .select("id, check_in")
    .eq("employee_id", staffUserId)
    .eq("status", "active")
    .is("check_out", null)
    .order("check_in", { ascending: false })
    .limit(1);

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  const active = activeRows?.[0] ?? null;
  if (!active) {
    return NextResponse.json({ error: "Нет активной смены" }, { status: 404 });
  }

  const checkOut = new Date();
  const checkIn = new Date(active.check_in as string);
  const totalHours = parseFloat(
    ((checkOut.getTime() - checkIn.getTime()) / 3_600_000).toFixed(2),
  );

  const { data, error } = await supabase
    .from("employee_attendance")
    .update({
      check_out: checkOut.toISOString(),
      total_hours: totalHours,
      status: "completed",
    })
    .eq("id", active.id)
    .select("id, employee_id, check_in, check_out, total_hours, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}
