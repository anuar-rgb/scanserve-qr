// Central constants — import from here, never hardcode inline.

export const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

export const STORAGE_BUCKETS = {
  branding: "branding",
  banners: "banners",
  menuImages: "menu-images",
  heroSlides: "hero-slides",
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
} as const;

export const SUPPORTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
export const MAX_IMAGE_SIZE_MB = 5;
