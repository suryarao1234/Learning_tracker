import { useLearningData } from "../state/useLearningData";

export function StorageErrorBanner() {
  const { storageError, dismissError } = useLearningData();
  if (!storageError) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-doing/25 bg-doing-soft px-4 py-2.5 text-sm font-semibold text-doing-ink"
    >
      <span className="flex-1">{storageError}</span>
      <button
        type="button"
        onClick={dismissError}
        className="font-bold underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
