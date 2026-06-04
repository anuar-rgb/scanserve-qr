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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

// POST /api/guest/register
// Body: { name?, phone, password, restaurantId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    name?: string;
    phone?: string;
    password?: string;
    restaurantId?: string;
  };

  const { name, phone, password, restaurantId } = body;

  if (!phone?.trim() || !password || !restaurantId) {
    return NextResponse.json({ error: "Телефон, пароль и ID ресторана обязательны" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен содержать не менее 6 символов" }, { status: 400 });
  }

  const supabase = db();
  const passwordHash = hashPassword(password);

  const { data: guest, error: insertErr } = await supabase
    .from("guests")
    .insert({ phone: phone.trim(), name: name?.trim() || null, password_hash: passwordHash })
    .select("id, name, phone")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "Этот номер телефона уже зарегистрирован" }, { status: 409 });
    }
    return NextResponse.json({ error: "Ошибка регистрации. Попробуйте ещё раз." }, { status: 500 });
  }

  // Link crm_clients rows that share this phone to the guest profile
  await supabase
    .from("crm_clients")
    .update({ guest_id: guest.id })
    .eq("phone", guest.phone)
    .eq("restaurant_id", restaurantId)
    .is("guest_id", null);

  // Create zero-balance wallet for this restaurant
  await supabase
    .from("guest_balances")
    .insert({ guest_id: guest.id, restaurant_id: restaurantId, bonus_amount: 0 })
    .select()
    .maybeSingle();

  return NextResponse.json({ id: guest.id, name: guest.name, phone: guest.phone, bonusAmount: 0 });
}
