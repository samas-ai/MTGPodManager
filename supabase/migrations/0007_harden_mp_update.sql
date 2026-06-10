-- =============================================================================
-- 0007_harden_mp_update.sql — security hardening for match_participants UPDATE
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- SECURITY FIX (found in the Phase 7 review): the original mp_update_self policy
-- had only a USING clause. Postgres then reuses USING as the WITH CHECK, but
-- that check did NOT require membership of the *new* row's match group — only
-- that the new match is 'open'. A crafted API call could therefore UPDATE one's
-- own participant row's match_id to a FOREIGN open match (UUID-guess), injecting
-- the caller as a participant in a pod they don't belong to.
--
-- Fix: add an explicit WITH CHECK that re-asserts ownership AND membership of the
-- (new) match's group. The app never moves a participant between matches, so this
-- is pure defense-in-depth aligning the policy with the "RLS is the boundary" rule.
-- =============================================================================

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
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'open' and public.is_group_member(m.group_id)
    )
  );
