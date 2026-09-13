import type { Subject, Subtopic, Topic } from "../types";
import { subjectProgress } from "./progress";

/** One subtopic with the context needed to show and act on it. */
export type SubtopicRef = {
  subject: Subject;
  topic: Topic;
  subtopic: Subtopic;
};

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * What to work on next: anything already started comes first, since finishing
 * something half-done beats opening something new, then the first untouched
 * subtopics in roadmap order.
 *
 * Everything here is derived from what's already tracked — the app stores no
 * schedule, and inventing one would be pretending to know more than it does.
 */
export function nextUp(subjects: Subject[], limit = 5): SubtopicRef[] {
  const started: SubtopicRef[] = [];
  const fresh: SubtopicRef[] = [];

  for (const subject of subjects) {
    for (const topic of subject.topics) {
      for (const subtopic of topic.subtopics) {
        if (subtopic.status === "in-progress") started.push({ subject, topic, subtopic });
        else if (subtopic.status === "not-started") fresh.push({ subject, topic, subtopic });
      }
    }
  }

  return [...started, ...fresh].slice(0, limit);
}

/** Subjects with something done but not everything — the ones worth resuming. */
export function inFlightSubjects(subjects: Subject[]): Subject[] {
  return subjects.filter((subject) => {
    const progress = subjectProgress(subject);
    return progress.total > 0 && progress.done + progress.inProgress > 0 && progress.percent < 100;
  });
}

/** The subject to offer first — the furthest along without being finished. */
export function focusSubject(subjects: Subject[]): Subject | null {
  const candidates = inFlightSubjects(subjects);
  if (candidates.length === 0) return subjects[0] ?? null;

  return candidates.reduce((best, subject) =>
    subjectProgress(subject).percent > subjectProgress(best).percent ? subject : best,
  );
}
