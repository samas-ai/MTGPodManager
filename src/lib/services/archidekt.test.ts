import { describe, expect, it } from "vitest";
import { parseArchidektDeck } from "./archidekt";
import fixture from "./__fixtures__/archidekt-deck.json";

describe("parseArchidektDeck", () => {
  it("parses name, commander, and cards from a real-shape payload", () => {
    const r = parseArchidektDeck(fixture);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe("Atraxa Superfriends");
      expect(r.data.commanderNames).toEqual(["Atraxa, Praetors' Voice"]);
      expect(r.data.cards).toHaveLength(3);
      expect(r.data.cards).toContainEqual({ name: "Wastes", quantity: 5 });
    }
  });

  it("detects no commander when none is in the commander category", () => {
    const noCommander = {
      name: "Pile",
      categories: [{ name: "Commander", isPremier: true }],
      cards: [{ card: { oracleCard: { name: "Llanowar Elves" } }, quantity: 1, categories: ["Ramp"] }],
    };
    const r = parseArchidektDeck(noCommander);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.commanderNames).toEqual([]);
  });

  it("errors on a non-object payload", () => {
    expect(parseArchidektDeck(null).ok).toBe(false);
    expect(parseArchidektDeck("nope").ok).toBe(false);
  });

  it("errors when there are no readable cards", () => {
    const r = parseArchidektDeck({ name: "Empty", cards: [] });
    expect(r.ok).toBe(false);
  });
});
