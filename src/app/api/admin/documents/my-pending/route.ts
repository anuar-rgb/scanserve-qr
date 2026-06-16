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

// GET — returns required documents not yet signed by the current staff member.
// Auto-creates employee_signatures records (with sign_token) for any missing ones,
// so the blocking screen can immediately show sign links.
export async function GET(req: NextRequest) {
  const staffUserId = req.cookies.get("admin_user_id")?.value;
  if (!staffUserId) return NextResponse.json({ docs: [] });

  const supabase = db();

  // All required documents for this restaurant
  const { data: allDocs } = await supabase
    .from("company_documents")
    .select("id, title")
    .eq("restaurant_id", RID(req))
    .eq("is_required", true);

  if (!allDocs || allDocs.length === 0) return NextResponse.json({ docs: [] });

  // Existing signature records for this staff member
  const { data: existingSigs } = await supabase
    .from("employee_signatures")
    .select("document_id, status, sign_token")
    .eq("restaurant_id", RID(req))
    .eq("staff_user_id", staffUserId);

  const sigMap = new Map(existingSigs?.map((s) => [s.document_id, s]) ?? []);

  // Determine which docs need a new employee_signatures record
  const toCreate = allDocs
    .filter((d) => !sigMap.has(d.id))
    .map((d) => ({
      restaurant_id: RID(req),
      document_id: d.id,
      staff_user_id: staffUserId,
    }));

  if (toCreate.length > 0) {
    const { data: created } = await supabase
      .from("employee_signatures")
      .insert(toCreate)
      .select("document_id, status, sign_token");

    for (const row of created ?? []) {
      sigMap.set(row.document_id, row);
    }
  }

  // Return docs that are still pending
  const pending = allDocs
    .map((d) => {
      const sig = sigMap.get(d.id);
      return { id: d.id, title: d.title, signToken: sig?.sign_token ?? null };
    })
    .filter((d) => {
      const sig = sigMap.get(d.id);
      return !sig || sig.status !== "signed";
    });

  return NextResponse.json({ docs: pending });
}
