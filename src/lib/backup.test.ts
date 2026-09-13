import { describe, expect, it } from "vitest";
import {
  backupFilename,
  countContents,
  mergeBackup,
  parseBackup,
  serializeBackup,
} from "./backup";
import { sampleData } from "./sampleData";
import { subjectFromParsed } from "./subject";
import { CURRENT_SCHEMA_VERSION, emptyData, type LearningData } from "../types";

function dataWith(...names: string[]): LearningData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    subjects: names.map((name) =>
      subjectFromParsed(
        { name, topics: [{ name: "Topic", subtopics: [{ name: "Sub" }] }] },
        `# ${name}`,
      ),
    ),
  };
}

describe("export", () => {
  it("round-trips through a backup unchanged", () => {
    const data = sampleData();
    const result = parseBackup(serializeBackup(data));
    expect(result).toMatchObject({ ok: true });
    expect((result as { data: LearningData }).data).toEqual(data);
  });

  it("preserves recorded progress", () => {
    const data = sampleData();
    const restored = (parseBackup(serializeBackup(data)) as { data: LearningData }).data;
    expect(restored.subjects[0].topics[0].subtopics[0].status).toBe("done");
    expect(restored.subjects[0].topics[0].subtopics[2].status).toBe("in-progress");
  });

  it("names the file by date", () => {
    expect(backupFilename(new Date("2026-09-13T10:20:30Z"))).toBe(
      "learning-tracker-2026-09-13.json",
    );
  });

  it("counts what's inside", () => {
    expect(countContents(sampleData())).toEqual({ subjects: 1, topics: 3, subtopics: 8 });
    expect(countContents(emptyData())).toEqual({ subjects: 0, topics: 0, subtopics: 0 });
  });
});

describe("parseBackup", () => {
  it("rejects files that aren't JSON", () => {
    expect(parseBackup("not json at all")).toMatchObject({ ok: false });
    expect(parseBackup("")).toMatchObject({ ok: false });
  });

  it("rejects JSON that isn't a backup", () => {
    const cases = ["[]", "42", '"text"', "null", '{"subjects":[]}', '{"schemaVersion":"1"}'];
    for (const text of cases) {
      expect(parseBackup(text), text).toMatchObject({ ok: false });
    }
  });

  it("names schemaVersion when it's missing, since that's the giveaway", () => {
    const result = parseBackup('{"subjects":[]}');
    expect((result as { message: string }).message).toContain("schemaVersion");
  });

  it("accepts an empty but valid backup", () => {
    const result = parseBackup(serializeBackup(emptyData()));
    expect(result).toMatchObject({ ok: true, counts: { subjects: 0 } });
  });

  it("accepts a newer schema version with a warning rather than refusing", () => {
    const result = parseBackup(
      JSON.stringify({ schemaVersion: 99, subjects: dataWith("Go").subjects }),
    );
    expect(result).toMatchObject({ ok: true });
    expect((result as { warning?: string }).warning).toContain("newer version");
    expect((result as { data: LearningData }).data.subjects).toHaveLength(1);
  });

  it("repairs a hand-edited backup instead of refusing it", () => {
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        subjects: [
          { name: "Go", topics: [{ name: "Basics", subtopics: [{ name: "Variables" }] }] },
          { topics: [] }, // no name
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true, counts: { subjects: 1, subtopics: 1 } });
    const restored = (result as { data: LearningData }).data;
    expect(restored.subjects[0].id).toBeTruthy();
    expect(restored.subjects[0].topics[0].subtopics[0].status).toBe("not-started");
  });
});

describe("mergeBackup", () => {
  it("adds subjects that aren't already here", () => {
    const result = mergeBackup(dataWith("Go"), dataWith("Rust", "Elixir"));
    expect(result.added).toBe(2);
    expect(result.skipped).toEqual([]);
    expect(result.data.subjects.map((s) => s.name)).toEqual(["Go", "Rust", "Elixir"]);
  });

  it("skips a name that's already here, and says which", () => {
    const result = mergeBackup(dataWith("Go"), dataWith("  go  ", "Rust"));
    expect(result.added).toBe(1);
    expect(result.skipped).toEqual(["  go  "]);
    expect(result.data.subjects.map((s) => s.name)).toEqual(["Go", "Rust"]);
  });

  it("leaves the subjects already here completely untouched", () => {
    const current = dataWith("Go");
    const before = structuredClone(current);
    const result = mergeBackup(current, dataWith("Go", "Rust"));
    expect(result.data.subjects[0]).toEqual(before.subjects[0]);
    expect(current).toEqual(before);
  });

  it("gives imported subjects fresh IDs, so nothing can collide", () => {
    const current = dataWith("Go");
    // A backup of the same store, with one subject renamed: same IDs throughout.
    const incoming = structuredClone(current);
    incoming.subjects[0].name = "Rust";

    const result = mergeBackup(current, incoming);
    expect(result.added).toBe(1);

    const ids = result.data.subjects.flatMap((s) => [
      s.id,
      ...s.topics.flatMap((t) => [t.id, ...t.subtopics.map((sub) => sub.id)]),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not double-add a name repeated within the backup itself", () => {
    const result = mergeBackup(emptyData(), dataWith("Rust", "rust"));
    expect(result.added).toBe(1);
    expect(result.skipped).toEqual(["rust"]);
  });

  it("handles merging into nothing", () => {
    const result = mergeBackup(emptyData(), dataWith("Go"));
    expect(result.data.subjects).toHaveLength(1);
  });
});
