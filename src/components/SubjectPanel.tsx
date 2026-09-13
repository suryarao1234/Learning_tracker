import { useState } from "react";
import { accentFor, avatarStyle, initialOf } from "../lib/accent";
import { subjectProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import type { Subject, SubtopicStatus } from "../types";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";
import { TopicCard } from "./TopicCard";

type SubjectPanelProps = {
  subject: Subject;
  onBack: () => void;
};

type Filter = "all" | "in-progress" | "not-started" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In progress" },
  { value: "not-started", label: "Not started" },
  { value: "done", label: "Done" },
];

export function SubjectPanel({ subject, onBack }: SubjectPanelProps) {
  const { setSubtopicStatus } = useLearningData();
  const [filter, setFilter] = useState<Filter>("all");

  const progress = subjectProgress(subject);
  const accent = accentFor(subject.id);

  // Filtering hides subtopics, not topics — a topic with nothing matching is
  // dropped rather than shown as an empty shell.
  const topics =
    filter === "all"
      ? subject.topics
      : subject.topics
          .map((topic) => ({
            ...topic,
            subtopics: topic.subtopics.filter((s) => s.status === filter),
          }))
          .filter((topic) => topic.subtopics.length > 0);

  const handleStatusChange = (
    topicId: string,
    subtopicId: string,
    status: SubtopicStatus,
  ) => setSubtopicStatus(subject.id, topicId, subtopicId, status);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft transition hover:text-ink"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M10 3.5 5.5 8l4.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Overview
      </button>

      <section className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <span
            aria-hidden="true"
            style={avatarStyle(accent)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold"
          >
            {initialOf(subject.name)}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              {subject.name}
            </h2>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              {subject.topics.length} {subject.topics.length === 1 ? "topic" : "topics"} ·{" "}
              {progress.done} of {progress.total} subtopics done
              {progress.inProgress > 0 && ` · ${progress.inProgress} in progress`}
            </p>
            <div className="mt-3 flex max-w-md items-center gap-3">
              <ProgressBar
                percent={progress.percent}
                inProgressPercent={progress.inProgressPercent}
                size="md"
              />
              <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                {progress.percent}%
              </span>
            </div>
          </div>

          <ProgressRing
            percent={progress.percent}
            inProgressPercent={progress.inProgressPercent}
            label={`${progress.percent}%`}
            caption="done"
            size={84}
          />
        </div>
      </section>

      {subject.topics.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-ink-soft shadow-sm ring-1 ring-line">
          This subject has no topics yet.
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Filter subtopics by status"
            className="flex flex-wrap gap-1.5"
          >
            {FILTERS.map((option) => {
              const active = option.value === filter;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? "bg-ink text-white"
                      : "bg-card text-ink-soft ring-1 ring-line hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {topics.length === 0 ? (
            <p className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-ink-soft shadow-sm ring-1 ring-line">
              Nothing here with that status.
            </p>
          ) : (
            <ul className="space-y-3">
              {topics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  accent={accent}
                  onStatusChange={(subtopicId, status) =>
                    handleStatusChange(topic.id, subtopicId, status)
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
