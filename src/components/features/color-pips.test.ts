import { describe, expect, it } from "vitest";
import { colorComboName, colorIdentityLabel } from "./color-pips";

describe("colorIdentityLabel", () => {
  it("returns null for colorless and mono-color identities", () => {
    expect(colorIdentityLabel([])).toBeNull();
    expect(colorIdentityLabel(["G"])).toBeNull();
    expect(colorIdentityLabel(["U"])).toBeNull();
  });

  it("names two-color guilds regardless of input order", () => {
    expect(colorIdentityLabel(["B", "G"])).toBe("Golgari");
    expect(colorIdentityLabel(["G", "B"])).toBe("Golgari");
    expect(colorIdentityLabel(["R", "W"])).toBe("Boros");
  });

  it("names three-color shards and wedges", () => {
    expect(colorIdentityLabel(["W", "U", "B"])).toBe("Esper");
    expect(colorIdentityLabel(["R", "U", "G"])).toBe("Temur"); // wedge, out of order
    expect(colorIdentityLabel(["B", "R", "G"])).toBe("Jund");
  });

  it("names four- and five-color identities", () => {
    expect(colorIdentityLabel(["W", "U", "B", "R"])).toBe("Artifice");
    expect(colorIdentityLabel(["G", "R", "B", "U", "W"])).toBe("Five-Color");
  });

  it("ignores unknown tokens that aren't WUBRG", () => {
    expect(colorIdentityLabel(["B", "G", "X"])).toBe("Golgari");
  });
});

describe("colorComboName", () => {
  it("names colorless and mono identities", () => {
    expect(colorComboName([])).toBe("Colorless");
    expect(colorComboName(["G"])).toBe("Mono-Green");
    expect(colorComboName(["W"])).toBe("Mono-White");
  });

  it("uses guild/shard/wedge names for multicolor", () => {
    expect(colorComboName(["B", "G"])).toBe("Golgari");
    expect(colorComboName(["R", "U", "G"])).toBe("Temur");
    expect(colorComboName(["W", "U", "B", "R", "G"])).toBe("Five-Color");
  });
});
