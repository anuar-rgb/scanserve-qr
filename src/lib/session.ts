import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback-secret-key";

const VALID_ROLES = new Set([
  "owner", "manager", "supervisor", "cashier", "waiter", "chef",
  "bartender", "hostess", "courier", "cleaner", "doorman",
  "sommelier", "senior_waiter", "runner", "storekeeper", "accountant",
]);

export function signSession(payload: string): string {
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifySession(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) {
    // Legacy unsigned cookie — accept if it's a valid role name
    return VALID_ROLES.has(signed) ? signed : null;
  }
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  if (sig !== expected) return null;
  return payload;
}

export function getSessionRole(req: NextRequest): string | null {
  const raw = req.cookies.get("admin_session")?.value;
  if (!raw) return null;
  return verifySession(raw);
}
