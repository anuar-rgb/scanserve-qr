import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionRole } from "@/lib/session";
import webpush from "web-push";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const RID = (r: NextRequest) =>
  r.cookies.get("admin_restaurant_id")?.value ?? process.env.NEXT_PUBLIC_RESTAURANT_ID!;

// POST /api/admin/courier-push?action=subscribe|notify
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") ?? "notify";

  if (action === "subscribe") {
    // Save push subscription for the current staff user
    const role = getSessionRole(request);
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = request.cookies.get("admin_user_id")?.value;
    if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

    const body = await request.json().catch(() => null) as { subscription?: unknown } | null;
    if (!body?.subscription) return NextResponse.json({ error: "Missing subscription" }, { status: 400 });

    const supabase = db();
    const { error } = await supabase
      .from("staff_users")
      .update({ push_subscription: body.subscription })
      .eq("id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // action === "notify" — notify all couriers for a restaurant
  // Called from CartDrawer after placing a delivery order
  const body = await request.json().catch(() => null) as {
    restaurantId?: string;
    address?: string;
    orderId?: string;
  } | null;

  const restaurantId = body?.restaurantId ?? RID(request);
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ ok: true, sent: 0, reason: "VAPID not configured" });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = db();

  // Fetch couriers and restaurant logo in parallel
  const [{ data: couriers }, { data: restaurant }] = await Promise.all([
    supabase
      .from("staff_users")
      .select("id, push_subscription")
      .eq("restaurant_id", restaurantId)
      .eq("role", "courier")
      .not("push_subscription", "is", null),
    supabase
      .from("restaurants")
      .select("logo")
      .eq("id", restaurantId)
      .single(),
  ]);

  if (!couriers || couriers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const restaurantLogo = (restaurant as { logo?: string | null } | null)?.logo ?? null;

  const payload = JSON.stringify({
    title: "🛵 Новый заказ доставки!",
    body: body?.address ? `📍 ${body.address}` : "Новый заказ ожидает принятия",
    url: "/admin/delivery",
    icon: restaurantLogo,
  });

  let sent = 0;
  const expiredIds: string[] = [];

  await Promise.allSettled(
    couriers.map(async (courier) => {
      try {
        await webpush.sendNotification(
          courier.push_subscription as webpush.PushSubscription,
          payload,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expiredIds.push(courier.id);
      }
    }),
  );

  if (expiredIds.length > 0) {
    await supabase
      .from("staff_users")
      .update({ push_subscription: null })
      .in("id", expiredIds);
  }

  return NextResponse.json({ ok: true, sent });
}
