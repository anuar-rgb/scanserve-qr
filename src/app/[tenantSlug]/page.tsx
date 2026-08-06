import { notFound } from "next/navigation";
import {
  MenuTemplate,
  type Banner,
  type HeroBanner,
  type HeroSlide,
  type ShowcaseItem,
} from "@/components/MenuTemplate";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import {
  fetchRestaurantBySlug,
  fetchMenuCategories,
  fetchBanners,
  fetchHeroSlides,
  fetchInfoShowcase,
  fetchPaymentBanks,
  fetchRestaurantTables,
  fetchActiveAds,
  fetchHappyHours,
} from "@/lib/fetch-menu";

export const dynamic = "force-dynamic";

const FALLBACK_HERO: HeroBanner = {
  imageUrl:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  title: "",
  subtitle: { en: "", ru: "", kz: "" },
};

export default async function TenantMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ table?: string; order?: string }>;
}) {
  const { tenantSlug } = await params;
  const { table, order } = await searchParams;
  const initialTableNumber = table?.trim() || undefined;
  const initialOrderId = order?.trim() || undefined;

  const dbRestaurant = await fetchRestaurantBySlug(tenantSlug);
  if (!dbRestaurant) notFound();

  const restaurantId = dbRestaurant.id;

  const [categories, dbBanners, dbHeroSlides, dbShowcase, dbPaymentBanks, dbTables, dbAds, dbHappyHours] =
    await Promise.all([
      fetchMenuCategories(restaurantId).then((r) => r ?? []),
      fetchBanners(restaurantId).then((r) => r ?? []),
      fetchHeroSlides(restaurantId).then((r) => r ?? []),
      fetchInfoShowcase(restaurantId).then((r) => r ?? []),
      fetchPaymentBanks(restaurantId).then((r) => r ?? []),
      fetchRestaurantTables(restaurantId).then((r) => r ?? []),
      fetchActiveAds(),
      fetchHappyHours(restaurantId),
    ]);

  const banners: Banner[] = dbBanners.map((b) => ({
    id: b.id,
    imageUrl: b.image_url,
    title: b.title,
    subtitle: b.subtitle ?? undefined,
    linkUrl: b.link_url,
  }));

  const heroSlides: HeroSlide[] = dbHeroSlides.map((s) => ({
    id: s.id,
    type: s.type,
    url: s.url,
    title: s.title,
    description: s.description,
    tags: s.tags ?? [],
    title_font_size: s.title_font_size,
    description_font_size: s.description_font_size,
  }));

  const showcaseItems: ShowcaseItem[] = dbShowcase.map((c) => ({
    id: c.id,
    emoji: c.emoji,
    title: c.title,
    description: c.description ?? null,
  }));

  const cardTransferOptions = dbPaymentBanks.map((b) => ({
    bankName: b.bank_name,
    phone: b.phone,
    recipientName: b.recipient_name ?? undefined,
  }));

  return (
    <>
      <RealtimeRefresher restaurantId={restaurantId} />
      <MenuTemplate
        restaurant={{
          name: dbRestaurant.name,
          logoUrl: dbRestaurant.logo ?? undefined,
          whatsappPhone: dbRestaurant.wa_number ?? undefined,
          instagramUrl: dbRestaurant.instagram_url ?? undefined,
          phone: dbRestaurant.phone ?? undefined,
          address: dbRestaurant.address ?? undefined,
          workingHours: dbRestaurant.working_hours ?? undefined,
          cardTransferOptions,
          deliveryFee: dbRestaurant.delivery_fee ?? 600,
        }}
        categories={categories}
        banners={banners}
        heroBanner={FALLBACK_HERO}
        heroSlides={heroSlides}
        showcaseItems={showcaseItems}
        initialTableNumber={initialTableNumber}
        initialOrderId={initialOrderId}
        restaurantTables={dbTables.map((t) => ({ id: t.id, label: t.label }))}
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
