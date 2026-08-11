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
  return sig === expected;
}
