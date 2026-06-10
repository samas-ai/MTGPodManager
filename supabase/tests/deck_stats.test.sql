-- =============================================================================
-- pgTAP — B2 deck win rates + head-to-head views (0010).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Fixture: alice beats bob twice (decks A vs B); carol joins game 2 (deck C).
-- Proves per-deck games/wins, directional head-to-head counts, and that a
-- non-member sees zero rows (security_invoker + base RLS).
-- =============================================================================
begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');  -- non-member

create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('Pod');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);

insert into public.group_members (group_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'member' from public.groups where name = 'Pod';
insert into public.group_members (group_id, user_id, role)
select id, '33333333-3333-3333-3333-333333333333', 'member' from public.groups where name = 'Pod';

insert into public.decks (id, user_id, name, commander_name, source) values
  ('dddddddd-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A deck', 'Atraxa', 'manual'),
  ('dddddddd-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B deck', 'Edgar Markov', 'manual'),
  ('dddddddd-0000-0000-0000-0000000000c1', '33333333-3333-3333-3333-333333333333', 'C deck', 'Krenko', 'manual');

-- Two finalized matches, inserted as fixtures (the finalize path itself is
-- covered by finalize_match.test.sql / placement.test.sql).
insert into public.matches (id, group_id, host_id, status, winner_user_id, finalized_at)
select 'ffffffff-0000-0000-0000-0000000000f1', id, '11111111-1111-1111-1111-111111111111',
       'finalized', '11111111-1111-1111-1111-111111111111', now()
from public.groups where name = 'Pod';
insert into public.matches (id, group_id, host_id, status, winner_user_id, finalized_at)
select 'ffffffff-0000-0000-0000-0000000000f2', id, '11111111-1111-1111-1111-111111111111',
       'finalized', '11111111-1111-1111-1111-111111111111', now()
from public.groups where name = 'Pod';

insert into public.match_participants (match_id, user_id, deck_id, deck_name_snapshot, commander_snapshot, verified) values
  ('ffffffff-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', 'A deck', 'Atraxa', true),
  ('ffffffff-0000-0000-0000-0000000000f1', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', 'B deck', 'Edgar Markov', true),
  ('ffffffff-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', 'A deck', 'Atraxa', true),
  ('ffffffff-0000-0000-0000-0000000000f2', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', 'B deck', 'Edgar Markov', true),
  ('ffffffff-0000-0000-0000-0000000000f2', '33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-0000000000c1', 'C deck', 'Krenko', true);

-- --- Member view: per-deck win rates -----------------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');

select results_eq(
  $$ select deck_name_snapshot, games::int, wins::int from public.group_deck_winrates
      order by deck_name_snapshot $$,
  $$ values ('A deck', 2, 2), ('B deck', 2, 0), ('C deck', 1, 0) $$,
  'deck winrates: games and wins per deck are correct'
);

-- --- Member view: head-to-head ------------------------------------------------
select results_eq(
  $$ select games_together::int, player_wins::int, opponent_wins::int
       from public.group_head_to_head
      where player_id = '11111111-1111-1111-1111-111111111111'
        and opponent_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (2, 2, 0) $$,
  'alice vs bob: 2 shared games, alice won both'
);

select results_eq(
  $$ select games_together::int, player_wins::int, opponent_wins::int
       from public.group_head_to_head
      where player_id = '22222222-2222-2222-2222-222222222222'
        and opponent_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (2, 0, 2) $$,
  'bob vs alice: mirrored direction is consistent'
);

select results_eq(
  $$ select games_together::int, player_wins::int, opponent_wins::int
       from public.group_head_to_head
      where player_id = '11111111-1111-1111-1111-111111111111'
        and opponent_id = '33333333-3333-3333-3333-333333333333' $$,
  $$ values (1, 1, 0) $$,
  'alice vs carol: 1 shared game, alice won'
);

select is(
  (select count(*)::int from public.group_head_to_head),
  6,
  'directional pairs: 3 player pairs x 2 directions'
);

select is(
  (select count(*)::int from public.group_deck_winrates),
  3,
  'a member sees all three decks'
);

-- --- Non-member sees nothing ---------------------------------------------------
select tests.act_as('44444444-4444-4444-4444-444444444444');

select is(
  (select count(*)::int from public.group_deck_winrates), 0,
  'non-member sees zero deck winrate rows'
);
select is(
  (select count(*)::int from public.group_head_to_head), 0,
  'non-member sees zero head-to-head rows'
);

select * from finish();
rollback;
