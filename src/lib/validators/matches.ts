import { z } from "zod";

export const matchIdSchema = z.string().uuid("Invalid match id.");

export const verifyParticipationSchema = z.object({
  matchId: z.string().uuid("Invalid match."),
  deckId: z.string().uuid("Pick a deck."),
});

export const finalizeMatchSchema = z.object({
  matchId: z.string().uuid("Invalid match."),
  winnerId: z.string().uuid("Pick a winner."),
  // Optional full finishing order, keyed by user id. The finalize_match RPC is
  // the authority (coverage, permutation 1..N, winner first) — this only shapes
  // the payload.
  placements: z.record(z.string().uuid(), z.number().int().min(1)).optional(),
});

/**
 * Assembles the optional placements object from `place_<userId>` form fields.
 * Empty selects are ignored; the winner is always placed 1st. Returns undefined
 * when no places were chosen (winner-only finalize).
 */
export function placementsFromForm(
  formData: FormData,
  winnerId: string,
): Record<string, number> | undefined {
  const placements: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("place_") || typeof value !== "string" || value === "") continue;
    const userId = key.slice("place_".length);
    const place = Number.parseInt(value, 10);
    if (userId === winnerId || !Number.isInteger(place)) continue;
    placements[userId] = place;
  }
  if (Object.keys(placements).length === 0) return undefined;
  placements[winnerId] = 1;
  return placements;
}
