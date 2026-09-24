import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — this is what lets the
 * notification dispatch job read *every* user's preferences/subscriptions
 * in one pass instead of one request per user. Never import this from a
 * client component or a code path that could leak the key to the browser;
 * `import "server-only"` makes the build fail if that ever happens.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY, which must never be prefixed with
 * NEXT_PUBLIC_ and must never be committed or logged.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. " +
        "This client is only usable server-side (e.g. the notification dispatch route)."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
