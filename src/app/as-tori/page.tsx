import { MenuTemplate, type HeroBanner, type Banner, type HeroSlide, type ShowcaseItem } from "@/components/MenuTemplate";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { restaurant } from "@/data/as-tori";
import { fetchMenuCategories, fetchBanners, fetchHeroSlides, fetchInfoShowcase, fetchPaymentBanks, fetchRestaurantBySlug, fetchRestaurantTables, fetchActiveAds, fetchHappyHours } from "@/lib/fetch-menu";

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
  searchParams: Promise<{ table?: string; order?: string; source?: string }>;
}) {
  const params = await searchParams;
  const initialTableNumber = params.table?.trim() || undefined;
  const initialOrderId = params.order?.trim() || undefined;
  // ?source=qr → пришёл по QR в зале; всё остальное (включая отсутствие параметра) → из дома
  const isInRestaurant = params.source === "qr";
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

  const [categories, dbBanners, dbRestaurant, dbHeroSlides, dbShowcase, dbPaymentBanks, dbTables, dbAds, dbHappyHours] = await Promise.all([
    fetchMenuCategories(restaurantId).then(r => r ?? []),
    fetchBanners(restaurantId).then(r => r ?? []),
    fetchRestaurantBySlug("as-tori"),
    fetchHeroSlides(restaurantId).then(r => r ?? []),
    fetchInfoShowcase(restaurantId).then(r => r ?? []),
    fetchPaymentBanks(restaurantId).then(r => r ?? []),
    fetchRestaurantTables(restaurantId).then(r => r ?? []),
    fetchActiveAds(),
    fetchHappyHours(restaurantId),
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
    title_font_size: s.title_font_size,
    description_font_size: s.description_font_size,
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
          deliveryFee: dbRestaurant?.delivery_fee ?? 600,
          is2gisEnabled: dbRestaurant?.is_2gis_enabled ?? false,
          twoGisApiKey: dbRestaurant?.custom_2gis_api_key ?? undefined,
        }}
        categories={categories}
        lang="kz"
        heroBanner={heroBanner}
        heroSlides={heroSlides}
        banners={banners}
        showcaseItems={showcaseItems}
        initialTableNumber={initialTableNumber}
        initialOrderId={initialOrderId}
        isInRestaurant={isInRestaurant}
        restaurantTables={dbTables.map(t => ({ id: t.id, label: t.label }))}
        restaurantId={restaurantId}
        ads={dbAds}
        happyHours={dbHappyHours.map(h => ({
          id: h.id,
          name: h.name,
          discountPercent: h.discount_percent,
          categoryIds: h.category_ids,
          startTime: h.start_time.slice(0, 5),
          endTime: h.end_time.slice(0, 5),
          daysOfWeek: h.days_of_week,
        }))}
      />
    </>
  );
}
