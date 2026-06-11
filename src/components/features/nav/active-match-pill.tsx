"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Floating "return to table" affordance. When the signed-in user has an open
 * match in any of their pods, a pill sits just above the bottom nav linking
 * straight to the host screen (if they host) or the join page. RLS scopes the
 * matches query to the user's pods, so no membership check is needed here.
 * Hidden on match screens (you're already there) and off the app shell.
 */

const HIDDEN_PREFIXES = ["/sign-in", "/sign-up", "/match", "/join"];

export function ActiveMatchPill() {
  const pathname = usePathname();
  const [href, setHref] = useState<string | null>(null);

  const hidden = pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) {
      setHref(null);
      return;
    }
    let active = true;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data } = await supabase
        .from("matches")
        .select("id, host_id")
        .eq("status", "open")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      setHref(
        data ? `/match/${data.id}/${data.host_id === user.id ? "host" : "join"}` : null,
      );
    })();
    return () => {
      active = false;
    };
  }, [pathname, hidden]);

  if (hidden || !href) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 mb-[env(safe-area-inset-bottom)] flex justify-center px-4">
      <Link
        href={href}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
        Return to the table →
      </Link>
    </div>
  );
}
