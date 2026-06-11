-- =============================================================================
-- 0012_group_management.sql — B5 group management (Phase 10, ROADMAP.md)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Extends the F1 membership model with admin/self management. Keeps F1's core
-- discipline intact: group_members has NO direct write policy, so every change
-- flows through a SECURITY DEFINER RPC that re-checks authorization. The
-- last-admin guards make it impossible to orphan a pod (no admin / no members).
--   * is_group_admin()  — admin counterpart to is_group_member()
--   * rename_group()     — admin renames the pod
--   * leave_group()      — a member removes themselves (sole admin blocked)
--   * remove_member()    — admin removes someone else (not self; not last admin)
--   * set_admin()        — admin promotes/demotes (last admin can't be demoted)
--   * revoke_invites()   — admin invalidates the pod's outstanding invite codes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admin helper (SECURITY DEFINER, mirrors is_group_member to avoid RLS recursion)
-- -----------------------------------------------------------------------------
create or replace function public.is_group_admin(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Count of admins in a group (internal helper; not granted to clients).
create or replace function public.admin_count(g uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from public.group_members
  where group_id = g and role = 'admin';
$$;

-- -----------------------------------------------------------------------------
-- rename_group — admin only
-- -----------------------------------------------------------------------------
create or replace function public.rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 60 then
    raise exception 'invalid_group_name';
  end if;

  update public.groups set name = trim(p_name) where id = p_group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- leave_group — remove your own membership; the sole admin cannot leave
-- -----------------------------------------------------------------------------
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.group_role;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.group_members
  where group_id = p_group_id and user_id = v_uid;
  if v_role is null then raise exception 'not_a_member'; end if;

  if v_role = 'admin' and public.admin_count(p_group_id) = 1 then
    raise exception 'last_admin_cannot_leave';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- remove_member — admin removes another member (not self; not the last admin)
-- -----------------------------------------------------------------------------
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.group_role;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;
  if p_user_id = auth.uid() then raise exception 'use_leave_to_remove_self'; end if;

  select role into v_target_role from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'not_a_member'; end if;

  if v_target_role = 'admin' and public.admin_count(p_group_id) = 1 then
    raise exception 'cannot_remove_last_admin';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_admin — admin promotes/demotes a member; the last admin can't be demoted
-- (transfer = promote someone, then demote yourself)
-- -----------------------------------------------------------------------------
create or replace function public.set_admin(p_group_id uuid, p_user_id uuid, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.group_role;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;

  select role into v_target_role from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'not_a_member'; end if;

  if not p_make_admin and v_target_role = 'admin' and public.admin_count(p_group_id) = 1 then
    raise exception 'cannot_demote_last_admin';
  end if;

  update public.group_members
     set role = case when p_make_admin then 'admin'::public.group_role else 'member'::public.group_role end
   where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- revoke_invites — admin invalidates all outstanding invite codes for the pod
-- -----------------------------------------------------------------------------
create or replace function public.revoke_invites(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_an_admin'; end if;

  delete from public.group_invites where group_id = p_group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lock down execution: authenticated only. admin_count stays server-internal.
-- -----------------------------------------------------------------------------
revoke all on function public.is_group_admin(uuid)               from public;
revoke all on function public.admin_count(uuid)                  from public;
revoke all on function public.rename_group(uuid, text)           from public;
revoke all on function public.leave_group(uuid)                  from public;
revoke all on function public.remove_member(uuid, uuid)          from public;
revoke all on function public.set_admin(uuid, uuid, boolean)     from public;
revoke all on function public.revoke_invites(uuid)               from public;

grant execute on function public.is_group_admin(uuid)            to authenticated;
grant execute on function public.rename_group(uuid, text)        to authenticated;
grant execute on function public.leave_group(uuid)               to authenticated;
grant execute on function public.remove_member(uuid, uuid)       to authenticated;
grant execute on function public.set_admin(uuid, uuid, boolean)  to authenticated;
grant execute on function public.revoke_invites(uuid)            to authenticated;
