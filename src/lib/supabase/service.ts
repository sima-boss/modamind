import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client that bypasses RLS. Only ever use server-side, and
 * only with parameters (e.g. user ids) derived from the caller's own
 * authenticated session — never from client-supplied input.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
