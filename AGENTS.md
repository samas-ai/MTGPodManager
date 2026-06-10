# AGENTS.md — Master Plan for MTG Pod Manager

## Project Overview & Stack
**App:** MTG Pod Manager
**Overview:** A persistent, per-group "league" for fixed Magic: The Gathering Commander (EDH) playgroups. Every recurring pod gets a shared home for registered decks, **participation-verified** match logging, and the running stats (win rate by player, most-played decks) that deck-centric or session-ephemeral tools don't keep across games. The differentiator is *participation-verified* logging: a match only finalizes once every joined player has authenticated and selected a registered deck, enforced as a database invariant — not a client convention. Primary user is a player-organizer ("The Pod Organizer") tracking their own 2–4 person pod.
**Stack:** Next.js (App Router) + TypeScript (strict) · Supabase (Auth, Postgres + RLS, Realtime) · Tailwind CSS + shadcn/ui (design tokens) · Vercel (hosting). See `agent_docs/tech_stack.md`.
**Critical Constraints:**
- **Mobile-first, responsive web only** — no native apps. Phones are used around the table mid-game.
- **RLS is the authorization source of truth** — never substitute client-side access checks for Row Level Security.
- **Match finalization is a database invariant** — only the `finalize_match()` `SECURITY DEFINER` RPC may set a match to `finalized`. Never finalize via an app-layer check-then-update.
- **Strict TypeScript, no `any`** — use `unknown` + type guards.
- **Free tier only (MVP)** — Supabase Free + Vercel Hobby. Keep Realtime payloads lean (one channel per match, participation status only; life totals are local-only, never synced).
- **Design tokens only** — no raw hex/pixel values scattered in components.

## Setup & Commands
Execute these commands for standard development workflows. Do not invent new package manager commands. (Confirm exact scripts against `package.json` once the project is scaffolded.)
- **Setup:** `npm install`
- **Development:** `npm run dev`
- **Testing (unit):** `npm test` (Vitest)
- **Testing (E2E):** `npm run test:e2e` (Playwright)
- **Database / RLS tests:** `supabase test db` (pgTAP, against Supabase local)
- **Type check:** `npm run typecheck` (`tsc --noEmit`)
- **Linting & Formatting:** `npm run lint`
- **Build:** `npm run build`
- **Supabase local stack:** `supabase start` / `supabase stop`
- **Apply migrations:** `supabase db push` (or `supabase migration up` locally)

