-- =============================================================================
-- 0003_matches.sql — F4 Host Live Session (matches + participants + realtime)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Adds the match event that anchors all stats. RLS scopes everything to group
-- membership. The matches_update_open policy forbids plain updates from flipping
-- status to 'finalized' — finalization arrives in F5 via the finalize_match()
-- SECURITY DEFINER RPC (the only door). match_participants is published for
-- Realtime so the host sees join status live (Postgres Changes respects RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum (guarded)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.match_status as enum ('open', 'finalized', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  status public.match_status not null default 'open',
  winner_user_id uuid references public.profiles(id),   -- set only at finalize (F5)
  started_at timestamptz not null default now(),
  finalized_at timestamptz
);

create table if not exists public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  deck_id  uuid references public.decks(id),       -- chosen at verify time (F5)
  deck_name_snapshot text,                         -- snapshot: stable history + simpler RLS
  commander_snapshot text,
  verified boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (match_id, user_id)                        -- no duplicate participants
);

-- Indexes
create index if not exists idx_matches_group_status on public.matches (group_id, status);
create index if not exists idx_matches_group_finalized on public.matches (group_id, finalized_at);
create index if not exists idx_mp_match on public.match_participants (match_id);
create index if not exists idx_mp_deck on public.match_participants (deck_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.matches            enable row level security;
alter table public.match_participants enable row level security;

-- matches: members read; host creates; host may edit only while 'open',
-- and may NOT flip status to finalized via plain update (RPC only, F5).
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select
  using (public.is_group_member(group_id));

drop policy if exists matches_insert_host on public.matches;
create policy matches_insert_host on public.matches for insert
  with check (host_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists matches_update_open on public.matches;
create policy matches_update_open on public.matches for update
  using (host_id = auth.uid() and status = 'open')
  with check (status = 'open');   -- blocks setting status = 'finalized'

-- match_participants: members read; a user manages only their own row, only
-- while the match is open.
drop policy if exists mp_select on public.match_participants;
create policy mp_select on public.match_participants for select using (
  exists (select 1 from public.matches m
          where m.id = match_id and public.is_group_member(m.group_id))
);

drop policy if exists mp_insert_self on public.match_participants;
create policy mp_insert_self on public.match_participants for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.matches m
              where m.id = match_id and m.status = 'open' and public.is_group_member(m.group_id))
);

drop policy if exists mp_update_self on public.match_participants;
create policy mp_update_self on public.match_participants for update using (
  user_id = auth.uid()
  and exists (select 1 from public.matches m where m.id = match_id and m.status = 'open')
);

-- -----------------------------------------------------------------------------
-- Realtime: publish match_participants so the host gets live join status.
-- Postgres Changes adheres to the mp_select RLS policy per subscriber.
-- Guarded so re-running doesn't error on an already-published table.
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_participants'
  ) then
    alter publication supabase_realtime add table public.match_participants;
  end if;
end $$;
