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
const TIMEOUT_MS = 8000;

export interface ResolvedCommander {
  name: string;
  scryfallId: string;
  colorIdentity: string[];
}

interface ScryfallCard {
  id: string;
  name: string;
  color_identity: string[];
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

    const resolved: ResolvedCommander[] = cards.map((c) => ({
      name: c.name,
      scryfallId: c.id,
      colorIdentity: c.color_identity ?? [],
    }));
    return ok(resolved);
  } catch (e) {
    console.error("[scryfall] lookup error", e);
    return err("Couldn't reach Scryfall to verify the commander.");
  } finally {
    clearTimeout(timer);
  }
}
