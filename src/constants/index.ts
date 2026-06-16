// Central constants — import from here, never hardcode inline.

function resolveRestaurantId(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";
  try {
    const m = document.cookie.match(/(?:^|;\s*)admin_restaurant_id=([^;]*)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {}
  return process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";
}

export const RESTAURANT_ID = resolveRestaurantId();

export const STORAGE_BUCKETS = {
  branding: "branding",
  banners: "banners",
  menuImages: "menu-images",
  heroSlides: "hero-slides",
  trainingImages: "training-images",
} as const;

export const DB_TABLES = {
  restaurants: "restaurants",
  categories: "categories",
  products: "products",
  banners: "banners",
  orders: "orders",
  reviews: "reviews",
  heroSlides: "hero_slides",
  restaurantTables: "restaurant_tables",
  waiterCalls: "waiter_calls",
  crmClients: "crm_clients",
  orderVoids: "order_voids",
  ingredients: "ingredients",
  recipeItems: "recipe_items",
  stockMovements: "stock_movements",
  trainingArticles: "training_articles",
} as const;

export const SUPPORTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
export const MAX_IMAGE_SIZE_MB = 5;
