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

// POST — generate (or retrieve existing) sign link for a staff member
// Body: { staffUserId: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = req.cookies.get("admin_session")?.value;
  if (!["owner", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: documentId } = await params;
  const body = await req.json().catch(() => ({})) as { staffUserId?: string };
  if (!body.staffUserId) {
    return NextResponse.json({ error: "staffUserId required" }, { status: 400 });
  }

  const supabase = db();

  // Verify document belongs to this restaurant
  const { data: doc } = await supabase
    .from("company_documents")
    .select("id")
    .eq("id", documentId)
    .eq("restaurant_id", RID(req))
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Upsert: create if not exists, return existing if already there
  const { data: sig, error } = await supabase
    .from("employee_signatures")
    .upsert(
      {
        restaurant_id: RID(req),
        document_id: documentId,
        staff_user_id: body.staffUserId,
      },
      { onConflict: "document_id,staff_user_id", ignoreDuplicates: true },
    )
    .select("sign_token, status")
    .maybeSingle();

  // If upsert returned nothing (ignoreDuplicates=true and row already existed), fetch it
  let token: string;
  let status: string;
  if (sig) {
    token = sig.sign_token;
    status = sig.status;
  } else {
    const { data: existing, error: fetchErr } = await supabase
      .from("employee_signatures")
      .select("sign_token, status")
      .eq("document_id", documentId)
      .eq("staff_user_id", body.staffUserId)
      .single();
    if (fetchErr || !existing) {
      return NextResponse.json({ error: error?.message ?? "Failed to generate link" }, { status: 500 });
    }
    token = existing.sign_token;
    status = existing.status;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json({ url: `${baseUrl}/shared/sign/${token}`, token, status });
}
