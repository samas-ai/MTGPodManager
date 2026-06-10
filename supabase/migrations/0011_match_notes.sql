-- =============================================================================
-- 0011_match_notes.sql — B4 match notes & tags (Phase 9)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Adds host-written notes ("the Gitrog combo game") and short tags to matches.
-- No policy changes needed: matches_update_open already scopes writes to the
-- host while the match is open (notes freeze at finalize — deliberate, matches
-- the snapshot philosophy), and matches_select gives members read access.
-- Zod validates at the boundary; these CHECKs are the backstop.
-- =============================================================================

-- Element-level tag validation isn't expressible inline in a CHECK, so a tiny
-- immutable helper carries it: at most 5 tags, each 1–24 chars, no duplicates.
create or replace function public.valid_match_tags(t text[])
returns boolean
immutable
language sql
as $$
  select t is null or (
    coalesce(array_length(t, 1), 0) <= 5
    and not exists (
      select 1 from unnest(t) x
      where char_length(x) < 1 or char_length(x) > 24
    )
    and (select count(*) from unnest(t) x) = (select count(distinct x) from unnest(t) x)
  );
$$;

alter table public.matches
  add column if not exists notes text
  constraint matches_notes_length check (notes is null or char_length(notes) <= 500);

alter table public.matches
  add column if not exists tags text[]
  constraint matches_tags_valid check (public.valid_match_tags(tags));
