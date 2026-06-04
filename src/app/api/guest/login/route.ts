import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

// POST /api/guest/login
// Body: { phone, password, restaurantId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    phone?: string;
    password?: string;
    restaurantId?: string;
  };

  const { phone, password, restaurantId } = body;

  if (!phone?.trim() || !password || !restaurantId) {
    return NextResponse.json({ error: "Телефон, пароль и ID ресторана обязательны" }, { status: 400 });
  }

  const supabase = db();

  const { data: guest } = await supabase
    .from("guests")
    .select("id, name, phone, password_hash")
    .eq("phone", phone.trim())
    .maybeSingle();

  if (!guest || !verifyPassword(password, guest.password_hash)) {
    return NextResponse.json({ error: "Неверный номер телефона или пароль" }, { status: 401 });
  }

  // Ensure balance row exists for this restaurant (insert if missing, ignore if exists)
  await supabase
    .from("guest_balances")
    .insert({ guest_id: guest.id, restaurant_id: restaurantId, bonus_amount: 0 })
    .select()
    .maybeSingle();

  // Fetch actual balance (may already exist with non-zero amount)
  const { data: balance } = await supabase
    .from("guest_balances")
    .select("bonus_amount")
    .eq("guest_id", guest.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return NextResponse.json({
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    bonusAmount: balance?.bonus_amount ?? 0,
  });
}
