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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-import-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
        <h2 id="backup-import-title" className="text-lg font-semibold text-ink">
          Import this backup?
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          The file holds {describe(counts)}.
          {hasCurrent && ` You currently have ${describe(currentCounts)}.`}
        </p>

        {warning && (
          <p className="mt-3 rounded-xl border border-doing/25 bg-doing-soft px-3 py-2 text-sm font-semibold text-doing-ink">
            {warning}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {hasCurrent && (
            <button
              type="button"
              onClick={onMerge}
              className="w-full rounded-xl bg-brand px-3.5 py-2.5 text-left text-sm font-bold text-white transition hover:bg-brand-ink"
            >
              Merge
              <span className="mt-0.5 block text-xs font-normal text-white/75">
                Adds subjects you don't already have. Nothing you're tracking changes.
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onReplace}
            className={
              hasCurrent
                ? "w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-left text-sm font-bold text-red-800 hover:bg-red-50"
                : "w-full rounded-xl bg-brand px-3.5 py-2.5 text-left text-sm font-bold text-white transition hover:bg-brand-ink"
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
            className="rounded-xl border border-line px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-canvas"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
