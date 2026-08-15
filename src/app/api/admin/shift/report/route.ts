import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const RID = (r: NextRequest) => r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// GET /api/admin/shift/report?shiftId=xxx
// Returns shift summary + restaurant report_whatsapp for building WhatsApp report
export async function GET(request: NextRequest) {
  const role = getSessionRole(request);
  if (!role || (role !== "owner" && role !== "manager" && role !== "supervisor" && role !== "cashier")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shiftId = request.nextUrl.searchParams.get("shiftId");
  if (!shiftId) {
    return NextResponse.json({ error: "shiftId required" }, { status: 400 });
  }

  const supabase = db();
  const restaurantId = RID(request);

  // Get restaurant report_whatsapp
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("report_whatsapp")
    .eq("id", restaurantId)
    .maybeSingle();

  // Get shift opened_at to filter orders
  const { data: shift } = await supabase
    .from("shifts")
    .select("opened_at, closed_at")
    .eq("id", shiftId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Fetch completed orders for this shift period
  const { data: orders } = await supabase
    .from("orders")
    .select("total_price, payment_method, payment_details, paid_amount")
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .gte("created_at", shift.opened_at)
    .lte("created_at", shift.closed_at ?? new Date().toISOString());

  const rows = (orders ?? []) as {
    total_price: number;
    payment_method: string | null;
    payment_details: Record<string, number> | null;
    paid_amount: number | null;
  }[];

  let revenue = 0;
  let cash = 0;
  let kaspi = 0;
  let halyk = 0;
  let card = 0;

  const CASH_KEYS  = new Set(["cash", "наличные", "наличка"]);
  const KASPI_KEYS = new Set(["kaspi", "каспи", "qr", "qr-kaspi"]);
  const HALYK_KEYS = new Set(["halyk", "halyk bank", "халык", "халык банк"]);
  const CARD_KEYS  = new Set(["card", "карта", "карты", "bank", "terminal"]);

  for (const order of rows) {
    // paid_amount defaults to 0 in DB; use || so 0 falls through to total_price
    const total = order.paid_amount || order.total_price || 0;
    revenue += total;

    if (order.payment_details && typeof order.payment_details === "object") {
      for (const [method, amount] of Object.entries(order.payment_details)) {
        const key = method.toLowerCase();
        if (CASH_KEYS.has(key))        cash  += amount;
        else if (KASPI_KEYS.has(key))  kaspi += amount;
        else if (HALYK_KEYS.has(key))  halyk += amount;
        else if (CARD_KEYS.has(key))   card  += amount;
        else                           kaspi += amount;
      }
    } else {
      const method = (order.payment_method ?? "").toLowerCase();
      if (CASH_KEYS.has(method))        cash  += total;
      else if (KASPI_KEYS.has(method))  kaspi += total;
      else if (HALYK_KEYS.has(method))  halyk += total;
      else if (CARD_KEYS.has(method))   card  += total;
      else                              kaspi += total;
    }
  }

  return NextResponse.json({
    reportWhatsapp: restaurant?.report_whatsapp ?? null,
    revenue,
    cash,
    kaspi,
    halyk,
    card,
    ordersCount: rows.length,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
  });
}
