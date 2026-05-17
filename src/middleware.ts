import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes accessible only to owner / manager
const OWNER_ONLY: string[] = [
  "/admin/analytics",
  "/admin/owner-overview",
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

// Roles that are restricted to POS-only access
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

  // POS-only roles cannot access owner routes
  if (POS_ONLY_ROLES.includes(session.value)) {
    const blocked = OWNER_ONLY.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
    if (blocked) {
      return NextResponse.redirect(new URL("/admin/hall", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
