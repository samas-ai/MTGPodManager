import { z } from "zod";

export const matchIdSchema = z.string().uuid("Invalid match id.");

export const verifyParticipationSchema = z.object({
  matchId: z.string().uuid("Invalid match."),
  deckId: z.string().uuid("Pick a deck."),
});

export const finalizeMatchSchema = z.object({
  matchId: z.string().uuid("Invalid match."),
  winnerId: z.string().uuid("Pick a winner."),
});
