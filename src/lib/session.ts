import { createHmac } from "crypto";

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback-secret-key";

export function signSession(payload: string): string {
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifySession(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  if (sig !== expected) return null;
  return payload;
}
