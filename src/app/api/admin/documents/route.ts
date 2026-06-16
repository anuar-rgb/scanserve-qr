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

// GET — list all documents for restaurant
export async function GET(req: NextRequest) {
  const role = req.cookies.get("admin_session")?.value;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = db();
  const { data, error } = await supabase
    .from("company_documents")
    .select("id, title, content, is_required, created_at")
    .eq("restaurant_id", RID(req))
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

// POST — create a new document
export async function POST(req: NextRequest) {
  const role = req.cookies.get("admin_session")?.value;
  if (!["owner", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    content?: string;
    is_required?: boolean;
  };
  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("company_documents")
    .insert({
      restaurant_id: RID(req),
      title: body.title.trim(),
      content: body.content.trim(),
      is_required: body.is_required ?? true,
    })
    .select("id, title, content, is_required, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
