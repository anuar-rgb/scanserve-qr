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

// Removed unsigned-cookie RID helper — now using getSessionRestaurantId from signed session

export async function PUT(request: NextRequest) {
  const { getSessionRole, getSessionRestaurantId } = await import("@/lib/session");
  const role = getSessionRole(request);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sessionRid = getSessionRestaurantId(request);
  if (!sessionRid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const allowed = ["name", "wa_number", "report_whatsapp", "instagram_url", "phone", "address", "working_hours", "logo", "qr_checkin_enabled", "delivery_fee"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("restaurants")
    .update(update)
    .eq("id", sessionRid)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
