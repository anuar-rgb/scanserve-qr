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

const RID = (r: NextRequest) =>
  r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

const ALLOWED_ROLES = new Set(["owner", "manager", "supervisor", "chef"]);

export async function GET(req: NextRequest) {
  const { getSessionRole } = await import("@/lib/session");
  const role = getSessionRole(req);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const rid = RID(req);

  const [prodsRes, catsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, emoji, price, category_id, remaining_qty, is_available")
      .eq("restaurant_id", rid)
      .eq("is_archived", false)
      .order("order_index"),
    supabase
      .from("categories")
      .select("id, name, order_index")
      .eq("restaurant_id", rid)
      .order("order_index"),
  ]);

  if (prodsRes.error) return NextResponse.json({ error: prodsRes.error.message }, { status: 500 });

  return NextResponse.json({
    products: prodsRes.data ?? [],
    categories: catsRes.data ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const { getSessionRole } = await import("@/lib/session");
  const role = getSessionRole(req);
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    productId?: string;
    remainingQty?: number | null;
  };
  const { productId, remainingQty } = body;

  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const supabase = db();
  const rid = RID(req);

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("restaurant_id", rid)
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Sync is_available: 0 = stop-list (unavailable), null or >0 = available
  const updates: Record<string, unknown> = {
    remaining_qty: remainingQty ?? null,
    is_available: remainingQty === 0 ? false : true,
  };

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("restaurant_id", rid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
