import { MenuTemplate, type HeroBanner, type Banner } from "@/components/MenuTemplate";
import { restaurant } from "@/data/as-tori";
import { fetchMenuCategories, fetchBanners, fetchRestaurantBySlug } from "@/lib/fetch-menu";

export const dynamic = "force-dynamic";

const FALLBACK_HERO: HeroBanner = {
  imageUrl:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  title: "АС ТӨРІ",
  subtitle: {
    en: "Authentic Kazakh Cuisine",
    ru: "Настоящая казахская кухня",
    kz: "Нағыз қазақ асханасы",
  },
};

export default async function AsToriPage() {
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

  const [categories, dbBanners, dbRestaurant] = await Promise.all([
    fetchMenuCategories(restaurantId).then(r => r ?? []),
    fetchBanners(restaurantId).then(r => r ?? []),
    fetchRestaurantBySlug("as-tori"),
  ]);

  const heroBanner: HeroBanner = dbRestaurant?.cover_url
    ? { imageUrl: dbRestaurant.cover_url, title: "АС ТӨРІ", subtitle: FALLBACK_HERO.subtitle }
    : FALLBACK_HERO;

  const banners: Banner[] = dbBanners.map(b => ({
    id: b.id,
    imageUrl: b.image_url,
    title: b.title,
    subtitle: b.subtitle ?? undefined,
    linkUrl: b.link_url,
  }));

  return (
    <MenuTemplate
      restaurant={{
        ...restaurant,
        // Prefer wa_number from Supabase so Branding page changes take effect
        whatsappPhone: dbRestaurant?.wa_number ?? restaurant.whatsappPhone,
      }}
      categories={categories}
      lang="kz"
      heroBanner={heroBanner}
      banners={banners}
    />
  );
}
