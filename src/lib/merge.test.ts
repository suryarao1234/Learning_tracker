import { describe, expect, it } from "vitest";
import {
  applyMergeDraft,
  mergeSummary,
  setAllKeep,
  setSubtopicKeep,
  setTopicKeep,
  toMergeDraft,
} from "./merge";
import { renameTopic, type DraftSubject } from "./draft";
import { parseRoadmap } from "./parseRoadmap";
import { subjectFromParsed } from "./subject";
import type { Subject, SubtopicStatus } from "../types";

/** An existing subject with some progress already recorded on it. */
function existingSubject(): Subject {
  const subject = subjectFromParsed(
    {
      name: "Go",
      topics: [
        {
          name: "Basics",
          subtopics: [{ name: "Variables" }, { name: "Types" }, { name: "Loops" }],
        },
        { name: "Concurrency", subtopics: [{ name: "Goroutines" }, { name: "Channels" }] },
        { name: "Deprecated corner", subtopics: [{ name: "GOPATH" }] },
      ],
    },
    "# Go (original)",
  );
  subject.topics[0].subtopics[0].status = "done";
  subject.topics[0].subtopics[1].status = "in-progress";
  subject.topics[1].subtopics[0].status = "done";
  subject.topics[2].subtopics[0].status = "done";
  return subject;
}

function findTopic(draft: DraftSubject, name: string) {
  const topic = draft.topics.find((t) => t.name === name);
  if (!topic) throw new Error(`no topic named ${name} in [${draft.topics.map((t) => t.name)}]`);
  return topic;
}

function statusOf(subject: Subject, topicName: string, subtopicName: string): SubtopicStatus {
  const topic = subject.topics.find((t) => t.name === topicName);
  const subtopic = topic?.subtopics.find((s) => s.name === subtopicName);
  if (!subtopic) throw new Error(`no ${topicName} / ${subtopicName}`);
  return subtopic.status;
}

const UPDATED_ROADMAP = `
# Go
## Basics
- Variables
- Types
- Constants
## Concurrency
- Goroutines
- Channels
- Select
## Generics
- Type parameters
`;

describe("toMergeDraft", () => {
  it("sorts every node into new, matched or removed", () => {
    const draft = toMergeDraft(existingSubject(), parseRoadmap(UPDATED_ROADMAP).subject);

    expect(draft.topics.map((t) => [t.name, t.origin])).toEqual([
      ["Basics", "matched"],
      ["Concurrency", "matched"],
      ["Generics", "new"],
      ["Deprecated corner", "removed"],
    ]);
    expect(findTopic(draft, "Basics").subtopics.map((s) => [s.name, s.origin])).toEqual([
      ["Variables", "matched"],
      ["Types", "matched"],
      ["Constants", "new"],
      ["Loops", "removed"],
    ]);
  });

  it("carries the stored ID and status onto every matched row", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    const basics = findTopic(draft, "Basics");

    expect(basics.id).toBe(existing.topics[0].id);
    expect(basics.subtopics[0]).toMatchObject({
      id: existing.topics[0].subtopics[0].id,
      status: "done",
    });
    expect(basics.subtopics[1]).toMatchObject({ status: "in-progress" });
    expect(basics.subtopics[2].id).toBeUndefined();
  });

  it("matches on normalized names, so case and spacing don't break the link", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(
      existing,
      parseRoadmap("# Go\n## basics\n-   VARIABLES\n").subject,
    );
    const basics = draft.topics[0];

    expect(basics.origin).toBe("matched");
    expect(basics.id).toBe(existing.topics[0].id);
    // The new wording wins for display, but the link (and the status) survive.
    expect(basics.name).toBe("basics");
    expect(basics.subtopics[0]).toMatchObject({ name: "VARIABLES", status: "done" });
  });

  it("matches by name, not position, when the roadmap is reordered", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(
      existing,
      parseRoadmap("# Go\n## Concurrency\n- Channels\n- Goroutines\n").subject,
    );

    expect(draft.topics[0]).toMatchObject({ name: "Concurrency", id: existing.topics[1].id });
    expect(draft.topics[0].subtopics.map((s) => [s.name, s.status])).toEqual([
      ["Channels", "not-started"],
      ["Goroutines", "done"],
    ]);
  });

  it("keeps a removed topic's children unbadged — they ride on its decision", () => {
    const draft = toMergeDraft(existingSubject(), parseRoadmap(UPDATED_ROADMAP).subject);
    const removed = findTopic(draft, "Deprecated corner");

    expect(removed).toMatchObject({ origin: "removed", keep: true });
    expect(removed.subtopics[0].origin).toBeUndefined();
    expect(removed.subtopics[0].status).toBe("done");
  });

  it("gives two same-named stored topics one match each, not both to the first", () => {
    const existing = subjectFromParsed(
      {
        name: "Go",
        topics: [
          { name: "Basics", subtopics: [{ name: "a" }] },
          { name: "Basics", subtopics: [{ name: "b" }] },
        ],
      },
      "",
    );
    const draft = toMergeDraft(existing, { name: "Go", topics: [{ name: "Basics", subtopics: [] }] });

    // One matched; the other is reported as removed rather than disappearing.
    expect(draft.topics.map((t) => t.origin)).toEqual(["matched", "removed"]);
    expect(draft.topics[0].id).toBe(existing.topics[0].id);
    expect(draft.topics[1].id).toBe(existing.topics[1].id);
  });

  it("falls back to the stored name when the new roadmap has none", () => {
    const draft = toMergeDraft(existingSubject(), { name: "", topics: [] });
    expect(draft.name).toBe("Go");
  });
});

