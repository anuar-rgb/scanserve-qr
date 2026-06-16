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

// PATCH — update a document
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = req.cookies.get("admin_session")?.value;
  if (!["owner", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    title?: string;
    content?: string;
    is_required?: boolean;
  };

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined)       patch.title       = body.title.trim();
  if (body.content !== undefined)     patch.content     = body.content.trim();
  if (body.is_required !== undefined) patch.is_required = body.is_required;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("company_documents")
    .update(patch)
    .eq("id", id)
    .eq("restaurant_id", RID(req))
    .select("id, title, content, is_required, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If document content changed — reset all employee signatures so they must re-sign
  const signaturesReset = body.content !== undefined;
  if (signaturesReset) {
    await supabase
      .from("employee_signatures")
      .update({ status: "pending", signature_image: null, signed_at: null, ip_address: null })
      .eq("document_id", id)
      .eq("restaurant_id", RID(req));
  }

  return NextResponse.json({ document: data, signaturesReset });
}

// DELETE — remove a document (also cascades to employee_signatures)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = req.cookies.get("admin_session")?.value;
  if (!["owner", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = db();
  const { error } = await supabase
    .from("company_documents")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", RID(req));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
