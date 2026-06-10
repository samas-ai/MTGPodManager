-- =============================================================================
-- pgTAP — B4 match notes & tags (0011).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves: host can write notes/tags while the match is open; a non-host
-- member cannot; writes freeze after finalize; the CHECK backstops reject
-- oversized notes and invalid tag arrays.
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

insert into public.group_members (group_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'member' from public.groups where name = 'Pod';

insert into public.matches (id, group_id, host_id)
select 'abababab-0000-0000-0000-0000000000a1', id, '11111111-1111-1111-1111-111111111111'
from public.groups where name = 'Pod';

-- --- Host writes notes + tags while open --------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ update public.matches
        set notes = 'Gitrog combo went off on turn 6',
            tags  = array['combo','close-game']
      where id = 'abababab-0000-0000-0000-0000000000a1' $$,
  'host can set notes and tags on an open match'
);

-- --- A non-host member cannot write (0 rows pass the USING filter) ------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
update public.matches set notes = 'bob was here'
 where id = 'abababab-0000-0000-0000-0000000000a1';
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select is(
  (select notes from public.matches where id = 'abababab-0000-0000-0000-0000000000a1'),
  'Gitrog combo went off on turn 6',
  'a non-host member''s update is a no-op (RLS filters the row)'
);

-- --- CHECK backstops (as owner — RLS isn't the layer under test here) ---------
select throws_ok(
  $$ update public.matches set notes = repeat('x', 501)
      where id = 'abababab-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'notes longer than 500 chars are rejected'
);
select throws_ok(
  $$ update public.matches set tags = array['a','b','c','d','e','f']
      where id = 'abababab-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'more than 5 tags are rejected'
);
select throws_ok(
  $$ update public.matches set tags = array['this-tag-name-is-far-too-long-to-keep']
      where id = 'abababab-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'a tag over 24 chars is rejected'
);
select throws_ok(
  $$ update public.matches set tags = array['combo','combo']
      where id = 'abababab-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'duplicate tags are rejected'
);

-- --- Writes freeze after finalize ----------------------------------------------
update public.matches
   set status = 'finalized',
       winner_user_id = '11111111-1111-1111-1111-111111111111',
       finalized_at = now()
 where id = 'abababab-0000-0000-0000-0000000000a1';

select tests.act_as('11111111-1111-1111-1111-111111111111');
update public.matches set notes = 'late edit'
 where id = 'abababab-0000-0000-0000-0000000000a1';
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
select is(
  (select notes from public.matches where id = 'abababab-0000-0000-0000-0000000000a1'),
  'Gitrog combo went off on turn 6',
  'notes are frozen once the match is finalized'
);

select * from finish();
rollback;
