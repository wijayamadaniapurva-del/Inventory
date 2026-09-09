import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// SERVER-ONLY. Uses the Supabase service role key, which bypasses all
// Row Level Security. Only ever call this from trusted backend code
// (cron routes, admin scripts) — never from a Client Component, and
// never let SUPABASE_SERVICE_ROLE_KEY leak into NEXT_PUBLIC_* env vars.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
