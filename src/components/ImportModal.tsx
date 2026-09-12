import { useMemo, useState } from "react";
import { fromDraft, toDraft, validateDraft, type DraftSubject } from "../lib/draft";
import { parseRoadmap, type ParseResult } from "../lib/parseRoadmap";
import { subjectFromParsed } from "../lib/subject";
import { useLearningData } from "../state/useLearningData";
import { DraftTreeEditor } from "./DraftTreeEditor";

type ImportModalProps = {
  onClose: () => void;
  onSaved: (subjectId: string) => void;
};

type Step = "paste" | "review";

/**
 * Mounted only while an import is in progress — the caller renders it
 * conditionally rather than passing an `open` flag. That way a cancelled
 * import can't leave its half-edited tree waiting for the next one, without
 * needing an effect to clear it.
 */
export function ImportModal({ onClose, onSaved }: ImportModalProps) {
  const { data, addSubject } = useLearningData();
  const [step, setStep] = useState<Step>("paste");
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [draft, setDraft] = useState<DraftSubject | null>(null);

  const existingNames = useMemo(
    () => data.subjects.map((subject) => subject.name),
    [data.subjects],
  );
  const validation = useMemo(
    () => (draft ? validateDraft(draft, existingNames) : null),
    [draft, existingNames],
  );

  const handleParse = () => {
    const result = parseRoadmap(rawText);
    setParseResult(result);
    setDraft(toDraft(result.subject));
    setStep("review");
  };

  const handleSave = () => {
    if (!draft || !validation || validation.errors.length > 0) return;
    const subject = subjectFromParsed(fromDraft(draft), rawText);
    addSubject(subject);
    onSaved(subject.id);
    onClose();
  };

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
            {step === "paste" ? "Import a roadmap" : "Review before saving"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === "paste"
              ? "Paste a roadmap in Markdown or plain text. Nothing is saved until you've reviewed how it was read."
              : "Rename, delete, merge or add anything before this becomes a subject."}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "paste" ? (
            <PasteStep value={rawText} onChange={setRawText} />
          ) : (
            draft &&
            parseResult && (
              <ReviewStep
                draft={draft}
                onChange={setDraft}
                parseResult={parseResult}
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
              onClick={() => setStep("paste")}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ← Back to text
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            {step === "paste" ? (
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
                Save subject
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function PasteStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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
        something a subtopic.
      </p>
    </div>
  );
}

function ReviewStep({
  draft,
  onChange,
  parseResult,
  errors,
  warnings,
}: {
  draft: DraftSubject;
  onChange: (draft: DraftSubject) => void;
  parseResult: ParseResult;
  errors: string[];
  warnings: string[];
}) {
  return (
    <div className="space-y-4">
      {parseResult.ambiguous && (
        <Notice tone="amber" title="This roadmap was hard to read">
          <ul className="list-inside list-disc">
            {parseResult.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-1">Check the structure below carefully before saving.</p>
        </Notice>
      )}

      {parseResult.ignoredCount > 0 && (
        <Notice tone="slate" title={null}>
          {parseResult.ignoredCount}{" "}
          {parseResult.ignoredCount === 1 ? "line was" : "lines were"} left out — code
          blocks, commentary, or detail nested deeper than a subtopic.
        </Notice>
      )}

      {errors.map((error) => (
        <Notice key={error} tone="red" title={null}>
          {error}
        </Notice>
      ))}

      {warnings.map((warning) => (
        <Notice key={warning} tone="amber" title={null}>
          {warning}
        </Notice>
      ))}

      <DraftTreeEditor draft={draft} onChange={onChange} />
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
