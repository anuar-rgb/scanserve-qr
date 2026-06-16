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
    .select("id, opened_at")
    .eq("restaurant_id", RID(request))
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

// POST — open a new shift (owner / manager / cashier)
export async function POST(request: NextRequest) {
  const role = getRole(request);
  if (!role || (role !== "owner" && role !== "manager" && role !== "cashier")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();
  const openedBy = getUserId(request);

  // Return existing open shift if already open
  const { data: existing } = await supabase
    .from("shifts")
    .select("id, opened_at")
    .eq("restaurant_id", RID(request))
    .eq("status", "open")
    .maybeSingle();

  if (existing) return NextResponse.json({ shift: existing });

  // Try to record who opened the shift; fall back silently if column missing
  const insertPayload: Record<string, unknown> = { restaurant_id: RID(request), status: "open" };
  if (openedBy) insertPayload.opened_by = openedBy;

  const { data, error } = await supabase
    .from("shifts")
    .insert(insertPayload)
    .select("id, opened_at")
    .single();

  if (error) {
    // If opened_by column doesn't exist yet, retry without it
    if (error.message.includes("opened_by") || error.code === "42703") {
      const { data: data2, error: error2 } = await supabase
        .from("shifts")
        .insert({ restaurant_id: RID(request), status: "open" })
        .select("id, opened_at")
        .single();
      if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
      return NextResponse.json({ shift: data2 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shift: data });
}

// DELETE — close current shift (owner / manager / cashier)
export async function DELETE(request: NextRequest) {
  const role = getRole(request);
  if (!role || (role !== "owner" && role !== "manager" && role !== "cashier")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();

  // Block shift close if there are active dine-in orders
  const { data: activeOrders } = await supabase
    .from("orders")
    .select("table_number")
    .eq("restaurant_id", RID(request))
    .in("status", ["pending", "confirmed", "preparing", "ready"])
    .not("table_number", "is", null);

  if (activeOrders && activeOrders.length > 0) {
    const tables = [...new Set(activeOrders.map((o: { table_number: string }) => o.table_number).filter(Boolean))];
    return NextResponse.json({ blocked: true, tables }, { status: 409 });
  }

  const { error } = await supabase
    .from("shifts")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("restaurant_id", RID(request))
    .eq("status", "open");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
