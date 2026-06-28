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

// GET /api/admin/documents/print-data?docId=...&staffId=...
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

  const [sigRes, docRes, staffRes, restRes] = await Promise.all([
    supabase
      .from("employee_signatures")
      .select("signature_image, signed_at, ip_address, phone_number, device_model, device_id")
      .eq("restaurant_id", RID(req))
      .eq("document_id",   docId)
      .eq("staff_user_id", staffId)
      .eq("status",        "signed")
      .maybeSingle(),
    supabase
      .from("company_documents")
      .select("title, content")
      .eq("id",            docId)
      .eq("restaurant_id", RID(req))
      .maybeSingle(),
    supabase
      .from("staff_users")
      .select("display_name, username")
      .eq("id", staffId)
      .maybeSingle(),
    supabase
      .from("restaurants")
      .select("name")
      .eq("id", RID(req))
      .maybeSingle(),
  ]);

  if (sigRes.error)  return NextResponse.json({ error: sigRes.error.message }, { status: 500 });
  if (!sigRes.data)  return NextResponse.json({ error: "Подпись не найдена" },  { status: 404 });
  if (!docRes.data)  return NextResponse.json({ error: "Документ не найден" },  { status: 404 });

  return NextResponse.json({
    restaurantName:  restRes.data?.name                                     ?? "Компания",
    document:        { title: docRes.data.title, content: docRes.data.content },
    staffName:       staffRes.data?.display_name ?? staffRes.data?.username  ?? "Сотрудник",
    signatureImage:  sigRes.data.signature_image  ?? null,
    signedAt:        sigRes.data.signed_at         ?? null,
    ipAddress:       sigRes.data.ip_address        ?? null,
    phoneNumber:     sigRes.data.phone_number      ?? null,
    deviceModel:     sigRes.data.device_model      ?? null,
    deviceId:        sigRes.data.device_id         ?? null,
  });
}
