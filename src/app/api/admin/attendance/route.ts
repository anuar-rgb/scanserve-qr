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

const OWNER_ROLES = new Set(["owner", "manager"]);

// GET — paginated attendance list for managers/owners
// ?startDate=ISO&endDate=ISO&employeeId=uuid&role=waiter
export async function GET(request: NextRequest) {
  const sessionRole = request.cookies.get("admin_session")?.value ?? null;
  if (!sessionRole || !OWNER_ROLES.has(sessionRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate  = searchParams.get("startDate");
  const endDate    = searchParams.get("endDate");
  const employeeId = searchParams.get("employeeId");
  const roleFilter = searchParams.get("role");

  const supabase = db();

  let query = supabase
    .from("employee_attendance")
    .select(`
      id,
      employee_id,
      check_in,
      check_out,
      total_hours,
      status,
      staff_users!employee_id (
        id,
        display_name,
        username,
        role
      )
    `)
    .eq("restaurant_id", RID(request))
    .order("check_in", { ascending: false })
    .limit(200);

  if (startDate) query = query.gte("check_in", startDate);
  if (endDate)   query = query.lte("check_in", endDate);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by role client-side (PostgREST nested filter on joined table is verbose)
  const filtered = roleFilter
    ? (data ?? []).filter((r) => {
        const su = r.staff_users as unknown as { role: string } | null;
        return su?.role === roleFilter;
      })
    : (data ?? []);

  return NextResponse.json({ records: filtered });
}
