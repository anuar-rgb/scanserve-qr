import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isConfigured = Boolean(url) && Boolean(key);

// IIFE with try-catch: prevents createClient from throwing at module-eval time
// when env vars are missing or malformed (e.g. Railway build with empty vars).
// The non-null assertion (!) preserves the SupabaseClient generic type so that
// Supabase's query-builder TypeScript inference keeps working in other files.
export const supabase = (() => {
  if (!isConfigured) return null;
  try { return createClient(url, key); } catch { return null; }
})()!;
