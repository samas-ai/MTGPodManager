-- =============================================================================
-- 0002_decks.sql — F2 Player Profiles & Deck Registration
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Adds owner-private decks. F2 stores deck IDENTITY only (name + commander);
-- Scryfall id + color identity are filled by F3 import, card_data stays null.
-- RLS keeps decks strictly owner-private — group-visible deck info comes later
-- from match_participant snapshots, never from reading other players' decks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum (guarded so the script is safe to re-run)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.deck_source as enum ('archidekt', 'manual');
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  commander_name text not null check (char_length(commander_name) between 1 and 100),
  commander_scryfall_id uuid,                   -- nullable until resolved (F3)
  color_identity text[] not null default '{}',  -- e.g. {W,U,B}; populated in F3
  source public.deck_source not null,
  source_url text,
  card_data jsonb,                              -- nullable; full list is best-effort (F3)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_decks_user on public.decks (user_id);

-- -----------------------------------------------------------------------------
-- Keep updated_at fresh on every update
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — strictly owner-only (read + write)
-- -----------------------------------------------------------------------------
alter table public.decks enable row level security;

drop policy if exists decks_all_own on public.decks;
create policy decks_all_own on public.decks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