describe("mergeSummary", () => {
  it("counts each bucket", () => {
    const draft = toMergeDraft(existingSubject(), parseRoadmap(UPDATED_ROADMAP).subject);
    expect(mergeSummary(draft)).toEqual({
      newTopics: 1,
      newSubtopics: 3, // Constants, Select, Type parameters
      matchedTopics: 2,
      matchedSubtopics: 4,
      removedTopics: 1,
      removedSubtopics: 1, // Loops
      droppedCount: 0,
    });
  });

  it("tracks how many rows are set to be dropped", () => {
    let draft = toMergeDraft(existingSubject(), parseRoadmap(UPDATED_ROADMAP).subject);
    expect(mergeSummary(draft).droppedCount).toBe(0);

    draft = setAllKeep(draft, false);
    expect(mergeSummary(draft).droppedCount).toBe(2);

    draft = setAllKeep(draft, true);
    expect(mergeSummary(draft).droppedCount).toBe(0);
  });

  it("leaves new and matched rows alone when dropping everything removed", () => {
    const draft = setAllKeep(
      toMergeDraft(existingSubject(), parseRoadmap(UPDATED_ROADMAP).subject),
      false,
    );
    expect(findTopic(draft, "Basics").keep).toBeUndefined();
    expect(findTopic(draft, "Generics").keep).toBeUndefined();
  });
});

describe("applyMergeDraft", () => {
  it("preserves progress on matched rows and starts new ones fresh", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    const merged = applyMergeDraft(existing, draft, "# Go (updated)");

    expect(statusOf(merged, "Basics", "Variables")).toBe("done");
    expect(statusOf(merged, "Basics", "Types")).toBe("in-progress");
    expect(statusOf(merged, "Concurrency", "Goroutines")).toBe("done");
    expect(statusOf(merged, "Basics", "Constants")).toBe("not-started");
    expect(statusOf(merged, "Generics", "Type parameters")).toBe("not-started");
  });

  it("keeps the subject's identity and creation date, and refreshes the rest", () => {
    const existing = existingSubject();
    existing.updatedAt = "2020-01-01T00:00:00.000Z";
    const draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    const merged = applyMergeDraft(existing, draft, "# Go (updated)");

    expect(merged.id).toBe(existing.id);
    expect(merged.createdAt).toBe(existing.createdAt);
    expect(merged.updatedAt).not.toBe(existing.updatedAt);
    expect(merged.sourceRoadmap).toBe("# Go (updated)");
  });

  it("keeps removed rows by default", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    const merged = applyMergeDraft(existing, draft, "");

    expect(merged.topics.map((t) => t.name)).toContain("Deprecated corner");
    expect(statusOf(merged, "Deprecated corner", "GOPATH")).toBe("done");
    expect(statusOf(merged, "Basics", "Loops")).toBe("not-started");
  });

  it("drops removed rows the user chose to drop", () => {
    const existing = existingSubject();
    let draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    draft = setTopicKeep(draft, findTopic(draft, "Deprecated corner").key, false);

    const basics = findTopic(draft, "Basics");
    const loops = basics.subtopics.find((s) => s.name === "Loops")!;
    draft = setSubtopicKeep(draft, basics.key, loops.key, false);

    const merged = applyMergeDraft(existing, draft, "");
    expect(merged.topics.map((t) => t.name)).not.toContain("Deprecated corner");
    expect(
      merged.topics.find((t) => t.name === "Basics")!.subtopics.map((s) => s.name),
    ).not.toContain("Loops");
  });

  it("survives a round trip with no roadmap changes at all", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(existing, {
      name: existing.name,
      topics: existing.topics.map((topic) => ({
        name: topic.name,
        subtopics: topic.subtopics.map((s) => ({ name: s.name })),
      })),
    });

    expect(mergeSummary(draft)).toMatchObject({
      newTopics: 0,
      newSubtopics: 0,
      removedTopics: 0,
      removedSubtopics: 0,
    });
    const merged = applyMergeDraft(existing, draft, existing.sourceRoadmap);
    expect(merged.topics).toEqual(existing.topics);
  });

  it("assigns IDs to rows the user added during the review", () => {
    const existing = existingSubject();
    let draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    draft = renameTopic(draft, findTopic(draft, "Generics").key, "Generics (2024)");

    const merged = applyMergeDraft(existing, draft, "");
    const generics = merged.topics.find((t) => t.name === "Generics (2024)")!;
    expect(generics.id).toBeTruthy();
    expect(generics.subtopics.every((s) => s.id)).toBe(true);
    // A new topic's ID must not collide with any stored one.
    const ids = merged.topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("drops rows left blank during the review", () => {
    const existing = existingSubject();
    const draft = toMergeDraft(existing, parseRoadmap(UPDATED_ROADMAP).subject);
    const blanked: DraftSubject = {
      ...draft,
      topics: draft.topics.map((topic) =>
        topic.name === "Generics" ? { ...topic, name: "   " } : topic,
      ),
    };
    expect(applyMergeDraft(existing, blanked, "").topics.map((t) => t.name)).not.toContain(
      "Generics",
    );
  });
});
