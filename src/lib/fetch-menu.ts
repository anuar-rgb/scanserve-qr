import { supabase, isConfigured } from "./supabase";
import type { MenuCategory } from "@/components/MenuTemplate";
import type { DbBanner, DbCategory, DbHappyHour, DbHeroSlide, DbInfoShowcase, DbModifier, DbPaymentBank, DbProduct, DbRestaurant, DbRestaurantTable } from "./db-types";

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

  const [catsRes, prodsRes, modsRes] = await Promise.all([
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
      .or("remaining_qty.is.null,remaining_qty.gt.0")
      .order("order_index"),
    supabase
      .from("modifiers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("order_index"),
  ]);

  if (catsRes.error || prodsRes.error || !catsRes.data || !prodsRes.data) return null;

  const cats = catsRes.data as DbCategory[];
  const prods = prodsRes.data as DbProduct[];
  const mods = (modsRes.data ?? []) as DbModifier[];

  return cats
    .map(cat => ({
      id: cat.id,
      icon: cat.icon ?? "🍽️",
      name: cat.name,
      imageUrl: cat.image_url ?? undefined,
      backgroundImageUrl: cat.background_image_url ?? undefined,
      dishes: prods
        .filter(p => p.category_id === cat.id)
        .map(p => ({
          id: p.id,
          categoryId: cat.id,
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
          allergens: p.allergens ?? undefined,
          bonusPercent: p.bonus_percent ?? undefined,
          remainingQty: p.remaining_qty ?? null,
          modifiers: mods
            .filter(m =>
              m.product_id === p.id ||
              (m.product_id === null && m.category_id === p.category_id)
            )
            .map(m => ({ id: m.id, name: m.name, price: m.price })),
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

export async function fetchHappyHours(restaurantId: string): Promise<DbHappyHour[]> {
  if (!isConfigured || !restaurantId) return [];
  const { data } = await supabase
    .from("happy_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);
  return (data ?? []) as DbHappyHour[];
}

export async function fetchRestaurantTables(restaurantId: string): Promise<DbRestaurantTable[] | null> {
  if (!isConfigured || !restaurantId) return null;
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("label");
  if (error || !data) return null;
  return data as DbRestaurantTable[];
}

export type DbAd = {
  id: string;
  image_url: string;
  target_url: string | null;
  title: string | null;
  placement: string;
  display_order: number;
};

export async function fetchActiveAds(placement = "menu_middle", restaurantId?: string): Promise<DbAd[]> {
  if (!isConfigured) return [];
  const { data } = await supabase
    .from("advertisements")
    .select("id, image_url, target_url, title, placement, display_order, restaurant_ids")
    .eq("is_active", true)
    .eq("placement", placement)
    .order("display_order");
  const all = (data ?? []) as (DbAd & { restaurant_ids: string[] | null })[];
  if (!restaurantId) return all;
  return all.filter(ad => !ad.restaurant_ids || ad.restaurant_ids.includes(restaurantId));
}
