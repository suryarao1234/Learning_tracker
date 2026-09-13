import { useRef, useState } from "react";
import {
  countContents,
  downloadBackup,
  mergeBackup,
  parseBackup,
  type BackupCounts,
} from "../lib/backup";
import { GEMINI_MODEL } from "../lib/gemini";
import { useLearningData } from "../state/useLearningData";
import type { LearningData } from "../types";
import { BackupImportDialog } from "./BackupImportDialog";
import { ConfirmDialog } from "./ConfirmDialog";

/** A validated backup, waiting for the user to say replace or merge. */
type PendingBackup = { data: LearningData; counts: BackupCounts; warning?: string };

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data, setData, geminiApiKey, setGeminiApiKey, loadSample, resetAll } =
    useLearningData();
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "sample" | null>(null);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasData = data.subjects.length > 0;

  const dirty = keyInput.trim() !== geminiApiKey.trim();

  const handleSave = () => {
    setGeminiApiKey(keyInput);
    setSaved(true);
  };

  const handleFileChosen = async (file: File | undefined) => {
    // Reset the input first, so picking the same file twice still fires.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setBackupError(null);
    setBackupNotice(null);

    let text: string;
    try {
      text = await file.text();
    } catch {
      setBackupError("That file couldn't be read.");
      return;
    }

    const result = parseBackup(text);
    if (!result.ok) {
      setBackupError(result.message);
      return;
    }
    setPending({ data: result.data, counts: result.counts, warning: result.warning });
  };

  const handleReplace = () => {
    if (!pending) return;
    setData(pending.data);
    const counts = countContents(pending.data);
    setBackupNotice(
      `Replaced everything with the backup — ${counts.subjects} ${
        counts.subjects === 1 ? "subject" : "subjects"
      } restored.`,
    );
    setPending(null);
  };

  const handleMerge = () => {
    if (!pending) return;
    const result = mergeBackup(data, pending.data);
    setData(result.data);
    setBackupNotice(
      result.skipped.length === 0
        ? `Added ${result.added} ${result.added === 1 ? "subject" : "subjects"} from the backup.`
        : `Added ${result.added} ${
            result.added === 1 ? "subject" : "subjects"
          }. Left out ${result.skipped.length} already here: ${result.skipped.join(", ")}.`,
    );
    setPending(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl bg-card shadow-2xl">
        <header className="border-b border-line px-5 py-4">
          <h2 id="settings-title" className="text-lg font-semibold text-ink">
            Settings
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-sm font-bold text-ink">Gemini API key</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Optional. When a pasted roadmap has no structure the local parser can read,
              Gemini is asked to structure it instead. Requests go to{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">{GEMINI_MODEL}</code>.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type={revealed ? "text" : "password"}
                value={keyInput}
                onChange={(event) => {
                  setKeyInput(event.target.value);
                  setSaved(false);
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your key"
                aria-label="Gemini API key"
                className="w-full rounded-xl border border-line px-2 py-1.5 font-mono text-sm text-ink focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                className="shrink-0 rounded-xl border border-line px-2 py-1.5 text-xs font-bold text-ink-soft hover:bg-canvas"
              >
                {revealed ? "Hide" : "Show"}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty}
                className="rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-ink disabled:cursor-not-allowed disabled:bg-ink-mute/40"
              >
                Save key
              </button>
              {geminiApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyInput("");
                    setGeminiApiKey("");
                    setSaved(false);
                  }}
                  className="rounded-xl border border-line px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-canvas"
                >
                  Remove key
                </button>
              )}
              {saved && !dirty && (
                <span role="status" className="text-sm font-bold text-done-ink">
                  Saved.
                </span>
              )}
            </div>

            {/*
              Deliberately always visible, not a dismissible tooltip: this is a
              real limitation of a frontend-only app, not a nicety.
            */}
            <p className="mt-3 rounded-xl border border-doing/25 bg-doing-soft px-3 py-2 text-sm font-semibold text-doing-ink">
              Your key is stored only in this browser's local storage and is sent directly
              to Google's API. Don't use this on a shared computer.
            </p>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="text-sm font-bold text-ink">Backup</h3>
            <p className="mt-1 text-sm text-ink-soft">
              A backup file holds your subjects and progress. It never contains your API
              key.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!hasData}
                onClick={() => downloadBackup(data)}
                className="rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-mute disabled:hover:bg-white"
              >
                Export backup
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas"
              >
                Import backup…
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Backup file"
                onChange={(event) => void handleFileChosen(event.target.files?.[0])}
              />
            </div>

            {backupError && (
              <p
                role="status"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {backupError}
              </p>
            )}
            {backupNotice && (
              <p
                role="status"
                className="mt-3 rounded-xl border border-done/25 bg-done-soft px-3 py-2 text-sm font-semibold text-done-ink"
              >
                {backupNotice}
              </p>
            )}
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="text-sm font-bold text-ink">Your data</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Everything lives in this browser. Clearing site data clears the tracker.
            </p>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => (hasData ? setConfirm("sample") : loadSample())}
                className="w-full rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas"
              >
                Load sample data
              </button>
              <button
                type="button"
                disabled={!hasData}
                onClick={() => setConfirm("reset")}
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-mute disabled:hover:bg-white"
              >
                Reset all data
              </button>
            </div>
          </section>
        </div>

        <footer className="flex justify-end border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-canvas"
          >
            Close
          </button>
        </footer>
      </div>

      {pending && (
        <BackupImportDialog
          counts={pending.counts}
          warning={pending.warning}
          current={data}
          onReplace={handleReplace}
          onMerge={handleMerge}
          onCancel={() => setPending(null)}
        />
      )}

      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset all data?"
        message="Every subject, topic and status you've tracked will be permanently deleted from this browser. This can't be undone."
        confirmLabel="Delete everything"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          resetAll();
          setConfirm(null);
        }}
      />

      <ConfirmDialog
        open={confirm === "sample"}
        title="Replace everything with the sample?"
        message="Loading the sample subject discards the subjects you already have, along with their progress."
        confirmLabel="Load the sample"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          loadSample();
          setConfirm(null);
        }}
      />
    </div>
  );
}
