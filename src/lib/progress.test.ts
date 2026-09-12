import { describe, expect, it } from "vitest";
import { overallProgress, subjectProgress, topicProgress } from "./progress";
import type { Subject, SubtopicStatus } from "../types";

function subject(name: string, topics: SubtopicStatus[][]): Subject {
  return {
    id: name,
    name,
    sourceRoadmap: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    topics: topics.map((statuses, i) => ({
      id: `${name}-t${i}`,
      name: `Topic ${i}`,
      subtopics: statuses.map((status, j) => ({ id: `${name}-t${i}-s${j}`, name: `Sub ${j}`, status })),
    })),
  };
}

describe("progress", () => {
  it("counts statuses within a topic", () => {
    const s = subject("A", [["done", "done", "in-progress", "not-started"]]);
    expect(topicProgress(s.topics[0])).toEqual({
      done: 2,
      inProgress: 1,
      total: 4,
      percent: 50,
      inProgressPercent: 25,
    });
  });

  it("reports the in-progress share alongside the done share", () => {
    const s = subject("A", [["done", "in-progress", "in-progress", "not-started"]]);
    const p = subjectProgress(s);
    expect(p.percent).toBe(25);
    expect(p.inProgressPercent).toBe(50);
    // The two shares can't overlap, so a bar drawing both never overflows.
    expect(p.percent + p.inProgressPercent).toBeLessThanOrEqual(100);
  });

  it("aggregates across topics in a subject", () => {
    const s = subject("A", [["done", "not-started"], ["done", "done", "not-started"]]);
    expect(subjectProgress(s)).toMatchObject({ done: 3, total: 5, percent: 60 });
  });

  it("reports 0% rather than NaN when there is nothing to complete", () => {
    expect(subjectProgress(subject("A", []))).toEqual({
      done: 0,
      inProgress: 0,
      total: 0,
      percent: 0,
      inProgressPercent: 0,
    });
    expect(overallProgress([])).toMatchObject({ percent: 0, total: 0 });
  });

  it("weights subjects by subtopic count, not equally", () => {
    const small = subject("small", [["done"]]);
    const large = subject("large", [["not-started", "not-started", "not-started"]]);
    expect(overallProgress([small, large])).toMatchObject({ done: 1, total: 4, percent: 25 });
  });
});
