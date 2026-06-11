-- =============================================================================
-- 0015_grants.sql — make the standard Supabase role grants explicit
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- The schema had been relying on the platform's IMPLICIT default privileges for
-- the anon/authenticated roles (Supabase normally grants table DML to both and
-- lets RLS gate the rows). A Supabase CLI image update stopped applying those
-- defaults in the local stack, so `authenticated` started getting
-- `42501 permission denied for table ...` on direct table access in CI (the
-- table-level privilege — distinct from RLS, which returns 0 rows, not 42501).
--
-- This makes the grants explicit so the schema is self-sufficient regardless of
-- platform defaults / CLI drift, and so a freshly provisioned project behaves
-- identically. Hosted/production Supabase already has these grants, so this is
-- an idempotent no-op there.
--
-- IMPORTANT: tables only. We do NOT grant function EXECUTE here — the per-RPC
-- `revoke all ... from public; grant execute ... to authenticated` hardening on
-- the SECURITY DEFINER functions (create_group, finalize_match, delete_group,
-- cancel_match, …) must remain the authority on who can call them. RLS remains
-- the row-level boundary on every table.
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- Future tables created by the migration owner inherit the same DML grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
