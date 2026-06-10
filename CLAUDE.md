# CLAUDE.md — Claude Code Configuration for MTG Pod Manager

## Project Context
**App:** MTG Pod Manager — persistent per-group league + participation-verified match logging for fixed MTG Commander pods
**Stack:** Next.js (App Router) + TypeScript (strict) · Supabase (Auth, Postgres + RLS, Realtime) · Tailwind + shadcn/ui (design tokens) · Vercel
**Stage:** MVP Development (P0 features F1–F6)
**User Level:** Developer (B)

## Directives
1. **Master Plan:** Always read `AGENTS.md` first — it holds the current phase, roadmap, and constraints. Then check `MEMORY.md` for active state.
2. **Documentation:** Refer to `agent_docs/` for details — `tech_stack.md`, `code_patterns.md`, `product_requirements.md`, `testing.md`, `project_brief.md`.
3. **Plan-First:** Propose a brief plan and wait for approval before changing more than one file. Use plan mode for non-trivial work.
4. **Incremental Build:** Build one P0 feature at a time (F1→F6). Test frequently; commit/checkpoint after each working feature.
5. **RLS is law:** Never substitute client-side checks for Row Level Security. Match finalization goes only through the `finalize_match()` RPC.
6. **Pre-Commit / CI:** Run typecheck, lint, Vitest, and pgTAP (for DB changes) before commit; fix failures. Do not bypass hooks without asking.
7. **No Linting by hand:** Don't act as a linter — use `npm run lint`.
8. **Memory:** Update `MEMORY.md` after milestones, architectural decisions, and resolved quirks. Don't fill context history during long sessions — write state to `MEMORY.md`.
9. **Communication:** Be concise. Ask ONE specific clarifying question when blocked.
10. **Verify external risks before building:** re-check Archidekt ToS/endpoints (F3), Supabase Realtime RLS-auth behavior (F4), and Scryfall etiquette before the steps that depend on them.

## What NOT To Do
- Do NOT modify `supabase/migrations/`, RLS policies, or `SECURITY DEFINER` functions without approval.
- Do NOT add features outside the current phase (respect the Won't-Have list).
- Do NOT use `any`, ship placeholder content, or leave the service-role key reachable from the browser.
- Do NOT skip or weaken tests to make CI pass.

## Commands
- `npm run dev` — Start dev server
- `npm test` — Run unit tests (Vitest)
- `npm run test:e2e` — Run E2E tests (Playwright)
- `supabase test db` — Run pgTAP RLS/finalization tests
- `npm run typecheck` — Type check (`tsc --noEmit`)
- `npm run lint` — Check code style
- `npm run build` — Production build
- `supabase start` / `supabase db push` — Local DB stack / apply migrations
