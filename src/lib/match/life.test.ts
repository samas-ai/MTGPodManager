import { describe, expect, it } from "vitest";
import {
  adjustLife,
  applyCommanderDamage,
  COMMANDER_LETHAL,
  initSeats,
  isCommanderDead,
  STARTING_LIFE,
} from "./life";

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

describe("applyCommanderDamage", () => {
  it("tallies per source and reduces the target's life in lockstep", () => {
    let seats = initSeats(4);
    seats = applyCommanderDamage(seats, 1, 2, 5);
    expect(seats[0]?.commanderDamage[2]).toBe(5);
    expect(seats[0]?.life).toBe(35);
    // other seats untouched
    expect(seats[1]?.life).toBe(40);
    expect(seats[1]?.commanderDamage).toEqual({});
  });

  it("stacks damage from the same source", () => {
    let seats = initSeats(2);
    seats = applyCommanderDamage(seats, 1, 2, 5);
    seats = applyCommanderDamage(seats, 1, 2, 5);
    expect(seats[0]?.commanderDamage[2]).toBe(10);
    expect(seats[0]?.life).toBe(30);
  });

  it("keeps sources separate", () => {
    let seats = initSeats(4);
    seats = applyCommanderDamage(seats, 1, 2, 7);
    seats = applyCommanderDamage(seats, 1, 3, 4);
    expect(seats[0]?.commanderDamage).toEqual({ 2: 7, 3: 4 });
    expect(seats[0]?.life).toBe(40 - 11);
  });

  it("floors the tally at 0 and restores life exactly on undo", () => {
    let seats = initSeats(2);
    seats = applyCommanderDamage(seats, 1, 2, 5);
    seats = applyCommanderDamage(seats, 1, 2, -5);
    expect(seats[0]?.commanderDamage[2]).toBe(0);
    expect(seats[0]?.life).toBe(40);
    // a decrement past 0 does nothing to tally or life
    seats = applyCommanderDamage(seats, 1, 2, -3);
    expect(seats[0]?.commanderDamage[2]).toBe(0);
    expect(seats[0]?.life).toBe(40);
  });

  it("does not mutate the input array", () => {
    const seats = initSeats(2);
    applyCommanderDamage(seats, 1, 2, 5);
    expect(seats[0]?.life).toBe(40);
    expect(seats[0]?.commanderDamage).toEqual({});
  });
});

describe("isCommanderDead", () => {
  it("is true once a single source reaches the lethal threshold", () => {
    let seats = initSeats(2);
    expect(isCommanderDead(seats[0]!)).toBe(false);
    seats = applyCommanderDamage(seats, 1, 2, COMMANDER_LETHAL);
    expect(isCommanderDead(seats[0]!)).toBe(true);
  });

  it("does not sum across different sources", () => {
    let seats = initSeats(4);
    seats = applyCommanderDamage(seats, 1, 2, 15);
    seats = applyCommanderDamage(seats, 1, 3, 15);
    // 30 total but only 15 from each source — not lethal by commander damage
    expect(isCommanderDead(seats[0]!)).toBe(false);
  });
});
