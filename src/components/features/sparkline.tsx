/**
 * Dependency-free inline sparkline (server component). Token colors only;
 * decorative — the adjacent text carries the numbers, color is never the sole
 * signal (the value is in the aria-label and the visible row text).
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 24,
}: {
  /** Series of 0–100 percentages, oldest first. */
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = pad + (values.length > 1 ? i * stepX : innerW / 2);
      const y = pad + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {/* 50% reference line */}
      <line
        x1={pad}
        y1={pad + innerH / 2}
        x2={width - pad}
        y2={pad + innerH / 2}
        stroke="hsl(var(--border))"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
