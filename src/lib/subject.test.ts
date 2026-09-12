import { describe, expect, it } from "vitest";
import { setSubtopicStatus, subjectFromParsed } from "./subject";
import { subjectProgress } from "./progress";
import { CURRENT_SCHEMA_VERSION, type LearningData } from "../types";

function dataWithOneSubject(): LearningData {
  const subject = subjectFromParsed(
    {
      name: "Go",
      topics: [
        { name: "Basics", subtopics: [{ name: "Variables" }, { name: "Types" }] },
        { name: "Concurrency", subtopics: [{ name: "Goroutines" }] },
      ],
    },
    "# Go",
  );
  subject.updatedAt = "2024-01-01T00:00:00.000Z";
  return { schemaVersion: CURRENT_SCHEMA_VERSION, subjects: [subject] };
}

describe("subjectFromParsed", () => {
  it("assigns distinct IDs and starts everything not-started", () => {
    const subject = subjectFromParsed(
      { name: "Go", topics: [{ name: "Basics", subtopics: [{ name: "a" }, { name: "b" }] }] },
      "raw text",
    );
    const ids = [
      subject.id,
      ...subject.topics.map((t) => t.id),
      ...subject.topics.flatMap((t) => t.subtopics.map((s) => s.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(subject.topics[0].subtopics.every((s) => s.status === "not-started")).toBe(true);
  });

  it("keeps the raw roadmap text", () => {
    expect(subjectFromParsed({ name: "Go", topics: [] }, "# Go\n- x").sourceRoadmap).toBe(
      "# Go\n- x",
    );
  });
});

describe("setSubtopicStatus", () => {
  it("marks the target subtopic and nothing else", () => {
    const data = dataWithOneSubject();
    const [subject] = data.subjects;
    const target = subject.topics[0].subtopics[1];

    const next = setSubtopicStatus(data, subject.id, subject.topics[0].id, target.id, "done");

    expect(next.subjects[0].topics[0].subtopics[1].status).toBe("done");
    expect(next.subjects[0].topics[0].subtopics[0].status).toBe("not-started");
    expect(next.subjects[0].topics[1].subtopics[0].status).toBe("not-started");
  });

  it("moves the subject's completion along", () => {
    const data = dataWithOneSubject();
    const [subject] = data.subjects;
    expect(subjectProgress(subject).percent).toBe(0);

    const next = setSubtopicStatus(
      data,
      subject.id,
      subject.topics[0].id,
      subject.topics[0].subtopics[0].id,
      "done",
    );
    expect(subjectProgress(next.subjects[0])).toMatchObject({ done: 1, total: 3, percent: 33 });
  });

  it("touches updatedAt on a real change", () => {
    const data = dataWithOneSubject();
    const [subject] = data.subjects;
    const next = setSubtopicStatus(
      data,
      subject.id,
      subject.topics[0].id,
      subject.topics[0].subtopics[0].id,
      "in-progress",
    );
    expect(next.subjects[0].updatedAt).not.toBe(subject.updatedAt);
    expect(next.subjects[0].createdAt).toBe(subject.createdAt);
  });

  it("does not mutate the data it is given", () => {
    const data = dataWithOneSubject();
    const before = structuredClone(data);
    const [subject] = data.subjects;
    setSubtopicStatus(
      data,
      subject.id,
      subject.topics[0].id,
      subject.topics[0].subtopics[0].id,
      "done",
    );
    expect(data).toEqual(before);
  });

  it("returns the same object when the status is already set", () => {
    const data = dataWithOneSubject();
    const [subject] = data.subjects;
    const ids = [subject.id, subject.topics[0].id, subject.topics[0].subtopics[0].id] as const;

    const once = setSubtopicStatus(data, ...ids, "done");
    expect(setSubtopicStatus(once, ...ids, "done")).toBe(once);
  });

  it("returns the same object for IDs that don't exist", () => {
    const data = dataWithOneSubject();
    const [subject] = data.subjects;
    expect(setSubtopicStatus(data, "nope", "nope", "nope", "done")).toBe(data);
    expect(setSubtopicStatus(data, subject.id, "nope", "nope", "done")).toBe(data);
    expect(
      setSubtopicStatus(data, subject.id, subject.topics[0].id, "nope", "done"),
    ).toBe(data);
  });
});
