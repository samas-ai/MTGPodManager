# Setup — MTG Pod Manager (Phase 1: Groups & Membership)

Phase 1 is built: project scaffold, email+password auth, and F1 (groups create/join,
invite codes, member roster) with RLS as the authorization boundary. Follow these
steps to run it against a free hosted Supabase project.

## Prerequisites
- Node 18+ (you have Node 22).
- A free Supabase account → https://supabase.com
- Dependencies installed: `npm install` (already done if you ran the build).

## 1. Create a Supabase project
1. Go to https://supabase.com/dashboard → **New project**. Pick a name, a strong DB
   password, and the region nearest your pod. Free tier is fine.
2. Wait for the project to finish provisioning (~2 min).

## 2. Apply the database migration
1. In the dashboard, open **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/migrations/0001_init_groups.sql`](supabase/migrations/0001_init_groups.sql)
   and click **Run**. It creates the tables, enables RLS, adds the policies, the
   `is_group_member()` helper, the `handle_new_user` trigger, and the
   `create_group` / `create_invite` / `accept_invite` RPCs. The script is
   idempotent — safe to re-run.
3. (Optional sanity check) In **Database → Tables** you should see `profiles`,
   `groups`, `group_members`, `group_invites`, each with the RLS shield icon.
4. **F2:** run [`supabase/migrations/0002_decks.sql`](supabase/migrations/0002_decks.sql)
   the same way. It adds the owner-private `decks` table + `deck_source` enum +
   `decks_all_own` RLS + `updated_at` trigger.
5. **F4:** run [`supabase/migrations/0003_matches.sql`](supabase/migrations/0003_matches.sql).
   It adds `matches` + `match_participants` + `match_status` enum + RLS, and adds
   `match_participants` to the `supabase_realtime` publication (check
   **Database → Publications → supabase_realtime**).
6. **F5:** run [`supabase/migrations/0004_finalize.sql`](supabase/migrations/0004_finalize.sql).
   It adds the `finalize_match()` RPC (the only path that finalizes a match).
7. **F6:** run [`supabase/migrations/0005_stats.sql`](supabase/migrations/0005_stats.sql).
   It adds the `group_player_winrates` + `group_deck_play_counts` views (check
   **Database → Views**).
8. **Fix:** run [`supabase/migrations/0006_deck_delete_set_null.sql`](supabase/migrations/0006_deck_delete_set_null.sql).
   It changes `match_participants.deck_id` to `ON DELETE SET NULL` so a deck that
   was used in a match can be deleted (its snapshot keeps history intact).
9. **Security hardening:** run [`supabase/migrations/0007_harden_mp_update.sql`](supabase/migrations/0007_harden_mp_update.sql).
   It adds a WITH CHECK to the `match_participants` UPDATE policy (membership of
   the new match's group) — closing an open-match injection vector found in the
   Phase 7 security review (see [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md)).
   Apply migrations in order (0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007).

## 3. Configure auth
- **Auth → Providers → Email** is enabled by default (email+password).
- For fast local testing, **Auth → Sign In / Providers → Email → "Confirm email"**
  can be turned **off** so sign-up immediately creates a session and lands you on
  `/groups`. Leave it **on** for production — the app already handles the
  "check your email" path (you'll confirm via the emailed link, then sign in).

## 4. Wire up environment variables
1. Copy the template: `cp .env.local.example .env.local`
2. In the dashboard, **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; not used until
     later phases, but keep it out of any client code)

## 5. Run it
```bash
npm run dev      # http://localhost:3000
```
- Sign up (user A) → you land on **Your pods**.
- **Create a pod** → you're taken to the pod home.
- **Generate invite code** → an 8-char code appears (expires in 14 days).
- In a separate browser/profile, sign up (user B) → **Join a pod** with the code →
  B now sees the pod and the 2-member roster.
- RLS proof: a third user C who was never invited cannot load that pod
  (`/groups/<id>` returns 404 for them).

### F2 — profile & decks
- From **Your pods**, click **Profile** (top-right) → **My decks** → add a deck
  (name + commander) → it appears in the list → **Remove** deletes it.
- On **Profile**, edit your display name and **Save** — it persists and updates the
  name shown in your pod roster.
- RLS proof: decks are owner-private — user B never sees user A's decks (each only
  ever sees their own).

### F3 — Archidekt import
- Ensure `SCRYFALL_USER_AGENT` is set in `.env.local` (already in the template) —
  Scryfall requires a descriptive User-Agent.
- **My decks → Import from Archidekt** → paste a public Archidekt deck URL
  (e.g. `https://archidekt.com/decks/<id>/<slug>`) → the deck is saved with its
  commander, color identity, and `source = archidekt` (shown as "imported").
