import { describe, expect, it } from "vitest";
import { archidektUrlSchema, extractArchidektDeckId } from "./import";

describe("extractArchidektDeckId", () => {
  it("extracts id from a full URL with slug", () => {
    expect(extractArchidektDeckId("https://archidekt.com/decks/123456/my-deck")).toBe("123456");
  });
  it("extracts id without protocol", () => {
    expect(extractArchidektDeckId("archidekt.com/decks/987")).toBe("987");
  });
  it("accepts a bare numeric id", () => {
    expect(extractArchidektDeckId("  555  ")).toBe("555");
  });
  it("returns null for a non-Archidekt URL", () => {
    expect(extractArchidektDeckId("https://moxfield.com/decks/abc")).toBeNull();
  });
  it("returns null for junk", () => {
    expect(extractArchidektDeckId("not a url")).toBeNull();
  });
});

describe("archidektUrlSchema", () => {
  it("transforms a valid URL to a deckId", () => {
    const r = archidektUrlSchema.safeParse({ url: "https://archidekt.com/decks/42/x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deckId).toBe("42");
  });
  it("rejects an invalid URL", () => {
    expect(archidektUrlSchema.safeParse({ url: "https://example.com" }).success).toBe(false);
  });
  it("rejects empty input", () => {
    expect(archidektUrlSchema.safeParse({ url: "" }).success).toBe(false);
  });
});
