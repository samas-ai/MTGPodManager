-- =============================================================================
-- pgTAP — Seasons (0019). Run with: supabase test db (requires CLI + Docker).
--
-- Proves: only admins can start a season; starting closes the prior active one
-- and opens exactly one new active season; members read their pod's seasons; a
-- non-member sees none; the name is validated.
-- =============================================================================
begin;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),  -- admin (creator)
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),    -- member
  ('44444444-4444-4444-4444-444444444444', 'dave@example.com');   -- non-member

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

-- --- A non-admin cannot start a season -----------------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.start_season((select id from public.groups where name = 'Pod'), 'Season 1') $$,
  'P0001', 'not_an_admin',
  'a non-admin member cannot start a season'
);

-- --- Admin starts the first season ---------------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.start_season((select id from public.groups where name = 'Pod'), 'Bloomburrow Nights') $$,
  'admin starts the first season'
);

-- Invalid name is rejected.
select throws_ok(
  $$ select public.start_season((select id from public.groups where name = 'Pod'), '   ') $$,
  'P0001', 'invalid_season_name',
  'a blank season name is rejected'
);

-- --- Starting a second season closes the first ---------------------------------
select public.start_season((select id from public.groups where name = 'Pod'), 'Murders at the Manor');

select is(
  (select count(*)::int from public.seasons s
     join public.groups g on g.id = s.group_id
    where g.name = 'Pod' and s.ended_at is null),
  1,
  'exactly one active season remains after starting a second'
);

select is(
  (select count(*)::int from public.seasons s
     join public.groups g on g.id = s.group_id
    where g.name = 'Pod'),
  2,
  'both seasons are recorded (the first now closed)'
);

-- --- Visibility: member sees the pod's seasons; non-member sees none -----------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.seasons), 2,
  'a member can read the pod''s seasons'
);

select tests.act_as('44444444-4444-4444-4444-444444444444');
select is(
  (select count(*)::int from public.seasons), 0,
  'a non-member sees zero seasons'
);

select * from finish();
rollback;