- Failure path (the guarantee): paste a malformed/private/non-Archidekt URL → you
  get a clear, recoverable error and the **Add a deck manually** form right below
  still works. Import is best-effort; manual entry always works.
- Etiquette: import runs server-side only — ~1 Archidekt GET + 1 Scryfall POST per
  import, descriptive User-Agent, results cached on the deck row.

### F4 — host live session
- From a pod, click **Start match** → you land on the host screen.
- Pick player count (2–4); each seat shows 40 life with −5/−1/+1/+5 controls. Life is
  **local to the host screen** — it is never synced across devices (by design).
- The **Joined** panel shows live join status. It's empty until F5 (joining/verifying).
  Optional smoke test now: in the Supabase SQL editor, insert a row into
  `match_participants` for this match's id + your user id — it appears on the host
  screen within ~1–2s without a refresh (Realtime working).
- Fallback: set `NEXT_PUBLIC_REALTIME_TRANSPORT=polling` in `.env.local` to use the
  3-second polling path instead of Realtime (then restart `npm run dev`).

### F5 — join, verify & finalize (the money path)
Needs at least 2 pod members (use two browsers/profiles) and each with ≥1 deck.
- **Host:** Start match → on the host screen pick **your deck** under "Your deck" → verify.
- **Player 2:** open the pod → **Join match** → pick a deck → **Confirm deck & verify**.
  The host's **Joined** panel flips them to "verified" within ~1–2s (live).
- **Host:** under **Record result**, select the winner → **Finalize match** → you land
  back on pod home with "Match recorded."
- Negative checks (expected to fail with a clear message):
  - Finalize while a joiner is still unverified → "Everyone must pick a deck and verify first."
  - A non-host opening `/match/<id>/host` is redirected to the join page.
  - The DB itself blocks a half-verified or non-participant-winner finalize — that's
    the `finalize_match()` RPC + the pgTAP suite (`finalize_match.test.sql`).

### F6 — stats (the payoff)
- After at least one finalized match, **pod home** shows a **Standings** teaser
  (top players by win %) and **Recent matches**, with a **Full stats →** link.
- **/stats/[groupId]** shows the full breakdown: standings (win % · W/G),
  most-played decks (× play count), and recent matches with dates.
- Finalize another match → counts and win % update on reload.
- RLS proof: a non-member cannot see another pod's stats (the views are
  `security_invoker`, so your RLS on the base tables scopes every row).

## Verification commands
```bash
npm run typecheck   # tsc --noEmit — passes
npm run lint        # eslint — clean
npm test            # vitest — 12 validator tests pass
npm run build       # next build — all routes compile
```

## Tests that need Docker (deferred)
- **pgTAP** RLS suites: [`supabase/tests/rls_groups.test.sql`](supabase/tests/rls_groups.test.sql)
  (member/non-member access + invite validation) and
  [`supabase/tests/rls_decks.test.sql`](supabase/tests/rls_decks.test.sql) (decks
  owner-private). Run with the Supabase CLI + Docker: `supabase start` then
  `supabase test db`. Neither the CLI nor Docker is installed in the current
  environment, so these suites are authored now and run in CI/Docker later.
- **Playwright** happy-path: [`e2e/groups.spec.ts`](e2e/groups.spec.ts) is skipped
  unless `E2E_RUN=1` and a live env are present. To run:
  `E2E_RUN=1 E2E_BASE_URL=http://localhost:3000 npm run test:e2e` (with the dev
  server up and email confirmation off).

## Known notes
- `npm audit` reports advisories that are transitive dev-dependency issues whose only
  "fix" is a breaking jump to a Next.js preview — deferred intentionally. Next.js is
  pinned to the patched **14.2.35**.
- No deck/match/stats tables exist yet — those arrive in Phases F2–F6 per `AGENTS.md`.
