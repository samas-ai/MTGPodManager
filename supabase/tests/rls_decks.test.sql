-- =============================================================================
-- pgTAP — F2 decks RLS (owner-private invariant).
-- Run with: supabase test db   (requires Supabase CLI + Docker)
--
-- Proves decks are strictly owner-only:
--   * owner can insert / select / delete their own decks;
--   * a NON-owner cannot see or delete another user's deck.
-- =============================================================================
begin;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

create schema if not exists tests;
create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- --- Alice creates a deck (owner write) -------------------------------------
select tests.act_as('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ insert into public.decks (user_id, name, commander_name, source)
     values ('11111111-1111-1111-1111-111111111111', 'Atraxa', 'Atraxa, Praetors'' Voice', 'manual') $$,
  'owner can INSERT their own deck'
);
select is(
  (select count(*)::int from public.decks where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'owner can SELECT their own deck'
);

-- --- Alice cannot insert a deck owned by someone else (with check) -----------
select throws_ok(
  $$ insert into public.decks (user_id, name, commander_name, source)
     values ('22222222-2222-2222-2222-222222222222', 'Sneaky', 'Edgar Markov', 'manual') $$,
  '42501',
  null,
  'cannot INSERT a deck owned by another user (RLS with check)'
);

-- --- Bob (non-owner) is blind to Alice's deck -------------------------------
select tests.act_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.decks where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'non-owner CANNOT SELECT another user''s deck'
);

-- Bob's delete of Alice's deck affects 0 rows (RLS filters it out, no error).
delete from public.decks where user_id = '11111111-1111-1111-1111-111111111111';
select tests.act_as('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.decks where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'non-owner DELETE does not remove another user''s deck'
);

-- --- Owner can delete their own deck ----------------------------------------
delete from public.decks where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.decks where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'owner can DELETE their own deck'
);

select * from finish();
rollback;
