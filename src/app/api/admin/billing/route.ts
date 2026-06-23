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

export async function GET(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db()
    .from("restaurants")
    .select("name, monthly_payment_status, payment_due_date")
    .eq("id", RID(request))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    name: data.name,
    status: data.monthly_payment_status ?? "unpaid",
    dueDate: data.payment_due_date ?? null,
  });
}
