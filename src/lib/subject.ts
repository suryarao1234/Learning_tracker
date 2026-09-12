import type { LearningData, ParsedSubject, Subject, SubtopicStatus } from "../types";
import { newId } from "./id";

/**
 * Turns a reviewed tree into a stored Subject, assigning fresh IDs. Every
 * fresh import ends here; re-imports keep the IDs they already have so that
 * progress survives.
 */
export function subjectFromParsed(parsed: ParsedSubject, sourceRoadmap: string): Subject {
  const now = new Date().toISOString();
  return {
    id: newId("subj"),
    name: parsed.name,
    sourceRoadmap,
    topics: parsed.topics.map((topic) => ({
      id: newId("top"),
      name: topic.name,
      subtopics: topic.subtopics.map((subtopic) => ({
        id: newId("sub"),
        name: subtopic.name,
        status: "not-started" as const,
      })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sets one subtopic's status. Returns the original object when nothing would
 * change, so a no-op click doesn't trigger a re-render or a pointless write to
 * localStorage.
 */
export function setSubtopicStatus(
  data: LearningData,
  subjectId: string,
  topicId: string,
  subtopicId: string,
  status: SubtopicStatus,
): LearningData {
  let changed = false;

  const subjects = data.subjects.map((subject) => {
    if (subject.id !== subjectId) return subject;

    const topics = subject.topics.map((topic) => {
      if (topic.id !== topicId) return topic;

      let topicChanged = false;
      const subtopics = topic.subtopics.map((subtopic) => {
        if (subtopic.id !== subtopicId || subtopic.status === status) return subtopic;
        topicChanged = true;
        return { ...subtopic, status };
      });

      if (!topicChanged) return topic;
      changed = true;
      return { ...topic, subtopics };
    });

    if (!changed) return subject;
    return { ...subject, topics, updatedAt: new Date().toISOString() };
  });

  return changed ? { ...data, subjects } : data;
}
