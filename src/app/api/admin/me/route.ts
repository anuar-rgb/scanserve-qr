import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type AdminRole =
  | "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "chef"
  | "bartender" | "hostess" | "courier" | "cleaner" | "doorman"
  | "sommelier" | "senior_waiter" | "runner" | "storekeeper" | "accountant";

const VALID_ROLES: AdminRole[] = [
  "owner", "manager", "supervisor", "cashier", "waiter", "chef",
  "bartender", "hostess", "courier", "cleaner", "doorman",
  "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
];

export async function GET(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = VALID_ROLES.includes(session.value as AdminRole)
    ? (session.value as AdminRole)
    : "owner";
  const id           = request.cookies.get("admin_user_id")?.value ?? null;
  const restaurantId = request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID ?? null;

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

  return NextResponse.json({ role, id, display_name, restaurant_id: restaurantId });
}
