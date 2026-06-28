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

// GET — returns current employee's attendance records for today
export async function GET(request: NextRequest) {
  const { getSessionRole } = await import("@/lib/session");
  const role = getSessionRole(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ error: "No user ID in session" }, { status: 400 });

  const supabase = db();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("employee_attendance")
    .select("id, check_in, check_out, total_hours, status")
    .eq("employee_id", staffUserId)
    .gte("check_in", today.toISOString())
    .order("check_in", { ascending: false });

  return NextResponse.json({ records: data ?? [] });
}
