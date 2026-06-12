import { cn } from "@/lib/utils";
import { COMMANDER_LETHAL, isCommanderDead, type Seat } from "@/lib/match/life";

/**
 * Per-opponent commander-damage controls for one seat. Local-only, like life.
 * `compact` is the Table-Mode variant (tap a chip to add 1); the grid variant
 * adds explicit −/+ for corrections. Lethal (21+ from one source) is never shown
 * by color alone — it carries a ☠ glyph and an aria "lethal" note.
 */
export function CommanderDamage({
  seat,
  others,
  onChange,
  compact = false,
}: {
  seat: Seat;
  others: Seat[];
  onChange: (sourceId: number, delta: number) => void;
  compact?: boolean;
}) {
  if (others.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {others.map((o) => {
          const dmg = seat.commanderDamage[o.id] ?? 0;
          const lethal = dmg >= COMMANDER_LETHAL;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id, 1)}
              aria-label={`Seat ${seat.id}: ${dmg} commander damage from Seat ${o.id}${
                lethal ? ", lethal" : ""
              }. Tap to add 1.`}
              className={cn(
                "flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs tabular-nums",
                "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                lethal
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground",
              )}
            >
              <span aria-hidden="true">⚔{o.id}</span>
              <span>{dmg}</span>
              {lethal ? <span aria-hidden="true">☠</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Commander damage (21 = lethal)</p>
      <div className="flex flex-col gap-1">
        {others.map((o) => {
          const dmg = seat.commanderDamage[o.id] ?? 0;
          const lethal = dmg >= COMMANDER_LETHAL;
          return (
            <div
              key={o.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs",
                lethal ? "border-destructive text-destructive" : "border-border",
              )}
            >
              <span aria-hidden="true" className="text-muted-foreground">
                ⚔ from Seat {o.id}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(o.id, -1)}
                  aria-label={`Seat ${seat.id}: remove 1 commander damage from Seat ${o.id}`}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  −
                </button>
                <span
                  className="w-8 text-center font-medium tabular-nums"
                  aria-label={`${dmg} commander damage from Seat ${o.id}${lethal ? ", lethal" : ""}`}
                >
                  {dmg}
                  {lethal ? <span aria-hidden="true"> ☠</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(o.id, 1)}
                  aria-label={`Seat ${seat.id}: add 1 commander damage from Seat ${o.id}`}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Convenience: does this seat have any lethal commander-damage source? */
export { isCommanderDead };
