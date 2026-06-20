import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RESTAURANT_ID } from "@/constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const session = req.cookies.get("admin_session");
  if (!session?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeId, date, present } = await req.json().catch(() => ({})) as {
    employeeId?: string; date?: string; present?: boolean;
  };

  if (!employeeId || !date) {
    return NextResponse.json({ error: "employeeId and date required" }, { status: 400 });
  }

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  if (present) {
    const { data: existing } = await supabase
      .from("employee_attendance")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("check_in", dayStart)
      .lte("check_in", dayEnd)
      .maybeSingle();

    if (!existing) {
      await supabase.from("employee_attendance").insert({
        employee_id: employeeId,
        restaurant_id: RESTAURANT_ID,
        check_in: `${date}T09:00:00`,
        check_out: `${date}T18:00:00`,
        total_hours: 9,
        status: "completed",
        source: "manual",
      });
    }
  } else {
    await supabase
      .from("employee_attendance")
      .delete()
      .eq("employee_id", employeeId)
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("check_in", dayStart)
      .lte("check_in", dayEnd);
  }

  return NextResponse.json({ ok: true });
}
