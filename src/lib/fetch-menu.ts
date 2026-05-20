import { supabase, isConfigured } from "./supabase";
import type { MenuCategory } from "@/components/MenuTemplate";
import type { DbBanner, DbCategory, DbHeroSlide, DbInfoShowcase, DbModifier, DbPaymentBank, DbProduct, DbRestaurant } from "./db-types";

export async function fetchRestaurantBySlug(slug: string): Promise<DbRestaurant | null> {
  if (!isConfigured || !slug) return null;
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as DbRestaurant;
}

export async function fetchMenuCategories(restaurantId: string): Promise<MenuCategory[] | null> {
  if (!isConfigured || !restaurantId) return null;

  const [catsRes, prodsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("order_index"),
    supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_archived", false)
      .order("order_index"),
  ]);

  if (catsRes.error || prodsRes.error || !catsRes.data || !prodsRes.data) return null;

  const cats = catsRes.data as DbCategory[];
  const prods = prodsRes.data as DbProduct[];

  // Build a set of child category IDs for quick lookup
  const childIds = new Set(cats.filter(c => c.parent_id).map(c => c.id));

  function mapProduct(p: DbProduct) {
    return {
      id: p.id,
      emoji: p.emoji ?? "🍽️",
      imageUrl: p.image_url ?? undefined,
      badge: p.badge ?? undefined,
      discountLabel: p.discount_label ?? undefined,
      isNew: p.is_new,
      isPopular: p.is_popular,
      isSpicy: p.is_spicy,
      isPromo: p.is_promo,
      isRecommended: p.is_recommended,
      badgeColor: p.badge_color ?? undefined,
      name: p.name,
      desc: p.description ?? { en: "", ru: "", kz: "" },
      price: p.price,
      ingredients: p.ingredients ?? undefined,
    };
  }

  // Only root categories appear at top level; subcategory products are merged in
  return cats
    .filter(cat => !cat.parent_id)
    .map(cat => {
      const subCatIds = cats.filter(c => c.parent_id === cat.id).map(c => c.id);
      const dishes = prods
        .filter(p => p.category_id === cat.id || subCatIds.includes(p.category_id))
        .map(mapProduct);
      return { id: cat.id, icon: cat.icon ?? "🍽️", name: cat.name, imageUrl: cat.image_url ?? undefined, dishes };
    })
    .filter(cat => cat.dishes.length > 0);
}

export async function fetchBanners(restaurantId: string): Promise<DbBanner[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");
  if (error || !data) return null;
  return data as DbBanner[];
}

export async function fetchHeroSlides(restaurantId: string): Promise<DbHeroSlide[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");
  if (error || !data) return null;
  return data as DbHeroSlide[];
}

export async function fetchInfoShowcase(restaurantId: string): Promise<DbInfoShowcase[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("info_showcases")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");
  if (error || !data) return null;
  return data as DbInfoShowcase[];
}

export async function fetchPaymentBanks(restaurantId: string): Promise<DbPaymentBank[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("payment_banks")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");
  if (error || !data) return null;
  return data as DbPaymentBank[];
}

export async function fetchModifiers(restaurantId: string): Promise<DbModifier[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("modifiers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("order_index");
  if (error || !data) return null;
  return data as DbModifier[];
}
