/**
 * Supabase client for the API server.
 * Uses the service_role key so it can read/write all rows, bypassing RLS.
 * Returns a no-op stub when env vars are not set so the server still boots.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let _client: SupabaseClient | null = null;

if (url && key) {
  _client = createClient(url, key, { auth: { persistSession: false } });
} else {
  console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB persistence disabled.");
}

// Export a proxy so callers don't need to null-check.
// When not configured, every operation returns an empty result with no error.
export const supabase: SupabaseClient = _client ?? (new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    if (prop === "from") return () => ({
      select: () => ({ data: [], error: null, gte: () => ({ order: () => ({ data: [], error: null }) }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }), in: () => Promise.resolve({ data: null, error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    });
    return () => Promise.resolve({ data: null, error: null });
  },
}));
