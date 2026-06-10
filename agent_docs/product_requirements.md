# Product Requirements

> Source of truth: `docs/PRD-MTGPodManager-MVP.md`. This is the working extract the agent builds against.

## Product
- **Name:** MTG Pod Manager — MVP (1.0)
- **One-liner:** A persistent, per-group "league" for fixed MTG Commander playgroups: registered decks, participation-verified match logging, and group-scoped stats that persist across games.
- **North Star:** Logged matches per active group per week — target ≥1 for your own pod, sustained through week 4.

## Primary User Story (verbatim)
"As a pod organizer, I want every player to confirm participation and their deck from their own phone before a match is recorded, so that our group's stats are trustworthy and complete."

**Acceptance Criteria:**
- A match is only marked *logged* once every joined participant has authenticated and selected a registered deck.
- The host can see, in real time, which players have joined and which are still pending.
- A match cannot be finalized with unverified or duplicate participants.

## Supporting User Stories
1. "As a player, I want to create a group and invite my pod, so that all our data lives in one place." — *creator becomes admin; only invited/joined members can read or write group data.*
2. "As a player, I want to register my decks by pasting an Archidekt link, so that match logging is just deck selection." — *import resolves commander + card identity via Scryfall and saves the deck to my profile.*
3. "As a host, I want to start a live session and run the shared life-counter screen, so that one device tracks the table while others just join." — *host opens a match channel; joiners attach from their own devices.*
4. "As a player, I want to view our group's win rate by player and most-played decks, so that we can see standings over time." — *stats are group-scoped and update after each logged match.*

## Must-Have Features (P0 — MVP)
- **F1 — Groups & Membership (M):** Create a group, invite/join members; all data scoped to the group; creator = admin. Members join via invite; non-members cannot read/write group data (RLS-enforced). All decks, matches, results reference a group.
- **F2 — Player Profiles & Deck Registration (M):** Each player has a profile and registered decks (commander identity + optional imported card data). Add/view/remove decks.
- **F3 — Decklist Import — Archidekt only, v1 (M–L):** Paste an Archidekt URL → import list, detect commander(s), normalize identity via Scryfall. Import failures surface a clear, recoverable error. **Manual deck-entry fallback is in scope** (name + Scryfall-resolved commander). ⚠️ Highest-uncertainty item — design for graceful failure.
- **F4 — Host Live Session (L):** One device hosts: runs the **single shared life-counter** for the table (local state only) and opens the match for others to join. Host sees join status update in real time (~1–2s). *Synced life totals across devices are explicitly out of scope.*
- **F5 — Join-to-Verify & Match Finalization (L):** Joiners authenticate and select a registered deck from their own devices. Host records the winner. Match finalizes only when all joined players are verified, there are ≥2 participants, no duplicates, and the winner is a participant.
- **F6 — Core Group Stats (M):** Group-scoped **win rate by player** and **most-played deck**, plus basic match history. Stats update after each finalized match.

## Should Have (P1 — post-MVP)
- Per-deck win rates and head-to-head matchups.
- Group leaderboard / standings view.
- Match history with notes/tags.

## Could Have (P2)
- Commander color-identity and archetype breakdowns.
- Streaks, seasons, and date-range filtering.

## Out of Scope (Won't Have — this release)
- Native iOS/Android apps — responsive web only.
- Real-time synced life totals across devices — single host screen only.
- Tournament/Swiss pairing logic.
- Non-Commander formats.
- Deckbuilding / recommendation features.
- Moxfield/Deckbox import — Archidekt only for v1.

## Success Metrics
- **North Star:** ≥1 verified logged match per active group per week (sustained through week 4).
- **O1 — Verified-logging loop works:** ≥1 verified match/week for 4 weeks; ≥90% of started matches reach *finalized*; ≥3 players per match join-and-verify on their own devices.
- **O2 — Frictionless onboarding:** a new player registers ≥1 deck via Archidekt import within their first session; median deck-import time < 60s.
- **Activation:** group reaches 3+ players & 1 logged match in first session.

## Non-Functional Requirements
- **Performance:** page load < 3s on a mid-range phone; join status visible to host within ~1–2s; comfortably handle a single 4-player match within free-tier Realtime limits.
- **Security/Privacy:** Supabase Auth; Postgres RLS scoping every read/write to group membership; channel authorization for Realtime; no PII beyond auth identity + display name.
- **Usability:** WCAG 2.1 AA target; mobile-first responsive; latest 2 versions of Chrome/Safari/Firefox/Edge, iOS 15+, Android 11+.
- **Scalability:** group-scoped from day one (extend to many groups with no schema change); run on Supabase + Vercel free tiers initially with a known paid-tier upgrade trigger.

## UI/UX Principles
1. **Table-first:** the live-match flow must work fast on a phone, mid-game.
2. **Verify, don't nag:** join/verify is a quick tap, not a form.
3. **Stats as payoff:** standings are glanceable and satisfying.

## Quality Standards (Anti-Vibe)
- Strict TypeScript, no `any`. Thin handlers/components; logic in services; RLS as the access source of truth (not client checks).
- Explicit error types; import and Realtime failures handled gracefully, never swallowed.
- Critical path tested: RLS access, import, match finalization.
- Design tokens only; WCAG 2.1 AA on core flows; Core Web Vitals green on mobile.
- **Will NOT accept:** placeholder content in production, out-of-scope features, client-side-only access checks, half-working features.

## Constraints & Assumptions
- **Budget:** Supabase + Vercel free tiers initially. **Timeline:** ~1 month to usable MVP. **Resources:** solo developer (Python/Django, React/Next.js, Postgres/Supabase).
- Primary user is a player-organizer using it for their own pod first. Scryfall is canonical for card/commander identity. Pods are 2–4 players, recurring and fixed.

## Resolved Open Questions (from Tech Design)
- **Archidekt path:** best-effort, server-side, design for graceful failure; manual fallback is the guarantee. (Confirm ToS at build time.)
- **Result model:** winner-only (`matches.winner_user_id`, validated as a participant). Full finishing order is a clean future migration.
- **Manual deck-entry fallback:** in scope (name + Scryfall-resolved commander; no card list required).
