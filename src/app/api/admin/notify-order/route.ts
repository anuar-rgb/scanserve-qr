import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const NOTIFIABLE_TYPES = new Set(["takeaway", "delivery", "pickup"]);

export async function POST(request: NextRequest) {
  const role = request.cookies.get("admin_session")?.value ?? null;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  const orderId = body?.orderId;
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const supabase = db();
  const rid = process.env.NEXT_PUBLIC_RESTAURANT_ID!;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, type, status, guest_id, customer_phone, customer_name")
    .eq("id", orderId)
    .eq("restaurant_id", rid)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!NOTIFIABLE_TYPES.has(order.type as string) || order.status !== "preparing") {
    return NextResponse.json({ error: "Order not eligible for notification" }, { status: 400 });
  }

  let pushSent = false;
  let phone = (order.customer_phone as string | null);
  let name  = (order.customer_name  as string | null);

  if (order.guest_id) {
    const { data: client } = await supabase
      .from("crm_clients")
      .select("push_subscription, phone, name")
      .eq("restaurant_id", rid)
      .eq("guest_id", order.guest_id)
      .maybeSingle();

    if (client) {
      if (client.phone && !phone) phone = client.phone as string;
      if (client.name  && !name)  name  = client.name  as string;

      if (client.push_subscription) {
        const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
        const restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "АС ТӨРІ";

        if (vapidPublic && vapidPrivate) {
          webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
          try {
            await webpush.sendNotification(
              client.push_subscription as webpush.PushSubscription,
              JSON.stringify({
                title: "🛍️ Ваш заказ готов!",
                body:  `Ваш заказ готов к выдаче! Ждем вас в ${restaurantName}.`,
              }),
            );
            pushSent = true;
          } catch {
            // Push failed — client will open WhatsApp fallback
          }
        }
      }
    }
  }

  return NextResponse.json({ pushSent, phone, name, orderId: order.id });
}
