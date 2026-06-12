import { cn } from "@/lib/utils";

// WUBRG → token fill + readable label + letter color. Color is never the sole
// signal: each pip is a hand-drawn SVG mana symbol that still carries its WUBRG
// letter, and the group has a descriptive aria-label. We hand-draw minimal SVGs
// (token-filled circles) rather than pull a community mana-icon font: those ship
// their own raw hex colors (our rule is design-tokens-only) and the glyphs are
// WotC IP — under our non-commercial Fan Content posture this stays cleanest.
const PIP: Record<string, { fill: string; letter: string; label: string }> = {
  W: { fill: "fill-mtg-w", letter: "fill-foreground", label: "White" },
  U: { fill: "fill-mtg-u", letter: "fill-white", label: "Blue" },
  B: { fill: "fill-mtg-b", letter: "fill-white", label: "Black" },
  R: { fill: "fill-mtg-r", letter: "fill-white", label: "Red" },
  G: { fill: "fill-mtg-g", letter: "fill-white", label: "Green" },
};

const ORDER = ["W", "U", "B", "R", "G"];

/** Colors present in `identity`, in canonical WUBRG order. */
function ordered(identity: string[]): string[] {
  return ORDER.filter((c) => identity.includes(c));
}

// Guild (2-color), shard/wedge (3-color), and the Commander-2016 four-color
// names — deep EDH-native vocabulary, keyed by the colors in WUBRG order.
const COMBO_NAMES: Record<string, string> = {
  // Guilds
  WU: "Azorius",
  WB: "Orzhov",
  WR: "Boros",
  WG: "Selesnya",
  UB: "Dimir",
  UR: "Izzet",
  UG: "Simic",
  BR: "Rakdos",
  BG: "Golgari",
  RG: "Gruul",
  // Shards (allied) + wedges (enemy)
  WUB: "Esper",
  WUR: "Jeskai",
  WUG: "Bant",
  WBR: "Mardu",
  WBG: "Abzan",
  WRG: "Naya",
  UBR: "Grixis",
  UBG: "Sultai",
  URG: "Temur",
  BRG: "Jund",
  // Four-color (Commander 2016)
  WUBR: "Artifice",
  WUBG: "Growth",
  WURG: "Altruism",
  WBRG: "Aggression",
  UBRG: "Chaos",
  // Five-color
  WUBRG: "Five-Color",
};

/**
 * Flavor name for a multi-color identity ("Golgari", "Esper", "Temur"), or null
 * for mono/colorless (no guild name applies). Pure — unit-tested.
 */
export function colorIdentityLabel(identity: string[]): string | null {
  const colors = ordered(identity);
  if (colors.length < 2) return null;
  return COMBO_NAMES[colors.join("")] ?? null;
}

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

/**
 * A display name for ANY color identity: "Colorless", "Mono-Green", a guild/
 * shard/wedge name, or an "N-color" fallback. Pure — unit-tested.
 */
export function colorComboName(identity: string[]): string {
  const colors = ordered(identity);
  if (colors.length === 0) return "Colorless";
  if (colors.length === 1) return `Mono-${COLOR_NAMES[colors[0]!]}`;
  return COMBO_NAMES[colors.join("")] ?? `${colors.length}-color`;
}

export function ColorPips({ identity, className }: { identity: string[]; className?: string }) {
  const colors = ordered(identity);

  if (colors.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Colorless</span>;
  }

  const label = `Color identity: ${colors.map((c) => PIP[c]!.label).join(", ")}`;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={label}
    >
      {colors.map((c) => {
        const pip = PIP[c]!;
        return (
          <svg key={c} viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <circle cx="8" cy="8" r="7" className={cn(pip.fill, "stroke-border")} strokeWidth="1" />
            <text
              x="8"
              y="8"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              className={cn(pip.letter, "font-bold")}
            >
              {c}
            </text>
          </svg>
        );
      })}
    </span>
  );
}

/**
 * A thin left edge tinted by color identity, for deck cards and stats rows.
 * Mono = solid token color; 2+ colors = a vertical token gradient; colorless =
 * nothing. Token-only: the inline gradient references --mtg-* CSS variables
 * (the design tokens themselves), never raw hex. Render inside a `relative
 * overflow-hidden` container; decorative, so aria-hidden.
 */
export function ColorIdentityEdge({ identity, className }: { identity: string[]; className?: string }) {
  const colors = ordered(identity);
  if (colors.length === 0) return null;

  const stops = colors.map((c) => `hsl(var(--mtg-${c.toLowerCase()}))`);
  const background =
    stops.length === 1 ? stops[0] : `linear-gradient(to bottom, ${stops.join(", ")})`;

  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-y-0 left-0 w-1", className)}
      style={{ background }}
    />
  );
}
