import { err, ok, type Result } from "@/lib/result";

/**
 * Archidekt client — SERVER-ONLY, best-effort. Archidekt's API is unofficial,
 * undocumented, and "open to change", so every step degrades gracefully: any
 * fetch/parse failure becomes a Result error and the caller routes the user to
 * the manual deck form (the real guarantee).
 *
 * Endpoint: GET https://archidekt.com/api/decks/{id}/  → deck JSON with a `cards`
 * array (each card has a name + `categories`) and a `categories` array where the
 * commander category is flagged `isPremier`.
 */

const TIMEOUT_MS = 8000;

export interface ParsedArchidektDeck {
  name: string;
  commanderNames: string[];
  cards: { name: string; quantity: number }[];
}

// Loose shapes for the untyped payload — narrowed defensively below (no `any`).
interface RawOracleCard {
  name?: unknown;
}
interface RawInnerCard {
  oracleCard?: RawOracleCard;
  name?: unknown;
}
interface RawDeckCard {
  card?: RawInnerCard;
  quantity?: unknown;
  categories?: unknown;
}
interface RawCategory {
  name?: unknown;
  isPremier?: unknown;
}
interface RawDeckJson {
  name?: unknown;
  cards?: unknown;
  categories?: unknown;
}

function userAgent(): string {
  // Descriptive UA so we're identifiable and a good citizen.
  return process.env.SCRYFALL_USER_AGENT ?? "MTGPodManager/0.1";
}

export async function fetchArchidektDeck(deckId: string): Promise<Result<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
      method: "GET",
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[archidekt] fetch failed", res.status);
      return err("Couldn't fetch that deck from Archidekt.");
    }
    const text = await res.text();
    // Archidekt sometimes returns a non-JSON "Client Unavailable" body.
    try {
      return ok(JSON.parse(text) as unknown);
    } catch {
      console.error("[archidekt] non-JSON response", text.slice(0, 120));
      return err("Archidekt returned an unexpected response.");
    }
  } catch (e) {
    console.error("[archidekt] fetch error", e);
    return err("Couldn't reach Archidekt. Try again or add the deck manually.");
  } finally {
    clearTimeout(timer);
  }
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** Pure parser — fully unit-testable from a saved fixture. */
export function parseArchidektDeck(json: unknown): Result<ParsedArchidektDeck> {
  if (typeof json !== "object" || json === null) {
    return err("That deck couldn't be read.");
  }
  const deck = json as RawDeckJson;

  const name = asString(deck.name) ?? "Imported Archidekt deck";

  if (!Array.isArray(deck.cards)) {
    return err("That deck had no card list.");
  }

  // Which category names denote the commander? Prefer isPremier flags; else "Commander".
  const premierNames = new Set<string>();
  if (Array.isArray(deck.categories)) {
    for (const raw of deck.categories as RawCategory[]) {
      const cname = asString(raw?.name);
      if (cname && raw?.isPremier === true) premierNames.add(cname.toLowerCase());
    }
  }
  if (premierNames.size === 0) premierNames.add("commander");

  const cards: { name: string; quantity: number }[] = [];
  const commanderNames: string[] = [];
  const seenCommander = new Set<string>();

  for (const raw of deck.cards as RawDeckCard[]) {
    const cardName = asString(raw?.card?.oracleCard?.name) ?? asString(raw?.card?.name);
    if (!cardName) continue;
    const quantity = typeof raw?.quantity === "number" && raw.quantity > 0 ? raw.quantity : 1;
    cards.push({ name: cardName, quantity });

    const cats = Array.isArray(raw?.categories) ? (raw.categories as unknown[]) : [];
    const isCommander = cats.some(
      (c) => typeof c === "string" && premierNames.has(c.toLowerCase()),
    );
    if (isCommander && !seenCommander.has(cardName)) {
      seenCommander.add(cardName);
      commanderNames.push(cardName);
    }
  }

  if (cards.length === 0) {
    return err("That deck had no readable cards.");
  }

  return ok({ name, commanderNames, cards });
}
