import { useRef, useMemo, useState } from "react";
import {
  fromDraft,
  toDraft,
  validateDraft,
  type DraftError,
  type DraftSubject,
} from "../lib/draft";
import { GEMINI_MODEL, structureRoadmap } from "../lib/gemini";
import { applyMergeDraft, toMergeDraft } from "../lib/merge";
import { normalizeName } from "../lib/normalize";
import { parseRoadmap, type ParseResult } from "../lib/parseRoadmap";
import { subjectFromParsed } from "../lib/subject";
import { useLearningData } from "../state/useLearningData";
import type { ParsedSubject, Subject } from "../types";
import { DraftTreeEditor } from "./DraftTreeEditor";
import { MergeSummaryPanel } from "./MergeSummaryPanel";

type ImportModalProps = {
  onClose: () => void;
  onSaved: (subjectId: string) => void;
};

type Step = "paste" | "thinking" | "review";

/**
 * What happened on the Gemini path, when it was taken at all. A failure is
 * recorded rather than thrown away: the local parser's result is still shown,
 * and the user should be told why it wasn't improved on.
 */
type GeminiOutcome = { used: true } | { used: false; message: string };

/**
 * Mounted only while an import is in progress — the caller renders it
 * conditionally rather than passing an `open` flag. That way a cancelled
 * import can't leave its half-edited tree waiting for the next one, without
 * needing an effect to clear it.
 */
