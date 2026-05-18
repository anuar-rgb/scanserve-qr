import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type AdminRole = "owner" | "manager" | "cashier" | "waiter" | "chef";

const VALID_ROLES: AdminRole[] = ["owner", "manager", "cashier", "waiter", "chef"];

export async function GET(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = VALID_ROLES.includes(session.value as AdminRole)
    ? (session.value as AdminRole)
    : "owner";
  const id = request.cookies.get("admin_user_id")?.value ?? null;

  let display_name: string | null = null;
  if (id) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
      const { data } = await supabase
        .from("staff_users")
        .select("display_name, username")
        .eq("id", id)
        .single();
      display_name = data?.display_name || data?.username || null;
    } catch {}
  }

  return NextResponse.json({ role, id, display_name });
}
