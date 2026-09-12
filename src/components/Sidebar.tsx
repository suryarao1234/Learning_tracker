import { useState } from "react";
import { subjectProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressBar } from "./ProgressBar";

type SidebarProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  /** Whether the narrow-screen drawer is showing. Ignored from `sm` up. */
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ selectedId, onSelect, onImport, open, onClose }: SidebarProps) {
  const { data, loadSample, resetAll } = useLearningData();
  const [confirm, setConfirm] = useState<"reset" | "sample" | null>(null);
  const hasData = data.subjects.length > 0;

  // Below `sm` there isn't room for a permanent sidebar beside the tracker, so
  // it becomes a drawer over it. From `sm` up it's an ordinary column again.
  return (
    <>
      {open && (
        <div
          className="absolute inset-0 z-20 bg-slate-900/40 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${
          open ? "flex" : "hidden"
        } absolute inset-y-0 left-0 z-30 w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50 shadow-lg sm:static sm:z-auto sm:flex sm:w-64 sm:shadow-none`}
      >
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            onImport();
          }}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Import roadmap
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {!hasData ? (
          <p className="px-2 py-4 text-sm text-slate-500">
            No subjects yet. Import a roadmap to get started.
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
                    onClick={() => {
                      onSelect(subject.id);
                      onClose();
                    }}
                    aria-current={selected ? "true" : undefined}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selected
                        ? "bg-white shadow-sm ring-1 ring-slate-200"
                        : "hover:bg-slate-100"
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
                    <ProgressBar
                      percent={progress.percent}
                      inProgressPercent={progress.inProgressPercent}
                      className="mt-1.5"
                    />
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
          onClick={() => (hasData ? setConfirm("sample") : loadSample())}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Load sample data
        </button>
        <button
          type="button"
          disabled={!hasData}
          onClick={() => setConfirm("reset")}
          className="w-full rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
        >
          Reset all data
        </button>
      </div>

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
      </aside>
    </>
  );
}
