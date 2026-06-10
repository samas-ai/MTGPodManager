-- =============================================================================
-- 0010_deck_stats.sql — B2 per-deck win rates + head-to-head (Phase 9)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Two more security_invoker views in the 0005 mold: base-table RLS scopes the
-- rows per caller, recompute on read (fine at pod scale).
--   * group_deck_winrates — games / wins / win_rate per deck per group, using
--     the same snapshot identity as group_deck_play_counts so renamed/deleted
--     decks keep their history.
--   * group_head_to_head  — directional player pairs from shared finalized
--     matches: how often A and B sat at the same table, and who won those.
--     Both directions are emitted so clients can filter on player_id alone.
-- =============================================================================

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
  ) as win_rate
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'finalized'
group by m.group_id, mp.deck_id, mp.deck_name_snapshot, mp.commander_snapshot;

create or replace view public.group_head_to_head with (security_invoker = on) as
select
  m.group_id,
  a.user_id as player_id,
  b.user_id as opponent_id,
  count(*) as games_together,
  count(*) filter (where m.winner_user_id = a.user_id) as player_wins,
  count(*) filter (where m.winner_user_id = b.user_id) as opponent_wins
from public.match_participants a
join public.match_participants b
  on b.match_id = a.match_id and b.user_id <> a.user_id
join public.matches m on m.id = a.match_id
where m.status = 'finalized'
group by m.group_id, a.user_id, b.user_id;

-- security_invoker views still require SELECT on the view itself;
-- base-table RLS does the row scoping.
grant select on public.group_deck_winrates to authenticated;
grant select on public.group_head_to_head  to authenticated;
