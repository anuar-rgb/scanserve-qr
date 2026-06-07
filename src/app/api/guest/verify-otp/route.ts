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

// POST /api/guest/verify-otp
// Body: { accessToken, name?, phone?, restaurantId, isRegister }
// Called after client-side supabase.auth.verifyOtp() succeeds.
// Verifies the Supabase Auth JWT, then creates or fetches the guest profile.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    accessToken?: string;
    name?: string;
    phone?: string;
    restaurantId?: string;
    isRegister?: boolean;
  };

  const { accessToken, name, phone, restaurantId, isRegister } = body;

  if (!accessToken || !restaurantId) {
    return NextResponse.json({ error: "accessToken и restaurantId обязательны" }, { status: 400 });
  }

  const supabase = db();

  // Verify the access token and extract the authenticated user's email
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user?.email) {
    return NextResponse.json({ error: "Недействительный или истёкший токен" }, { status: 401 });
  }

  const email = user.email;

  // Look up existing guest by email
  const { data: existing } = await supabase
    .from("guests")
    .select("id, name, phone, email")
    .eq("email", email)
    .maybeSingle();

  let guest: { id: string; name: string | null; phone: string | null; email: string };

  if (existing) {
    // Update name/phone only if not already set
    const updates: Record<string, string> = {};
    if (name?.trim() && !existing.name) updates.name = name.trim();
    if (phone?.trim() && !existing.phone) updates.phone = phone.trim();
    if (Object.keys(updates).length > 0) {
      await supabase.from("guests").update(updates).eq("id", existing.id);
    }
    guest = { ...existing, ...updates } as typeof guest;
  } else {
    // Guest not found — require registration flow
    if (!isRegister) {
      return NextResponse.json(
        { error: "Гость с этим email не зарегистрирован. Перейдите во вкладку «Регистрация»." },
        { status: 404 },
      );
    }

    const { data: created, error: insertErr } = await supabase
      .from("guests")
      .insert({ email, name: name?.trim() || null, phone: phone?.trim() || null })
      .select("id, name, phone, email")
      .single();

    if (insertErr || !created) {
      console.error("guests insert error:", insertErr);
      return NextResponse.json({ error: "Ошибка при создании профиля" }, { status: 500 });
    }
    guest = created as typeof guest;
  }

  // Link crm_clients by phone to the guest profile
  if (guest.phone) {
    await supabase
      .from("crm_clients")
      .update({ guest_id: guest.id })
      .eq("phone", guest.phone)
      .eq("restaurant_id", restaurantId)
      .is("guest_id", null);
  }

  // Ensure balance row exists (insert only, ignore duplicate)
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
    email: guest.email,
    bonusAmount: balance?.bonus_amount ?? 0,
  });
}
