# ROADMAP.md — MTG Pod Manager, Post-Launch Roadmap

> Status baseline (2026-06-10): MVP F1–F6 **shipped to production** (Vercel + Supabase, migrations 0001–0008 applied, verified live). Phase 7 design/a11y/security/CI-prep complete. This roadmap covers what comes next, in four tracks: **A — System Quality**, **B — Features**, **C — UI/UX**, **D — MTG Theming**, followed by a suggested phase sequence.
>
> Standing guardrails still apply everywhere: RLS is the authorization source of truth, `finalize_match()` is the only finalization path, free tier until a measured trigger says otherwise, design tokens only, strict TS, mobile-first.

---

## Track A — System Quality & Hardening

The MVP is correct but young. These items convert "verified by hand" into "verified by machines, continuously."

| # | Item | Why | Size |
|---|------|-----|------|
| A1 | **Push to GitHub so CI actually runs** — `.github/workflows/ci.yml` is written but has never executed; pgTAP suites (the RLS + finalization trust guarantee) currently only run by hand | The whole integrity story is test-backed only if the tests run on every change | S |
| A2 | **Regenerate DB types via `supabase gen types typescript`** — `database.types.ts` is hand-authored (no CLI/Docker locally); drift is silent | Eliminates a known class of "looks like a type bug" failures | S |
| A3 | **Playwright E2E of the golden path** — sign-up → create pod → invite/join → register deck → host match → join-to-verify → finalize → stats reflect it. Run against `supabase start` in CI | The one flow that defines the product currently has zero automated end-to-end coverage | M–L |
| A4 | **Error monitoring + analytics** — Sentry (free tier) for server actions/RPC failures; Vercel Analytics for Web Vitals field data | Production is live and currently observable only via user reports | S |
| A5 | **Enable the documented CSP** in `next.config.mjs` after a browser pass (it's written but commented out) | Finishes the security-review follow-through | S |
| A6 | **Core Web Vitals on a real mid-range phone** — the last unchecked Phase 7 box (DEPLOY.md §6); fix what's red | PRD Definition of Done; phones-at-the-table is the primary context | M |
| A7 | **Import rate limiting** — per-user throttle on the Archidekt/Scryfall import action (e.g. token bucket in Postgres) | Protects free-tier quotas and honors Scryfall etiquette under abuse, not just good behavior | S–M |
| A8 | **Dependency hygiene** — Dependabot/Renovate with `@supabase/ssr` + `@supabase/supabase-js` grouped as one update (documented skew quirk); Next.js patch cadence | Prevents the known version-skew foot-gun from recurring | S |
| A9 | **Assistive-tech pass** — real VoiceOver (iOS) + TalkBack run of join/verify/finalize; fix findings | A11y Pass 1 was code-level; AT behavior is only knowable on-device | M |
| A10 | **Data lifecycle** — confirm Supabase backup posture on free tier; add a "export my group's matches as CSV/JSON" server action | Pods accumulate irreplaceable history; users should be able to take it with them | M |
| A11 | **Free-tier usage watch → upgrade trigger** — instrument Realtime connection counts + DB size against the documented thresholds in DEPLOY.md | Turns "watch usage" from a memory note into a measurable signal | S |

**Exit criteria for the track:** CI green on every PR including pgTAP + E2E; Sentry quiet; CWV green on-device; CSP enforced.

---

## Track B — New Features

Ordered by the PRD's own priorities (P1 "Should Have" first), plus gaps surfaced by real usage. One feature at a time, each behind its own migration + pgTAP coverage where the DB is touched.

### B1 — Finishing order (placement) — *the keystone migration* (M)
Add `placement` to `match_participants` (the clean migration MEMORY.md already anticipated). Extend `finalize_match()` (new migration, never edit shipped ones) to accept an ordered result; winner-only remains valid input (placement 1 + ties unset). **Do this first** — head-to-head, standings-over-time, and streaks all get strictly better with ordering data, and backfilling later is impossible.

### B2 — Per-deck win rates & head-to-head (P1) (M)
New `security_invoker` views: `group_deck_winrates`, `group_head_to_head` (player-vs-player from shared finalized matches). Surfaces on deck pages and a stats subpage. No schema change beyond B1.

### B3 — Leaderboard / standings over time (P1) (M)
Standings snapshot computed per finalized match (view or computed-on-read at pod scale), rendered as a glanceable trend (see C4). "Stats as payoff" is the PRD's third UX principle — this is its flagship.

### B4 — Match notes & tags (P1) (S–M)
`notes text` + `tags text[]` on `matches`, host-editable while open, member-readable after. Enables "the game where the Gitrog combo went off" group lore. Validation via Zod + CHECK constraints (length caps).

### B5 — Group management gaps (S–M)
Real usage will hit these fast: leave group, admin removes member, admin transfer, rename pod, revoke/regenerate invite codes. All RPC + RLS work (extends F1's SECURITY DEFINER family — needs the usual approval + pgTAP).

### B6 — "Run it back" rematch (S)
One tap on a finalized match → new open match pre-seeded with the same pod; participants re-verify (the invariant is untouched — verification is per-match). Huge table-side ergonomics for fixed pods playing 3 games a night.

### B7 — P2 horizon (post-B1–B6, pick by demand)
- **Color-identity & archetype breakdowns** (P2) — color data already snapshotted/importable.
- **Streaks, seasons, date-range filters** (P2) — seasons map naturally to MTG "sets" (see D5).
- **Moxfield import** — explicitly out of scope for v1; revisit only after Archidekt import proves stable and only with the same best-effort + manual-fallback design.
- **Commander damage on the host life counter** — local-only state like life; fits the existing constraint (no synced totals).

---

## Track C — UI/UX Design Changes

Pass 1 established tokens, fonts, pips, and route states. Pass 2 is about *ergonomics at the table* and *navigation between sessions*.

### C1 — App shell & navigation (M)
Today navigation is page-to-page links. Add a persistent mobile bottom tab bar — **Pods · Decks · Stats · Profile** — with the active match surfaced as a floating "return to table" pill when one is open. Desktop gets a slim top nav. (Token-based, shadcn-style, no new deps.)

### C2 — Life counter v2: "Table Mode" (M–L)
The host screen is the mid-game workhorse; current buttons are small for a tense table.
- Full-screen mode: giant per-seat tap zones (top half +1, bottom half −1; long-press ±5), landscape 2×2 grid for 4 players.
- **Screen Wake Lock API** so the host phone doesn't sleep mid-game (progressive enhancement).
- Life-change ticker (last few deltas) so "wait, what hit me?" is answerable.
- Stays 100% local state per the constraint; reduced-motion respected.

### C3 — QR join flow (S–M)
Invite codes are typed today. Host screen renders a QR (tiny dependency or hand-rolled SVG) encoding the join URL; joiners scan → auth → verify. Cuts the activation metric ("3+ players join-and-verify") friction to near zero.

### C4 — Stats visualization (M)
Replace number-only tables with token-colored bars (win rate), sparklines (standings over time, pairs with B3), and deck play-count bars. No chart library unless necessary — small SVGs keep the bundle lean. Color is never the only signal (existing a11y rule).

### C5 — Dark mode toggle (S)
The `.dark` token set already exists and is AA-checked. Add OS-preference default + manual toggle (persisted). Pairs with D2 — dark mode is where the MTG atmosphere really lands.

### C6 — Onboarding & empty states (M)
PRD Definition-of-Done still lists the new-pod walkthrough. First-run: create-pod → invite (QR) → register deck guided sequence; empty states teach the next action instead of stating absence. Native share sheet (`navigator.share`) for invites.

### C7 — Micro-interaction polish (S)
Optimistic verify state on the join page, button press feedback, view transitions between pod ↔ stats. All gated behind `prefers-reduced-motion`.

---

## Track D — Authentic MTG Theming

Goal: make it *feel* like Magic without crossing IP lines or becoming kitsch. Theme is atmosphere; trust signals (verification, stats) stay legible.

### D0 — Legal footing first (S) ⚠️ do before D1–D5
- Comply with the **Wizards of the Coast Fan Content Policy**: add the required footer disclaimer ("unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards…"), and note the constraint it imposes: **the app must remain non-commercial** while it uses WotC IP (symbols, card art). If monetization ever enters the picture, this whole track gets re-scoped.
- Follow **Scryfall's imagery guidelines**: card art allowed with **artist attribution**, no implying Scryfall/WotC endorsement, cache respectfully.
- Re-verify both policies at build time (same discipline as the Archidekt rule).

### D1 — Commander art everywhere it earns its place (M)
Scryfall's API already returns `image_uris.art_crop` and `artist`. Store both at import/resolve time (extend the existing Scryfall service; nullable columns, manual decks just omit it).
- Deck cards: art_crop banner with a token-gradient scrim + "Art: {artist}" credit.
- Join/verify screen: your selected commander's art confirms "yes, that deck."
- Match history rows: tiny commander thumbnails make history scannable and personal.

### D2 — Mana & color identity as a first-class visual language (M)
- Upgrade letter-pips to proper **WUBRG mana-symbol SVGs** (e.g. the community `mana` icon set — check its license — or hand-drawn equivalents), keeping the existing aria-labels and color+symbol pairing.
- Decks and stats rows take a subtle **color-identity tint** derived from existing `--mtg-*` tokens (left border / gradient edge — token-only, no raw hex).
- Guild/shard/wedge names as flavor labels on two/three-color decks ("Golgari", "Esper") — names of color combinations are deep EDH-native vocabulary.

### D3 — Voice & copy pass (S–M)
A terminology sweep, kept tasteful (flavor in chrome, clarity in actions — never obscure a destructive or trust-critical action behind a joke):
- "Start match" → **"Untap"**-flavored framing where it doesn't cost clarity; match history as the **"Chronicle"**; stats page as **"Standings"** with flavor subtitle.
- Empty states and loading lines get EDH-native flavor ("No decks sleeved up yet", "Shuffling up…").
- Keep verify/finalize copy literal — that's the trust core; flavor stops at its border.

### D4 — Texture & frame pass (M)
The "arcane parchment" base is in place. Deepen it, tokens-only:
- Card-frame treatment for `Card` components (subtle double border + corner radius rhythm echoing a card frame, not a clone of one).
- Optional fine parchment/noise texture on `--background` (CSS, kilobytes, no images).
- A restrained "foil" sheen on win-highlight moments (finalized banner, leaderboard #1) — `prefers-reduced-motion` disables it.
- Dark mode (C5) tuned as its own mood — deep blacks + arcane purple, not just inverted parchment.

### D5 — Seasons as "Sets" (M, pairs with B7 streaks/seasons)
When seasons land, frame them like MTG sets: a pod names each season, gets a season "symbol" (generated geometric badge), and the leaderboard archives per season. Mechanically it's date-range filtering (P2); the framing makes it feel native.

### D6 — Playful trust-safe extras (S each, backlog)
- **D20 first-player roller** on the host screen pre-game (local, animated, reduced-motion aware).
- Deck "card back" placeholder art for manual decks with no commander resolved.
- Win badges with flavor ("Kingslayer" for beating the previous leader) — purely cosmetic, computed from existing stats.

---

## Suggested Sequence

Dependency-ordered, one phase at a time, commit/checkpoint per working item — same discipline as F1–F6.

| Phase | Contents | Duration (solo) |
|-------|----------|-----------------|
| **8 — Stabilize & instrument** | A1, A2, A4, A5, A6, A8, A11 (+ A7 if import sees use) | ~1–2 weeks |
| **9 — Stats that pay off** | B1 (placement migration first) → B2 → B3 → B4; A3 E2E lands here against the now-richer golden path | ~2–3 weeks |
| **10 — Table-side UX** | C1 nav, C2 Table Mode, C3 QR join, C5 dark mode, B5 group management, B6 rematch | ~2 weeks |
| **11 — The flavor pass** | D0 legal → D1 art → D2 mana language → D3 copy → D4 texture; C4 stats viz + C6 onboarding ride along | ~1–2 weeks |
| **12 — Horizon (by demand)** | B7 picks (seasons/D5, archetype breakdowns, commander damage, Moxfield), A9, A10, D6 extras | ongoing |

### Sequencing rationale
- **Quality before features** (Phase 8): the next migration (B1) should land on a repo where CI + pgTAP actually gate merges.
- **B1 before any new stats**: placement data can't be backfilled; every week of winner-only matches is lost fidelity for head-to-head/standings.
- **Theming last among the big tracks**: D1/D2 build on stable deck/import services and benefit from dark mode (C5) and nav (C1) being settled — restyling twice is waste.
- **D0 gates the whole theme track**: confirm the Fan Content Policy posture before a single piece of WotC-derived art or symbology ships.

### Standing risks to re-verify at build time
1. **Archidekt API drift** — re-check before extending import (B7 Moxfield, D1 art capture). Manual fallback remains the guarantee.
2. **Supabase Realtime RLS behavior** — re-confirm on any Realtime change (C2 does *not* add sync; keep it that way).
3. **Scryfall etiquette** — art_crop caching (D1) must batch + cache, never per-render fetch.
4. **Free-tier limits** — A11's instrumentation decides when the upgrade trigger fires; nothing in this roadmap assumes paid tier.
