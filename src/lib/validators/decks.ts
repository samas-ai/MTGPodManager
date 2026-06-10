import { z } from "zod";

// Mirrors the decks CHECK constraints: name 1–80, commander_name 1–100.
// F2 is manual entry only — no Scryfall id / color identity yet (filled in F3).
export const createDeckSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Deck name is required.")
    .max(80, "Deck name must be 80 characters or fewer."),
  commanderName: z
    .string()
    .trim()
    .min(1, "Commander is required.")
    .max(100, "Commander name must be 100 characters or fewer."),
});

export const deckIdSchema = z.string().uuid("Invalid deck id.");

export type CreateDeckInput = z.infer<typeof createDeckSchema>;
