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
  const { getSessionRole } = await import("@/lib/session");
  const role = getSessionRole(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthStart = searchParams.get("start");
  const monthEnd = searchParams.get("end");

  if (!monthStart || !monthEnd) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = db();
  const rid = RID(request);

  // Find shifts that overlap this month
  const [staffRes, attRes, shiftsRes] = await Promise.all([
    supabase
      .from("staff_users")
      .select("id, display_name, username, role, daily_rate, commission_pct")
      .eq("restaurant_id", rid)
      .neq("role", "owner")
      .order("display_name"),
    supabase
      .from("employee_attendance")
      .select("id, employee_id, check_in, source")
      .eq("restaurant_id", rid)
      .gte("check_in", monthStart)
      .lte("check_in", monthEnd),
    supabase
      .from("shifts")
      .select("id")
      .eq("restaurant_id", rid)
      .gte("opened_at", monthStart)
      .lte("opened_at", monthEnd),
  ]);

  // Load commission totals from waiter_shift_revenues for this month's shifts
  const shiftIds = (shiftsRes.data ?? []).map((s: { id: string }) => s.id);
  let commissions: Record<string, number> = {};

  if (shiftIds.length > 0) {
    const { data: revenueData } = await supabase
      .from("waiter_shift_revenues")
      .select("waiter_id, commission_amount")
      .in("shift_id", shiftIds);

    if (revenueData) {
      for (const r of revenueData as { waiter_id: string; commission_amount: number }[]) {
        commissions[r.waiter_id] = (commissions[r.waiter_id] ?? 0) + Number(r.commission_amount ?? 0);
      }
    }
  }

  return NextResponse.json({
    staff: staffRes.data ?? [],
    records: attRes.data ?? [],
    commissions,
  });
}
