import { z } from "zod";

/**
 * Accepts an Archidekt deck URL (any host casing, with or without protocol or a
 * trailing slug) or a bare numeric id, and normalizes to the numeric deck id.
 * Examples that resolve to "123456":
 *   https://archidekt.com/decks/123456/my-deck
 *   archidekt.com/decks/123456
 *   123456
 */
export function extractArchidektDeckId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/archidekt\.com\/decks\/(\d+)/i);
  return match ? match[1]! : null;
}

export const archidektUrlSchema = z
  .object({ url: z.string().trim().min(1, "Enter an Archidekt deck URL.") })
  .transform((v, ctx) => {
    const deckId = extractArchidektDeckId(v.url);
    if (!deckId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "That doesn't look like an Archidekt deck URL.",
      });
      return z.NEVER;
    }
    return { deckId, url: v.url };
  });
