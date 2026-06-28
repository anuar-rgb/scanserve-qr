import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PUT(req: NextRequest) {
  if (!getSessionRole(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeId, dailyRate, commissionPct } = await req.json().catch(() => ({})) as {
    employeeId?: string; dailyRate?: number; commissionPct?: number;
  };

  if (!employeeId || (dailyRate === undefined && commissionPct === undefined)) {
    return NextResponse.json({ error: "employeeId and dailyRate or commissionPct required" }, { status: 400 });
  }

  const updates: Record<string, number> = {};
  if (dailyRate !== undefined) updates.daily_rate = Math.max(0, Math.round(dailyRate));
  if (commissionPct !== undefined) updates.commission_pct = Math.max(0, Math.min(100, commissionPct));

  const { error } = await supabase
    .from("staff_users")
    .update(updates)
    .eq("id", employeeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
