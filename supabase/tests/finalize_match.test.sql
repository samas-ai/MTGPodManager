-- =============================================================================
-- pgTAP — F5 finalize_match() invariants (THE highest-value suite).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- finalize_match() is the only path that can set status='finalized'. This suite
-- proves it rejects every illegitimate finalize and accepts a valid one exactly
-- once — the database guarantee behind "trustworthy stats".
-- =============================================================================
begin;
select plan(9);

-- Fixed ids so we can reference rows directly.
-- alice = host, bob/carol = members.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Alice creates the group (becomes admin member) via the RPC.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('Pod');

-- Back to the privileged role for fixture setup (bypasses RLS).
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);

-- Members + a deck each.
insert into public.group_members (group_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'member' from public.groups where name = 'Pod';
insert into public.group_members (group_id, user_id, role)
select id, '33333333-3333-3333-3333-333333333333', 'member' from public.groups where name = 'Pod';

insert into public.decks (id, user_id, name, commander_name, source) values
  ('dddddddd-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A deck', 'Atraxa', 'manual'),
  ('dddddddd-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B deck', 'Edgar Markov', 'manual'),
  ('dddddddd-0000-0000-0000-0000000000c1', '33333333-3333-3333-3333-333333333333', 'C deck', 'Krenko', 'manual');

-- Three matches for three scenarios.
insert into public.matches (id, group_id, host_id)
select 'aaaaaaaa-0000-0000-0000-00000000000a', id, '11111111-1111-1111-1111-111111111111' from public.groups where name = 'Pod';
insert into public.matches (id, group_id, host_id)
select 'aaaaaaaa-0000-0000-0000-00000000000b', id, '11111111-1111-1111-1111-111111111111' from public.groups where name = 'Pod';
insert into public.matches (id, group_id, host_id)
select 'aaaaaaaa-0000-0000-0000-00000000000c', id, '11111111-1111-1111-1111-111111111111' from public.groups where name = 'Pod';

-- Match A: one verified + one UNverified participant.
insert into public.match_participants (match_id, user_id, deck_id, verified) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', true),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', null, false);

-- Match B: a single verified participant.
insert into public.match_participants (match_id, user_id, deck_id, verified) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', true);

-- Match C: two verified participants (alice + bob). carol is NOT a participant.
insert into public.match_participants (match_id, user_id, deck_id, verified) values
  ('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-0000000000a1', true),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'dddddddd-0000-0000-0000-0000000000b1', true);

-- ---- Assertions (call the RPC as the relevant user) ------------------------

-- 1) Unverified participant present → rejected.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'unverified_participants_present',
  'rejects finalize when a participant is unverified'
);

-- 2) Fewer than two participants → rejected.
select throws_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'need_at_least_two_participants',
  'rejects finalize with fewer than two participants'
);

-- 3) Winner not a participant → rejected.
select throws_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333') $$,
  'P0001', 'winner_must_be_participant',
  'rejects a winner who is not a participant'
);

-- 4) Non-host caller → rejected (host check happens first).
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'only_host_can_finalize',
  'rejects a non-host caller'
);

-- 5) Valid finalize by the host → succeeds.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222') $$,
  'host finalizes a valid, fully-verified match'
);

-- 6/7) State is correct after finalize.
select is(
  (select status::text from public.matches where id = 'aaaaaaaa-0000-0000-0000-00000000000c'),
  'finalized',
  'match status is finalized'
);
select is(
  (select winner_user_id from public.matches where id = 'aaaaaaaa-0000-0000-0000-00000000000c'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'winner is recorded'
);

-- 8) Double finalize → rejected (no longer open).
select throws_ok(
  $$ select public.finalize_match('aaaaaaaa-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222') $$,
  'P0001', 'match_not_open',
  'rejects finalizing an already-finalized match'
);

-- 9) Duplicate participant is impossible (unique constraint).
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select throws_ok(
  $$ insert into public.match_participants (match_id, user_id)
     values ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$,
  '23505', null,
  'duplicate (match_id, user_id) participant is rejected'
);

select * from finish();
rollback;
