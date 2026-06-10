/**
 * Pure helpers for the host's local life counter. Life is local React state on
 * the host screen only — never persisted or synced across devices (per PRD).
 */
export const STARTING_LIFE = 40;
export type SeatCount = 2 | 3 | 4;

export interface Seat {
  id: number;
  life: number;
}

export function initSeats(count: SeatCount): Seat[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, life: STARTING_LIFE }));
}

/** Adjust one seat's life by delta. Life may go negative or above 40 (no clamp). */
export function adjustLife(seats: Seat[], seatId: number, delta: number): Seat[] {
  return seats.map((s) => (s.id === seatId ? { ...s, life: s.life + delta } : s));
}
