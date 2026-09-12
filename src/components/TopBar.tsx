import { overallProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import { ProgressBar } from "./ProgressBar";

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { data } = useLearningData();
  const progress = overallProgress(data.subjects);

  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Show subjects"
        className="-ml-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:hidden"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5">
          <path
            d="M2 4h12M2 8h12M2 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <h1 className="text-base font-semibold text-slate-900">Learning Tracker</h1>
      {progress.total > 0 && (
        <div className="ml-auto flex w-48 items-center gap-3 sm:w-64">
          <ProgressBar
            percent={progress.percent}
            inProgressPercent={progress.inProgressPercent}
          />
          <span className="shrink-0 text-sm tabular-nums text-slate-600">
            {progress.percent}%{" "}
            <span className="text-slate-400">
              ({progress.done}/{progress.total})
            </span>
          </span>
        </div>
      )}
    </header>
  );
}
