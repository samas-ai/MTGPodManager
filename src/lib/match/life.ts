/**
 * Pure helpers for the host's local life counter. Life is local React state on
 * the host screen only — never persisted or synced across devices (per PRD).
 * Commander damage is tracked the same way (local-only): per seat, how much has
 * been taken from each opponent's commander. 21 from a single commander is
 * lethal in EDH, and commander damage IS life loss — so applying it moves life
 * in lockstep.
 */
export const STARTING_LIFE = 40;
export const COMMANDER_LETHAL = 21;
export type SeatCount = 2 | 3 | 4;

export interface Seat {
  id: number;
  life: number;
  /** Commander damage received, keyed by source seat id. 21+ from one is lethal. */
  commanderDamage: Record<number, number>;
}

export function initSeats(count: SeatCount): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    life: STARTING_LIFE,
    commanderDamage: {},
  }));
}

/** Adjust one seat's life by delta. Life may go negative or above 40 (no clamp). */
export function adjustLife(seats: Seat[], seatId: number, delta: number): Seat[] {
  return seats.map((s) => (s.id === seatId ? { ...s, life: s.life + delta } : s));
}

/**
 * Apply commander damage to `targetId` from `sourceId`. The per-source tally
 * floors at 0; the target's life moves by the *actual* tally change (so undoing
 * restores life exactly and a floored decrement can't inflate life). Returns a
 * new seats array; never mutates the input.
 */
export function applyCommanderDamage(
  seats: Seat[],
  targetId: number,
  sourceId: number,
  delta: number,
): Seat[] {
  return seats.map((s) => {
    if (s.id !== targetId) return s;
    const prev = s.commanderDamage[sourceId] ?? 0;
    const next = Math.max(0, prev + delta);
    const actual = next - prev;
    return {
      ...s,
      life: s.life - actual,
      commanderDamage: { ...s.commanderDamage, [sourceId]: next },
    };
  });
}

/** True once any single source has dealt 21+ commander damage to this seat. */
export function isCommanderDead(seat: Seat): boolean {
  return Object.values(seat.commanderDamage).some((d) => d >= COMMANDER_LETHAL);
}
