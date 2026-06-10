import { describe, expect, it } from "vitest";
import { finalizeMatchSchema, matchIdSchema, verifyParticipationSchema } from "./matches";

const UUID = "00000000-0000-0000-0000-000000000000";

describe("matchIdSchema", () => {
  it("accepts a uuid", () => {
    expect(matchIdSchema.safeParse(UUID).success).toBe(true);
  });
  it("rejects a non-uuid", () => {
    expect(matchIdSchema.safeParse("nope").success).toBe(false);
  });
});

describe("verifyParticipationSchema", () => {
  it("accepts matchId + deckId uuids", () => {
    expect(verifyParticipationSchema.safeParse({ matchId: UUID, deckId: UUID }).success).toBe(true);
  });
  it("rejects a missing deck", () => {
    expect(verifyParticipationSchema.safeParse({ matchId: UUID, deckId: "x" }).success).toBe(false);
  });
});

describe("finalizeMatchSchema", () => {
  it("accepts matchId + winnerId uuids", () => {
    expect(finalizeMatchSchema.safeParse({ matchId: UUID, winnerId: UUID }).success).toBe(true);
  });
  it("rejects a missing winner", () => {
    expect(finalizeMatchSchema.safeParse({ matchId: UUID, winnerId: "" }).success).toBe(false);
  });
});
