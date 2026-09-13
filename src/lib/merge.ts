import type { ParsedSubject, ParsedTopic, Subject, Subtopic, Topic } from "../types";
import type { DraftSubject, DraftSubtopic, DraftTopic } from "./draft";
import { newId } from "./id";
import { normalizeName } from "./normalize";

/**
 * Re-importing a roadmap for a subject that already exists.
 *
 * The whole point is that progress survives an updated roadmap, so matching is
 * by normalized name and a matched node keeps the ID and status it already
 * had. Names are matched, not positions: a roadmap that reorders its sections,
 * or gains one in the middle, still lines up.
 *
 * The result is an ordinary DraftSubject, so the same review UI handles it —
 * just with each row tagged with the bucket it fell into.
 */

/**
 * Indexes stored nodes by normalized name. A queue per name, because nothing
 * stops a subject from holding two topics with the same name, and each should
 * match at most one incoming node rather than both collapsing onto the first.
 */
function queueByName<T extends { name: string }>(nodes: T[]): Map<string, T[]> {
  const byName = new Map<string, T[]>();
  for (const node of nodes) {
    const key = normalizeName(node.name);
    const queue = byName.get(key);
    if (queue) queue.push(node);
    else byName.set(key, [node]);
  }
  return byName;
}

function takeMatch<T extends { name: string }>(
  byName: Map<string, T[]>,
  name: string,
): T | undefined {
  const queue = byName.get(normalizeName(name));
  return queue && queue.length > 0 ? queue.shift() : undefined;
}

function matchedSubtopic(existing: Subtopic, incoming: { name: string }): DraftSubtopic {
  return {
    key: newId("ds"),
    // The incoming wording wins; the normalized names are equal either way, so
    // this only ever changes capitalization or spacing.
    name: incoming.name,
    id: existing.id,
    status: existing.status,
    origin: "matched",
  };
}

function newSubtopic(incoming: { name: string }): DraftSubtopic {
  return { key: newId("ds"), name: incoming.name, origin: "new" };
}

function removedSubtopic(existing: Subtopic): DraftSubtopic {
  return {
    key: newId("ds"),
    name: existing.name,
    id: existing.id,
    status: existing.status,
    origin: "removed",
    keep: true,
  };
}

function mergeTopic(existing: Topic, incoming: ParsedTopic): DraftTopic {
  const byName = queueByName(existing.subtopics);
  const consumed = new Set<string>();
  const subtopics: DraftSubtopic[] = [];

  for (const incomingSubtopic of incoming.subtopics) {
    const match = takeMatch(byName, incomingSubtopic.name);
    if (match) {
      consumed.add(match.id);
      subtopics.push(matchedSubtopic(match, incomingSubtopic));
    } else {
      subtopics.push(newSubtopic(incomingSubtopic));
    }
  }

  // Whatever the new roadmap no longer mentions goes to the end, for the user
  // to keep or drop.
  for (const subtopic of existing.subtopics) {
    if (!consumed.has(subtopic.id)) subtopics.push(removedSubtopic(subtopic));
  }

  return {
    key: newId("dt"),
    name: incoming.name,
    id: existing.id,
    origin: "matched",
    subtopics,
  };
}

function newTopic(incoming: ParsedTopic): DraftTopic {
  return {
    key: newId("dt"),
    name: incoming.name,
    origin: "new",
    subtopics: incoming.subtopics.map(newSubtopic),
  };
}

function removedTopic(existing: Topic): DraftTopic {
  return {
    key: newId("dt"),
    name: existing.name,
    id: existing.id,
    origin: "removed",
    keep: true,
    // The children aren't individually removed — they ride on the topic's
    // decision — so they carry no badge of their own, only their progress.
    subtopics: existing.subtopics.map((subtopic) => ({
      key: newId("ds"),
      name: subtopic.name,
      id: subtopic.id,
      status: subtopic.status,
    })),
  };
}

export function toMergeDraft(existing: Subject, incoming: ParsedSubject): DraftSubject {
  const byName = queueByName(existing.topics);
  const consumed = new Set<string>();
  const topics: DraftTopic[] = [];

  for (const incomingTopic of incoming.topics) {
    const match = takeMatch(byName, incomingTopic.name);
    if (match) {
      consumed.add(match.id);
      topics.push(mergeTopic(match, incomingTopic));
    } else {
      topics.push(newTopic(incomingTopic));
    }
  }

  for (const topic of existing.topics) {
    if (!consumed.has(topic.id)) topics.push(removedTopic(topic));
  }

  return { name: incoming.name.trim() || existing.name, topics };
}

