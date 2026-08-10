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

const RID = (r: NextRequest) =>
  r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// POST — auto-checkin via session auth (no QR token required).
// Records shift attendance when admin has opened a shift, without blocking the terminal.
export async function POST(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ error: "No user ID in session" }, { status: 400 });

  const supabase = db();

  const { data: shift } = await supabase
    .from("shifts")
    .select("id")
    .eq("restaurant_id", RID(request))
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) {
    // No open shift — not an error, just skip recording
    return NextResponse.json({ checkin: null, reason: "no_open_shift" });
  }

  // Upsert — idempotent, safe to call multiple times
  const { data, error } = await supabase
    .from("shift_checkins")
    .upsert(
      { shift_id: shift.id, staff_user_id: staffUserId, restaurant_id: RID(request), checked_out_at: null },
      { onConflict: "shift_id,staff_user_id", ignoreDuplicates: true },
    )
    .select("staff_user_id, checked_in_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: sync employee_attendance
  try {
    const { data: activeAtt } = await supabase
      .from("employee_attendance")
      .select("id")
      .eq("employee_id", staffUserId)
      .eq("restaurant_id", RID(request))
      .eq("status", "active")
      .is("check_out", null)
      .limit(1)
      .maybeSingle();

    if (!activeAtt) {
      const payload: Record<string, unknown> = {
        employee_id: staffUserId,
        restaurant_id: RID(request),
        check_in: new Date().toISOString(),
        status: "active",
        source: "shift",
      };
      const { error: attErr } = await supabase.from("employee_attendance").insert(payload);
      if (attErr && (attErr.message.includes("source") || attErr.code === "42703")) {
        const { source: _, ...withoutSource } = payload;
        await supabase.from("employee_attendance").insert(withoutSource);
      }
    }
  } catch (_) { /* attendance sync failure must not block */ }

  return NextResponse.json({ checkin: data ?? { staff_user_id: staffUserId, checked_in_at: new Date().toISOString() } });
}
