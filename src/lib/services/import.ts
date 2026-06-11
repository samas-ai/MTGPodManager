import { err, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import { fetchArchidektDeck, parseArchidektDeck } from "@/lib/services/archidekt";
import { resolveCommanders } from "@/lib/services/scryfall";

/**
 * Import orchestration — SERVER-ONLY. Fetch (Archidekt) → parse → resolve
 * commander identity (Scryfall) → assemble a decks insert. Returns the row
 * fields *except* user_id; the Server Action adds user_id and writes under RLS.
 * Any step failing yields a Result error → caller falls back to manual entry.
 */
export interface ImportedDeck {
  name: string;
  commander_name: string;
  commander_scryfall_id: string | null;
  color_identity: string[];
  art_crop_url: string | null;
  artist: string | null;
  source: "archidekt";
  source_url: string;
  card_data: Json;
}

function unionColors(lists: string[][]): string[] {
  const order = ["W", "U", "B", "R", "G"];
  const set = new Set<string>();
  for (const list of lists) for (const c of list) set.add(c);
  return order.filter((c) => set.has(c)).concat([...set].filter((c) => !order.includes(c)));
}

export async function importArchidektDeck(
  deckId: string,
  sourceUrl: string,
): Promise<Result<ImportedDeck>> {
  const fetched = await fetchArchidektDeck(deckId);
  if (!fetched.ok) return fetched;

  const parsed = parseArchidektDeck(fetched.data);
  if (!parsed.ok) return parsed;

  if (parsed.data.commanderNames.length === 0) {
    return err("Couldn't detect a commander in that deck. Add it manually instead.");
  }

  const resolved = await resolveCommanders(parsed.data.commanderNames);
  if (!resolved.ok) return resolved;

  const colorIdentity = unionColors(resolved.data.map((c) => c.colorIdentity));
  const commanderName = resolved.data.map((c) => c.name).join(" // ");

  const cardData: Json = {
    source: "archidekt",
    commanders: resolved.data.map((c) => c.name),
    cards: parsed.data.cards,
  };

  return ok({
    name: parsed.data.name,
    commander_name: commanderName,
    commander_scryfall_id: resolved.data[0]?.scryfallId ?? null,
    color_identity: colorIdentity,
    // Lead commander's art represents the deck (partners → first one).
    art_crop_url: resolved.data[0]?.artCrop ?? null,
    artist: resolved.data[0]?.artist ?? null,
    source: "archidekt",
    source_url: sourceUrl,
    card_data: cardData,
  });
}
