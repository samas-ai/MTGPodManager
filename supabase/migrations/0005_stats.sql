-- =============================================================================
-- 0005_stats.sql — F6 Core Group Stats (the payoff)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Two views with security_invoker = on (Postgres 15+, which Supabase runs): the
-- querying user's RLS on the base tables (matches, match_participants) applies
-- automatically, so the views are group-scoped without any extra WHERE and need
-- no separate authorization. They recompute on read — fine at pod scale.
--   * group_player_winrates  — games / wins / win_rate per player per group
--   * group_deck_play_counts — most-played decks per group (finalized matches)
-- =============================================================================

create or replace view public.group_player_winrates with (security_invoker = on) as
select
  m.group_id,
  mp.user_id,
  count(*) filter (where m.status = 'finalized') as games,
  count(*) filter (where m.status = 'finalized' and m.winner_user_id = mp.user_id) as wins,
  round(
    (count(*) filter (where m.status = 'finalized' and m.winner_user_id = mp.user_id))::numeric
    / nullif(count(*) filter (where m.status = 'finalized'), 0), 3
  ) as win_rate
from public.match_participants mp
join public.matches m on m.id = mp.match_id
group by m.group_id, mp.user_id;

create or replace view public.group_deck_play_counts with (security_invoker = on) as
select
  m.group_id,
  mp.deck_id,
  mp.deck_name_snapshot,
  mp.commander_snapshot,
  count(*) as times_played
from public.match_participants mp
join public.matches m on m.id = mp.match_id
where m.status = 'finalized'
group by m.group_id, mp.deck_id, mp.deck_name_snapshot, mp.commander_snapshot
order by times_played desc;

-- security_invoker views still require the caller to hold SELECT on the view;
-- base-table RLS does the row scoping.
grant select on public.group_player_winrates  to authenticated;
grant select on public.group_deck_play_counts to authenticated;
