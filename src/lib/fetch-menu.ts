import { supabase, isConfigured } from "./supabase";
import type { MenuCategory } from "@/components/MenuTemplate";
import type { DbBanner, DbCategory, DbProduct, DbRestaurant } from "./db-types";

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

  return cats
    .map(cat => ({
      id: cat.id,
      icon: cat.icon ?? "🍽️",
      name: cat.name,
      imageUrl: cat.image_url ?? undefined,
      dishes: prods
        .filter(p => p.category_id === cat.id)
        .map(p => ({
          id: p.id,
          emoji: p.emoji ?? "🍽️",
          imageUrl: p.image_url ?? undefined,
          badge: p.badge ?? undefined,
          discountLabel: p.discount_label ?? undefined,
          isNew: p.is_new,
          isPromo: p.is_promo,
          isRecommended: p.is_recommended,
          name: p.name,
          desc: p.description ?? { en: "", ru: "", kz: "" },
          price: p.price,
        })),
    }))
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
