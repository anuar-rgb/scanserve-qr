"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";

const RESTAURANT_TABLES = ["products", "banners", "hero_slides", "info_showcases"] as const;

export function RealtimeRefresher({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!isConfigured || !restaurantId) return;

    let ch = supabase.channel(`guest-menu-${restaurantId}`);

    for (const table of RESTAURANT_TABLES) {
      ch = ch.on(
        "postgres_changes" as Parameters<typeof ch.on>[0],
        { event: "*", schema: "public", table, filter: `restaurant_id=eq.${restaurantId}` },
        () => router.refresh(),
      );
    }

    // restaurants table uses id, not restaurant_id
    ch = ch.on(
      "postgres_changes" as Parameters<typeof ch.on>[0],
      { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${restaurantId}` },
      () => router.refresh(),
    );

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, router]);

  return null;
}
