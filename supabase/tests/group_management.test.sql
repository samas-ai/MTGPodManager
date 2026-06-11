-- =============================================================================
-- pgTAP — B5 group management RPCs (0012).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Fixture: alice (admin/creator), bob + carol (members). Proves admin-only
-- authorization, the last-admin guards (can't leave / remove / demote the sole
-- admin), self-removal routing, rename, and invite revocation.
-- =============================================================================
begin;
select plan(15);

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

-- Alice creates the pod (admin), bob + carol join as members.
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

-- --- rename: non-admin blocked, admin allowed -------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.rename_group((select id from _g), 'Hacked') $$,
  'P0001', 'not_an_admin', 'a non-admin cannot rename the pod'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.rename_group((select id from _g), 'Tuesday Night EDH') $$,
  'admin renames the pod'
);
select is(
  (select name from public.groups where id = (select id from _g)),
  'Tuesday Night EDH', 'pod name is updated'
);

-- --- leave: sole admin blocked; a member can leave --------------------------
select throws_ok(
  $$ select public.leave_group((select id from _g)) $$,
  'P0001', 'last_admin_cannot_leave', 'the sole admin cannot leave'
);

select tests.act_as('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ select public.leave_group((select id from _g)) $$,
  'a member can leave the pod'
);
select is(
  (select count(*)::int from public.group_members where group_id = (select id from _g)),
  2, 'roster shrinks after carol leaves'
);

-- --- remove_member: non-admin blocked, self blocked, last-admin blocked ------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.remove_member((select id from _g), '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'not_an_admin', 'a non-admin cannot remove members'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.remove_member((select id from _g), '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'use_leave_to_remove_self', 'admin must use leave to remove themselves'
);
select lives_ok(
  $$ select public.remove_member((select id from _g), '22222222-2222-2222-2222-222222222222') $$,
  'admin removes a member'
);

-- Re-add bob for the set_admin tests.
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
insert into public.group_members (group_id, user_id, role)
select (select id from _g), '22222222-2222-2222-2222-222222222222', 'member';

-- --- set_admin: promote, then demote is allowed once a 2nd admin exists ------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.set_admin((select id from _g), '11111111-1111-1111-1111-111111111111', false) $$,
  'P0001', 'cannot_demote_last_admin', 'the last admin cannot be demoted'
);
select lives_ok(
  $$ select public.set_admin((select id from _g), '22222222-2222-2222-2222-222222222222', true) $$,
  'admin promotes bob to admin'
);
select lives_ok(
  $$ select public.set_admin((select id from _g), '11111111-1111-1111-1111-111111111111', false) $$,
  'now the original admin can step down (transfer complete)'
);
select is(
  (select role::text from public.group_members
    where group_id = (select id from _g) and user_id = '11111111-1111-1111-1111-111111111111'),
  'member', 'alice is now a member after transfer'
);

-- --- revoke_invites: admin clears outstanding codes -------------------------
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
insert into public.group_invites (group_id, code, created_by)
select (select id from _g), 'TESTCODE', '22222222-2222-2222-2222-222222222222';

select tests.act_as('22222222-2222-2222-2222-222222222222');  -- bob is now admin
select lives_ok(
  $$ select public.revoke_invites((select id from _g)) $$,
  'admin revokes outstanding invite codes'
);
select is(
  (select count(*)::int from public.group_invites where group_id = (select id from _g)),
  0, 'no invite codes remain after revoke'
);

select * from finish();
rollback;
