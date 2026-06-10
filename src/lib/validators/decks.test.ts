import { describe, expect, it } from "vitest";
import { createDeckSchema, deckIdSchema } from "./decks";
import { updateProfileSchema } from "./profile";

describe("createDeckSchema", () => {
  it("accepts and trims a valid deck", () => {
    const r = createDeckSchema.safeParse({
      name: "  Atraxa Superfriends  ",
      commanderName: "  Atraxa, Praetors' Voice ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Atraxa Superfriends");
      expect(r.data.commanderName).toBe("Atraxa, Praetors' Voice");
    }
  });

  it("rejects an empty name", () => {
    expect(createDeckSchema.safeParse({ name: "  ", commanderName: "Atraxa" }).success).toBe(false);
  });

  it("rejects an empty commander", () => {
    expect(createDeckSchema.safeParse({ name: "Deck", commanderName: "" }).success).toBe(false);
  });

  it("rejects a name over 80 chars", () => {
    expect(
      createDeckSchema.safeParse({ name: "x".repeat(81), commanderName: "Atraxa" }).success,
    ).toBe(false);
  });

  it("rejects a commander over 100 chars", () => {
    expect(
      createDeckSchema.safeParse({ name: "Deck", commanderName: "x".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("deckIdSchema", () => {
  it("accepts a uuid", () => {
    expect(deckIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(true);
  });
  it("rejects a non-uuid", () => {
    expect(deckIdSchema.safeParse("nope").success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts a valid display name", () => {
    expect(updateProfileSchema.safeParse({ displayName: "Tana" }).success).toBe(true);
  });
  it("rejects empty", () => {
    expect(updateProfileSchema.safeParse({ displayName: "   " }).success).toBe(false);
  });
  it("rejects over 40 chars", () => {
    expect(updateProfileSchema.safeParse({ displayName: "x".repeat(41) }).success).toBe(false);
  });
});
