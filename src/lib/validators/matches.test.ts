import { describe, expect, it } from "vitest";
import {
  finalizeMatchSchema,
  matchIdSchema,
  placementsFromForm,
  verifyParticipationSchema,
} from "./matches";

const UUID = "00000000-0000-0000-0000-000000000000";
// RFC 4122-valid v4 UUIDs — zod 4's uuid format checks version/variant nibbles.
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CAROL = "33333333-3333-4333-8333-333333333333";

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
  it("accepts an optional placements record", () => {
    expect(
      finalizeMatchSchema.safeParse({
        matchId: UUID,
        winnerId: ALICE,
        placements: { [ALICE]: 1, [BOB]: 2 },
      }).success,
    ).toBe(true);
  });
  it("rejects non-uuid placement keys and non-positive places", () => {
    expect(
      finalizeMatchSchema.safeParse({ matchId: UUID, winnerId: ALICE, placements: { nope: 2 } })
        .success,
    ).toBe(false);
    expect(
      finalizeMatchSchema.safeParse({ matchId: UUID, winnerId: ALICE, placements: { [BOB]: 0 } })
        .success,
    ).toBe(false);
  });
});

describe("placementsFromForm", () => {
  function form(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  it("returns undefined when no places were chosen (winner-only)", () => {
    expect(placementsFromForm(form({}), ALICE)).toBeUndefined();
    expect(placementsFromForm(form({ [`place_${BOB}`]: "" }), ALICE)).toBeUndefined();
  });

  it("assembles places and pins the winner to 1st", () => {
    const fd = form({ [`place_${BOB}`]: "2", [`place_${CAROL}`]: "3" });
    expect(placementsFromForm(fd, ALICE)).toEqual({ [ALICE]: 1, [BOB]: 2, [CAROL]: 3 });
  });

  it("ignores a stray place field for the winner", () => {
    const fd = form({ [`place_${ALICE}`]: "4", [`place_${BOB}`]: "2" });
    expect(placementsFromForm(fd, ALICE)).toEqual({ [ALICE]: 1, [BOB]: 2 });
  });

  it("ignores non-numeric values", () => {
    expect(placementsFromForm(form({ [`place_${BOB}`]: "abc" }), ALICE)).toBeUndefined();
  });
});
