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

  const ROLE_HOME: Partial<Record<string, string>> = {
    courier:     "/admin/delivery",
    storekeeper: "/admin/warehouse",
    accountant:  "/admin/billing",
    cashier:     "/admin/invoices",
    cleaner:     "/admin/my-attendance",
    doorman:     "/admin/my-attendance",
  };

  if (pathname === "/login") {
    if (sessionCookie) {
      const role = await verifySession(sessionCookie);
      if (role) {
        const dest = ROLE_HOME[role] ?? (POS_ONLY_ROLES.includes(role) ? "/admin/hall" : "/admin/analytics");
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

  // Non-courier accessing /admin/delivery → redirect to hall (delivery tab is inside hall now)
  if (role !== "courier" && (pathname === "/admin/delivery" || pathname.startsWith("/admin/delivery/"))) {
    return NextResponse.redirect(new URL("/admin/hall", request.url));
  }

  if (POS_ONLY_ROLES.includes(role)) {
    const allowedHome = ROLE_HOME[role];
    if (allowedHome && (pathname === allowedHome || pathname.startsWith(allowedHome + "/"))) {
      return NextResponse.next();
    }
    const blocked = POS_BLOCKED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL(allowedHome ?? "/admin/hall", request.url));
  } else if (role === "manager" || role === "supervisor") {
    const blocked = OWNER_EXCLUSIVE.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL("/admin/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
