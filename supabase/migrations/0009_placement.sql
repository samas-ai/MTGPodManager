-- =============================================================================
-- 0009_placement.sql — B1 finishing order (Phase 9, ROADMAP.md)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Adds `placement` to match_participants and teaches finalize_match() to record
-- a full finishing order. Designed so historical truth is preserved and the
-- column is writable by exactly one code path:
--   * placement is NULLABLE — null means "order unknown" (all pre-0009 rows
--     except winners, which are backfilled to 1 below).
--   * winner-only finalize keeps working: finalize_match(match, winner) sets
--     the winner's placement to 1 and leaves the rest null.
--   * optional full order: finalize_match(match, winner, placements) takes a
--     jsonb object {user_id: place} that must cover EXACTLY the participants,
--     be a strict permutation of 1..N, and rank the winner first.
--   * players can never write their own placement: mp_insert_self /
--     mp_update_self gain `placement is null` in WITH CHECK (same
--     defense-in-depth pattern as 0007). Only the SECURITY DEFINER RPC writes it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Column + backfill
-- -----------------------------------------------------------------------------
alter table public.match_participants
  add column if not exists placement smallint
  constraint mp_placement_positive check (placement is null or placement >= 1);

-- Winners of already-finalized matches are known to have finished 1st.
update public.match_participants mp
   set placement = 1
  from public.matches m
 where m.id = mp.match_id
   and m.status = 'finalized'
   and m.winner_user_id = mp.user_id
   and mp.placement is null;

-- -----------------------------------------------------------------------------
-- RLS: self-service writes may never set placement (RPC-only column).
-- Recreates the 0003/0007 policies verbatim plus the placement guard.
-- -----------------------------------------------------------------------------
drop policy if exists mp_insert_self on public.match_participants;
create policy mp_insert_self on public.match_participants for insert with check (
  user_id = auth.uid()
  and placement is null
  and exists (select 1 from public.matches m
              where m.id = match_id and m.status = 'open' and public.is_group_member(m.group_id))
);

drop policy if exists mp_update_self on public.match_participants;
create policy mp_update_self on public.match_participants for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'open' and public.is_group_member(m.group_id)
    )
  )
  with check (
    user_id = auth.uid()
    and placement is null
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'open' and public.is_group_member(m.group_id)
    )
  );

-- -----------------------------------------------------------------------------
-- finalize_match v2: same five invariants, optional finishing order.
-- Drop is required to change the signature; the old 2-arg form is subsumed by
-- the defaulted third parameter (existing rpc('finalize_match', {p_match_id,
-- p_winner}) calls keep working unchanged).
-- -----------------------------------------------------------------------------
drop function if exists public.finalize_match(uuid, uuid);

create function public.finalize_match(
  p_match_id uuid,
  p_winner uuid,
  p_placements jsonb default null
)
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

  if p_placements is null then
    -- Winner-only mode (unchanged behavior + placement 1 for the winner).
    update public.match_participants
       set placement = case when user_id = p_winner then 1 else null end
     where match_id = p_match_id;
  else
    -- Full order: keys must be exactly the participants…
    if (select count(*) from jsonb_each_text(p_placements)) <> v_total then
      raise exception 'placements_must_cover_all_participants';
    end if;
    if exists (
      select 1 from jsonb_each_text(p_placements) e
      where not exists (
        select 1 from public.match_participants mp
        where mp.match_id = p_match_id and mp.user_id = e.key::uuid
      )
    ) then
      raise exception 'placement_unknown_participant';
    end if;
    -- …values a strict permutation of 1..N…
    if exists (
      select 1 from jsonb_each_text(p_placements) e
      where e.value !~ '^[0-9]+$' or e.value::int < 1 or e.value::int > v_total
    ) then
      raise exception 'invalid_placement_value';
    end if;
    if (select count(distinct e.value::int) from jsonb_each_text(p_placements) e) <> v_total then
      raise exception 'duplicate_placement';
    end if;
    -- …and the winner first.
    if (p_placements ->> p_winner::text)::int is distinct from 1 then
      raise exception 'winner_must_be_first';
    end if;

    update public.match_participants mp
       set placement = (p_placements ->> mp.user_id::text)::int
     where mp.match_id = p_match_id;
  end if;

  update public.matches
     set status = 'finalized', winner_user_id = p_winner, finalized_at = now()
   where id = p_match_id;
end;
$$;

revoke all on function public.finalize_match(uuid, uuid, jsonb) from public;
grant execute on function public.finalize_match(uuid, uuid, jsonb) to authenticated;
