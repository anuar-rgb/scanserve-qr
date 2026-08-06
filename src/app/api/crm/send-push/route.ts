import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getSessionRole } from "@/lib/session";

// Body: { title: string, body: string, url?: string }
export async function POST(request: NextRequest) {
  if (!getSessionRole(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const restaurantId = request.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID;

  if (!supabaseUrl || !serviceKey || !restaurantId) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Fetch clients and restaurant logo in parallel
  const [{ data: clients, error }, { data: restaurant }] = await Promise.all([
    supabase
      .from("crm_clients")
      .select("id,push_subscription")
      .eq("restaurant_id", restaurantId)
      .not("push_subscription", "is", null)
      .not("guest_id", "is", null),
    supabase
      .from("restaurants")
      .select("logo")
      .eq("id", restaurantId)
      .single(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0 });
  }

  const restaurantLogo = (restaurant as { logo?: string | null } | null)?.logo ?? null;

  const payload = JSON.stringify({
    title: body.title,
    body:  body.body,
    url:   body.url ?? null,
    icon:  restaurantLogo,
  });

  let sent   = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  await Promise.allSettled(
    clients.map(async (client) => {
      try {
        await webpush.sendNotification(
          client.push_subscription as webpush.PushSubscription,
          payload,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired — clean up
          expiredIds.push(client.id);
        }
        failed++;
      }
    }),
  );

  // Remove stale subscriptions
  if (expiredIds.length > 0) {
    await supabase.from("crm_clients").delete().in("id", expiredIds);
  }

  return NextResponse.json({ ok: true, sent, failed });
}
