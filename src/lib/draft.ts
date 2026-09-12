import type { ParsedSubject } from "../types";
import { newId } from "./id";
import { normalizeName } from "./normalize";

/**
 * The editable form of a parsed roadmap, shown for review before anything is
 * written to storage.
 *
 * Draft nodes carry a `key` that exists only for the lifetime of the review:
 * React needs a stable identity for each row so that editing one name doesn't
 * remount the inputs around it, and the parsed tree has no IDs of its own yet.
 * Real IDs are assigned on save.
 */
export type DraftSubtopic = { key: string; name: string };
export type DraftTopic = { key: string; name: string; subtopics: DraftSubtopic[] };
export type DraftSubject = { name: string; topics: DraftTopic[] };

export function toDraft(parsed: ParsedSubject): DraftSubject {
  return {
    name: parsed.name,
    topics: parsed.topics.map((topic) => ({
      key: newId("dt"),
      name: topic.name,
      subtopics: topic.subtopics.map((subtopic) => ({
        key: newId("ds"),
        name: subtopic.name,
      })),
    })),
  };
}

/** Drops the review-only keys, trims names, and discards anything left blank. */
export function fromDraft(draft: DraftSubject): ParsedSubject {
  return {
    name: draft.name.trim(),
    topics: draft.topics
      .map((topic) => ({
        name: topic.name.trim(),
        subtopics: topic.subtopics
          .map((subtopic) => ({ name: subtopic.name.trim() }))
          .filter((subtopic) => subtopic.name !== ""),
      }))
      .filter((topic) => topic.name !== ""),
  };
}

export function draftCounts(draft: DraftSubject): { topics: number; subtopics: number } {
  return {
    topics: draft.topics.length,
    subtopics: draft.topics.reduce((total, topic) => total + topic.subtopics.length, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Edit operations — all immutable, so the review UI stays a plain
 * setState(op(draft, ...)) call.
 * ------------------------------------------------------------------ */

function mapTopic(
  draft: DraftSubject,
  topicKey: string,
  fn: (topic: DraftTopic) => DraftTopic,
): DraftSubject {
  return {
    ...draft,
    topics: draft.topics.map((topic) => (topic.key === topicKey ? fn(topic) : topic)),
  };
}

export function setSubjectName(draft: DraftSubject, name: string): DraftSubject {
  return { ...draft, name };
}

export function addTopic(draft: DraftSubject): DraftSubject {
  return { ...draft, topics: [...draft.topics, { key: newId("dt"), name: "", subtopics: [] }] };
}

export function renameTopic(
  draft: DraftSubject,
  topicKey: string,
  name: string,
): DraftSubject {
  return mapTopic(draft, topicKey, (topic) => ({ ...topic, name }));
}

export function deleteTopic(draft: DraftSubject, topicKey: string): DraftSubject {
  return { ...draft, topics: draft.topics.filter((topic) => topic.key !== topicKey) };
}

/**
 * Folds a topic into the one above it: its subtopics are appended, and its own
 * name is kept as a subtopic so the wording isn't lost. A no-op on the first
 * topic, which has nothing above it.
 */
export function mergeTopicIntoPrevious(draft: DraftSubject, topicKey: string): DraftSubject {
  const index = draft.topics.findIndex((topic) => topic.key === topicKey);
  if (index <= 0) return draft;

  const previous = draft.topics[index - 1];
  const merged = draft.topics[index];
  const combined: DraftTopic = {
    ...previous,
    subtopics: [
      ...previous.subtopics,
      { key: newId("ds"), name: merged.name },
      ...merged.subtopics,
    ],
  };

  const topics = [...draft.topics];
  topics.splice(index - 1, 2, dedupeSubtopicNames(combined));
  return { ...draft, topics };
}

function dedupeSubtopicNames(topic: DraftTopic): DraftTopic {
  const seen = new Set<string>();
  return {
    ...topic,
    subtopics: topic.subtopics.filter((subtopic) => {
      const key = normalizeName(subtopic.name);
      if (!key) return true; // leave blank rows alone; the user is mid-edit
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

export function addSubtopic(draft: DraftSubject, topicKey: string): DraftSubject {
  return mapTopic(draft, topicKey, (topic) => ({
    ...topic,
    subtopics: [...topic.subtopics, { key: newId("ds"), name: "" }],
  }));
}

export function renameSubtopic(
  draft: DraftSubject,
  topicKey: string,
  subtopicKey: string,
  name: string,
): DraftSubject {
  return mapTopic(draft, topicKey, (topic) => ({
    ...topic,
    subtopics: topic.subtopics.map((subtopic) =>
      subtopic.key === subtopicKey ? { ...subtopic, name } : subtopic,
    ),
  }));
}

export function deleteSubtopic(
  draft: DraftSubject,
  topicKey: string,
  subtopicKey: string,
): DraftSubject {
  return mapTopic(draft, topicKey, (topic) => ({
    ...topic,
    subtopics: topic.subtopics.filter((subtopic) => subtopic.key !== subtopicKey),
  }));
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export type DraftValidation = {
  /** Blocking problems. Saving is disabled while any of these stand. */
  errors: string[];
  /** Worth knowing, but the user may well have meant it. */
  warnings: string[];
};

export function validateDraft(
  draft: DraftSubject,
  existingSubjectNames: string[],
): DraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cleaned = fromDraft(draft);

  if (!cleaned.name) {
    errors.push("Give the subject a name.");
  } else if (existingSubjectNames.some((name) => normalizeName(name) === normalizeName(cleaned.name))) {
    errors.push(
      `A subject called "${cleaned.name}" already exists. Rename this one for now — merging into an existing subject arrives with the re-import flow.`,
    );
  }

  if (cleaned.topics.length === 0) {
    errors.push("Add at least one topic.");
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const topic of cleaned.topics) {
    const key = normalizeName(topic.name);
    if (seen.has(key)) duplicates.add(topic.name);
    seen.add(key);
  }
  if (duplicates.size > 0) {
    warnings.push(
      `Two topics share the same name (${[...duplicates].join(", ")}). Both will be saved separately.`,
    );
  }

  const blankTopics = draft.topics.length - cleaned.topics.length;
  if (blankTopics > 0) {
    warnings.push(
      `${blankTopics} unnamed ${blankTopics === 1 ? "topic" : "topics"} will be left out.`,
    );
  }

  return { errors, warnings };
}
