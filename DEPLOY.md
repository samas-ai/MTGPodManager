# Deploy & Launch Checklist — MTG Pod Manager

Production target: **Vercel** (Next.js) + **Supabase** (DB/Auth/Realtime), both free tier.
Prereqs: a hosted Supabase project (see [`SETUP.md`](SETUP.md)) and a GitHub repo.

## 1. GitHub & CI ✅
The repo lives at `github.com/samas-ai/MTGPodManager`. `.github/workflows/ci.yml`
runs the full gate on every push/PR: typecheck → lint → Vitest → **Supabase local +
pgTAP** → build. Dependabot keeps deps fresh (`@supabase/*` grouped so `ssr` +
`supabase-js` always bump together).

## 2. Apply database migrations (in order)
In the Supabase dashboard → SQL Editor, run each, **0001 → 0013**:
`0001_init_groups` · `0002_decks` · `0003_matches` · `0004_finalize` · `0005_stats`
· `0006_deck_delete_set_null` · `0007_harden_mp_update` · `0008_backfill_profiles`
· `0009_placement` (finishing order) · `0010_deck_stats` (deck win-rate + head-to-head
views) · `0011_match_notes` (notes/tags) · `0012_group_management` (admin/self RPCs)
· `0013_delete_group` (admin pod deletion).
Confirm: 7 tables + 2 views (Database → Views), RLS shield on every table, and the
`finalize_match` / `create_group` / `accept_invite` / `create_invite` functions.

## 3. Production auth settings (Supabase → Authentication)
- **Enable "Confirm email"** for production (the app already handles the
  "check your email" path on sign-up).
- Set **Site URL** + redirect URLs to your Vercel domain.

## 4. Create the Vercel project
1. Vercel → New Project → import the GitHub repo (framework auto-detected: Next.js).
2. **Environment Variables** (Project Settings → Environment Variables — never in the repo):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `SCRYFALL_USER_AGENT` (e.g. `MTGPodManager/1.0 (you@example.com)`)
   - `NEXT_PUBLIC_SITE_URL` = your production URL (for metadata/robots/sitemap)
3. **Enable Web Analytics and Speed Insights** (Project → Analytics / Speed Insights
   → Enable). The app already mounts both first-party scripts (gated on `VERCEL=1`);
   nothing is collected until enabled in the dashboard. Speed Insights is the field
   data for the §6 performance check.
4. Deploy. Preview deploys come per-PR automatically.

## 5. Post-deploy smoke test (the verified-logging journey)
On the production URL, ideally on real phones (host + ≥1 joiner):
1. Sign up + confirm email → land on **Your pods**.
2. Create a pod → generate an invite → a second account joins via the code.
3. Add/import a deck on each account (try an Archidekt URL + the manual fallback).
4. Host **Start match** → both pick decks & verify (host sees "verified" live) →
   host **Finalize** with a winner → returns to pod home with "Match recorded."
5. Pod home + **Stats** show standings, most-played decks, recent matches.

## 6. Performance check (PRD: < 3s on mid-range phone, green Core Web Vitals)
- Run **Lighthouse** (Chrome DevTools → mobile preset) or PageSpeed Insights against
  the production URL. Target LCP/CLS/INP in the green.
- Spot-check on an actual mid-range phone over typical Wi-Fi.
- The app is already mobile-first, RSC-rendered, token-styled, and self-hosts fonts —
  expect good scores; investigate any regressions in the match/host route (largest JS).

## 7. Monthly free-tier usage check (~5 min, Supabase + Vercel dashboards)
Run through this checklist monthly (or after any unusually busy week). Caps below
are the free-tier figures as of mid-2026 — confirm current numbers on the pricing
pages when a reading gets close.

| Metric | Where | Free cap (≈) | Act when |
|---|---|---|---|
| DB size | Supabase → Reports → Database | 500 MB | > 350 MB (70%) |
| Realtime concurrent connections | Supabase → Reports → Realtime | 200 | > 100 sustained |
| Realtime messages / month | Supabase → Reports → Realtime | 2M | > 1.4M (70%) |
| Monthly active users | Supabase → Reports → Auth | 50k | n/a at pod scale |
| Project pausing | Supabase pauses free projects after ~1 week of inactivity | — | any pause once real pods depend on it |
| Bandwidth | Vercel → Usage | 100 GB | > 70 GB |

**Pressure valves, in order:**
1. Realtime pressure → set `NEXT_PUBLIC_REALTIME_TRANSPORT=polling` in Vercel env
   (3s polling, no schema/code change) and redeploy.
2. DB size → old finalized matches are tiny; size pressure would come from
   `decks.card_data` JSON — clear card lists for unused imported decks if ever needed.
3. **Upgrade trigger (move Supabase to Pro):** Realtime connections approach the cap
   during normal play, the project risks auto-pausing with real users, or DB size
   passes 70% with valves 1–2 exhausted.

## 8. Security follow-ups (see [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md))
- Verify **Supabase Realtime authorization** enforces `mp_select` RLS per subscriber
  for Postgres Changes on `match_participants`.
- Treat `SUPABASE_SERVICE_ROLE_KEY` as a secret (rotate if ever exposed).
- **CSP ✅ enabled (production-only)** in [`next.config.mjs`](next.config.mjs) —
  browser-verified locally (fonts, styles, Supabase https/wss allowed; foreign
  origins blocked). Post-deploy: confirm zero CSP violations in the browser console
  during the §5 smoke test (Realtime live updates working = wss allowed in prod).

## Done when
- CI green on `main`; production build succeeds on Vercel.
- One complete verified-logging journey works end-to-end on real devices.
- Mobile performance acceptable; Supabase usage within free tier with a known upgrade trigger.
