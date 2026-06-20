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

async function createAttendanceForUser(supabase: ReturnType<typeof db>, userId: string, restaurantId: string) {
  const { data: existing } = await supabase
    .from("employee_attendance")
    .select("id")
    .eq("employee_id", userId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .is("check_out", null)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await supabase.from("employee_attendance").insert({
      employee_id: userId,
      restaurant_id: restaurantId,
      check_in: new Date().toISOString(),
      status: "active",
      source: "shift",
    });
  }
}

async function closeAttendanceForUser(supabase: ReturnType<typeof db>, userId: string, restaurantId: string) {
  const now = new Date();
  const { data: activeAtt } = await supabase
    .from("employee_attendance")
    .select("id, check_in")
    .eq("employee_id", userId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .is("check_out", null)
    .order("check_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeAtt) {
    const totalHours = (now.getTime() - new Date(activeAtt.check_in).getTime()) / 3_600_000;
    await supabase
      .from("employee_attendance")
      .update({ check_out: now.toISOString(), total_hours: Math.round(totalHours * 100) / 100, status: "completed" })
      .eq("id", activeAtt.id);
  }
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

      // Sync: create attendance for the opener (best effort)
      if (openedBy) {
        try { await createAttendanceForUser(supabase, openedBy, RID(request)); } catch (_) {}
      }
      return NextResponse.json({ shift: data2 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync: create attendance for the opener (best effort)
  if (openedBy) {
    try { await createAttendanceForUser(supabase, openedBy, RID(request)); } catch (_) {}
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

  // Find the open shift before closing it
  const { data: openShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("restaurant_id", RID(request))
    .eq("status", "open")
    .maybeSingle();

  const { error } = await supabase
    .from("shifts")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("restaurant_id", RID(request))
    .eq("status", "open");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync: auto-checkout all remaining staff + close their attendance (best effort)
  if (openShift) {
    try {
      const now = new Date().toISOString();

      // Find staff still checked in to this shift
      const { data: remaining } = await supabase
        .from("shift_checkins")
        .select("staff_user_id")
        .eq("shift_id", openShift.id)
        .is("checked_out_at", null);

      // Bulk checkout from shift_checkins
      await supabase
        .from("shift_checkins")
        .update({ checked_out_at: now })
        .eq("shift_id", openShift.id)
        .is("checked_out_at", null);

      // Close attendance for each remaining staff member
      if (remaining) {
        for (const r of remaining) {
          try { await closeAttendanceForUser(supabase, r.staff_user_id, RID(request)); } catch (_) {}
        }
      }

      // Also close attendance for the person closing the shift (owner/manager)
      const closerId = getUserId(request);
      if (closerId) {
        try { await closeAttendanceForUser(supabase, closerId, RID(request)); } catch (_) {}
      }
    } catch (_) { /* best effort */ }
  }

  return NextResponse.json({ ok: true });
}
