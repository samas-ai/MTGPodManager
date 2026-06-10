-- =============================================================================
-- 0004_finalize.sql — F5 Match Finalization (the integrity core)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- finalize_match() is the ONLY code path that can set a match to 'finalized'
-- (the matches_update_open RLS policy blocks plain updates from doing so). It
-- runs SECURITY DEFINER, takes a row lock, and re-checks every invariant
-- atomically, so "trustworthy stats" is a database guarantee — not a convention:
--   * caller must be the host
--   * match must still be open
--   * at least 2 participants
--   * every participant verified AND has a deck
--   * the winner must be one of the participants
-- Duplicate participants are already impossible via unique (match_id, user_id).
-- =============================================================================

create or replace function public.finalize_match(p_match_id uuid, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_status match_status;
  v_total int;
  v_unverified int;
  v_winner_ok boolean;
begin
  -- Lock the match row to prevent concurrent finalize.
  select host_id, status into v_host, v_status
  from public.matches where id = p_match_id for update;

  if v_host is null then raise exception 'match_not_found'; end if;
  if v_host <> auth.uid() then raise exception 'only_host_can_finalize'; end if;
  if v_status <> 'open' then raise exception 'match_not_open'; end if;

  select count(*),
         count(*) filter (where verified = false or deck_id is null)
    into v_total, v_unverified
  from public.match_participants where match_id = p_match_id;

  if v_total < 2 then raise exception 'need_at_least_two_participants'; end if;
  if v_unverified > 0 then raise exception 'unverified_participants_present'; end if;

  select exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = p_winner
  ) into v_winner_ok;
  if not v_winner_ok then raise exception 'winner_must_be_participant'; end if;

  update public.matches
     set status = 'finalized', winner_user_id = p_winner, finalized_at = now()
   where id = p_match_id;
end;
$$;

revoke all on function public.finalize_match(uuid, uuid) from public;
grant execute on function public.finalize_match(uuid, uuid) to authenticated;
