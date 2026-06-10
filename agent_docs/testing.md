# Testing Strategy

> Source: Technical Design "Testing Strategy". The PRD requires the critical path covered: **RLS access, import, match finalization.** Weight effort on pgTAP — it protects the product's trust guarantee.

## Frameworks
- **RLS & DB invariants:** **pgTAP** (Supabase local) — the highest-value suite.
- **Unit / services:** **Vitest**.
- **E2E:** **Playwright** (one happy-path journey).

## What Each Layer Covers
| Layer | Tool | Covers |
|---|---|---|
| RLS policies | pgTAP | A non-member cannot read/write a group's matches, decks, participants; a member can. |
| Finalization invariants | pgTAP | `finalize_match` rejects unverified participants, <2 players, non-participant winner, non-host caller; accepts a valid set exactly once. |
| Import / Scryfall | Vitest | Parse fixture Archidekt payloads; mock Scryfall; assert graceful failure → manual-fallback path. |
| Services & validators | Vitest | Zod schemas, deck snapshot logic. |
| Happy-path E2E | Playwright | Host opens match → (simulated) joiners authenticate, pick deck, verify → host finalizes → stats update. Use separate auth contexts to simulate multiple devices. |

> Multi-device Realtime is genuinely hard to E2E; the pgTAP suite on `finalize_match` is what actually protects the trust guarantee — invest there first.

## Rules & Requirements
- **Coverage:** Aim to fully cover the critical path (RLS access, import graceful-failure, finalization invariants) before chasing a coverage percentage elsewhere.
- **Before Commit:** Run `npm test` (and `supabase test db` for DB changes) before marking a task complete.
- **Failures:** NEVER skip tests or mock out assertions to make a pipeline pass without human approval. If the agent breaks a test, the agent must fix it.
- **Frontend:** Verify on a mobile viewport in the browser before marking UI tasks complete.
- **Manual Checks (per PRD Definition of Done):** end-to-end run of host + 3 joiners on separate devices/contexts; mobile performance acceptable on a real phone; one complete verified-logging journey works end-to-end.

## Pre-commit Hooks
- Optional but recommended: lint-staged running format + lint on staged files to keep CI green.
- CI (GitHub Actions) is the enforced gate: `typecheck → lint → vitest → supabase local + pgTAP → next build`. Block merge on red.

## Verification Loop
Run checks after each feature and fix failures before moving on:
1. `npm run typecheck`
2. `npm run lint`
3. `npm test` (Vitest)
4. `supabase test db` (pgTAP — required whenever schema/RLS/RPCs change)
5. `npm run test:e2e` (Playwright — at minimum before release)
6. Browser check on a mobile viewport for UI changes.

## Execution Commands
- Run all unit tests: `npm test`
- Run a single unit test file: `npm test -- <path/to/file.test.ts>`
- Run DB/RLS tests: `supabase test db`
- Run E2E: `npm run test:e2e`
- Run a single E2E spec: `npm run test:e2e -- <path/to/spec.ts>`
