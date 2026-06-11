-- =============================================================================
-- 0016_commander_art.sql — D1 commander art (Scryfall art_crop + artist)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- Stores the commander's cropped art + the artist's name (Scryfall returns both:
-- image_uris.art_crop + artist). Captured once at import / commander-resolve and
-- cached on the deck row (Scryfall etiquette — never re-fetched per render).
-- Snapshotted onto match_participants at verify time, mirroring the existing
-- deck_name_snapshot pattern, so match history keeps the art even if the deck
-- is later changed or deleted. All nullable — manual decks whose commander
-- can't be resolved simply have no art. Artist attribution is required wherever
-- art is shown (Scryfall guidelines / Fan Content Policy — see CREDITS.md).
-- =============================================================================

alter table public.decks
  add column if not exists art_crop_url text,
  add column if not exists artist text;

alter table public.match_participants
  add column if not exists art_crop_snapshot text,
  add column if not exists artist_snapshot text;
