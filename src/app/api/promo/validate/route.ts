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

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  if (!origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    code?: string;
    restaurantId?: string;
    orderTotal?: number;
  };

  const { code, restaurantId, orderTotal } = body;
  if (!code || !restaurantId) {
    return NextResponse.json({ valid: false, message: "Введите промокод" }, { status: 400 });
  }

  const supabase = db();

  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!promo) {
    return NextResponse.json({ valid: false, message: "Промокод не найден" });
  }

  if (!promo.is_active) {
    return NextResponse.json({ valid: false, message: "Промокод неактивен" });
  }

  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return NextResponse.json({ valid: false, message: "Промокод ещё не действует" });
  }
  if (promo.valid_to && new Date(promo.valid_to) < now) {
    return NextResponse.json({ valid: false, message: "Промокод истёк" });
  }

  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return NextResponse.json({ valid: false, message: "Промокод исчерпан" });
  }

  const total = orderTotal ?? 0;
  if (promo.min_order_amount && total < promo.min_order_amount) {
    return NextResponse.json({
      valid: false,
      message: `Минимальная сумма заказа: ${promo.min_order_amount.toLocaleString("ru-RU")} ₸`,
    });
  }

  let discountAmount: number;
  if (promo.discount_type === "percent") {
    discountAmount = Math.round(total * Number(promo.discount_value) / 100);
  } else {
    discountAmount = Math.round(Number(promo.discount_value));
  }
  discountAmount = Math.min(discountAmount, total);

  const label = promo.discount_type === "percent"
    ? `${promo.code} — скидка ${Number(promo.discount_value)}%`
    : `${promo.code} — скидка ${Number(promo.discount_value).toLocaleString("ru-RU")} ₸`;

  return NextResponse.json({
    valid: true,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
    discountAmount,
    label,
  });
}
