-- =============================================================================
-- 0019_seasons.sql — Seasons-as-"Sets" (B7 / D5, Phase 12, ROADMAP.md)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- A season is a named time window for a pod. A finalized match belongs to the
-- season whose [started_at, ended_at) range contains its finalized_at — so this
-- never touches `matches` or the finalize_match() invariant; season stats are
-- the existing fold, filtered by date range. Writes flow ONLY through the
-- start_season() SECURITY DEFINER RPC (mirrors the 0012 group-management
-- discipline); the table has a member-read policy and no write policy.
-- =============================================================================

create table if not exists public.seasons (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  name         text not null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,                      -- null == the active season
  symbol_seed  smallint not null default 0,      -- drives the generated "set symbol"
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- At most one active (open) season per group — backstops the RPC against races.
create unique index if not exists seasons_one_active_per_group
  on public.seasons (group_id) where ended_at is null;
create index if not exists idx_seasons_group on public.seasons (group_id, started_at);

-- -----------------------------------------------------------------------------
-- RLS: members read; no direct writes (RPC only).
-- -----------------------------------------------------------------------------
alter table public.seasons enable row level security;

drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons for select
  using (public.is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- start_season — admin opens a new season, atomically closing the current one.
-- -----------------------------------------------------------------------------
create or replace function public.start_season(p_group_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 60 then
    raise exception 'invalid_season_name';
  end if;

  -- Close the current active season (if any) at the same instant the next opens.
  update public.seasons
     set ended_at = now()
   where group_id = p_group_id and ended_at is null;

  insert into public.seasons (group_id, name, symbol_seed, created_by)
  values (
    p_group_id,
    trim(p_name),
    (abs(hashtext(p_name || clock_timestamp()::text)) % 1000)::smallint,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: members read the table (RLS scopes rows); RPC is authenticated-only.
-- -----------------------------------------------------------------------------
grant select on public.seasons to authenticated;

revoke all on function public.start_season(uuid, text) from public;
grant execute on function public.start_season(uuid, text) to authenticated;
