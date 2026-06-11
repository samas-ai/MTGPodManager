-- =============================================================================
-- pgTAP — delete_group (0013).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Fixture: alice (admin), bob (member), one finalized match + participant +
-- invite, plus a deck alice owns. Proves: non-admin blocked; admin deletes;
-- the group and all its cascaded rows vanish; the owner's deck survives.
-- =============================================================================
begin;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

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
insert into public.group_invites (group_id, code, created_by)
select (select id from _g), 'DELCODE1', '11111111-1111-1111-1111-111111111111';
insert into public.decks (id, user_id, name, commander_name, source) values
  ('dddddddd-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'A deck', 'Atraxa', 'manual');
insert into public.matches (id, group_id, host_id, status, winner_user_id, finalized_at)
select 'cccccccc-0000-0000-0000-0000000000c1', (select id from _g),
       '11111111-1111-1111-1111-111111111111', 'finalized',
       '11111111-1111-1111-1111-111111111111', now();
insert into public.match_participants (match_id, user_id, deck_id, verified)
values ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111',
        'dddddddd-0000-0000-0000-0000000000a1', true);

-- --- A non-admin member cannot delete the pod -------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.delete_group((select id from _g)) $$,
  'P0001', 'not_an_admin', 'a non-admin cannot delete the pod'
);

-- --- The admin deletes the pod ----------------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.delete_group((select id from _g)) $$,
  'admin deletes the pod'
);

-- --- Verify the group and its cascaded rows are gone (as postgres) ----------
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select is((select count(*)::int from public.groups where id = (select id from _g)), 0,
  'group row is gone');
select is((select count(*)::int from public.group_members where group_id = (select id from _g)), 0,
  'group_members cascade-deleted');
select is((select count(*)::int from public.matches where group_id = (select id from _g)), 0,
  'matches cascade-deleted');
select is((select count(*)::int from public.match_participants
            where match_id = 'cccccccc-0000-0000-0000-0000000000c1'), 0,
  'match_participants cascade-deleted');

-- --- The owner's deck survives (decks are not pod-scoped) -------------------
select is((select count(*)::int from public.decks
            where id = 'dddddddd-0000-0000-0000-0000000000a1'), 1,
  'the owner''s deck survives pod deletion');

select * from finish();
rollback;
