import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * RLS-scoped Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads the user's session from cookies; every query it issues is
 * governed by Row Level Security as the authorization boundary.
 *
 * Uses the anon key only — never the service-role key. Server Components cannot
 * set cookies, so cookie writes are wrapped in try/catch (the middleware handles
 * session refresh instead).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session cookie on navigation.
          }
        },
      },
    },
  );
}
