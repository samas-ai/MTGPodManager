import { afterEach, describe, expect, it, vi } from "vitest";
import { importArchidektDeck } from "./import";
import fixture from "./__fixtures__/archidekt-deck.json";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("importArchidektDeck", () => {
  it("assembles a deck insert from Archidekt + Scryfall (happy path)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("archidekt.com")) {
          return { ok: true, status: 200, text: async () => JSON.stringify(fixture) };
        }
        // scryfall
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "sf-1",
                name: "Atraxa, Praetors' Voice",
                color_identity: ["W", "U", "B", "G"],
                artist: "Victor Adame Minguez",
                image_uris: {
                  art_crop: "https://cards.scryfall.io/art_crop/sf-1.jpg",
                  normal: "https://cards.scryfall.io/normal/sf-1.jpg",
                },
              },
            ],
            not_found: [],
          }),
        };
      }),
    );

    const r = await importArchidektDeck("123456", "https://archidekt.com/decks/123456/atraxa");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe("Atraxa Superfriends");
      expect(r.data.commander_name).toBe("Atraxa, Praetors' Voice");
      expect(r.data.color_identity).toEqual(["W", "U", "B", "G"]);
      expect(r.data.source).toBe("archidekt");
      expect(r.data.commander_scryfall_id).toBe("sf-1");
      expect(r.data.art_crop_url).toBe("https://cards.scryfall.io/art_crop/sf-1.jpg");
      expect(r.data.card_image_url).toBe("https://cards.scryfall.io/normal/sf-1.jpg");
      expect(r.data.artist).toBe("Victor Adame Minguez");
    }
  });

  it("fails gracefully (→ manual fallback) when Archidekt is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const r = await importArchidektDeck("123456", "https://archidekt.com/decks/123456");
    expect(r.ok).toBe(false);
  });

  it("fails when no commander is detected", async () => {
    const noCommander = JSON.stringify({
      name: "Pile",
      categories: [{ name: "Commander", isPremier: true }],
      cards: [{ card: { oracleCard: { name: "Forest" } }, quantity: 1, categories: ["Lands"] }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => noCommander })),
    );
    const r = await importArchidektDeck("1", "https://archidekt.com/decks/1");
    expect(r.ok).toBe(false);
  });
});
