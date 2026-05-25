import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function getSessionRole(request: NextRequest) {
  return request.cookies.get("admin_session")?.value ?? null;
}

// PATCH /api/admin/staff/[id] — update role, display_name, or is_active
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionRole = getSessionRole(request);
  if (sessionRole !== "owner" && sessionRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const allowed = ["role", "display_name", "is_active", "phone"] as const;
  const update: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (update.role) {
    const VALID_ROLES = [
      "owner", "manager", "cashier", "waiter", "chef",
      "bartender", "hostess", "courier", "cleaner", "doorman",
      "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
    ];
    if (!VALID_ROLES.includes(update.role as string)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Managers cannot promote anyone to owner
    if (sessionRole === "manager" && update.role === "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const supabase = serverSupabase();

  // Managers cannot edit owner accounts
  if (sessionRole === "manager") {
    const { data: target } = await supabase
      .from("staff_users")
      .select("role")
      .eq("id", id)
      .eq("restaurant_id", process.env.NEXT_PUBLIC_RESTAURANT_ID!)
      .single();
    if (target?.role === "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("staff_users")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", process.env.NEXT_PUBLIC_RESTAURANT_ID!);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/staff/[id] — permanently delete staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionRole = getSessionRole(request);
  if (sessionRole !== "owner" && sessionRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = serverSupabase();

  // Managers cannot delete owner accounts
  if (sessionRole === "manager") {
    const { data: target } = await supabase
      .from("staff_users")
      .select("role")
      .eq("id", id)
      .eq("restaurant_id", process.env.NEXT_PUBLIC_RESTAURANT_ID!)
      .single();
    if (target?.role === "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("staff_users")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", process.env.NEXT_PUBLIC_RESTAURANT_ID!);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
