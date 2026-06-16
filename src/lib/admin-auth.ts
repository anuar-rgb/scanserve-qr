import type { NextRequest } from "next/server";

export function getAdminRestaurantId(request: NextRequest): string {
  return (
    request.cookies.get("admin_restaurant_id")?.value ??
    process.env.NEXT_PUBLIC_RESTAURANT_ID ??
    ""
  );
}

export function requireAdminSession(request: NextRequest): boolean {
  return !!request.cookies.get("admin_session")?.value;
}
