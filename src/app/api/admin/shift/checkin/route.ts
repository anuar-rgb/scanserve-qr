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

// POST — staff checks into the current active shift (requires QR token)
export async function POST(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staffUserId = request.cookies.get("admin_user_id")?.value ?? null;
  if (!staffUserId) return NextResponse.json({ error: "No user ID in session" }, { status: 400 });

  // Verify QR token
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const qrToken = body?.qrToken as string | undefined;
  const expected = process.env.QR_CHECKIN_SECRET;
  if (!expected || qrToken !== expected) {
    return NextResponse.json({ error: "Неверный QR-код заведения" }, { status: 403 });
  }

  const supabase = db();

  // Verify all required documents are signed by this staff member
  const { data: requiredDocs } = await supabase
    .from("company_documents")
    .select("id")
    .eq("restaurant_id", RID())
    .eq("is_required", true);

  if (requiredDocs && requiredDocs.length > 0) {
    const { data: signedDocs } = await supabase
      .from("employee_signatures")
      .select("document_id")
      .eq("restaurant_id", RID())
      .eq("staff_user_id", staffUserId)
      .eq("status", "signed");

    const signedIds = new Set((signedDocs ?? []).map((s) => s.document_id));
    const hasUnsigned = requiredDocs.some((d) => !signedIds.has(d.id));

    if (hasUnsigned) {
      return NextResponse.json(
        { error: "Доступ заблокирован. Сначала подпишите обязательные документы." },
        { status: 403 },
      );
    }
  }

  // Find the current open shift
  const { data: shift } = await supabase
    .from("shifts")
    .select("id")
    .eq("restaurant_id", RID())
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) {
    return NextResponse.json({ error: "Нет открытой смены" }, { status: 404 });
  }

  // Upsert checkin — reset checked_out_at so re-checkin after checkout works
  const { data, error } = await supabase
    .from("shift_checkins")
    .upsert(
      { shift_id: shift.id, staff_user_id: staffUserId, restaurant_id: RID(), checked_out_at: null },
      { onConflict: "shift_id,staff_user_id", ignoreDuplicates: false },
    )
    .select("staff_user_id, checked_in_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkin: data });
}
