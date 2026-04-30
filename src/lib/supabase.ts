import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isConfigured = Boolean(url) && Boolean(key);

// Only instantiate the client when env vars are present — calling createClient("")
// throws at module-evaluation time (including during Next.js build), so we guard it.
export const supabase = isConfigured ? createClient(url, key) : (null as any);
