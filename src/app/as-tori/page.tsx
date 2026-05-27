import { MenuTemplate, type HeroBanner, type Banner, type HeroSlide, type ShowcaseItem } from "@/components/MenuTemplate";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { restaurant } from "@/data/as-tori";
import { fetchMenuCategories, fetchBanners, fetchHeroSlides, fetchInfoShowcase, fetchPaymentBanks, fetchRestaurantBySlug, fetchRestaurantTables } from "@/lib/fetch-menu";

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

  const [categories, dbBanners, dbRestaurant, dbHeroSlides, dbShowcase, dbPaymentBanks, dbTables] = await Promise.all([
    fetchMenuCategories(restaurantId).then(r => r ?? []),
    fetchBanners(restaurantId).then(r => r ?? []),
    fetchRestaurantBySlug("as-tori"),
    fetchHeroSlides(restaurantId).then(r => r ?? []),
    fetchInfoShowcase(restaurantId).then(r => r ?? []),
    fetchPaymentBanks(restaurantId).then(r => r ?? []),
    fetchRestaurantTables(restaurantId).then(r => r ?? []),
  ]);

  const heroBanner: HeroBanner = FALLBACK_HERO;

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
    description: c.description ?? null,
  }));

  const cardTransferOptions = dbPaymentBanks.length > 0
    ? dbPaymentBanks.map(b => ({ bankName: b.bank_name, phone: b.phone, recipientName: b.recipient_name ?? undefined }))
    : restaurant.cardTransferOptions;

  return (
    <>
      <RealtimeRefresher restaurantId={restaurantId} />
      <MenuTemplate
        restaurant={{
          ...restaurant,
          // All identity fields prefer DB values; static data is the fallback
          name: dbRestaurant?.name ?? restaurant.name,
          logoUrl: dbRestaurant?.logo ?? restaurant.logoUrl,
          whatsappPhone: dbRestaurant?.wa_number ?? restaurant.whatsappPhone,
          instagramUrl: dbRestaurant?.instagram_url ?? restaurant.instagramUrl,
          phone: dbRestaurant?.phone ?? restaurant.phone,
          address: dbRestaurant?.address ?? restaurant.address,
          workingHours: dbRestaurant?.working_hours ?? restaurant.workingHours,
          cardTransferOptions,
        }}
        categories={categories}
        lang="kz"
        heroBanner={heroBanner}
        heroSlides={heroSlides}
        banners={banners}
        showcaseItems={showcaseItems}
        initialTableNumber={initialTableNumber}
        restaurantTables={dbTables.map(t => ({ id: t.id, label: t.label }))}
      />
    </>
  );
}
