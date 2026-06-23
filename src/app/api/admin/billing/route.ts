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

  const supabase = db();
  const rid = RID(request);

  const [restRes, histRes, staffRes, ordersRes] = await Promise.all([
    supabase
      .from("restaurants")
      .select("name, monthly_payment_status, payment_due_date, plan_id")
      .eq("id", rid)
      .single(),
    supabase
      .from("payment_history")
      .select("id, amount, payment_method, period_start, period_end, status, notes, created_at")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("staff_users")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", rid),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", rid)
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  let plan = null;
  if (restRes.data?.plan_id) {
    const { data: planData } = await supabase
      .from("subscription_plans")
      .select("name, monthly_price, max_staff, max_orders_month, features")
      .eq("id", restRes.data.plan_id)
      .single();
    plan = planData;
  }

  return NextResponse.json({
    name: restRes.data?.name ?? "",
    status: restRes.data?.monthly_payment_status ?? "unpaid",
    dueDate: restRes.data?.payment_due_date ?? null,
    plan: plan ?? { name: "Стандарт", monthly_price: 30000, max_staff: 15, max_orders_month: 2000, features: [] },
    payments: histRes.data ?? [],
    usage: {
      staff: staffRes.count ?? 0,
      ordersThisMonth: ordersRes.count ?? 0,
    },
  });
}
