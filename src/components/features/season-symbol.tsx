import { cn } from "@/lib/utils";

/**
 * A generated geometric "set symbol" for a season — deterministic from the
 * season's stored seed, so each season gets its own recognizable mark (like an
 * MTG set symbol) with no image assets. Token colors only (the gold accent on a
 * background-colored cutout). Decorative: callers pair it with the season name.
 */
export function SeasonSymbol({ seed, className }: { seed: number; className?: string }) {
  const s = Math.abs(seed);
  const sides = 3 + (s % 4); // 3–6 sided
  const rot = (s * 47) % 360; // varied orientation
  const cx = 12;
  const cy = 12;
  const r = 9;

  const points = Array.from({ length: sides }, (_, i) => {
    const angle = ((rot + (360 / sides) * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");

  const innerR = 2.5 + (s % 3); // 2.5–4.5

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0", className)}
      role="img"
      aria-label="Season symbol"
    >
      <polygon
        points={points}
        className="fill-accent stroke-accent"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* cutout for the set-symbol look */}
      <circle cx={cx} cy={cy} r={innerR} className="fill-background" />
    </svg>
  );
}
