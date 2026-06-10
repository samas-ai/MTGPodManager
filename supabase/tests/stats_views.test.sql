-- =============================================================================
-- pgTAP — F6 stats views (group_player_winrates, group_deck_play_counts).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves: after a finalized match the views report correct games/wins and deck
-- play counts, AND that a non-member sees nothing (security_invoker + base RLS).
-- =============================================================================
begin;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');  -- non-member

create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Alice creates the group + a finalized 2-player match (alice beats bob).
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('Pod');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);

insert into public.group_members (group_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'member' from public.groups where name = 'Pod';

insert into public.decks (id, user_id, name, commander_name, source) values
  ('dddddddd-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A deck', 'Atraxa', 'manual'),
  ('dddddddd-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B deck', 'Edgar', 'manual');

insert into public.matches (id, group_id, host_id, status, winner_user_id, finalized_at)
select 'aaaaaaaa-0000-0000-0000-00000000000c', id, '11111111-1111-1111-1111-111111111111',
       'finalized', '11111111-1111-1111-1111-111111111111', now()
from public.groups where name = 'Pod';

insert into public.match_participants (match_id, user_id, deck_id, deck_name_snapshot, commander_snapshot, verified) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', 'A deck', 'Atraxa', true),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', 'B deck', 'Edgar', true);

-- --- Member (alice) sees correct winrates -----------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(
  (select wins::int from public.group_player_winrates where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'winner has 1 win'
);
select is(
  (select games::int from public.group_player_winrates where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'winner has 1 game'
);
select is(
  (select wins::int from public.group_player_winrates where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'loser has 0 wins'
);

-- --- Deck play counts --------------------------------------------------------
select is(
  (select count(*)::int from public.group_deck_play_counts where times_played = 1),
  2,
  'both decks recorded one play each'
);

-- --- Group scoping: alice sees 2 player rows; non-member dave sees none ------
select is(
  (select count(*)::int from public.group_player_winrates),
  2,
  'member sees both players in the view'
);
select tests.act_as('44444444-4444-4444-4444-444444444444');
select is(
  (select count(*)::int from public.group_player_winrates),
  0,
  'non-member sees no winrate rows (security_invoker + RLS)'
);

select * from finish();
rollback;
