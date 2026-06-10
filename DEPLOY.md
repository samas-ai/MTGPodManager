# Deploy & Launch Checklist — MTG Pod Manager

Production target: **Vercel** (Next.js) + **Supabase** (DB/Auth/Realtime), both free tier.
Prereqs: a hosted Supabase project (see [`SETUP.md`](SETUP.md)) and a GitHub repo.

## 1. Push to GitHub (enables CI)
The repo isn't under git yet. Once pushed, `.github/workflows/ci.yml` runs the full
gate on every push/PR: typecheck → lint → Vitest → **Supabase local + pgTAP** → build.
```bash
git init && git add . && git commit -m "MVP F1–F6 + Phase 7 hardening"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## 2. Apply database migrations (in order)
In the Supabase dashboard → SQL Editor, run each, **0001 → 0007**:
`0001_init_groups` · `0002_decks` · `0003_matches` · `0004_finalize` · `0005_stats`
· `0006_deck_delete_set_null` · `0007_harden_mp_update`.
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
3. Deploy. Preview deploys come per-PR automatically.

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

## 7. Monitoring & free-tier watch (Supabase dashboard)
- Watch **Realtime concurrent connections** (one channel per active match) and **DB size**.
- **Upgrade trigger:** move Supabase to a paid tier when Realtime connections approach
  the free cap during normal play, or the project risks auto-pausing once real users
  depend on it. The app has a **polling fallback** — set
  `NEXT_PUBLIC_REALTIME_TRANSPORT=polling` to relieve Realtime pressure.

## 8. Security follow-ups (see [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md))
- Verify **Supabase Realtime authorization** enforces `mp_select` RLS per subscriber
  for Postgres Changes on `match_participants`.
- Treat `SUPABASE_SERVICE_ROLE_KEY` as a secret (rotate if ever exposed).
- **Optional CSP:** enable the documented Content-Security-Policy in
  [`next.config.mjs`](next.config.mjs) after confirming in-browser that Realtime,
  fonts, and styles still work.

## Done when
- CI green on `main`; production build succeeds on Vercel.
- One complete verified-logging journey works end-to-end on real devices.
- Mobile performance acceptable; Supabase usage within free tier with a known upgrade trigger.
