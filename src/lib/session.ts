import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

function secret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

// Payload format: "role:restaurantId"
export function signSession(role: string, restaurantId: string): string {
  const payload = `${role}:${restaurantId}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySession(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null; // reject unsigned cookies
  const payload = signed.slice(0, dot);
  const sig     = signed.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  return payload;
}

export function getSessionRole(req: NextRequest): string | null {
  const raw = req.cookies.get("admin_session")?.value;
  if (!raw) return null;
  const payload = verifySession(raw);
  if (!payload) return null;
  return payload.split(":")[0] ?? null;
}

// Returns the restaurant_id embedded in the signed session cookie.
// Preferred over reading the unsigned admin_restaurant_id cookie.
export function getSessionRestaurantId(req: NextRequest): string | null {
  const raw = req.cookies.get("admin_session")?.value;
  if (!raw) return null;
  const payload = verifySession(raw);
  if (!payload) return null;
  const idx = payload.indexOf(":");
  if (idx < 0) return null; // legacy session without restaurantId
  return payload.slice(idx + 1) || null;
}

// ── Super-admin session ───────────────────────────────────────────────────────

const SA_PREFIX = "super_admin:";
// Super-admin session lifetime: 8 hours. Must match maxAge in super-admin/login/route.ts.
const SA_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function signSuperAdminSession(): string {
  const payload = SA_PREFIX + Date.now();
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySuperAdminSession(signed: string): boolean {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = signed.slice(0, dot);
  const sig     = signed.slice(dot + 1);
  if (!payload.startsWith(SA_PREFIX)) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return false;
  // Validate embedded timestamp so replayed cookies expire server-side too
  const ts = parseInt(payload.slice(SA_PREFIX.length), 10);
  if (isNaN(ts) || Date.now() - ts > SA_MAX_AGE_MS) return false;
  return true;
}
