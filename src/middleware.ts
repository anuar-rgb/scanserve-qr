import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that only the owner role can access
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("admin_session");

  if (pathname === "/admin/login") {
    if (session?.value) {
      const role = session.value;
      const dest = role === "admin" ? "/admin/hall" : "/admin/analytics";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!session?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Admin role cannot access owner-only routes
  if (session.value === "admin") {
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
