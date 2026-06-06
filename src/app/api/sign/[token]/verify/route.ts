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

// POST — verify that the staff member knows their own password before signing
// Body: { password: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({})) as { password?: string };

  if (!body.password) {
    return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
  }

  const supabase = db();

  // Get the signature request + staff user info
  const { data: sig } = await supabase
    .from("employee_signatures")
    .select("staff_user_id, status")
    .eq("sign_token", token)
    .maybeSingle();

  if (!sig) return NextResponse.json({ error: "Ссылка не найдена" }, { status: 404 });
  if (sig.status === "signed") return NextResponse.json({ error: "Документ уже подписан" }, { status: 409 });

  const { data: staff } = await supabase
    .from("staff_users")
    .select("restaurant_id, username")
    .eq("id", sig.staff_user_id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

  // Verify password using the existing pgcrypto RPC
  const { data: verified } = await supabase.rpc("verify_staff_password", {
    p_restaurant_id: staff.restaurant_id,
    p_username:      staff.username,
    p_password:      body.password,
  });

  if (!verified || (Array.isArray(verified) && verified.length === 0)) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
