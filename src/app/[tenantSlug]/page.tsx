import { notFound } from "next/navigation";
import { MenuTemplate, type Banner } from "@/components/MenuTemplate";
import { fetchRestaurantBySlug, fetchMenuCategories, fetchBanners } from "@/lib/fetch-menu";

export const dynamic = "force-dynamic";

export default async function TenantMenuPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const dbRestaurant = await fetchRestaurantBySlug(tenantSlug);
  if (!dbRestaurant) notFound();

  const [categories, dbBanners] = await Promise.all([
    fetchMenuCategories(dbRestaurant.id).then(r => r ?? []),
    fetchBanners(dbRestaurant.id).then(r => r ?? []),
  ]);

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
        name: dbRestaurant.name,
        logoUrl: dbRestaurant.logo ?? undefined,
        whatsappPhone: dbRestaurant.wa_number ?? undefined,
      }}
      heroBanner={dbRestaurant.cover_url ? { imageUrl: dbRestaurant.cover_url } : undefined}
      categories={categories}
      banners={banners}
    />
  );
}
