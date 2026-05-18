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

function getRole(req: NextRequest) {
  return req.cookies.get("admin_session")?.value ?? null;
}

function getUserId(req: NextRequest) {
  return req.cookies.get("admin_user_id")?.value ?? null;
}

// GET — current open shift + checked-in waiters
export async function GET(request: NextRequest) {
  if (!getRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, opened_at, opened_by")
    .eq("restaurant_id", RID())
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return NextResponse.json({ shift: null, checkins: [] });

  const { data: checkins } = await supabase
    .from("shift_checkins")
    .select("staff_user_id, checked_in_at")
    .eq("shift_id", shift.id)
    .order("checked_in_at", { ascending: true });

  return NextResponse.json({ shift, checkins: checkins ?? [] });
}

// POST — open a new shift (manager / owner only)
export async function POST(request: NextRequest) {
  const role = getRole(request);
  if (!role || (role !== "owner" && role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();
  const openedBy = getUserId(request);

  // Return existing open shift if already open
  const { data: existing } = await supabase
    .from("shifts")
    .select("id, opened_at, opened_by")
    .eq("restaurant_id", RID())
    .eq("status", "open")
    .maybeSingle();

  if (existing) return NextResponse.json({ shift: existing });

  const { data, error } = await supabase
    .from("shifts")
    .insert({ restaurant_id: RID(), status: "open", opened_by: openedBy })
    .select("id, opened_at, opened_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shift: data });
}

// DELETE — close current shift (owner / manager only)
export async function DELETE(request: NextRequest) {
  const role = getRole(request);
  if (!role || (role !== "owner" && role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db()
    .from("shifts")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("restaurant_id", RID())
    .eq("status", "open");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
