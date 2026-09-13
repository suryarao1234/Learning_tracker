import {
  addSubtopic,
  addTopic,
  deleteSubtopic,
  deleteTopic,
  draftCounts,
  mergeTopicIntoPrevious,
  renameSubtopic,
  renameTopic,
  setSubjectName,
  type DraftSubject,
  type DraftSubtopic,
  type DraftTopic,
} from "../lib/draft";
import { setSubtopicKeep, setTopicKeep } from "../lib/merge";
import type { SubtopicStatus } from "../types";

type DraftTreeEditorProps = {
  draft: DraftSubject;
  onChange: (draft: DraftSubject) => void;
  /**
   * Re-import mode: tag each row with the bucket it fell into, and offer a
   * keep-or-drop choice on the rows the new roadmap no longer mentions.
   */
  showOrigins?: boolean;
  subjectPlaceholder?: string;
};

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";

const ICON_BUTTON_CLASS =
  "shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

const STATUS_CHIP: Record<SubtopicStatus, { label: string; className: string } | null> = {
  "not-started": null,
  "in-progress": { label: "In progress", className: "bg-amber-100 text-amber-800" },
  done: { label: "Done", className: "bg-emerald-100 text-emerald-800" },
};

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}

/** The badge for one row: what bucket it's in, or what progress it carries. */
function RowBadge({ node }: { node: DraftTopic | DraftSubtopic }) {
  if (node.origin === "new") {
    return <Chip label="New" className="bg-emerald-100 text-emerald-800" />;
  }
  if (node.origin === "removed") {
    return <Chip label="Not in new roadmap" className="bg-amber-100 text-amber-900" />;
  }
  const status = node.status ? STATUS_CHIP[node.status] : null;
  return status ? <Chip label={status.label} className={status.className} /> : null;
}

function isDropped(node: DraftTopic | DraftSubtopic): boolean {
  return node.origin === "removed" && node.keep === false;
}

export function DraftTreeEditor({
  draft,
  onChange,
  showOrigins = false,
  subjectPlaceholder = "e.g. TypeScript",
}: DraftTreeEditorProps) {
  const counts = draftCounts(draft);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="draft-subject-name" className="block text-sm font-medium text-slate-700">
          Subject name
        </label>
        <input
          id="draft-subject-name"
          className={`${INPUT_CLASS} mt-1`}
          value={draft.name}
          placeholder={subjectPlaceholder}
          onChange={(event) => onChange(setSubjectName(draft, event.target.value))}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Topics{" "}
          <span className="font-normal text-slate-500">
            ({counts.topics} topics, {counts.subtopics} subtopics)
          </span>
        </h3>
        <button
          type="button"
          onClick={() => onChange(addTopic(draft))}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          + Add topic
        </button>
      </div>

      {draft.topics.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          No topics yet. Add one, or go back and paste a roadmap with more structure.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.topics.map((topic, index) => {
            const dropped = isDropped(topic);
            return (
              <li
                key={topic.key}
                className={`rounded-lg border p-3 ${
                  dropped
                    ? "border-slate-200 bg-slate-100 opacity-60"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    className={`${INPUT_CLASS} min-w-40 flex-1 ${
                      dropped ? "line-through" : ""
                    }`}
                    value={topic.name}
                    placeholder="Topic name"
                    aria-label={`Topic ${index + 1} name`}
                    onChange={(event) =>
                      onChange(renameTopic(draft, topic.key, event.target.value))
                    }
                  />
                  {showOrigins && <RowBadge node={topic} />}
                  {topic.origin === "removed" ? (
                    <KeepButton
                      keep={topic.keep !== false}
                      onClick={() =>
                        onChange(setTopicKeep(draft, topic.key, topic.keep === false))
                      }
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={index === 0}
                        title={
                          index === 0
                            ? "Nothing above this topic to merge into"
                            : "Fold this topic into the one above it"
                        }
                        onClick={() => onChange(mergeTopicIntoPrevious(draft, topic.key))}
                        className={ICON_BUTTON_CLASS}
                      >
                        Merge up
                      </button>
                      <button
                        type="button"
                        title="Delete this topic and its subtopics"
                        onClick={() => onChange(deleteTopic(draft, topic.key))}
                        className={`${ICON_BUTTON_CLASS} hover:text-red-700`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3">
                  {topic.subtopics.map((subtopic, subIndex) => {
                    const subDropped = isDropped(subtopic);
                    return (
                      <li
                        key={subtopic.key}
                        className={`flex flex-wrap items-center gap-1 ${
                          subDropped ? "opacity-60" : ""
                        }`}
                      >
                        <input
                          className={`${INPUT_CLASS} min-w-40 flex-1 ${
                            subDropped ? "line-through" : ""
                          }`}
                          value={subtopic.name}
                          placeholder="Subtopic name"
                          aria-label={`Subtopic ${subIndex + 1} of ${
                            topic.name || `topic ${index + 1}`
                          }`}
                          onChange={(event) =>
                            onChange(
                              renameSubtopic(
                                draft,
                                topic.key,
                                subtopic.key,
                                event.target.value,
                              ),
                            )
                          }
                        />
                        {showOrigins && <RowBadge node={subtopic} />}
                        {subtopic.origin === "removed" ? (
                          <KeepButton
                            keep={subtopic.keep !== false}
                            onClick={() =>
                              onChange(
                                setSubtopicKeep(
                                  draft,
                                  topic.key,
                                  subtopic.key,
                                  subtopic.keep === false,
                                ),
                              )
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            title="Delete this subtopic"
                            onClick={() =>
                              onChange(deleteSubtopic(draft, topic.key, subtopic.key))
                            }
                            className={`${ICON_BUTTON_CLASS} hover:text-red-700`}
                          >
                            Delete
                          </button>
                        )}
                      </li>
                    );
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={() => onChange(addSubtopic(draft, topic.key))}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      + Add subtopic
                    </button>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The keep-or-drop choice on a row the new roadmap no longer mentions. It
 * stays reversible for the whole review, unlike an outright delete.
 */
function KeepButton({ keep, onClick }: { keep: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        keep
          ? "Drop this on save — it's gone from the new roadmap"
          : "Keep this after all"
      }
      className={`${ICON_BUTTON_CLASS} ${keep ? "hover:text-red-700" : "text-slate-700"}`}
    >
      {keep ? "Drop" : "Undo drop"}
    </button>
  );
}
