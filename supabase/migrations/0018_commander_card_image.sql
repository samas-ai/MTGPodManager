-- =============================================================================
-- 0018_commander_card_image.sql — full commander card image (Phase 11 / D1.1)
-- MTG Pod Manager. Apply in the Supabase dashboard SQL editor (runs as owner).
--
-- D1 stored only art_crop, which we squeezed into a wide banner — heads got cut
-- off. Store the full card image too (Scryfall image_uris.normal: frame, art,
-- text box, mana cost — like the deck-builder card preview). Captured at import
-- / commander-resolve and cached on the deck (Scryfall etiquette — never
-- re-fetched per render). Snapshotted onto match_participants at verify time,
-- mirroring art_crop_snapshot, so match history keeps the card. Nullable —
-- manual decks whose commander can't be resolved simply have no card image, and
-- CommanderArt falls back to the (uncropped) art_crop, then to nothing.
-- =============================================================================

alter table public.decks
  add column if not exists card_image_url text;

alter table public.match_participants
  add column if not exists card_image_snapshot text;
