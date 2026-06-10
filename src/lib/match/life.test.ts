import { describe, expect, it } from "vitest";
import { adjustLife, initSeats, STARTING_LIFE } from "./life";

describe("initSeats", () => {
  it("creates N seats each at 40 life", () => {
    const seats = initSeats(4);
    expect(seats).toHaveLength(4);
    expect(seats.every((s) => s.life === STARTING_LIFE)).toBe(true);
    expect(seats.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("supports 2 and 3 players", () => {
    expect(initSeats(2)).toHaveLength(2);
    expect(initSeats(3)).toHaveLength(3);
  });
});

describe("adjustLife", () => {
  it("changes only the targeted seat", () => {
    const seats = initSeats(3);
    const next = adjustLife(seats, 2, -5);
    expect(next[0]?.life).toBe(40);
    expect(next[1]?.life).toBe(35);
    expect(next[2]?.life).toBe(40);
  });

  it("allows life above 40 and below 0 (no clamp)", () => {
    let seats = initSeats(2);
    seats = adjustLife(seats, 1, 5);
    expect(seats[0]?.life).toBe(45);
    seats = adjustLife(seats, 2, -45);
    expect(seats[1]?.life).toBe(-5);
  });

  it("does not mutate the input array", () => {
    const seats = initSeats(2);
    adjustLife(seats, 1, -1);
    expect(seats[0]?.life).toBe(40);
  });
});
