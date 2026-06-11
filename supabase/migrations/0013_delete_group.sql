-- =============================================================================
-- 0013_delete_group.sql — delete a pod (admin only)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Admin-only, irreversible. Deleting the groups row cascades (via the existing
-- ON DELETE CASCADE FKs from 0001/0003) to group_members, group_invites,
-- matches, and match_participants — the pod's entire history. Players' decks are
-- owner-owned (no group_id) and are untouched. Consistent with the B5 RPC
-- family: group_members has no direct write policy, so this RPC is the door.
-- =============================================================================

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;

  delete from public.groups where id = p_group_id;
end;
$$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
