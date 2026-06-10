# Tech Stack & Tools

- **Frontend:** Next.js (App Router) with TypeScript (`strict`, no `any`). Reads via Server Components, writes via Server Actions. React state + URL state only — no global store at MVP scale (the live-match screen is the only stateful surface and it is local-only).
- **Backend:** Supabase (managed Postgres + Auth + Realtime). No separate Node/Python service. Data access through the Supabase JS client via `@supabase/ssr` (cookie-based server auth). Cross-row invariants enforced by Postgres functions (RPC).
- **Database:** Supabase Postgres. UUID PKs, `timestamptz` everywhere. **Row Level Security (RLS) on every table is the authorization source of truth.** Schema/RLS/RPCs are code — managed as Supabase CLI migrations under `supabase/migrations/`.
- **Styling:** Tailwind CSS with a **design-token layer** — CSS variables in `styles/globals.css`, surfaced as Tailwind theme extensions. Raw hex/pixel values in components are banned. UI components from **shadcn/ui** (copied-in, owned, token-themed).
- **Authentication:** Supabase Auth (email/OTP or password). JWT stored in HTTP-only cookies via `@supabase/ssr`.
- **Validation:** Zod at every Server Action / Route Handler boundary; Postgres `CHECK` constraints as the backstop.
- **External (server-side only):** Archidekt (best-effort deck import), Scryfall (canonical card/commander identity via bulk data + batch `collection` endpoint).
- **Hosting / Infra:** Vercel (Hobby/free) — Git push to deploy, preview deploy per PR. Supabase (Free) for DB/Auth/Realtime.
- **Monitoring (MVP):** Supabase dashboard (Realtime connections, DB size) + Vercel logs. Sentry deferred to the first paid milestone.

## Project Structure
```
src/
├── app/
│   ├── (auth)/sign-in, sign-up
│   ├── groups/
│   │   ├── page.tsx                 # list / create / join
│   │   └── [groupId]/page.tsx       # group home: stats + recent matches (Server Component)
│   ├── profile/decks/page.tsx       # register / import / manual entry
│   ├── match/
│   │   ├── [matchId]/host/page.tsx  # host: local life counter + live join status
│   │   └── [matchId]/join/page.tsx  # join: auth -> select deck -> confirm
│   └── stats/[groupId]/page.tsx
├── components/ui/                   # shadcn, token-themed
├── components/features/             # match, decks, stats
├── lib/
│   ├── supabase/server.ts           # @supabase/ssr server client (RLS-scoped)
│   ├── supabase/client.ts           # browser client (Realtime subscribe only)
│   ├── services/                    # import.ts, scryfall.ts, matches.ts
│   └── validators/                  # zod schemas
└── styles/globals.css               # design tokens (CSS vars)
supabase/
├── migrations/                      # schema + RLS + RPCs (reviewed like code)
└── tests/                           # pgTAP
```

## Setup Commands
```bash
npm install                 # install deps
supabase start              # local Postgres/Auth/Realtime stack
supabase db push            # apply migrations locally
npm run dev                 # Next.js dev server
```

## Environment Variables
```bash
# .env.local — server values never exposed to the client bundle
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # browser touches only anon key + RLS
SUPABASE_SERVICE_ROLE_KEY=...           # SERVER-ONLY; used by import/admin paths
SCRYFALL_USER_AGENT="MTGPodManager/0.1 (contact@example.com)"
```

## Data Fetching & Writes (canonical pattern)
```tsx
// READ — Server Component, RLS-scoped client. No client-side data fetching boilerplate.
// app/groups/[groupId]/page.tsx
import { createServerClient } from "@/lib/supabase/server";

export default async function GroupHome({ params }: { params: { groupId: string } }) {
  const supabase = createServerClient();
  // RLS guarantees the user only sees groups they are a member of — no manual check needed.
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, status, winner_user_id, finalized_at")
    .eq("group_id", params.groupId)
    .order("finalized_at", { ascending: false });

  if (error) throw error; // boundary error; surface via error.tsx, never swallow
  return <RecentMatches matches={matches} />;
}
```

```ts
// WRITE — Server Action: validate with Zod, then write (RLS-protected) or call an RPC.
// lib/services/matches.ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const FinalizeInput = z.object({
  matchId: z.string().uuid(),
  winnerId: z.string().uuid(),
});

export async function finalizeMatch(raw: unknown) {
  const { matchId, winnerId } = FinalizeInput.parse(raw); // boundary validation
  const supabase = createServerClient();
  // The ONLY path that can set status='finalized'. Invariants enforced atomically in SQL.
  const { error } = await supabase.rpc("finalize_match", {
    p_match_id: matchId,
    p_winner: winnerId,
  });
  if (error) return { ok: false as const, error: error.message }; // user-safe, logged server-side
  return { ok: true as const };
}
```

## Error Handling Pattern
```ts
// Normalize at the service boundary; never let a raw exception reach the UI,
// and never swallow it silently. Return a user-safe message, log dev context server-side.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function importFromArchidekt(url: string): Promise<Result<DeckIdentity>> {
  try {
    const deck = await fetchAndResolve(url); // server-side only
    return { ok: true, data: deck };
  } catch (err) {
    console.error("[import] archidekt failed", { url, err }); // dev context, server-side
    // Graceful failure → caller drops the user into the manual two-field fallback form.
    return { ok: false, error: "Couldn't import that deck. Enter it manually." };
  }
}
```

## Styling & Component Example (design tokens, no raw values)
```tsx
// Use shadcn/ui + Tailwind classes that map to design tokens. No raw hex/px in components.
import { Button } from "@/components/ui/button";

export function JoinConfirm({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  return (
    // Tailwind classes resolve to CSS-variable design tokens defined in globals.css.
    <div className="flex flex-col gap-4 p-4 bg-background text-foreground">
      <Button className="w-full" disabled={pending} onClick={onConfirm}>
        {pending ? "Confirming…" : "Confirm deck & verify"}
      </Button>
    </div>
  );
}
```

## Naming Conventions
- **Components / types:** PascalCase
- **Functions / variables:** camelCase
- **Constants / env vars:** UPPER_SNAKE_CASE
- **Postgres:** snake_case tables/columns; RPCs as verbs (`finalize_match`, `create_group`, `accept_invite`).
