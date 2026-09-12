import { useLearningData } from "../state/useLearningData";

export function StorageErrorBanner() {
  const { storageError, dismissError } = useLearningData();
  if (!storageError) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <span className="flex-1">{storageError}</span>
      <button
        type="button"
        onClick={dismissError}
        className="font-medium underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
