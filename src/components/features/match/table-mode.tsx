"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Seat } from "@/lib/match/life";
import { CommanderDamage } from "@/components/features/match/commander-damage";

/**
 * Full-screen "Table Mode" life counter for the host phone laid on the table.
 * Each seat is two tap zones — top half +1, bottom half −1; hold either for ±5.
 * Seats on the far side of the table are rotated 180° to face the player there.
 * A Screen Wake Lock keeps the phone awake (progressive enhancement). Life is
 * local-only React state, same as normal mode — nothing is synced. A change
 * ticker shows the last few deltas ("wait, what hit me?"). Animations are off
 * under prefers-reduced-motion via the global stylesheet.
 */

// The Screen Wake Lock API isn't in every TS DOM lib; type just what we touch.
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

interface Tick {
  id: number;
  seatId: number;
  delta: number;
}

const HOLD_MS = 450;

/** A tap/hold zone. Pointer events drive touch + mouse; keyboard gets ±1. */
function HoldZone({
  label,
  onTap,
  onHold,
  className,
  children,
}: {
  label: string;
  onTap: () => void;
  onHold: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex touch-manipulation select-none items-start justify-center text-2xl text-muted-foreground/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/40",
        className,
      )}
      onPointerDown={() => {
        held.current = false;
        clear();
        timer.current = setTimeout(() => {
          held.current = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerUp={() => {
        clear();
        if (!held.current) onTap();
      }}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {children}
    </button>
  );
}

function gridClass(count: number): string {
  // 2 players stack; 3 and 4 use a 2×2 (the 3rd seat spans the bottom row).
  return count === 2 ? "grid-cols-1 grid-rows-2" : "grid-cols-2 grid-rows-2";
}

// Far-side seats (visually "top") are rotated to face the opposite player.
function isRotated(index: number, count: number): boolean {
  return count === 2 ? index === 0 : index < 2;
}

export function TableMode({
  seats,
  onBump,
  onCommanderDamage,
  onReset,
  onClose,
}: {
  seats: Seat[];
  onBump: (seatId: number, delta: number) => void;
  onCommanderDamage: (targetId: number, sourceId: number, delta: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const nextTickId = useRef(0);

  const change = useCallback(
    (seatId: number, delta: number) => {
      onBump(seatId, delta);
      const id = (nextTickId.current += 1);
      setTicks((prev) => [{ id, seatId, delta }, ...prev].slice(0, 5));
    },
    [onBump],
  );

  // Keep the screen awake while Table Mode is open; re-acquire on refocus
  // (the lock auto-releases when the tab is hidden).
  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* denied or not visible — non-fatal */
      }
    };
    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  // Exit on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = seats.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      {/* Chrome: exit, change ticker, reset */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          ← Done
        </Button>
        <div
          className="flex flex-1 flex-wrap justify-center gap-1 text-xs text-muted-foreground"
          aria-live="polite"
          aria-label="Recent life changes"
        >
          {ticks.map((t) => (
            <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
              Seat {t.seatId} {t.delta > 0 ? `+${t.delta}` : t.delta}
            </span>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      {/* Seats */}
      <div className={cn("grid flex-1 gap-2 p-2", gridClass(count))}>
        {seats.map((seat, i) => (
          <div
            key={seat.id}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-card",
              isRotated(i, count) && "rotate-180",
              count === 3 && i === 2 && "col-span-2",
            )}
          >
            <span className="pointer-events-none absolute left-2 top-2 z-10 text-xs font-medium text-muted-foreground">
              Seat {seat.id}
            </span>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                aria-live="polite"
                aria-label={`Seat ${seat.id} life: ${seat.life}`}
                className="text-6xl font-bold tabular-nums sm:text-7xl"
              >
                {seat.life}
              </span>
            </div>
            <div className="flex h-full flex-col">
              <HoldZone
                label={`Seat ${seat.id}: tap to add 1, hold to add 5`}
                onTap={() => change(seat.id, 1)}
                onHold={() => change(seat.id, 5)}
                className="h-1/2 pt-3"
              >
                +
              </HoldZone>
              <HoldZone
                label={`Seat ${seat.id}: tap to subtract 1, hold to subtract 5`}
                onTap={() => change(seat.id, -1)}
                onHold={() => change(seat.id, -5)}
                className="h-1/2 items-end pb-3"
              >
                −
              </HoldZone>
            </div>
            {/* Commander damage: tap an opponent chip to add 1 (also −1 life). */}
            <div className="pointer-events-auto absolute inset-x-1 bottom-1 z-20">
              <CommanderDamage
                seat={seat}
                others={seats.filter((s) => s.id !== seat.id)}
                onChange={(sourceId, delta) => onCommanderDamage(seat.id, sourceId, delta)}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
