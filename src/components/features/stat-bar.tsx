import { cn } from "@/lib/utils";

/**
 * A thin horizontal bar for stats rows — token colors only, dependency-free (no
 * chart lib). Decorative: the numeric value always sits in the adjacent row
 * text, so color/length is never the sole signal (same rule as Sparkline). The
 * width % is a computed layout value, not a hardcoded color.
 */
export function StatBar({
  value,
  max,
  tone = "primary",
  className,
}: {
  value: number;
  max: number;
  tone?: "primary" | "accent";
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = tone === "accent" ? "bg-accent" : "bg-primary";
  return (
    <div
      aria-hidden="true"
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
