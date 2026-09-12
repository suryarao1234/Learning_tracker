type ProgressBarProps = {
  /** Share of the bar that's done, 0–100. */
  percent: number;
  /** Share that's in progress, drawn in a lighter shade after the done part. */
  inProgressPercent?: number;
  className?: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ProgressBar({
  percent,
  inProgressPercent = 0,
  className = "",
}: ProgressBarProps) {
  const done = clamp(percent);
  // Never let the two segments overflow the bar, however the numbers arrive.
  const inProgress = clamp(Math.min(inProgressPercent, 100 - done));

  return (
    <div
      className={`flex h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${done}%` }} />
      <div
        className="h-full bg-amber-300 transition-[width]"
        style={{ width: `${inProgress}%` }}
      />
    </div>
  );
}
