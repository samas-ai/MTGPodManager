# Code Patterns

## Purpose
This file defines the implementation patterns the agent should follow for MTG Pod Manager.
Prefer these patterns over inventing new ones. They are derived from the Technical Design.

## Architecture Pattern
- **Primary pattern:** Layered within a feature-based folder structure. Transport (Server Components / Server Actions / Route Handlers) is thin; domain logic lives in `lib/services/`; cross-row invariants live in Postgres RPCs.
- **Rule:** RLS is the authorization boundary. Reads use an RLS-scoped Server Component client; the browser client is used almost exclusively to subscribe to the match Realtime channel.
- **Rule:** Keep domain logic out of components and route bodies. Reuse existing services (`import.ts`, `scryfall.ts`, `matches.ts`) before creating new abstractions.

## Data Fetching
- **Primary approach:** RSC (React Server Components) for reads + Server Actions for writes — the App Router default. No client-side data-fetching library.
- **Rule:** Reads hit an RLS-scoped server Supabase client; do not add manual access checks — RLS already scopes rows.
- **Rule:** Writes validate with Zod, then either write directly (RLS-protected) or call an RPC. The browser never holds the service-role key.

## State Management
- **Server state:** Supabase via RSC reads; revalidate after Server Action writes.
- **Client state:** Local React state. The **host live-match life counter is local-only** (no sync). The only Realtime subscription is the match participants channel.
- **Forms:** Server Actions + Zod validation. Keep it minimal.
- **Rule:** Do not add a global state library (Redux/Zustand) — MVP scale does not need it.

## Realtime (join status — F4/F5)
- **Primary:** Realtime Postgres Changes on `match_participants`, filtered by `match_id`. The DB is the single source of truth for participation; RLS on the table scopes who receives events.
- **Rule:** Write the **polling fallback** (poll `match_participants` every 2–3s) behind a flag so you can degrade gracefully if free-tier Realtime limits bite mid-match.
- **Rule:** Never carry life totals over Realtime — participation status only, to keep payloads inside the free tier.

## Error Handling
- Normalize errors at the service/API boundary — never let a raw exception reach the UI.
- Never swallow errors silently; log developer context server-side, return a user-safe message.
- Use a consistent `Result<T>` shape (`{ ok: true, data } | { ok: false, error }`) across services.
- **Import failures are expected** — surface a clear, recoverable error and drop the user into the manual deck-entry fallback (name + Scryfall-resolved commander).

## Validation
- Zod at every Server Action / Route Handler boundary; Postgres `CHECK` constraints as the backstop.
- Validate all external inputs (forms, Archidekt URLs, env vars). Trust internal types inside the boundary.
- Co-locate validators in `lib/validators/` next to the contract they guard.

## Authorization & Invariants (the integrity core)
- **RLS is law.** Every table has RLS enabled; no client-side check substitutes for it.
- **`SECURITY DEFINER` RPCs only where cross-row invariants demand it:** `finalize_match()`, `create_group()`, `accept_invite()`, plus the `is_group_member()` helper. Each: `revoke all ... from public; grant execute ... to authenticated`.
- **Match finalization** must go through `finalize_match(match_id, winner)` — it locks the row, re-checks verification/count/winner-membership, and is the only code path allowed to set `status='finalized'`. The `matches` update RLS policy blocks plain updates from flipping status.
- **Snapshot deck identity** (`deck_name_snapshot`, `commander_snapshot`) onto `match_participants` at verify time so history survives deck renames/deletes and `decks` stays owner-private.

## File and Naming Conventions
- **Files:** Next.js App Router defaults (`page.tsx`, `route.ts`); kebab-case for other modules.
- **Components / types:** PascalCase
- **Functions / variables:** camelCase
- **Constants / env vars:** UPPER_SNAKE_CASE
- **Postgres:** snake_case; RPCs named as verbs.

## Testing Pattern
- **Weight effort on pgTAP** — it protects the product's trust guarantee. Cover: a non-member cannot read/write a group's data; `finalize_match` rejects unverified / <2 players / non-participant winner / non-host caller and accepts a valid set exactly once.
- Vitest for services/validators (parse fixture Archidekt payloads, mock Scryfall, assert graceful-failure → manual-fallback path).
- Playwright for the one happy-path E2E (host → joiners verify → finalize → stats update), using separate auth contexts to simulate devices.
- Run the relevant suite after every feature; fix failures before moving on.

## Change Discipline
- Prefer focused, minimal edits over large rewrites.
- Check `tech_stack.md` / `package.json` before adding any dependency; prefer native APIs and the standard RSC + Server Actions approach.
- Do NOT change migrations, RLS policies, `SECURITY DEFINER` functions, auth flows, or infra without explicit approval.
- One P0 feature (F1–F6) at a time — commit/checkpoint after each working feature.
- Respect the Won't-Have list: no synced life totals, no extra importers (Archidekt only), no non-Commander formats, no deckbuilding.
