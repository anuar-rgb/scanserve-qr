import { NextResponse } from "next/server";
import { verifySuperAdminSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function requireAuth(request: NextRequest) {
  return verifySuperAdminSession(request.cookies.get("super_admin_session")?.value ?? "");
}

// POST — clone menu (categories + products) from one restaurant to another
export async function POST(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceRestaurantId, targetRestaurantId } = await request.json();
  if (!sourceRestaurantId || !targetRestaurantId) {
    return NextResponse.json({ error: "sourceRestaurantId and targetRestaurantId required" }, { status: 400 });
  }

  const supabase = db();

  // 1. Get source categories
  const { data: srcCategories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", sourceRestaurantId)
    .order("order_index");

  if (!srcCategories || srcCategories.length === 0) {
    return NextResponse.json({ error: "Source restaurant has no categories" }, { status: 404 });
  }

  // 2. Get source products
  const { data: srcProducts } = await supabase
    .from("products")
    .select("*")
    .eq("restaurant_id", sourceRestaurantId);

  let categoriesCloned = 0;
  let productsCloned = 0;
  const categoryIdMap = new Map<string, string>();

  // 3. Clone categories
  for (const cat of srcCategories) {
    const { id: _oldId, restaurant_id: _rid, created_at: _ca, ...catData } = cat;
    const { data: newCat } = await supabase
      .from("categories")
      .insert({ ...catData, restaurant_id: targetRestaurantId })
      .select("id")
      .single();

    if (newCat) {
      categoryIdMap.set(cat.id, newCat.id);
      categoriesCloned++;
    }
  }

  // 4. Clone products
  if (srcProducts) {
    for (const prod of srcProducts) {
      const newCatId = categoryIdMap.get(prod.category_id);
      if (!newCatId) continue;

      const { id: _oldId, restaurant_id: _rid, created_at: _ca, ...prodData } = prod;
      const { error } = await supabase
        .from("products")
        .insert({ ...prodData, restaurant_id: targetRestaurantId, category_id: newCatId });

      if (!error) productsCloned++;
    }
  }

  return NextResponse.json({
    ok: true,
    categoriesCloned,
    productsCloned,
  });
}