export function ImportModal({ onClose, onSaved }: ImportModalProps) {
  const { data, addSubject, updateSubject, geminiApiKey } = useLearningData();
  const [step, setStep] = useState<Step>("paste");
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [draft, setDraft] = useState<DraftSubject | null>(null);
  /** Set once the import is understood to be an update of an existing subject. */
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [geminiOutcome, setGeminiOutcome] = useState<GeminiOutcome | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mergeTarget = useMemo(
    () => data.subjects.find((subject) => subject.id === mergeTargetId) ?? null,
    [data.subjects, mergeTargetId],
  );

  const findByName = (name: string): Subject | undefined => {
    const key = normalizeName(name);
    return key ? data.subjects.find((s) => normalizeName(s.name) === key) : undefined;
  };

  // The subject whose name this draft collides with, when we aren't already
  // merging into it. That's an offer to merge, not a dead end. Cheap enough to
  // derive on every render.
  const collision = draft && !mergeTargetId ? (findByName(draft.name) ?? null) : null;

  const validation = useMemo(() => {
    if (!draft) return null;
    // A re-import is expected to reuse its target's name, so that one name
    // doesn't count as a collision.
    const otherNames = data.subjects
      .filter((subject) => subject.id !== mergeTargetId)
      .map((subject) => subject.name);
    return validateDraft(draft, otherNames);
  }, [draft, data.subjects, mergeTargetId]);

  /** Sends a parsed subject to the review step, as a fresh import or a merge. */
  const openReview = (subject: ParsedSubject) => {
    const existing = findByName(subject.name);
    if (existing) {
      setMergeTargetId(existing.id);
      setDraft(toMergeDraft(existing, subject));
    } else {
      setMergeTargetId(null);
      setDraft(toDraft(subject));
    }
    setStep("review");
  };

  const handleParse = async () => {
    const result = parseRoadmap(rawText);
    setParseResult(result);

    // The local parser is always run first, and its result is what's shown
    // unless Gemini manages to do better. Gemini is only worth the round trip
    // when the local read came out doubtful.
    if (!result.ambiguous || !geminiApiKey) {
      setGeminiOutcome(null);
      openReview(result.subject);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStep("thinking");

    const gemini = await structureRoadmap(rawText, geminiApiKey, controller.signal);
    abortRef.current = null;

    if (gemini.ok) {
      setGeminiOutcome({ used: true });
      openReview(gemini.subject);
      return;
    }
    // Every failure — offline, bad key, rate limit, a response that didn't
    // match the schema — lands on the local parser's best effort, with a note.
    setGeminiOutcome(
      gemini.reason === "cancelled" ? null : { used: false, message: gemini.message },
    );
    openReview(result.subject);
  };

  const handleCancelThinking = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  /** Turns an in-progress fresh import into a re-import of the named subject. */
  const handleMergeInstead = (target: Subject) => {
    if (!draft) return;
    setMergeTargetId(target.id);
    setDraft(toMergeDraft(target, fromDraft(draft)));
  };

  const handleBackToText = () => {
    // The merge target and the Gemini outcome both came from the pasted text,
    // so re-parsing decides them again rather than carrying stale ones forward.
    setMergeTargetId(null);
    setGeminiOutcome(null);
    setStep("paste");
  };

  const handleSave = () => {
    if (!draft || !validation || validation.errors.length > 0) return;

    if (mergeTarget) {
      const merged = applyMergeDraft(mergeTarget, draft, rawText);
      updateSubject(merged);
      onSaved(merged.id);
    } else {
      const subject = subjectFromParsed(fromDraft(draft), rawText);
      addSubject(subject);
      onSaved(subject.id);
    }
    onClose();
  };

  const title =
    step === "paste"
      ? "Import a roadmap"
      : step === "thinking"
        ? "Asking Gemini"
        : mergeTarget
          ? "Review the update"
          : "Review before saving";

  const subtitle =
    step === "paste"
      ? "Paste a roadmap in Markdown or plain text. Nothing is saved until you've reviewed how it was read."
      : step === "thinking"
        ? "This roadmap didn't have a structure the local parser could read with confidence."
        : "Rename, delete, merge or add anything before this is saved.";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 id="import-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "paste" ? (
            <PasteStep value={rawText} onChange={setRawText} hasGeminiKey={geminiApiKey !== ""} />
          ) : step === "thinking" ? (
            <ThinkingStep />
          ) : (
            draft &&
            parseResult && (
              <ReviewStep
                draft={draft}
                onChange={setDraft}
                parseResult={parseResult}
                mergeTarget={mergeTarget}
                geminiOutcome={geminiOutcome}
                collision={collision}
                onMergeInstead={handleMergeInstead}
                errors={validation?.errors ?? []}
                warnings={validation?.warnings ?? []}
              />
            )
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          {step === "review" && (
            <button
              type="button"
              onClick={handleBackToText}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ← Back to text
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {step !== "thinking" && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            {step === "thinking" ? (
              <button
                type="button"
                onClick={handleCancelThinking}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Skip Gemini
              </button>
            ) : step === "paste" ? (
              <button
                type="button"
                disabled={rawText.trim() === ""}
                onClick={handleParse}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Parse roadmap
              </button>
            ) : (
              <button
                type="button"
                disabled={(validation?.errors.length ?? 1) > 0}
                onClick={handleSave}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {mergeTarget ? "Save changes" : "Save subject"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function ThinkingStep() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-600">
        Asking {GEMINI_MODEL} to structure it instead…
      </p>
      <p className="max-w-sm text-xs text-slate-500">
        Skip to review the local parser's best effort straight away. Nothing is saved
        either way.
      </p>
    </div>
  );
}

function PasteStep({
  value,
  onChange,
  hasGeminiKey,
}: {
  value: string;
  onChange: (value: string) => void;
  hasGeminiKey: boolean;
}) {
  return (
    <div>
      <label htmlFor="roadmap-text" className="sr-only">
        Roadmap text
      </label>
      <textarea
        id="roadmap-text"
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder={"# Subject\n\n## First topic\n- A subtopic\n- Another subtopic\n\n## Second topic\n- ..."}
        className="h-80 w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
      />
      <p className="mt-2 text-xs text-slate-500">
        Headings, bullet lists and numbered lists are all understood. Indentation makes
        something a subtopic. Pasting an updated roadmap for a subject you already have
        updates it in place, keeping your progress.
      </p>
      {hasGeminiKey && (
        <p className="mt-1 text-xs text-slate-500">
          If the structure isn't clear enough to read locally, Gemini will be asked to
          structure it.
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  draft,
  onChange,
  parseResult,
  mergeTarget,
  geminiOutcome,
  collision,
  onMergeInstead,
  errors,
  warnings,
}: {
  draft: DraftSubject;
  onChange: (draft: DraftSubject) => void;
  parseResult: ParseResult;
  mergeTarget: Subject | null;
  geminiOutcome: GeminiOutcome | null;
  collision: Subject | null;
  onMergeInstead: (target: Subject) => void;
  errors: DraftError[];
  warnings: string[];
}) {
  return (
    <div className="space-y-4">
      {mergeTarget && (
        <MergeSummaryPanel
          draft={draft}
          onChange={onChange}
          existingName={mergeTarget.name}
        />
      )}

      {geminiOutcome?.used && (
        <Notice tone="slate" title={null}>
          Structured by {GEMINI_MODEL}, because the local parser couldn't read this
          roadmap's structure with confidence. Check it over before saving.
        </Notice>
      )}

      {geminiOutcome && !geminiOutcome.used && (
        <Notice tone="amber" title="Gemini couldn't be used">
          <p>{geminiOutcome.message}</p>
          <p className="mt-1">Showing the local parser's best effort instead.</p>
        </Notice>
      )}

      {/* The local parser's caveats only apply when its result is the one shown. */}
      {!geminiOutcome?.used && parseResult.ambiguous && (
        <Notice tone="amber" title="This roadmap was hard to read">
          <ul className="list-inside list-disc">
            {parseResult.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-1">Check the structure below carefully before saving.</p>
        </Notice>
      )}

      {!geminiOutcome?.used && parseResult.ignoredCount > 0 && (
        <Notice tone="slate" title={null}>
          {parseResult.ignoredCount}{" "}
          {parseResult.ignoredCount === 1 ? "line was" : "lines were"} left out — code
          blocks, commentary, or detail nested deeper than a subtopic.
        </Notice>
      )}

      {errors.map((error) => (
        <Notice key={error.code} tone="red" title={null}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1">{error.message}</span>
            {error.code === "duplicate-name" && collision && (
              <button
                type="button"
                onClick={() => onMergeInstead(collision)}
                className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
              >
                Merge into it instead
              </button>
            )}
          </div>
        </Notice>
      ))}

      {warnings.map((warning) => (
        <Notice key={warning} tone="amber" title={null}>
          {warning}
        </Notice>
      ))}

      <DraftTreeEditor draft={draft} onChange={onChange} showOrigins={mergeTarget !== null} />
    </div>
  );
}

const NOTICE_TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-800",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

function Notice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  title: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${NOTICE_TONES[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
  );
}
