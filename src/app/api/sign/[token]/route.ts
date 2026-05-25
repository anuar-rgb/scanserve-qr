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

// GET — public endpoint: fetch sign request details by token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = db();

  const { data: sig } = await supabase
    .from("employee_signatures")
    .select(`
      id,
      status,
      signed_at,
      document_id,
      staff_user_id,
      company_documents (
        title,
        content
      )
    `)
    .eq("sign_token", token)
    .maybeSingle();

  if (!sig) return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });

  // Get staff display name
  const { data: staff } = await supabase
    .from("staff_users")
    .select("display_name, username")
    .eq("id", sig.staff_user_id)
    .maybeSingle();

  const doc = Array.isArray(sig.company_documents)
    ? sig.company_documents[0]
    : sig.company_documents;

  return NextResponse.json({
    status:     sig.status,
    signedAt:   sig.signed_at,
    staffName:  staff?.display_name ?? staff?.username ?? "Сотрудник",
    document: {
      title:   doc?.title   ?? "",
      content: doc?.content ?? "",
    },
  });
}

// POST — public endpoint: submit handwritten signature
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({})) as { signatureImage?: string };

  if (!body.signatureImage) {
    return NextResponse.json({ error: "signatureImage required" }, { status: 400 });
  }

  // Capture IP address for legal record
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const supabase = db();

  // Verify token exists and is still pending
  const { data: sig } = await supabase
    .from("employee_signatures")
    .select("id, status")
    .eq("sign_token", token)
    .maybeSingle();

  if (!sig) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (sig.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 409 });
  }

  const { error } = await supabase
    .from("employee_signatures")
    .update({
      signature_image: body.signatureImage,
      signed_at:       new Date().toISOString(),
      ip_address:      ip,
      status:          "signed",
    })
    .eq("id", sig.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
