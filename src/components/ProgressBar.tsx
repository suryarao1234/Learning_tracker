type ProgressBarProps = {
  /** Share of the bar that's done, 0–100. */
  percent: number;
  /** Share that's in progress, drawn in a lighter tone after the done part. */
  inProgressPercent?: number;
  /** Bar thickness. Thin by default — it sits under text, not beside it. */
  size?: "sm" | "md";
  className?: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ProgressBar({
  percent,
  inProgressPercent = 0,
  size = "sm",
  className = "",
}: ProgressBarProps) {
  const done = clamp(percent);
  // Never let the two segments overflow the bar, however the numbers arrive.
  const inProgress = clamp(Math.min(inProgressPercent, 100 - done));
  const height = size === "md" ? "h-2.5" : "h-1.5";

  return (
    <div
      className={`flex ${height} w-full gap-px overflow-hidden rounded-full bg-line ${className}`}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-done transition-[width] duration-300"
        style={{ width: `${done}%` }}
      />
      <div
        className="h-full rounded-full bg-doing/55 transition-[width] duration-300"
        style={{ width: `${inProgress}%` }}
      />
    </div>
  );
}
