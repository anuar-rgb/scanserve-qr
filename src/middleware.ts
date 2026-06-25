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
  if (dot < 1) {
    // Legacy unsigned cookie — treat value as plain role (backward compat)
    const VALID_ROLES = new Set([...POS_ONLY_ROLES, "owner", "manager", "supervisor"]);
    return VALID_ROLES.has(signed) ? signed : null;
  }
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback-secret-key";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const expected = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))))
    .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

  return sig === expected ? payload : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("admin_session")?.value;

  if (pathname === "/login") {
    if (sessionCookie) {
      const role = await verifySession(sessionCookie);
      if (role) {
        const dest = POS_ONLY_ROLES.includes(role) ? "/admin/hall" : "/admin/analytics";
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
    const blocked = POS_BLOCKED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL("/admin/hall", request.url));
  } else if (role === "manager") {
    const blocked = OWNER_EXCLUSIVE.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (blocked) return NextResponse.redirect(new URL("/admin/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
