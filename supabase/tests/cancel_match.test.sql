-- =============================================================================
-- pgTAP — cancel_match (0014).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- alice = admin, bob + carol = members. Proves: an admin can force-close a
-- match they don't host; the host can close their own; a non-host non-admin
-- cannot; and a non-open match can't be cancelled.
-- =============================================================================
begin;
select plan(6);

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

select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('Pod');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
create temporary table _g as select id from public.groups where name = 'Pod' limit 1;
grant select on _g to authenticated;
insert into public.group_members (group_id, user_id, role)
select (select id from _g), '22222222-2222-2222-2222-222222222222', 'member';
insert into public.group_members (group_id, user_id, role)
select (select id from _g), '33333333-3333-3333-3333-333333333333', 'member';

-- Two open matches, both hosted by bob (a member, not an admin).
insert into public.matches (id, group_id, host_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', (select id from _g), '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', (select id from _g), '22222222-2222-2222-2222-222222222222');

-- --- Admin force-closes a match they do NOT host ----------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.cancel_match('aaaaaaaa-0000-0000-0000-0000000000a1') $$,
  'a pod admin can force-close a match they do not host'
);
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select is(
  (select status::text from public.matches where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  'cancelled', 'the match is marked cancelled'
);

-- --- A non-host, non-admin member cannot cancel -----------------------------
select tests.act_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select public.cancel_match('aaaaaaaa-0000-0000-0000-0000000000a2') $$,
  'P0001', 'not_host_or_admin', 'a non-host non-admin member cannot cancel'
);

-- --- The host can close their own match -------------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$ select public.cancel_match('aaaaaaaa-0000-0000-0000-0000000000a2') $$,
  'the host can close their own match'
);

-- --- A non-open match cannot be cancelled again -----------------------------
select throws_ok(
  $$ select public.cancel_match('aaaaaaaa-0000-0000-0000-0000000000a2') $$,
  'P0001', 'match_not_open', 'an already-closed match cannot be cancelled'
);

-- --- Stats are unaffected: cancelled matches never count --------------------
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select is(
  (select count(*)::int from public.matches
    where group_id = (select id from _g) and status = 'finalized'),
  0, 'no finalized matches exist, so standings are untouched by cancellation'
);

select * from finish();
rollback;
