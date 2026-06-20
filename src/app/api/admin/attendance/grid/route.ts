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

export async function GET(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthStart = searchParams.get("start");
  const monthEnd = searchParams.get("end");

  if (!monthStart || !monthEnd) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = db();
  const rid = RID(request);

  const [staffRes, attRes] = await Promise.all([
    supabase
      .from("staff_users")
      .select("id, display_name, username, role, daily_rate")
      .eq("restaurant_id", rid)
      .neq("role", "owner")
      .order("display_name"),
    supabase
      .from("employee_attendance")
      .select("id, employee_id, check_in, source")
      .eq("restaurant_id", rid)
      .gte("check_in", monthStart)
      .lte("check_in", monthEnd),
  ]);

  return NextResponse.json({
    staff: staffRes.data ?? [],
    records: attRes.data ?? [],
  });
}
