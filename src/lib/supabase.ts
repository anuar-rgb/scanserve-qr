import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// IIFE with try-catch: prevents createClient from throwing at module-eval time
// when env vars are missing or malformed (e.g. Railway build with empty vars).
const _client = (() => {
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
})();

// isConfigured is true ONLY when the client was successfully created,
// so `if (!isConfigured) return` guards are reliable runtime null checks.
export const isConfigured = _client !== null;

// Non-null assertion preserves the SupabaseClient generic type for query-builder inference.
// Safe to use after checking isConfigured.
export const supabase = _client!;
