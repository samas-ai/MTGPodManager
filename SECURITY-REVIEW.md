# Security Review — MTG Pod Manager (Phase 7)

**Date:** 2026-06-10 · **Scope:** full app (F1–F6) + Phase 7 design pass · **Reviewer:** Claude Code
**Method:** static review against the Tech Design "Security" section + PRD Quality Standards; RLS/RPC inspection; client-bundle inspection; dependency/secret scan.

## Summary
The app's core security posture is **sound**: RLS is enabled on every table and is the authorization boundary, finalization is a DB invariant, secrets are server-only, and all action inputs are Zod-validated. Two issues were found and **fixed** in this pass (one app-layer, one RLS hardening). Three items require the user's environment to complete.

## Controls verified ✅
| Area | Finding |
|---|---|
| **Service-role key isolation** | `SUPABASE_SERVICE_ROLE_KEY` is **not referenced anywhere in `src/`** and **not present in the client bundle** (`.next/static` scanned for the key — absent). Browser uses the anon key + RLS only. |
| **RLS coverage** | RLS enabled on all 7 tables (`profiles`, `groups`, `group_members`, `group_invites`, `decks`, `matches`, `match_participants`). Group data is member-scoped; decks are owner-only; membership writes go only through `SECURITY DEFINER` RPCs (no public insert policy on `group_members`). |
| **Finalization invariant** | `finalize_match()` is the only path that sets `status='finalized'` (plain UPDATE blocked by `matches_update_open` WITH CHECK). Re-checks host/open/≥2/all-verified/winner-is-participant atomically under a row lock. Covered by pgTAP. |
| **SECURITY DEFINER hygiene** | All definer functions set `search_path = public`; the four mutating RPCs `revoke … from public` + `grant execute … to authenticated`. No dynamic SQL (no injection surface). |
| **Input validation** | Zod at every Server Action boundary (auth, groups, decks, import, matches), mirrored by Postgres `CHECK` constraints. No `any` in `src/`. |
| **XSS** | All user-supplied content (names, decks, commanders, codes, error/message params) rendered as text in JSX (auto-escaped). No `dangerouslySetInnerHTML`. |
| **Auth** | Session validated via `supabase.auth.getUser()` (not `getSession()`) in middleware + every guarded page. |
| **Secrets in VCS** | `.env*.local` is gitignored; `.env.local.example` holds only placeholders. |
| **Server-only modules** | `scryfall.ts` / `archidekt.ts` / `import.ts` use `SCRYFALL_USER_AGENT` (non-`NEXT_PUBLIC`) and are imported only by server code. |

## Findings & fixes
### 1. Open redirect via `redirectTo` — FIXED
- **Where:** `src/lib/services/matches.ts` `safePath()`.
- **Issue:** accepted any value starting with `/`, including protocol-relative `//evil.com` (browsers treat as external) → open-redirect after verify/finalize.
- **Severity:** Low (the field is set by our own forms; exploit requires luring a user to submit a crafted value).
- **Fix:** extracted to `src/lib/safe-path.ts`; now rejects `//` and `/\` prefixes and non-`/` values. Unit-tested in `safe-path.test.ts`.

### 2. `match_participants` UPDATE missing membership check — FIXED
- **Where:** `mp_update_self` RLS policy (migration 0003).
- **Issue:** the policy had only a `USING` clause; the implied WITH CHECK required the new match be `open` but **not** that the caller is a member of the new match's group. A crafted API call could move one's own participant row into a *foreign* open match (UUID-guess), injecting the caller into a pod they don't belong to. The app never does this — RLS is the boundary, so it's hardened regardless.
- **Severity:** Low–Medium (needs an unguessable match UUID; app code unaffected).
- **Fix:** migration **`0007_harden_mp_update.sql`** adds an explicit `WITH CHECK` re-asserting ownership **and** group membership. Covered by pgTAP `rls_mp_update.test.sql`. **⚠️ User must apply 0007.**

## Open items (need the user's environment)
- **Run all pgTAP suites** against a real DB (Docker/CLI): `rls_groups`, `rls_decks`, `rls_matches`, `finalize_match`, `stats_views`, **`rls_mp_update`**. This is what actually proves RLS at runtime.
- **Supabase Realtime authorization:** confirm in the dashboard that Postgres Changes on `match_participants` enforce the `mp_select` RLS per subscriber (Supabase's Realtime authorization behavior has shifted across releases — Tech Design flagged this). Polling fallback exists if needed.
- **Rotate the service-role key** if `.env.local` was ever shared/committed (it is gitignored; treat the key as sensitive).
- **Pre-deploy:** set env vars in Vercel project settings (never in the repo); enable email confirmation in production; add basic Supabase usage monitoring.

## Verdict
No high/critical issues. The two findings are fixed in code/SQL (apply `0007`). Remaining items are runtime/deploy verifications. Safe to proceed to performance + deploy once `0007` is applied and the pgTAP suites pass.
