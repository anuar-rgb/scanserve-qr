import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";
import { RESTAURANT_ID } from "@/constants";

const AS_TORI_ID = "6bc6f9af-b494-4d23-ba53-32d4d47bb08d";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// POST /api/admin/test-reset-all
// Удаляет все заказы, бонусы и запросы на возврат ресторана.
// Только для владельца. Используется исключительно для тестирования.
export async function POST(req: NextRequest) {
  const role = getSessionRole(req);
  const ALLOWED = new Set(["owner", "manager", "supervisor"]);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Только для ресторана Ас Төрі — для тестирования
  const callerRid =
    req.cookies.get("admin_restaurant_id")?.value ?? RESTAURANT_ID;
  if (callerRid !== AS_TORI_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();
  const rid = RESTAURANT_ID;

  const steps: Array<{ table: string; error: string | null }> = [];

  const { error: e1 } = await supabase.from("refund_requests").delete().eq("restaurant_id", rid);
  steps.push({ table: "refund_requests", error: e1?.message ?? null });

  const { error: e2 } = await supabase.from("bonus_transactions").delete().eq("restaurant_id", rid);
  if (e2 && !e2.message.includes("does not exist")) steps.push({ table: "bonus_transactions", error: e2.message });

  const { error: e3 } = await supabase.from("guest_balances").delete().eq("restaurant_id", rid);
  steps.push({ table: "guest_balances", error: e3?.message ?? null });

  const { error: e4 } = await supabase.from("orders").delete().eq("restaurant_id", rid);
  steps.push({ table: "orders", error: e4?.message ?? null });

  const errors = steps.filter((s) => s.error).map((s) => `${s.table}: ${s.error}`);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
