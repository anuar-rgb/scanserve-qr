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

// GET — return all staff + their signature status per document
export async function GET(req: NextRequest) {
  const role = req.cookies.get("admin_session")?.value;
  if (!["owner", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();

  const [{ data: staff }, { data: documents }, { data: signatures }] =
    await Promise.all([
      supabase
        .from("staff_users")
        .select("id, display_name, username, role")
        .eq("restaurant_id", RID())
        .eq("is_active", true)
        .not("role", "in", "(owner)")
        .order("display_name", { ascending: true }),

      supabase
        .from("company_documents")
        .select("id, title, is_required")
        .eq("restaurant_id", RID())
        .order("created_at", { ascending: true }),

      supabase
        .from("employee_signatures")
        .select("document_id, staff_user_id, sign_token, status, signed_at")
        .eq("restaurant_id", RID()),
    ]);

  return NextResponse.json({
    staff:      staff      ?? [],
    documents:  documents  ?? [],
    signatures: signatures ?? [],
  });
}