/* ------------------------------------------------------------------ *
 * Keep / drop decisions
 * ------------------------------------------------------------------ */

function withKeep<T extends { origin?: string; keep?: boolean }>(node: T, keep: boolean): T {
  return node.origin === "removed" ? { ...node, keep } : node;
}

export function setTopicKeep(
  draft: DraftSubject,
  topicKey: string,
  keep: boolean,
): DraftSubject {
  return {
    ...draft,
    topics: draft.topics.map((topic) =>
      topic.key === topicKey ? withKeep(topic, keep) : topic,
    ),
  };
}

export function setSubtopicKeep(
  draft: DraftSubject,
  topicKey: string,
  subtopicKey: string,
  keep: boolean,
): DraftSubject {
  return {
    ...draft,
    topics: draft.topics.map((topic) =>
      topic.key === topicKey
        ? {
            ...topic,
            subtopics: topic.subtopics.map((subtopic) =>
              subtopic.key === subtopicKey ? withKeep(subtopic, keep) : subtopic,
            ),
          }
        : topic,
    ),
  };
}

/** Applies one decision to every removed row at once. */
export function setAllKeep(draft: DraftSubject, keep: boolean): DraftSubject {
  return {
    ...draft,
    topics: draft.topics.map((topic) => ({
      ...withKeep(topic, keep),
      subtopics: topic.subtopics.map((subtopic) => withKeep(subtopic, keep)),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

export type MergeSummary = {
  newTopics: number;
  newSubtopics: number;
  matchedTopics: number;
  matchedSubtopics: number;
  removedTopics: number;
  removedSubtopics: number;
  /** How many removed rows are currently set to be dropped. */
  droppedCount: number;
};

export function mergeSummary(draft: DraftSubject): MergeSummary {
  const summary: MergeSummary = {
    newTopics: 0,
    newSubtopics: 0,
    matchedTopics: 0,
    matchedSubtopics: 0,
    removedTopics: 0,
    removedSubtopics: 0,
    droppedCount: 0,
  };

  for (const topic of draft.topics) {
    if (topic.origin === "new") summary.newTopics++;
    else if (topic.origin === "matched") summary.matchedTopics++;
    else if (topic.origin === "removed") {
      summary.removedTopics++;
      if (topic.keep === false) summary.droppedCount++;
    }

    for (const subtopic of topic.subtopics) {
      if (subtopic.origin === "new") summary.newSubtopics++;
      else if (subtopic.origin === "matched") summary.matchedSubtopics++;
      else if (subtopic.origin === "removed") {
        summary.removedSubtopics++;
        if (subtopic.keep === false) summary.droppedCount++;
      }
    }
  }

  return summary;
}

/* ------------------------------------------------------------------ *
 * Applying
 * ------------------------------------------------------------------ */

function isDropped(node: { origin?: string; keep?: boolean }): boolean {
  return node.origin === "removed" && node.keep === false;
}

/**
 * Turns a reviewed merge draft back into the stored subject. Rows that carry
 * an ID keep it along with their status; rows without one are new and start
 * at not-started.
 */
export function applyMergeDraft(
  existing: Subject,
  draft: DraftSubject,
  sourceRoadmap: string,
): Subject {
  const topics: Topic[] = draft.topics
    .filter((topic) => !isDropped(topic))
    .map((topic) => ({
      id: topic.id ?? newId("top"),
      name: topic.name.trim(),
      subtopics: topic.subtopics
        .filter((subtopic) => !isDropped(subtopic))
        .map((subtopic) => ({
          id: subtopic.id ?? newId("sub"),
          name: subtopic.name.trim(),
          status: subtopic.status ?? ("not-started" as const),
        }))
        .filter((subtopic) => subtopic.name !== ""),
    }))
    .filter((topic) => topic.name !== "");

  return {
    ...existing,
    name: draft.name.trim() || existing.name,
    sourceRoadmap,
    topics,
    updatedAt: new Date().toISOString(),
  };
}
