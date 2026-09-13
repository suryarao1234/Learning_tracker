import { useState } from "react";
import type { Accent } from "../lib/accent";
import { topicProgress } from "../lib/progress";
import type { SubtopicStatus, Topic } from "../types";
import { ProgressBar } from "./ProgressBar";
import { StatusToggle } from "./StatusToggle";

type TopicCardProps = {
  topic: Topic;
  accent: Accent;
  onStatusChange: (subtopicId: string, status: SubtopicStatus) => void;
};

export function TopicCard({ topic, accent, onStatusChange }: TopicCardProps) {
  const [expanded, setExpanded] = useState(true);
  const progress = topicProgress(topic);
  const panelId = `topic-panel-${topic.id}`;
  const complete = progress.total > 0 && progress.percent === 100;

  return (
    <li className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-line">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-canvas"
      >
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-transform ${
            accent.soft
          } ${expanded ? "rotate-90" : ""}`}
        >
          <svg viewBox="0 0 12 12" className={`h-3 w-3 ${accent.text}`} fill="none">
            <path
              d="M4.5 2 8.5 6l-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-ink">{topic.name}</span>
          <span className="mt-1 flex items-center gap-2">
            <ProgressBar
              percent={progress.percent}
              inProgressPercent={progress.inProgressPercent}
              className="max-w-40"
            />
            <span className="shrink-0 text-xs font-bold tabular-nums text-ink-mute">
              {progress.done}/{progress.total}
            </span>
          </span>
        </span>

        {complete && (
          <span className="shrink-0 rounded-full bg-done-soft px-2.5 py-1 text-[11px] font-bold text-done-ink">
            Done
          </span>
        )}
      </button>

      {expanded && (
        <ul id={panelId} className="border-t border-line px-3 py-1.5">
          {topic.subtopics.length === 0 ? (
            <li className="px-1 py-3 text-sm text-ink-mute">No subtopics.</li>
          ) : (
            topic.subtopics.map((subtopic) => (
              <li
                key={subtopic.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-1 py-2 transition hover:bg-canvas"
              >
                <span
                  className={`min-w-0 flex-1 text-sm font-semibold ${
                    subtopic.status === "done"
                      ? "text-ink-mute line-through"
                      : "text-ink-soft"
                  }`}
                >
                  {subtopic.name}
                </span>
                <StatusToggle
                  value={subtopic.status}
                  label={subtopic.name}
                  onChange={(status) => onStatusChange(subtopic.id, status)}
                />
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}
