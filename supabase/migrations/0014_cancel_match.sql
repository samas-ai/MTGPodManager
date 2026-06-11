-- =============================================================================
-- 0014_cancel_match.sql — force-close an open match (host or pod admin)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- An open match blocks the pod from starting a new one (pod home shows the live
-- match instead of "Start match"). This RPC lets the host abandon their own
-- match, and gives a pod admin authority to force-close ANY open match in the
-- pod — clearing orphaned sessions. Like finalize_match, it's SECURITY DEFINER
-- because matches_update_open's WITH CHECK forbids plain updates from leaving
-- 'open'. Sets status='cancelled' (the enum value from 0003); stats count only
-- 'finalized', so a cancelled match leaves history and standings untouched.
-- =============================================================================

create or replace function public.cancel_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_group uuid;
  v_status match_status;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  -- Row-lock to avoid racing a concurrent finalize/cancel.
  select host_id, group_id, status into v_host, v_group, v_status
  from public.matches where id = p_match_id for update;

  if v_host is null then raise exception 'match_not_found'; end if;
  if v_status <> 'open' then raise exception 'match_not_open'; end if;
  if auth.uid() <> v_host and not public.is_group_admin(v_group) then
    raise exception 'not_host_or_admin';
  end if;

  update public.matches set status = 'cancelled' where id = p_match_id;
end;
$$;

revoke all on function public.cancel_match(uuid) from public;
grant execute on function public.cancel_match(uuid) to authenticated;
