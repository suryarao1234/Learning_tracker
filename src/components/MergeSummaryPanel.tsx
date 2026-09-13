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
    <div className="space-y-3 rounded-xl border border-line bg-canvas p-3 text-sm">
      <p className="text-ink-soft">
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
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-ink-soft">
            {summary.droppedCount === 0
              ? "Keeping everything the new roadmap left out."
              : `${plural(summary.droppedCount, "item")} will be deleted on save.`}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => onChange(setAllKeep(draft, true))}
              className="rounded-xl border border-line bg-white px-2 py-1 text-xs font-bold text-ink-soft hover:bg-canvas"
            >
              Keep all
            </button>
            <button
              type="button"
              onClick={() => onChange(setAllKeep(draft, false))}
              className="rounded-xl border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
            >
              Drop all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// "New" is brand-coloured rather than green — green means done, and reusing it
// for a bucket would make an untouched row look finished.
const BUCKET_TONES = {
  emerald: "border-brand/20 bg-brand-soft",
  slate: "border-line bg-card",
  amber: "border-doing/25 bg-doing-soft",
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
    <div className={`rounded-xl border px-3 py-2 ${BUCKET_TONES[tone]}`}>
      <dt className="text-xs font-bold text-ink-soft">{term}</dt>
      <dd className="mt-0.5 text-sm font-bold text-ink">{detail}</dd>
      <dd className="mt-0.5 text-xs text-ink-mute">{hint}</dd>
    </div>
  );
}
