import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const POS_BLOCKED: string[] = [
  "/admin/analytics", "/admin/owner-overview", "/admin/orders", "/admin/reviews",
  "/admin/promotions", "/admin/recommendations", "/admin/dashboard", "/admin/storefront",
  "/admin/banners", "/admin/hero-slider", "/admin/info-showcase", "/admin/qr",
  "/admin/training", "/admin/payment-banks", "/admin/settings",
];

const OWNER_EXCLUSIVE: string[] = ["/admin/owner-overview", "/admin/payment-banks"];

const POS_ONLY_ROLES = [
  "cashier", "waiter", "chef", "bartender", "hostess", "courier", "cleaner",
  "doorman", "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
];

async function verifySession(signed: string): Promise<string | null> {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null; // reject unsigned cookies
  const payload = signed.slice(0, dot);
  const sig     = signed.slice(dot + 1);

  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) return null;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const expected = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  return sig === expected ? payload : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("admin_session")?.value;

  if (pathname === "/login") {
    if (sessionCookie) {
      const role = await verifySession(sessionCookie);
      if (role) {
        const dest = role === "courier"
          ? "/admin/delivery"
          : POS_ONLY_ROLES.includes(role) ? "/admin/hall" : "/admin/analytics";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
    return NextResponse.next();
  }

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = await verifySession(sessionCookie);
  if (!role) {
    const resp = NextResponse.redirect(new URL("/login", request.url));
    resp.cookies.delete("admin_session");
    return resp;
  }

  if (POS_ONLY_ROLES.includes(role)) {
    // Courier can access /admin/delivery
    if (role === "courier" && (pathname === "/admin/delivery" || pathname.startsWith("/admin/delivery/"))) {
      return NextResponse.next();
    }
    const blocked = POS_BLOCKED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL(role === "courier" ? "/admin/delivery" : "/admin/hall", request.url));
  } else if (role === "manager" || role === "supervisor") {
    const blocked = OWNER_EXCLUSIVE.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL("/admin/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
