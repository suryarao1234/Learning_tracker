import { describe, expect, it } from "vitest";
import {
  addSubtopic,
  addTopic,
  deleteSubtopic,
  deleteTopic,
  draftCounts,
  fromDraft,
  mergeTopicIntoPrevious,
  renameSubtopic,
  renameTopic,
  toDraft,
  validateDraft,
  type DraftSubject,
} from "./draft";
import { parseRoadmap } from "./parseRoadmap";

function draftOf(markdown: string): DraftSubject {
  return toDraft(parseRoadmap(markdown).subject);
}

const SAMPLE = `
# Go
## Basics
- Variables
- Types
## Concurrency
- Goroutines
`;

describe("toDraft / fromDraft", () => {
  it("round-trips a parsed subject unchanged", () => {
    const parsed = parseRoadmap(SAMPLE).subject;
    expect(fromDraft(toDraft(parsed))).toEqual(parsed);
  });

  it("gives every node a distinct key", () => {
    const draft = draftOf(SAMPLE);
    const keys = [
      ...draft.topics.map((t) => t.key),
      ...draft.topics.flatMap((t) => t.subtopics.map((s) => s.key)),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("trims names and drops blank rows on the way out", () => {
    const draft: DraftSubject = {
      name: "  Go  ",
      topics: [
        { key: "a", name: " Basics ", subtopics: [{ key: "a1", name: " Variables " }, { key: "a2", name: "  " }] },
        { key: "b", name: "   ", subtopics: [{ key: "b1", name: "Dropped with its topic" }] },
      ],
    };
    expect(fromDraft(draft)).toEqual({
      name: "Go",
      topics: [{ name: "Basics", subtopics: [{ name: "Variables" }] }],
    });
  });
});

describe("edit operations", () => {
  it("does not mutate the draft it is given", () => {
    const draft = draftOf(SAMPLE);
    const before = structuredClone(draft);
    renameTopic(draft, draft.topics[0].key, "Renamed");
    deleteTopic(draft, draft.topics[0].key);
    addSubtopic(draft, draft.topics[0].key);
    expect(draft).toEqual(before);
  });

  it("renames, adds and deletes topics and subtopics", () => {
    let draft = draftOf(SAMPLE);
    const basics = draft.topics[0].key;

    draft = renameTopic(draft, basics, "Fundamentals");
    expect(draft.topics[0].name).toBe("Fundamentals");

    draft = deleteSubtopic(draft, basics, draft.topics[0].subtopics[0].key);
    expect(draft.topics[0].subtopics.map((s) => s.name)).toEqual(["Types"]);

    draft = addSubtopic(draft, basics);
    draft = renameSubtopic(draft, basics, draft.topics[0].subtopics[1].key, "Constants");
    expect(draft.topics[0].subtopics.map((s) => s.name)).toEqual(["Types", "Constants"]);

    draft = addTopic(draft);
    expect(draftCounts(draft)).toEqual({ topics: 3, subtopics: 3 });

    draft = deleteTopic(draft, draft.topics[2].key);
    expect(draftCounts(draft)).toEqual({ topics: 2, subtopics: 3 });
  });
});

describe("mergeTopicIntoPrevious", () => {
  it("folds a topic into the one above, keeping its name as a subtopic", () => {
    let draft = draftOf(SAMPLE);
    draft = mergeTopicIntoPrevious(draft, draft.topics[1].key);
    expect(fromDraft(draft).topics).toEqual([
      {
        name: "Basics",
        subtopics: [
          { name: "Variables" },
          { name: "Types" },
          { name: "Concurrency" },
          { name: "Goroutines" },
        ],
      },
    ]);
  });

  it("drops subtopics that the merge duplicates", () => {
    let draft = draftOf(`
# Go
## Basics
- Variables
- Types
## Syntax
- Types
- Keywords
`);
    draft = mergeTopicIntoPrevious(draft, draft.topics[1].key);
    expect(fromDraft(draft).topics[0].subtopics.map((s) => s.name)).toEqual([
      "Variables",
      "Types",
      "Syntax",
      "Keywords",
    ]);
  });

  it("is a no-op on the first topic", () => {
    const draft = draftOf(SAMPLE);
    expect(mergeTopicIntoPrevious(draft, draft.topics[0].key)).toBe(draft);
  });

  it("is a no-op for an unknown key", () => {
    const draft = draftOf(SAMPLE);
    expect(mergeTopicIntoPrevious(draft, "nope")).toBe(draft);
  });
});

describe("validateDraft", () => {
  it("accepts a well-formed draft", () => {
    expect(validateDraft(draftOf(SAMPLE), [])).toEqual({ errors: [], warnings: [] });
  });

  it("requires a subject name and at least one topic", () => {
    const { errors } = validateDraft({ name: "  ", topics: [] }, []);
    expect(errors.map((e) => e.code)).toEqual(["no-name", "no-topics"]);
  });

  it("blocks a name that collides with an existing subject, ignoring case and spacing", () => {
    const { errors } = validateDraft(draftOf(SAMPLE), ["  go  "]);
    expect(errors.map((e) => e.code)).toEqual(["duplicate-name"]);
    expect(errors[0].message).toContain("already exists");
  });

  it("does not block a name that merely resembles an existing one", () => {
    expect(validateDraft(draftOf(SAMPLE), ["Golang", "Go 2"]).errors).toEqual([]);
  });

  it("warns about duplicate topic names without blocking", () => {
    let draft = draftOf(SAMPLE);
    draft = renameTopic(draft, draft.topics[1].key, "basics");
    const { errors, warnings } = validateDraft(draft, []);
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toContain("same name");
  });

  it("warns that unnamed topics will be left out", () => {
    const draft = addTopic(draftOf(SAMPLE));
    const { errors, warnings } = validateDraft(draft, []);
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toContain("unnamed");
  });
});
