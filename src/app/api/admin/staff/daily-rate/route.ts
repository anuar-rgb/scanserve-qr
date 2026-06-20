import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PUT(req: NextRequest) {
  const session = req.cookies.get("admin_session");
  if (!session?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeId, dailyRate } = await req.json().catch(() => ({})) as {
    employeeId?: string; dailyRate?: number;
  };

  if (!employeeId || dailyRate === undefined) {
    return NextResponse.json({ error: "employeeId and dailyRate required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("staff_users")
    .update({ daily_rate: Math.max(0, Math.round(dailyRate)) })
    .eq("id", employeeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
