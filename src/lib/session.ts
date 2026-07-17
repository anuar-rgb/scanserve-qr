import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return s;
}

export function signSession(payload: string): string {
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
  return verifySession(raw);
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
