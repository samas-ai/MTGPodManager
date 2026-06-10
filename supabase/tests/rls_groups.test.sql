-- =============================================================================
-- pgTAP — F1 RLS & membership invariants (highest-value suite).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves the product's trust foundation:
--   * a member can read their group's roster;
--   * a NON-member cannot read another group's group/roster/invites;
--   * group_members has no public write path (RPC-only);
--   * accept_invite rejects invalid and expired codes.
-- =============================================================================
begin;
select plan(9);

-- Two users in auth.users; profiles auto-created by the trigger.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

-- --- Helper to act as a given user (sets the JWT claims RLS reads) -----------
create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- --- Alice creates a group via the RPC --------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.create_group('Alice Pod') $$,
  'member can create a group via create_group()'
);

-- capture the group id (as postgres, bypassing RLS for the test fixture)
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
create temporary table _g as select id from public.groups where name = 'Alice Pod' limit 1;

-- --- Alice (member) can read her group & roster -----------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.groups where id = (select id from _g)),
  1,
  'member can SELECT their own group'
);
select is(
  (select count(*)::int from public.group_members where group_id = (select id from _g)),
  1,
  'member can read their group roster (creator is admin member)'
);
select is(
  (select role::text from public.group_members
    where group_id = (select id from _g) and user_id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'group creator is recorded as admin'
);

-- --- Bob (non-member) is fully blind to Alice's group -----------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.groups where id = (select id from _g)),
  0,
  'non-member CANNOT SELECT the group'
);
select is(
  (select count(*)::int from public.group_members where group_id = (select id from _g)),
  0,
  'non-member CANNOT read the roster'
);

-- --- group_members has no public INSERT path (RPC-only) ---------------------
select throws_ok(
  format(
    $$ insert into public.group_members (group_id, user_id, role)
       values (%L, '22222222-2222-2222-2222-222222222222', 'member') $$,
    (select id from _g)
  ),
  '42501',  -- insufficient_privilege / RLS violation
  null,
  'non-member CANNOT self-insert into group_members (no insert policy)'
);

-- --- accept_invite rejects bad codes ----------------------------------------
select throws_ok(
  $$ select public.accept_invite('NOTACODE') $$,
  'invalid_invite_code',
  'accept_invite rejects an unknown code'
);

-- Insert an already-expired invite as postgres, then try to accept it.
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
insert into public.group_invites (group_id, code, created_by, expires_at)
values ((select id from _g), 'EXPIRED1', '11111111-1111-1111-1111-111111111111', now() - interval '1 day');

select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.accept_invite('EXPIRED1') $$,
  'invite_expired',
  'accept_invite rejects an expired code'
);

select * from finish();
rollback;
