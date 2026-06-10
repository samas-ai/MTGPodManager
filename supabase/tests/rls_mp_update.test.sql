-- =============================================================================
-- pgTAP — match_participants UPDATE hardening (0007).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves a user can update their own participant row within their own open
-- match, but CANNOT move it into a foreign match's group they don't belong to.
-- =============================================================================
begin;
select plan(2);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Alice owns group A; Bob owns group B. Alice is NOT a member of B.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('A');
select tests.act_as('22222222-2222-2222-2222-222222222222');
select public.create_group('B');

-- Fixture rows as the privileged role.
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);

insert into public.matches (id, group_id, host_id)
select 'aaaaaaaa-0000-0000-0000-0000000000a1', id, '11111111-1111-1111-1111-111111111111'
from public.groups where name = 'A';
insert into public.matches (id, group_id, host_id)
select 'bbbbbbbb-0000-0000-0000-0000000000b1', id, '22222222-2222-2222-2222-222222222222'
from public.groups where name = 'B';

-- Alice has a participant row in her own (group A) match.
insert into public.match_participants (match_id, user_id)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111');

-- --- Legit update within her own open match succeeds ------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ update public.match_participants set verified = true
     where match_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'
       and user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user can update their own row in their own open match'
);

-- --- Moving the row into Bob's foreign match is blocked (WITH CHECK) --------
select throws_ok(
  $$ update public.match_participants set match_id = 'bbbbbbbb-0000-0000-0000-0000000000b1'
     where match_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'
       and user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'cannot move own participant row into a foreign group''s match'
);

select * from finish();
rollback;
