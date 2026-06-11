-- =============================================================================
-- 0017_color_identity_snapshot.sql — D2 color-identity on stats rows (Phase 11)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- D2 tints deck cards + stats rows by color identity. Deck cards already have it
-- (decks.color_identity, owner-private), but the deck-stats views aggregate from
-- match_participants snapshots only — decks stay owner-private, so the view can't
-- read color identity from there. Mirror the existing snapshot pattern
-- (deck_name_snapshot, art_crop_snapshot, …): capture color_identity at verify
-- time onto match_participants, then surface it on the two deck views.
--
-- All additive: new nullable column, views recreated with the new column appended
-- last (CREATE OR REPLACE VIEW only permits appending). Older rows snapshot null;
-- mode() ignores nulls and the app coerces null -> [] (colorless renders as none).
-- =============================================================================

alter table public.match_participants
  add column if not exists color_identity_snapshot text[];

-- Re-create both deck views with color_identity appended. mode() within group
-- picks the modal snapshot per deck identity (stable in practice; robust if a
-- deck's identity ever changed between snapshots). Column order before the new
-- one is preserved exactly, as CREATE OR REPLACE VIEW requires.
create or replace view public.group_deck_play_counts with (security_invoker = on) as
select
  m.group_id,
  mp.deck_id,
  mp.deck_name_snapshot,
  mp.commander_snapshot,
  count(*) as times_played,
  mode() within group (order by mp.color_identity_snapshot) as color_identity
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'finalized'
group by m.group_id, mp.deck_id, mp.deck_name_snapshot, mp.commander_snapshot
order by times_played desc;

create or replace view public.group_deck_winrates with (security_invoker = on) as
select
  m.group_id,
  mp.deck_id,
  mp.deck_name_snapshot,
  mp.commander_snapshot,
  count(*) as games,
  count(*) filter (where m.winner_user_id = mp.user_id) as wins,
  round(
    (count(*) filter (where m.winner_user_id = mp.user_id))::numeric
    / nullif(count(*), 0), 3
  ) as win_rate,
  mode() within group (order by mp.color_identity_snapshot) as color_identity
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'finalized'
group by m.group_id, mp.deck_id, mp.deck_name_snapshot, mp.commander_snapshot;

-- Grants persist across CREATE OR REPLACE, but re-assert to be safe.
grant select on public.group_deck_play_counts to authenticated;
grant select on public.group_deck_winrates    to authenticated;
