type ProgressRingProps = {
  /** Completed share, 0–100. */
  percent: number;
  /** In-progress share, drawn as a lighter arc after the completed one. */
  inProgressPercent?: number;
  size?: number;
  stroke?: number;
  /** Large text in the middle. Omit for a bare ring. */
  label?: string;
  /** Small text under the label. */
  caption?: string;
  color?: string;
  /** Overrides the unfilled track, for use on a coloured surface. */
  trackColor?: string;
  /** `onColor` flips the centre text for use on a saturated background. */
  variant?: "onSurface" | "onColor";
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * A donut meter. Two arcs on one track: done, then in-progress in a lighter
 * tone, so a part-finished subject reads differently from an untouched one.
 * The arcs are separated by a small gap so they never blend into one another.
 */
export function ProgressRing({
  percent,
  inProgressPercent = 0,
  size = 88,
  stroke = 9,
  label,
  caption,
  color = "var(--color-done)",
  trackColor = "var(--color-line)",
  variant = "onSurface",
}: ProgressRingProps) {
  const done = clamp(percent);
  const doing = clamp(Math.min(inProgressPercent, 100 - done));

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A 2px visual gap between the two arcs, expressed in path length.
  const gap = done > 0 && doing > 0 ? 2 : 0;
  const doneLength = Math.max(0, (done / 100) * circumference - gap);
  const doingLength = Math.max(0, (doing / 100) * circumference);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Rotated so both arcs start at twelve o'clock. */}
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          {doing > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-doing)"
              strokeOpacity={0.55}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${doingLength} ${circumference}`}
              strokeDashoffset={-((done / 100) * circumference)}
            />
          )}
          {done > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${doneLength} ${circumference}`}
            />
          )}
        </g>
      </svg>
      {(label || caption) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span
              className={`text-lg leading-none font-extrabold tabular-nums ${
                variant === "onColor" ? "text-white" : "text-ink"
              }`}
            >
              {label}
            </span>
          )}
          {caption && (
            <span
              className={`mt-0.5 text-[10px] font-bold ${
                variant === "onColor" ? "text-white/80" : "text-ink-mute"
              }`}
            >
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
