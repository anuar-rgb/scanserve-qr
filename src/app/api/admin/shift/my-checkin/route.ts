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

// GET — returns the current user's checkin record for the open shift
export async function GET(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ checkin: null });

  const supabase = db();

  const { data: shift } = await supabase
    .from("shifts")
    .select("id")
    .eq("restaurant_id", RID())
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return NextResponse.json({ checkin: null });

  const { data: checkin } = await supabase
    .from("shift_checkins")
    .select("checked_in_at, checked_out_at")
    .eq("shift_id", shift.id)
    .eq("staff_user_id", staffUserId)
    .maybeSingle();

  return NextResponse.json({ checkin: checkin ?? null });
}
