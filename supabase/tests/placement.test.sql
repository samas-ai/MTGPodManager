-- =============================================================================
-- pgTAP — B1 finishing order (0009): placement column + finalize_match v2.
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves:
--   * winner-only finalize still works and sets winner placement = 1, rest null;
--   * a full finishing order persists exactly as submitted;
--   * bad orders are rejected (coverage, range, duplicates, winner not first);
--   * players cannot write their own placement (RPC-only column).
-- =============================================================================
begin;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Alice creates the pod; bob + carol join; everyone has a deck.
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

-- Match P: 3 verified participants, for the full-order path.
-- Match Q: 2 verified participants, for the winner-only path.
insert into public.matches (id, group_id, host_id)
select 'eeeeeeee-0000-0000-0000-0000000000e1', id, '11111111-1111-1111-1111-111111111111' from public.groups where name = 'Pod';
insert into public.matches (id, group_id, host_id)
select 'eeeeeeee-0000-0000-0000-0000000000e2', id, '11111111-1111-1111-1111-111111111111' from public.groups where name = 'Pod';

insert into public.match_participants (match_id, user_id, deck_id, verified) values
  ('eeeeeeee-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', true),
  ('eeeeeeee-0000-0000-0000-0000000000e1', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', true),
  ('eeeeeeee-0000-0000-0000-0000000000e1', '33333333-3333-3333-3333-333333333333', 'dddddddd-0000-0000-0000-0000000000c1', true),
  ('eeeeeeee-0000-0000-0000-0000000000e2', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', true),
  ('eeeeeeee-0000-0000-0000-0000000000e2', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', true);

-- --- RPC-only column: self-service writes of placement are blocked -----------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ update public.match_participants set placement = 1
     where match_id = 'eeeeeeee-0000-0000-0000-0000000000e1'
       and user_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'a player cannot set their own placement (WITH CHECK blocks it)'
);

-- --- Rejections (host calls, full-order mode) --------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '11111111-1111-1111-1111-111111111111',
       '{"11111111-1111-1111-1111-111111111111": 1,
         "22222222-2222-2222-2222-222222222222": 2}'::jsonb) $$,
  'P0001', 'placements_must_cover_all_participants',
  'rejects an order that misses a participant'
);

select throws_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '11111111-1111-1111-1111-111111111111',
       '{"11111111-1111-1111-1111-111111111111": 1,
         "22222222-2222-2222-2222-222222222222": 2,
         "44444444-4444-4444-4444-444444444444": 3}'::jsonb) $$,
  'P0001', 'placement_unknown_participant',
  'rejects an order naming a non-participant'
);

select throws_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '11111111-1111-1111-1111-111111111111',
       '{"11111111-1111-1111-1111-111111111111": 1,
         "22222222-2222-2222-2222-222222222222": 2,
         "33333333-3333-3333-3333-333333333333": 9}'::jsonb) $$,
  'P0001', 'invalid_placement_value',
  'rejects an out-of-range placement'
);

select throws_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '11111111-1111-1111-1111-111111111111',
       '{"11111111-1111-1111-1111-111111111111": 1,
         "22222222-2222-2222-2222-222222222222": 2,
         "33333333-3333-3333-3333-333333333333": 2}'::jsonb) $$,
  'P0001', 'duplicate_placement',
  'rejects duplicate placements'
);

select throws_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '11111111-1111-1111-1111-111111111111',
       '{"11111111-1111-1111-1111-111111111111": 2,
         "22222222-2222-2222-2222-222222222222": 1,
         "33333333-3333-3333-3333-333333333333": 3}'::jsonb) $$,
  'P0001', 'winner_must_be_first',
  'rejects an order where the winner is not 1st'
);

-- --- Valid full order persists ------------------------------------------------
select lives_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e1',
       '22222222-2222-2222-2222-222222222222',
       '{"22222222-2222-2222-2222-222222222222": 1,
         "33333333-3333-3333-3333-333333333333": 2,
         "11111111-1111-1111-1111-111111111111": 3}'::jsonb) $$,
  'host finalizes with a valid full finishing order'
);

select is(
  (select placement from public.match_participants
    where match_id = 'eeeeeeee-0000-0000-0000-0000000000e1'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  1::smallint, 'winner recorded as 1st'
);
select is(
  (select placement from public.match_participants
    where match_id = 'eeeeeeee-0000-0000-0000-0000000000e1'
      and user_id = '33333333-3333-3333-3333-333333333333'),
  2::smallint, 'second place recorded'
);
select is(
  (select placement from public.match_participants
    where match_id = 'eeeeeeee-0000-0000-0000-0000000000e1'
      and user_id = '11111111-1111-1111-1111-111111111111'),
  3::smallint, 'third place recorded'
);

-- --- Winner-only mode still works ----------------------------------------------
select lives_ok(
  $$ select public.finalize_match('eeeeeeee-0000-0000-0000-0000000000e2',
       '11111111-1111-1111-1111-111111111111') $$,
  'winner-only finalize (no placements argument) still works'
);
select results_eq(
  $$ select user_id, placement from public.match_participants
      where match_id = 'eeeeeeee-0000-0000-0000-0000000000e2' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 1::smallint),
            ('22222222-2222-2222-2222-222222222222'::uuid, null::smallint) $$,
  'winner-only mode sets winner to 1, leaves others null'
);

select * from finish();
rollback;
