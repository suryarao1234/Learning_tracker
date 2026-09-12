import type { Subject, Topic } from "../types";

export type Progress = {
  done: number;
  inProgress: number;
  total: number;
  /** 0–100, rounded. 0 when there is nothing to complete. */
  percent: number;
  /** The in-progress share, on the same scale. */
  inProgressPercent: number;
};

function toProgress(done: number, inProgress: number, total: number): Progress {
  return {
    done,
    inProgress,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    inProgressPercent: total === 0 ? 0 : Math.round((inProgress / total) * 100),
  };
}

export function topicProgress(topic: Topic): Progress {
  let done = 0;
  let inProgress = 0;
  for (const subtopic of topic.subtopics) {
    if (subtopic.status === "done") done++;
    else if (subtopic.status === "in-progress") inProgress++;
  }
  return toProgress(done, inProgress, topic.subtopics.length);
}

export function subjectProgress(subject: Subject): Progress {
  let done = 0;
  let inProgress = 0;
  let total = 0;
  for (const topic of subject.topics) {
    const p = topicProgress(topic);
    done += p.done;
    inProgress += p.inProgress;
    total += p.total;
  }
  return toProgress(done, inProgress, total);
}

export function overallProgress(subjects: Subject[]): Progress {
  let done = 0;
  let inProgress = 0;
  let total = 0;
  for (const subject of subjects) {
    const p = subjectProgress(subject);
    done += p.done;
    inProgress += p.inProgress;
    total += p.total;
  }
  return toProgress(done, inProgress, total);
}
