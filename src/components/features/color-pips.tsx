import { cn } from "@/lib/utils";

// Map WUBRG → token bg + readable label. Color is never the sole signal: each
// pip carries its letter, and the group has a descriptive aria-label.
const PIP: Record<string, { bg: string; label: string; text: string }> = {
  W: { bg: "bg-mtg-w", label: "White", text: "text-foreground" },
  U: { bg: "bg-mtg-u", label: "Blue", text: "text-white" },
  B: { bg: "bg-mtg-b", label: "Black", text: "text-white" },
  R: { bg: "bg-mtg-r", label: "Red", text: "text-white" },
  G: { bg: "bg-mtg-g", label: "Green", text: "text-white" },
};

const ORDER = ["W", "U", "B", "R", "G"];

export function ColorPips({ identity, className }: { identity: string[]; className?: string }) {
  const colors = ORDER.filter((c) => identity.includes(c));

  if (colors.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Colorless</span>;
  }

  const label = `Color identity: ${colors.map((c) => PIP[c]!.label).join(", ")}`;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label}>
      {colors.map((c) => {
        const pip = PIP[c]!;
        return (
          <span
            key={c}
            aria-hidden="true"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold leading-none",
              pip.bg,
              pip.text,
            )}
          >
            {c}
          </span>
        );
      })}
    </span>
  );
}
