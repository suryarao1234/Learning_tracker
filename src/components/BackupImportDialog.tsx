import { useEffect } from "react";
import { countContents, type BackupCounts } from "../lib/backup";
import type { LearningData } from "../types";

type BackupImportDialogProps = {
  /** What the file holds, already counted by the caller. */
  counts: BackupCounts;
  warning?: string;
  current: LearningData;
  onReplace: () => void;
  onMerge: () => void;
  onCancel: () => void;
};

function describe(counts: BackupCounts): string {
  const parts = [
    `${counts.subjects} ${counts.subjects === 1 ? "subject" : "subjects"}`,
    `${counts.topics} ${counts.topics === 1 ? "topic" : "topics"}`,
    `${counts.subtopics} ${counts.subtopics === 1 ? "subtopic" : "subtopics"}`,
  ];
  return parts.join(", ");
}

/**
 * Asks what to do with a validated backup. Two outcomes rather than one, so
 * this can't be the shared ConfirmDialog: replacing is destructive and merging
 * isn't, and the difference has to be legible before either is clicked.
 */
export function BackupImportDialog({
  counts,
  warning,
  current,
  onReplace,
  onMerge,
  onCancel,
}: BackupImportDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const currentCounts = countContents(current);
  const hasCurrent = currentCounts.subjects > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-import-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="backup-import-title" className="text-lg font-semibold text-slate-900">
          Import this backup?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The file holds {describe(counts)}.
          {hasCurrent && ` You currently have ${describe(currentCounts)}.`}
        </p>

        {warning && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {warning}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {hasCurrent && (
            <button
              type="button"
              onClick={onMerge}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white hover:bg-slate-800"
            >
              Merge
              <span className="mt-0.5 block text-xs font-normal text-slate-300">
                Adds subjects you don't already have. Nothing you're tracking changes.
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onReplace}
            className={
              hasCurrent
                ? "w-full rounded-md border border-red-300 bg-white px-3 py-2 text-left text-sm font-medium text-red-800 hover:bg-red-50"
                : "w-full rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white hover:bg-slate-800"
            }
          >
            {hasCurrent ? "Replace everything" : "Import"}
            {hasCurrent && (
              <span className="mt-0.5 block text-xs font-normal text-red-700">
                Deletes your current subjects and progress. This can't be undone.
              </span>
            )}
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
