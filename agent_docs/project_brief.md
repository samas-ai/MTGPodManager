# Project Brief (Persistent)

- **Product vision:** A persistent, per-group "league" for fixed MTG Commander pods — participation-verified match logging plus group-scoped stats (win rate by player, most-played decks) that persist across games.
- **Target Audience:** "The Pod Organizer" — an adult hobbyist EDH player tracking a recurring, fixed 2–4 person Commander pod. Comfortable with web/phones, not necessarily technical, mildly competitive, distrustful of honor-system stats, and unwilling to let logging interrupt the game.

## Conventions
- **Naming:** PascalCase for React components/types, camelCase for functions/variables, UPPER_SNAKE_CASE for constants/env, snake_case for Postgres.
- **File Structure:** Feature-based under `src/` (see `tech_stack.md`). Domain logic in `lib/services/`; validators in `lib/validators/`; migrations/RLS/RPCs in `supabase/migrations/`; pgTAP in `supabase/tests/`.
- **Styling:** Design tokens only (CSS variables → Tailwind theme). No raw hex/pixel values in components.
- **TypeScript:** `strict`, no `any` (`unknown` + type guards).

## Quality Gates
- **Tests:** Critical path covered first — RLS access (pgTAP), `finalize_match` invariants (pgTAP), import graceful failure (Vitest). One happy-path E2E (Playwright).
- **CI:** `typecheck → lint → vitest → supabase local + pgTAP → next build`. Block merge on red.
- **Pre-commit (optional):** format + lint via lint-staged to keep CI green.
- **Review:** Use `REVIEW-CHECKLIST.md` before marking any task complete. Frontend tasks require a mobile-viewport browser check. Run a dedicated security pass (RLS coverage, no service-role key in the bundle) before deploy.
- **Definition of done (per the PRD/Tech Design):** non-member provably cannot read/write another group's data; a match cannot reach `finalized` with an unverified/duplicate participant or non-participant winner; stats compute correctly and update after each finalized match; runs within free tiers.

## Key Commands
- Dev: `npm run dev` · Test (unit): `npm test` · E2E: `npm run test:e2e` · DB tests: `supabase test db`
- Typecheck: `npm run typecheck` · Lint: `npm run lint` · Build: `npm run build`
- Local DB: `supabase start` / `supabase db push`

## Key Principles
- Ship the simplest solution that satisfies the user story; cut scope before shipping half-working features.
- Prefer low-code/native paths (shadcn copy-in components, RSC + Server Actions, RLS) over custom infrastructure.
- "Trustworthy" is the whole product — keep finalization a database invariant, never a client convention.
- Design for the table: the live-match flow must be fast on a phone, mid-game.

## Update Cadence
Refresh this brief and `MEMORY.md` after each completed P0 feature, any architectural decision, or a resolved quirk. Re-verify the external-dependency risk notes (Archidekt ToS, Supabase Realtime auth behavior, Scryfall etiquette, vendor pricing) before the build steps that depend on them. Tech Design next review: ~2026-07.
