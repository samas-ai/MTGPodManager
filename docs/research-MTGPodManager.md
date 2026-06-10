## Deep Research Request: MTG Pod Manager

<context>
I'm building a web app called **MTG Pod Manager** for fixed Magic: The Gathering Commander playgroups. I have a Systems Analysis degree and solid experience with Python/Django, React/Next.js, MySQL/PostgreSQL, and Supabase. I need comprehensive technical research — assume I can code, so go deep and skip beginner explanations.

**The product:** Users join a "group." All match data aggregates per group. Players have profiles with registered decks. To log a game, one user hosts a live session (runs a single shared life-counter screen on the table), and every other participant joins the active match from their own device to authenticate and select which of their pre-registered decks they're playing. Only then is the match officially logged. This verifies participation without requiring multi-device life-total sync.

**Technical Context:**
- Preferred Stack: Next.js (App Router) + Supabase (Auth, Postgres, Realtime), responsive web (phones used around the table)
- Constraints: Must run on free tiers initially (Supabase + Vercel); architecture should scale to a paid multi-group SaaS later
- Pod size: variable 2–4 player Commander games
- Timeline: ~1 month to a usable MVP
</context>

<instructions>
### Research Objectives
1. Validate the market gap for **persistent, per-group league-style stat tracking** for recurring playgroups.
2. Determine the most reliable, ToS-compliant way to import decklists and fetch card/commander data.
3. Recommend a real-time architecture for the "host screen + players join from own devices" match flow on Supabase.
4. Provide a concrete data model and the queries behind core stats.
5. Map free-tier limits and the path to a subscription model.

### Specific Questions
1. What existing tools (Archidekt playgroups, Deckbox, the official MTG Companion app's game history, Spelltable-era tools, any newer entrants) already do group/league stat tracking, and where exactly do they fall short for a fixed recurring pod?
2. For decklist import — what are the current options, rate limits, auth requirements, and Terms of Service realities for **Moxfield**, **Archidekt**, and **Scryfall**? Which should be the primary integration and which are best-effort? Confirm Scryfall as the canonical card/commander/identity data source and document its API + bulk-data options and rate-limit etiquette.
3. What is the recommended **Supabase Realtime** pattern for a host-initiated session that other authenticated players join — covering Presence, Broadcast, channel authorization, and Row Level Security so only group members can join/write to a match?
4. What Postgres schema best models: users/players, groups (membership, roles), decks (linked to a player, with imported card data + commander identity), matches (variable 2–4 participants), and per-player match results — and what are the efficient queries for win rate by player and "most-played deck"?
5. What are the relevant Supabase and Vercel free-tier limits (DB size, Realtime concurrent connections/messages, edge function invocations, auth MAU), and what's the realistic upgrade trigger and pricing as this grows into a multi-playgroup SaaS?

### Scope Definition
- **Include:** competitor analysis, decklist-import/data-source integration, Supabase Realtime match architecture, data modeling + stat queries, free-tier limits and SaaS scaling path, security/RLS for group-scoped data.
- **Exclude:** native iOS/Android apps, full real-time *synced* life totals across devices (only one host screen tracks life), tournament/Swiss pairing logic, non-Commander formats, deckbuilding/recommendation features.
- **Depth:** Competitor Analysis [Deep] · Technical Architecture [Comprehensive] · Implementation Options [Deep] · Cost Analysis [Surface]

### Sources Priority
1. Official API/technical documentation (Scryfall, Moxfield, Archidekt, Supabase, Next.js)
2. GitHub repositories (reference implementations of MTG trackers, Supabase Realtime + RLS examples)
3. Supabase/Next.js community guides and case studies
4. MTG community forums/Reddit (r/EDH, r/magicTCG) for feature expectations and gaps
5. Industry/SaaS pricing references

### Required Analysis
- Real-time architecture patterns for host/join session flows on Supabase (Presence, Broadcast, channel auth).
- Concrete Postgres schema (DDL sketch) for groups, players, decks, variable-size matches, and results.
- The actual SQL/queries for win-rate-by-player and most-played-deck, plus indexing notes.
- RLS policy patterns to scope all reads/writes to group membership.
- Decklist-import integration comparison: API availability, auth, rate limits, ToS, reliability — with a recommended primary + fallbacks.
- Free-tier ceilings (Supabase Realtime concurrent connections especially) and the cost curve toward a subscription SaaS.
</instructions>

<output_format>
- Detailed technical findings with code/schema examples (SQL DDL, RLS policies, a Realtime channel sketch).
- Describe the match-flow architecture as a Mermaid.js diagram or clear text sequence.
- **Cite sources with URLs and access dates** for each major finding.
- Use tables for the competitor comparison and the import-source comparison.
- **Explicitly flag where sources disagree or data is uncertain** — especially anything about the official MTG bracket/rules or third-party API ToS, which change often.
- Include pros/cons for each major recommendation (e.g., Realtime Broadcast vs database-change subscriptions; which import source to prioritize).
</output_format>
