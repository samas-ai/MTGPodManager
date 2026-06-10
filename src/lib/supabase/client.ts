import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Browser Supabase client. At MVP scale this is used almost exclusively to
 * subscribe to the match Realtime channel (later phases). It touches only the
 * anon key + RLS — never any privileged key.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
