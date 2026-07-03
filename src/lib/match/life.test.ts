import { describe, expect, it } from "vitest";
import { adjustLife, initSeats, resizeSeats, STARTING_LIFE } from "./life";

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

describe("resizeSeats", () => {
  it("preserves the life of retained seats when growing", () => {
    let seats = initSeats(2);
    seats = adjustLife(seats, 1, -7);
    const grown = resizeSeats(seats, 4);
    expect(grown).toHaveLength(4);
    expect(grown[0]?.life).toBe(33); // seat 1 kept
    expect(grown[2]?.life).toBe(STARTING_LIFE); // new seat fresh
    expect(grown[3]?.id).toBe(4);
  });

  it("trims extra seats when shrinking", () => {
    const grown = resizeSeats(initSeats(4), 2);
    expect(grown.map((s) => s.id)).toEqual([1, 2]);
  });
});
