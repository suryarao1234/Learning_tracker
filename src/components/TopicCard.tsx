import { useState } from "react";
import { topicProgress } from "../lib/progress";
import type { SubtopicStatus, Topic } from "../types";
import { ProgressBar } from "./ProgressBar";
import { StatusToggle } from "./StatusToggle";

type TopicCardProps = {
  topic: Topic;
  onStatusChange: (subtopicId: string, status: SubtopicStatus) => void;
};

export function TopicCard({ topic, onStatusChange }: TopicCardProps) {
  const [expanded, setExpanded] = useState(true);
  const progress = topicProgress(topic);
  const panelId = `topic-panel-${topic.id}`;

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <Chevron expanded={expanded} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{topic.name}</span>
        </span>
        <span className="hidden w-32 shrink-0 sm:block">
          <ProgressBar
            percent={progress.percent}
            inProgressPercent={progress.inProgressPercent}
          />
        </span>
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">
          {progress.done}/{progress.total}
        </span>
      </button>

      {expanded && (
        <ul id={panelId} className="border-t border-slate-100 px-4 py-2">
          {topic.subtopics.length === 0 ? (
            <li className="py-2 text-sm text-slate-400">No subtopics.</li>
          ) : (
            topic.subtopics.map((subtopic) => (
              <li
                key={subtopic.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
              >
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    subtopic.status === "done"
                      ? "text-slate-400 line-through"
                      : "text-slate-700"
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

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
    >
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
