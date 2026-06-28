import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
const RID = (r: NextRequest) => r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// GET /api/admin/documents/signature-image?docId=...&staffId=...
export async function GET(req: NextRequest) {
  const role = getSessionRole(req);
  if (!["owner", "manager", "supervisor"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const docId   = searchParams.get("docId");
  const staffId = searchParams.get("staffId");

  if (!docId || !staffId) {
    return NextResponse.json({ error: "docId and staffId required" }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("employee_signatures")
    .select("signature_image, signed_at, ip_address, phone_number, device_model, device_id")
    .eq("restaurant_id", RID(req))
    .eq("document_id",   docId)
    .eq("staff_user_id", staffId)
    .eq("status", "signed")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" },  { status: 404 });

  return NextResponse.json({
    signatureImage: data.signature_image ?? null,
    signedAt:       data.signed_at       ?? null,
    ipAddress:      data.ip_address      ?? null,
    phoneNumber:    data.phone_number    ?? null,
    deviceModel:    data.device_model    ?? null,
    deviceId:       data.device_id       ?? null,
  });
}
