import { describe, expect, it } from "vitest";
import { winPercent } from "./stats";

describe("winPercent", () => {
  it("returns 0 when there are no games (no divide-by-zero)", () => {
    expect(winPercent(0, 0)).toBe(0);
  });
  it("computes a rounded percentage", () => {
    expect(winPercent(1, 2)).toBe(50);
    expect(winPercent(1, 3)).toBe(33);
    expect(winPercent(2, 3)).toBe(67);
  });
  it("handles a perfect record", () => {
    expect(winPercent(4, 4)).toBe(100);
  });
});
