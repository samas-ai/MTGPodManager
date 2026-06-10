-- =============================================================================
-- 0008_backfill_profiles.sql — ensure every auth user has a profile
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- BUG FIX: creating a pod or saving a deck failed with FK 23503
--   "Key (created_by/user_id)=(…) is not present in table profiles"
-- because the signed-in user had no public.profiles row. That row is meant to be
-- created by the on_auth_user_created trigger; this migration (a) BACKFILLS
-- profiles for any existing auth users that are missing one (fixes accounts made
-- before the trigger existed in this project), and (b) RE-ASSERTS the function +
-- trigger so all future sign-ups are covered. Idempotent and safe to re-run.
-- =============================================================================

-- (a) Backfill missing profiles from existing auth users.
insert into public.profiles (id, display_name)
select
  u.id,
  left(coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1)), 40)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- (b) Re-assert the auto-create function + trigger (idempotent).
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
