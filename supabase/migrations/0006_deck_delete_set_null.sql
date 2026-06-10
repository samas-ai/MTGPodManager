-- =============================================================================
-- 0006_deck_delete_set_null.sql — allow deleting a deck used in past matches
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- BUG FIX: match_participants.deck_id was created with the default
-- ON DELETE NO ACTION, so a deck that had ever been used in a match could not
-- be deleted (foreign key violation → "Couldn't remove that deck").
--
-- The design snapshots deck_name_snapshot + commander_snapshot onto the
-- participant row precisely so history survives deck deletion. So the FK should
-- SET NULL on delete: the deck reference clears, but the snapshot (and therefore
-- stats / most-played decks / match history) stays intact.
-- =============================================================================

alter table public.match_participants
  drop constraint if exists match_participants_deck_id_fkey;

alter table public.match_participants
  add constraint match_participants_deck_id_fkey
  foreign key (deck_id) references public.decks(id) on delete set null;