## Protected Areas
Do NOT modify these areas without explicit human approval:
- **Database migrations:** Existing migration files under `supabase/migrations/`. Schema, RLS policies, and RPCs are code — add a new migration, never edit a shipped one.
- **RLS policies & `SECURITY DEFINER` functions:** `is_group_member()`, `finalize_match()`, `create_group()`, `accept_invite()`. These are the integrity core; changes need explicit sign-off and pgTAP coverage.
- **Auth setup:** `@supabase/ssr` cookie/session wiring in `lib/supabase/`.
- **Secrets & env:** `.env.local`, Vercel/Supabase project settings. The `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never reach the browser bundle.
- **Infrastructure:** Deployment workflows (`.github/workflows/`), Vercel config.

## Coding Conventions
- **Type Safety:** Strict TypeScript. The `any` type is forbidden — use `unknown` with type guards. All function params and returns typed. Zod validates every Server Action / Route Handler boundary; Postgres `CHECK` constraints are the backstop.
- **Architecture:** Thin route handlers/Server Components — reads via RLS-scoped Server Components, writes via Server Actions. Business logic lives in `lib/services/` (import, scryfall, matches), not in components or route bodies. Cross-row invariants live in Postgres RPCs.
- **Authorization:** RLS on every table is the boundary. Never re-implement access control client-side. Imports and RPC calls run server-side only.
- **Styling:** Design tokens (CSS variables in `globals.css`, surfaced as Tailwind theme extensions). No raw hex/pixel values in components. shadcn/ui components are copied-in and token-themed.
- **Formatting:** ESLint/Prettier enforced. No warnings allowed in new code.
- **Testing Expectations:** Critical path is covered first — RLS access (pgTAP), match finalization invariants (pgTAP), import/Scryfall graceful failure (Vitest). See `agent_docs/testing.md`.
- **Naming:** PascalCase components/types, camelCase functions/vars, UPPER_SNAKE_CASE constants/env. Match the existing project convention for filenames.

## How I Should Think
1. **Understand Intent First:** Before answering, identify what the user actually needs.
2. **Ask If Unsure:** If critical information is missing, ask ONE specific clarifying question before proceeding.
3. **Plan Before Coding:** Propose a brief plan, get approval, then implement. Use Plan/Reflect mode if the tool supports it.
4. **Verify After Changes:** Run typecheck, lint, and the relevant tests (or a manual browser check) after each change. Fix failures before moving on.
5. **Explain Trade-offs:** When recommending something, mention the alternatives — especially around RLS, Realtime, and the Archidekt import risk.

## Agent Behaviors
These rules apply across all AI coding assistants:
1. **Plan Before Execution:** ALWAYS propose a brief step-by-step plan before changing more than one file.
2. **Refactor Over Rewrite:** Prefer incremental refactors over rewriting large blocks.
3. **Context Compaction:** Write state to `MEMORY.md` instead of filling context history during long sessions.
4. **Iterative Verification:** Run tests/linters after each logical change; fix errors before proceeding (see `REVIEW-CHECKLIST.md`).
5. **One Feature at a Time:** Implement and verify one P0 feature (F1–F6) before starting the next. Commit/checkpoint after each working feature.
6. **Browser Verification:** For frontend work, verify on a mobile viewport in the browser before marking a task complete.

## What NOT To Do
- Do NOT delete files without explicit confirmation.
- Do NOT modify database schemas/migrations without a backup/forward-migration plan and approval.
- Do NOT add features not in the current phase (respect the Won't-Have list: no synced life totals, no extra importers, no non-Commander formats, no deckbuilding).
- Do NOT skip tests for "simple" changes, or bypass failing tests / pre-commit hooks.
- Do NOT substitute client-side access checks for RLS.
- Do NOT finalize a match via an app-layer update — only `finalize_match()` may.
- Do NOT ship placeholder content (no "Lorem ipsum", no sample decks) to production.
- Do NOT use the `any` type or deprecated libraries/patterns.

## Engineering Constraints
- **Type Safety:** `any` forbidden — `unknown` + type guards. Zod for runtime validation at boundaries.
- **Architectural Sovereignty:** Server Components/Actions handle request/response; business logic in `lib/services/`; cross-row invariants in Postgres RPCs. No direct privileged DB writes from the browser.
- **Library Governance:** Check `package.json` before adding dependencies. Prefer native APIs and the stack's standard data-fetching (RSC + Server Actions) over new libraries.
- **Clear Communication:** State issues briefly and fix them; no filler or repeated apologies. One specific clarifying question if blocked.
- **Workflow Discipline:** Pre-commit hooks and CI (typecheck → lint → vitest → pgTAP → build) must pass before commit/merge, or ask before bypassing.

## Roadmap (P0 — MVP)
Build in dependency order. Full detail in `agent_docs/product_requirements.md`.
1. **F1 — Groups & Membership:** `create_group()` / `accept_invite()` RPCs, `group_invites` codes, RLS + `is_group_member()`.
2. **F2 — Player Profiles & Deck Registration:** owner-private `decks` CRUD via Server Actions.
3. **F3 — Decklist Import (Archidekt + manual fallback):** server-side fetch → Scryfall identity resolve → save; graceful failure drops to a two-field manual form (name + commander). **Highest-risk item — design for failure.**
4. **F4 — Host Live Session:** host page with a **local** life counter + live join status via Realtime Postgres Changes (polling fallback written).
5. **F5 — Join-to-Verify & Finalization:** joiners write their own participant row; host calls `finalize_match()`.
6. **F6 — Core Group Stats:** win rate by player + most-played deck via `security_invoker` views.

## Phase 7 — Design, Accessibility & Launch Hardening (post-MVP)
Runs **after** F1–F6 are functionally complete. Not feature work — quality, polish, and release readiness. Honors the PRD's Quality Standards + Definition of Done:
- **Design / UX refinement:** ✅ **done (Pass 1)** — "arcane parchment" token theme, display/body fonts, MTG color-identity pips, badges, consistent `PageHeader`, loading/error/404 states; all token-based, table-first, mobile-first.
- **Accessibility:** ✅ **done (Pass 1)** — skip link, landmarks, per-page titles, labelled controls + life-counter `aria-label`s, focus-visible, AA-contrast palette, reduced-motion, color never the sole signal. (A real assistive-tech run is still worthwhile.)
- **Security review:** ✅ **done** — no high/critical; 2 fixes (open-redirect `safePath`; `mp_update_self` WITH CHECK via migration 0007). See `SECURITY-REVIEW.md`.
- **Launch prep (in-code):** ✅ **done** — GitHub Actions CI (full gate incl. pgTAP), security headers + commented CSP, `robots`/`sitemap`/OG metadata, and the `DEPLOY.md` runbook.
- **Performance:** ☐ Core Web Vitals green on a real mid-range phone (< 3s load). *(needs device — see DEPLOY.md §6)*
- **Release:** ☐ apply migrations, set Vercel env vars, deploy, smoke-test, enable monitoring. *(needs Vercel — see DEPLOY.md)*

See `MEMORY.md` for the **active phase** and current state.
