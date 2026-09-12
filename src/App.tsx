import { useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ProgressBar } from "./components/ProgressBar";
import { overallProgress, subjectProgress, topicProgress } from "./lib/progress";
import { LearningDataProvider } from "./state/LearningDataProvider";
import { useLearningData } from "./state/useLearningData";
import type { Subject, SubtopicStatus } from "./types";

const STATUS_LABEL: Record<SubtopicStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  done: "Done",
};

const STATUS_STYLE: Record<SubtopicStatus, string> = {
  "not-started": "bg-slate-100 text-slate-600",
  "in-progress": "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

function StorageErrorBanner() {
  const { storageError, dismissError } = useLearningData();
  if (!storageError) return null;
  return (
    <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
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

function TopBar() {
  const { data } = useLearningData();
  const progress = overallProgress(data.subjects);
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="text-base font-semibold text-slate-900">Learning Tracker</h1>
      <div className="ml-auto flex w-64 items-center gap-3">
        <ProgressBar percent={progress.percent} />
        <span className="shrink-0 text-sm tabular-nums text-slate-600">
          {progress.percent}%{" "}
          <span className="text-slate-400">
            ({progress.done}/{progress.total})
          </span>
        </span>
      </div>
    </header>
  );
}

function Sidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data, loadSample, resetAll } = useLearningData();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          disabled
          title="Coming in the import milestone"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          + Import roadmap
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {data.subjects.length === 0 ? (
          <p className="px-2 py-4 text-sm text-slate-500">
            No subjects yet. Load the sample data to check that persistence works.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.subjects.map((subject) => {
              const progress = subjectProgress(subject);
              const selected = subject.id === selectedId;
              return (
                <li key={subject.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(subject.id)}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selected ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">
                        {subject.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">
                        {progress.percent}%
                      </span>
                    </span>
                    <ProgressBar percent={progress.percent} className="mt-1.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={loadSample}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Load sample data
        </button>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="w-full rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
        >
          Reset all data
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        message="Every subject, topic and status you've tracked will be permanently deleted from this browser. This can't be undone."
        confirmLabel="Delete everything"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
        }}
      />
    </aside>
  );
}

function SubjectPanel({ subject }: { subject: Subject | null }) {
  if (!subject) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-500">Select a subject to see its topics.</p>
      </main>
    );
  }

  const progress = subjectProgress(subject);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{subject.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {progress.done} of {progress.total} subtopics done · {progress.percent}%
        </p>
        <ProgressBar percent={progress.percent} className="mt-2 max-w-md" />
      </div>

      <ul className="space-y-4">
        {subject.topics.map((topic) => {
          const topicDone = topicProgress(topic);
          return (
            <li key={topic.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium text-slate-900">{topic.name}</h3>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {topicDone.done}/{topicDone.total}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {topic.subtopics.map((subtopic) => (
                  <li key={subtopic.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 text-slate-700">{subtopic.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[subtopic.status]
                      }`}
                    >
                      {STATUS_LABEL[subtopic.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function Workspace() {
  const { data } = useLearningData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derived rather than stored, so a selection that no longer exists (after a
  // reset, or after loading the sample data) falls back to the first subject
  // without a render-triggering effect.
  const selected =
    data.subjects.find((s) => s.id === selectedId) ?? data.subjects[0] ?? null;

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <StorageErrorBanner />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        <SubjectPanel subject={selected} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LearningDataProvider>
      <Workspace />
    </LearningDataProvider>
  );
}
