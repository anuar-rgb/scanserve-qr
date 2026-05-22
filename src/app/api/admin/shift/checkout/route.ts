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

const RID = () => process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// POST — staff checks out (requires QR token scan)
export async function POST(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
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
    .eq("restaurant_id", RID())
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
  return NextResponse.json({ ok: true });
}
