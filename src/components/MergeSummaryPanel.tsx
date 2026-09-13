import { mergeSummary, setAllKeep, type MergeSummary } from "../lib/merge";
import type { DraftSubject } from "../lib/draft";

type MergeSummaryPanelProps = {
  draft: DraftSubject;
  onChange: (draft: DraftSubject) => void;
  existingName: string;
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function bucketLine(topics: number, subtopics: number): string {
  if (topics === 0 && subtopics === 0) return "nothing";
  const parts: string[] = [];
  if (topics > 0) parts.push(plural(topics, "topic"));
  if (subtopics > 0) parts.push(plural(subtopics, "subtopic"));
  return parts.join(", ");
}

export function MergeSummaryPanel({
  draft,
  onChange,
  existingName,
}: MergeSummaryPanelProps) {
  const summary: MergeSummary = mergeSummary(draft);
  const hasRemoved = summary.removedTopics + summary.removedSubtopics > 0;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="text-slate-700">
        Merging into your existing <strong>{existingName}</strong> subject. Anything
        already tracked keeps the progress you've recorded against it.
      </p>

      <dl className="grid gap-2 sm:grid-cols-3">
        <Bucket
          tone="emerald"
          term="New"
          detail={bucketLine(summary.newTopics, summary.newSubtopics)}
          hint="Added, starting at not-started."
        />
        <Bucket
          tone="slate"
          term="Already tracked"
          detail={bucketLine(summary.matchedTopics, summary.matchedSubtopics)}
          hint="Progress untouched."
        />
        <Bucket
          tone="amber"
          term="Not in new roadmap"
          detail={bucketLine(summary.removedTopics, summary.removedSubtopics)}
          hint={hasRemoved ? "Kept unless you drop them." : "Nothing was left out."}
        />
      </dl>

      {hasRemoved && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <span className="text-xs text-slate-600">
            {summary.droppedCount === 0
              ? "Keeping everything the new roadmap left out."
              : `${plural(summary.droppedCount, "item")} will be deleted on save.`}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => onChange(setAllKeep(draft, true))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep all
            </button>
            <button
              type="button"
              onClick={() => onChange(setAllKeep(draft, false))}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Drop all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BUCKET_TONES = {
  emerald: "border-emerald-200 bg-emerald-50",
  slate: "border-slate-200 bg-white",
  amber: "border-amber-200 bg-amber-50",
} as const;

function Bucket({
  tone,
  term,
  detail,
  hint,
}: {
  tone: keyof typeof BUCKET_TONES;
  term: string;
  detail: string;
  hint: string;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${BUCKET_TONES[tone]}`}>
      <dt className="text-xs font-medium text-slate-600">{term}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{detail}</dd>
      <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>
    </div>
  );
}
