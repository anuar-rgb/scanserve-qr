import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Blocked for cashier / waiter / chef
const POS_BLOCKED: string[] = [
  "/admin/analytics",
  "/admin/owner-overview",
  "/admin/orders",
  "/admin/reviews",
  "/admin/promotions",
  "/admin/recommendations",
  "/admin/dashboard",
  "/admin/storefront",
  "/admin/banners",
  "/admin/hero-slider",
  "/admin/info-showcase",
  "/admin/qr",
  "/admin/training",
  "/admin/payment-banks",
  "/admin/settings",
];

// Additionally blocked for manager (owner-exclusive)
const OWNER_EXCLUSIVE: string[] = [
  "/admin/owner-overview",
  "/admin/payment-banks",
  "/admin/settings/staff",
];

const POS_ONLY_ROLES = ["cashier", "waiter", "chef"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("admin_session");

  if (pathname === "/admin/login") {
    if (session?.value) {
      const dest = POS_ONLY_ROLES.includes(session.value) ? "/admin/hall" : "/admin/analytics";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!session?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (POS_ONLY_ROLES.includes(session.value)) {
    const blocked = POS_BLOCKED.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
    if (blocked) return NextResponse.redirect(new URL("/admin/hall", request.url));
  } else if (session.value === "manager") {
    const blocked = OWNER_EXCLUSIVE.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
    if (blocked) return NextResponse.redirect(new URL("/admin/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
