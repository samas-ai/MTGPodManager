-- =============================================================================
-- 0001_init_groups.sql — F1 Groups & Membership
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Establishes the authorization spine for the whole product:
--   * RLS on every table is the source of truth for access (PRD rule).
--   * group_members rows are NEVER inserted from the public surface — only
--     through SECURITY DEFINER RPCs (create_group / accept_invite).
--   * is_group_member() is SECURITY DEFINER to avoid self-referential RLS
--     recursion when a group_members policy needs to query group_members.
-- Scope: F1 only. decks/matches/match_participants arrive in later phases.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (guarded so the script is safe to re-run)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.group_role as enum ('admin', 'member');
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- 1:1 with auth.users. Populated by the handle_new_user() trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_group_members_user on public.group_members (user_id);
create index if not exists idx_group_invites_group on public.group_invites (group_id);
create index if not exists idx_groups_created_by on public.groups (created_by);

-- -----------------------------------------------------------------------------
-- Auto-create a profile when an auth user is created
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- display_name from sign-up metadata; fall back to the email local-part.
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
                  split_part(new.email, '@', 1)), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Membership helper (SECURITY DEFINER avoids RLS recursion on group_members)
-- -----------------------------------------------------------------------------
create or replace function public.is_group_member(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- -----------------------------------------------------------------------------
-- Policies — profiles: self + co-members readable; write only self
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
  )
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- Policies — groups: members read; creator inserts; admins update
-- -----------------------------------------------------------------------------
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups for select
  using (public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert
  with check (created_by = auth.uid());

drop policy if exists groups_update_admin on public.groups;
create policy groups_update_admin on public.groups for update using (
  exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'admin'
  )
);

-- -----------------------------------------------------------------------------
-- Policies — group_members: members read the roster. NO insert/update/delete
-- policy => direct writes are blocked; membership changes go through RPCs.
-- -----------------------------------------------------------------------------
drop policy if exists gm_select on public.group_members;
create policy gm_select on public.group_members for select
  using (public.is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- Policies — group_invites: members of the group may read its invites.
-- Inserts happen only via create_invite() RPC.
-- -----------------------------------------------------------------------------
drop policy if exists gi_select on public.group_invites;
create policy gi_select on public.group_invites for select
  using (public.is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER) — the only sanctioned write paths for membership
-- -----------------------------------------------------------------------------

-- Create a group and record the caller as its admin member, atomically.
create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(coalesce(p_name, '')) not between 1 and 60 then
    raise exception 'invalid_group_name';
  end if;

  insert into public.groups (name, created_by)
  values (p_name, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'admin');

  return v_group_id;
end;
$$;

-- A member generates a shareable invite code for their group.
create or replace function public.create_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_member';
  end if;

  -- 8-char human-shareable code derived from a random UUID (no extra extension).
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.group_invites (group_id, code, created_by)
  values (p_group_id, v_code, v_uid);

  return v_code;
end;
$$;

-- Accept an invite code: validate code + expiry, add caller as a member.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_expires timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select group_id, expires_at into v_group_id, v_expires
  from public.group_invites
  where code = upper(trim(p_code));

  if v_group_id is null then raise exception 'invalid_invite_code'; end if;
  if v_expires < now() then raise exception 'invite_expired'; end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;  -- already a member is fine

  return v_group_id;
end;
$$;

-- Lock down execution: callable only by authenticated users, never anon/public.
revoke all on function public.create_group(text)   from public;
revoke all on function public.create_invite(uuid)   from public;
revoke all on function public.accept_invite(text)   from public;
grant execute on function public.create_group(text)  to authenticated;
grant execute on function public.create_invite(uuid)  to authenticated;
grant execute on function public.accept_invite(text)  to authenticated;
