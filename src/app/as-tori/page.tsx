import { MenuTemplate, type HeroBanner, type Banner, type HeroSlide, type ShowcaseItem } from "@/components/MenuTemplate";
import { restaurant } from "@/data/as-tori";
import { fetchMenuCategories, fetchBanners, fetchHeroSlides, fetchInfoShowcase, fetchPaymentBanks, fetchRestaurantBySlug } from "@/lib/fetch-menu";

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

export default async function AsToriPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const params = await searchParams;
  const initialTableNumber = params.table?.trim() || undefined;
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

  const [categories, dbBanners, dbRestaurant, dbHeroSlides, dbShowcase, dbPaymentBanks] = await Promise.all([
    fetchMenuCategories(restaurantId).then(r => r ?? []),
    fetchBanners(restaurantId).then(r => r ?? []),
    fetchRestaurantBySlug("as-tori"),
    fetchHeroSlides(restaurantId).then(r => r ?? []),
    fetchInfoShowcase(restaurantId).then(r => r ?? []),
    fetchPaymentBanks(restaurantId).then(r => r ?? []),
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

  const heroSlides: HeroSlide[] = dbHeroSlides.map(s => ({
    id: s.id,
    type: s.type,
    url: s.url,
    title: s.title,
    description: s.description,
    tags: s.tags ?? [],
  }));

  const showcaseItems: ShowcaseItem[] = dbShowcase.map(c => ({
    id: c.id,
    emoji: c.emoji,
    title: c.title,
  }));

  const cardTransferOptions = dbPaymentBanks.length > 0
    ? dbPaymentBanks.map(b => ({ bankName: b.bank_name, phone: b.phone, recipientName: b.recipient_name ?? undefined }))
    : restaurant.cardTransferOptions;

  return (
    <MenuTemplate
      restaurant={{
        ...restaurant,
        // Prefer wa_number from Supabase so Branding page changes take effect
        whatsappPhone: dbRestaurant?.wa_number ?? restaurant.whatsappPhone,
        cardTransferOptions,
      }}
      categories={categories}
      lang="kz"
      heroBanner={heroBanner}
      heroSlides={heroSlides}
      banners={banners}
      showcaseItems={showcaseItems}
      initialTableNumber={initialTableNumber}
    />
  );
}
