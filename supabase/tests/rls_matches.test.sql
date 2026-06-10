-- =============================================================================
-- pgTAP — F4 matches & participants RLS.
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves:
--   * a member can read their group's match; a non-member cannot;
--   * the host can create a match; a non-host cannot;
--   * a plain UPDATE cannot flip status to 'finalized' (the with-check guard) —
--     finalization is reserved for the finalize_match() RPC in F5.
-- =============================================================================
begin;
select plan(7);

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

-- Alice creates a group; Bob joins; Carol stays out.
select tests.act_as('11111111-1111-1111-1111-111111111111');
select public.create_group('Pod');
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
create temporary table _g as select id from public.groups where name = 'Pod' limit 1;
grant select on _g to authenticated;
insert into public.group_members (group_id, user_id, role)
values ((select id from _g), '22222222-2222-2222-2222-222222222222', 'member');

-- --- Host (Alice) can create a match -----------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  format($$ insert into public.matches (group_id, host_id) values (%L, '11111111-1111-1111-1111-111111111111') $$, (select id from _g)),
  'host (member) can create a match'
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', null, true);
create temporary table _m as select id from public.matches where group_id = (select id from _g) limit 1;
grant select on _m to authenticated;

-- --- A member who is not the host cannot create a match as someone else ------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format($$ insert into public.matches (group_id, host_id) values (%L, '11111111-1111-1111-1111-111111111111') $$, (select id from _g)),
  '42501',
  null,
  'cannot insert a match with host_id != auth.uid()'
);

-- --- Member (Bob) can read the match; non-member (Carol) cannot --------------
select is(
  (select count(*)::int from public.matches where id = (select id from _m)),
  1,
  'member can SELECT the group match'
);
select tests.act_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.matches where id = (select id from _m)),
  0,
  'non-member CANNOT SELECT the match'
);

-- --- The integrity guard: host cannot flip status to finalized via UPDATE ----
select tests.act_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format($$ update public.matches set status = 'finalized' where id = %L $$, (select id from _m)),
  '42501',
  null,
  'plain UPDATE cannot set status = finalized (with check blocks it)'
);
-- ...but the host CAN make an allowed open-state update.
select lives_ok(
  format($$ update public.matches set host_id = host_id where id = %L $$, (select id from _m)),
  'host can perform an allowed update while open'
);

-- --- Non-member cannot read participants -------------------------------------
insert into public.match_participants (match_id, user_id)
  values ((select id from _m), '11111111-1111-1111-1111-111111111111');
select tests.act_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.match_participants where match_id = (select id from _m)),
  0,
  'non-member CANNOT read match participants'
);

select * from finish();
rollback;
