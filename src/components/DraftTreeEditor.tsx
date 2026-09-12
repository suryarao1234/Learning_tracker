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
} from "../lib/draft";

type DraftTreeEditorProps = {
  draft: DraftSubject;
  onChange: (draft: DraftSubject) => void;
  /** Shown as the subject field's placeholder when the parser found no name. */
  subjectPlaceholder?: string;
};

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";

const ICON_BUTTON_CLASS =
  "shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function DraftTreeEditor({
  draft,
  onChange,
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
          {draft.topics.map((topic, index) => (
            <li key={topic.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-1">
                <input
                  className={INPUT_CLASS}
                  value={topic.name}
                  placeholder="Topic name"
                  aria-label={`Topic ${index + 1} name`}
                  onChange={(event) =>
                    onChange(renameTopic(draft, topic.key, event.target.value))
                  }
                />
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
              </div>

              <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3">
                {topic.subtopics.map((subtopic, subIndex) => (
                  <li key={subtopic.key} className="flex items-center gap-1">
                    <input
                      className={INPUT_CLASS}
                      value={subtopic.name}
                      placeholder="Subtopic name"
                      aria-label={`Subtopic ${subIndex + 1} of ${topic.name || `topic ${index + 1}`}`}
                      onChange={(event) =>
                        onChange(
                          renameSubtopic(draft, topic.key, subtopic.key, event.target.value),
                        )
                      }
                    />
                    <button
                      type="button"
                      title="Delete this subtopic"
                      onClick={() => onChange(deleteSubtopic(draft, topic.key, subtopic.key))}
                      className={`${ICON_BUTTON_CLASS} hover:text-red-700`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
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
          ))}
        </ul>
      )}
    </div>
  );
}
