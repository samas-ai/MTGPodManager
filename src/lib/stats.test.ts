import { describe, expect, it } from "vitest";
import { winPercent, winRateSeries } from "./stats";

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

describe("winRateSeries", () => {
  it("returns an empty map for no matches", () => {
    expect(winRateSeries([]).size).toBe(0);
  });

  it("gives each player one point per game they played", () => {
    const series = winRateSeries([
      { winnerId: "a", participantIds: ["a", "b"] },
      { winnerId: "b", participantIds: ["a", "b", "c"] },
      { winnerId: "a", participantIds: ["a", "b"] },
    ]);
    expect(series.get("a")).toEqual([100, 50, 67]); // W, L, W
    expect(series.get("b")).toEqual([0, 50, 33]); // L, W, L
    expect(series.get("c")).toEqual([0]); // played game 2 only
  });

  it("tolerates a null winner (no one gains a win)", () => {
    const series = winRateSeries([{ winnerId: null, participantIds: ["a", "b"] }]);
    expect(series.get("a")).toEqual([0]);
    expect(series.get("b")).toEqual([0]);
  });
});
