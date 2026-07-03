import { err, ok, type Result } from "@/lib/result";

/**
 * Scryfall client — SERVER-ONLY (uses SCRYFALL_USER_AGENT, never shipped to the
 * browser). Resolves commander identity for deck import.
 *
 * Etiquette (verified against scryfall.com/docs/api):
 *  - Always send a descriptive User-Agent + an Accept header.
 *  - /cards/collection takes up to 75 identifiers per request — we send 1–2.
 *  - Resolved results are cached on the deck row (commander_scryfall_id +
 *    color_identity), so we never hammer per-card.
 */

const COLLECTION_URL = "https://api.scryfall.com/cards/collection";
const NAMED_URL = "https://api.scryfall.com/cards/named";
const TIMEOUT_MS = 8000;

export interface ResolvedCommander {
  name: string;
  scryfallId: string;
  colorIdentity: string[];
  artCrop: string | null;
  cardImage: string | null;
  artist: string | null;
}

interface ScryfallImageUris {
  art_crop?: string;
  // Full card image (frame + art + text box), ~488×680. Used for the card preview.
  normal?: string;
}

interface ScryfallCard {
  id: string;
  name: string;
  color_identity: string[];
  artist?: string;
  image_uris?: ScryfallImageUris;
  // Double-faced commanders carry imagery on the faces instead of the card.
  card_faces?: { artist?: string; image_uris?: ScryfallImageUris }[];
}

function artOf(card: ScryfallCard): string | null {
  return card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null;
}

function cardImageOf(card: ScryfallCard): string | null {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
}

function artistOf(card: ScryfallCard): string | null {
  return card.artist ?? card.card_faces?.[0]?.artist ?? null;
}

function toResolved(card: ScryfallCard): ResolvedCommander {
  return {
    name: card.name,
    scryfallId: card.id,
    colorIdentity: card.color_identity ?? [],
    artCrop: artOf(card),
    cardImage: cardImageOf(card),
    artist: artistOf(card),
  };
}

function userAgent(): string {
  return process.env.SCRYFALL_USER_AGENT ?? "MTGPodManager/0.1";
}

export async function resolveCommanders(names: string[]): Promise<Result<ResolvedCommander[]>> {
  const wanted = names.map((n) => n.trim()).filter(Boolean);
  if (wanted.length === 0) return err("No commander to resolve.");
  if (wanted.length > 75) return err("Too many commanders to resolve at once.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(COLLECTION_URL, {
      method: "POST",
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifiers: wanted.map((name) => ({ name })) }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[scryfall] collection request failed", res.status);
      return err("Couldn't reach Scryfall to verify the commander.");
    }

    const json = (await res.json()) as { data?: ScryfallCard[]; not_found?: unknown[] };
    const cards = json.data ?? [];

    if (cards.length === 0) {
      return err("Scryfall didn't recognize that commander.");
    }

    return ok(cards.map(toResolved));
  } catch (e) {
    console.error("[scryfall] lookup error", e);
    return err("Couldn't reach Scryfall to verify the commander.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a SINGLE commander by (approximate) name via Scryfall's fuzzy `named`
 * endpoint — for manual deck entry, where the name is typed freehand. Fuzzy
 * matching means a partial or slightly-off name ("atraxa") still resolves to the
 * real card, so a manual deck gets the same identity + art + card image as an
 * imported one. Returns the canonical card so the caller can store the real name.
 */
export async function resolveCommanderByName(name: string): Promise<Result<ResolvedCommander>> {
  const wanted = name.trim();
  if (!wanted) return err("No commander to resolve.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${NAMED_URL}?fuzzy=${encodeURIComponent(wanted)}`, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: controller.signal,
    });

    // 404 = no/ambiguous match; treat as "not recognized" (caller falls back).
    if (res.status === 404) return err("Scryfall didn't recognize that commander.");
    if (!res.ok) {
      console.error("[scryfall] named request failed", res.status);
      return err("Couldn't reach Scryfall to verify the commander.");
    }

    const card = (await res.json()) as ScryfallCard;
    if (!card?.id) return err("Scryfall didn't recognize that commander.");
    return ok(toResolved(card));
  } catch (e) {
    console.error("[scryfall] named lookup error", e);
    return err("Couldn't reach Scryfall to verify the commander.");
  } finally {
    clearTimeout(timer);
  }
}
