import { greetingFor } from "../lib/overview";
import { overallProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { data } = useLearningData();
  const progress = overallProgress(data.subjects);

  return (
    <header className="flex items-center gap-3 px-4 py-4 sm:px-7">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Show subjects"
        className="-ml-1 rounded-xl p-1.5 text-ink-soft transition hover:bg-card hover:text-ink sm:hidden"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5">
          <path
            d="M2 4h12M2 8h12M2 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-extrabold tracking-tight text-ink sm:text-xl">
          {greetingFor()} <span aria-hidden="true">👋</span>
        </h1>
        <p className="truncate text-sm text-ink-soft">
          {progress.total === 0
            ? "Paste a roadmap and start tracking."
            : `${progress.done} of ${progress.total} subtopics done across everything.`}
        </p>
      </div>

      {progress.total > 0 && (
        <div className="hidden items-center gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-sm ring-1 ring-line md:flex">
          <div className="text-right">
            <p className="text-[11px] font-bold tracking-wide text-ink-mute uppercase">
              Overall
            </p>
            <p className="text-lg leading-none font-extrabold tabular-nums text-ink">
              {progress.percent}%
            </p>
          </div>
          <div className="h-9 w-px bg-line" aria-hidden="true" />
          <p className="text-xs leading-tight font-semibold text-ink-soft">
            {progress.done}/{progress.total}
            <br />
            <span className="font-medium text-ink-mute">subtopics</span>
          </p>
        </div>
      )}
    </header>
  );
}
