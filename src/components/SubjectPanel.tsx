import { subjectProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import type { Subject, SubtopicStatus } from "../types";
import { ProgressBar } from "./ProgressBar";
import { TopicCard } from "./TopicCard";

type SubjectPanelProps = {
  subject: Subject | null;
  onImport: () => void;
};

export function SubjectPanel({ subject, onImport }: SubjectPanelProps) {
  const { setSubtopicStatus } = useLearningData();

  if (!subject) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="max-w-sm text-center text-sm text-slate-500">
          Paste an AI-generated learning roadmap and track your way through it.
        </p>
        <button
          type="button"
          onClick={onImport}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Import a roadmap
        </button>
      </main>
    );
  }

  const progress = subjectProgress(subject);

  const handleStatusChange = (
    topicId: string,
    subtopicId: string,
    status: SubtopicStatus,
  ) => setSubtopicStatus(subject.id, topicId, subtopicId, status);

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">{subject.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {progress.done} of {progress.total} subtopics done
          {progress.inProgress > 0 && `, ${progress.inProgress} in progress`} ·{" "}
          {progress.percent}%
        </p>
        <ProgressBar
          percent={progress.percent}
          inProgressPercent={progress.inProgressPercent}
          className="mt-2 max-w-md"
        />
      </header>

      {subject.topics.length === 0 ? (
        <p className="text-sm text-slate-500">This subject has no topics.</p>
      ) : (
        <ul className="space-y-3">
          {subject.topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onStatusChange={(subtopicId, status) =>
                handleStatusChange(topic.id, subtopicId, status)
              }
            />
          ))}
        </ul>
      )}
    </main>
  );
}
