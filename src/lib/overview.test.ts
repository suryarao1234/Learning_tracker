import { describe, expect, it } from "vitest";
import { focusSubject, greetingFor, inFlightSubjects, nextUp } from "./overview";
import { accentFor, initialOf } from "./accent";
import { subjectFromParsed } from "./subject";
import type { Subject, SubtopicStatus } from "../types";

function subject(name: string, statuses: SubtopicStatus[][]): Subject {
  const built = subjectFromParsed(
    {
      name,
      topics: statuses.map((row, i) => ({
        name: `Topic ${i + 1}`,
        subtopics: row.map((_, j) => ({ name: `${name} sub ${i + 1}.${j + 1}` })),
      })),
    },
    "",
  );
  statuses.forEach((row, i) =>
    row.forEach((status, j) => {
      built.topics[i].subtopics[j].status = status;
    }),
  );
  return built;
}

describe("greetingFor", () => {
  it("follows the clock", () => {
    expect(greetingFor(new Date("2026-09-13T08:00:00"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-09-13T13:00:00"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-09-13T20:00:00"))).toBe("Good evening");
  });

  it("has no gaps at the boundaries", () => {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date("2026-09-13T00:00:00");
      date.setHours(hour);
      expect(greetingFor(date)).toMatch(/^Good (morning|afternoon|evening)$/);
    }
  });
});

describe("nextUp", () => {
  it("puts started subtopics before untouched ones", () => {
    const a = subject("A", [["not-started", "in-progress"]]);
    const b = subject("B", [["in-progress", "not-started"]]);

    expect(nextUp([a, b]).map((r) => r.subtopic.name)).toEqual([
      "A sub 1.2", // in progress
      "B sub 1.1", // in progress
      "A sub 1.1",
      "B sub 1.2",
    ]);
  });

  it("never suggests something already done", () => {
    const s = subject("A", [["done", "done", "not-started"]]);
    expect(nextUp([s]).map((r) => r.subtopic.name)).toEqual(["A sub 1.3"]);
  });

  it("carries the subject and topic each subtopic belongs to", () => {
    const s = subject("A", [["not-started"]]);
    const [ref] = nextUp([s]);
    expect(ref.subject.name).toBe("A");
    expect(ref.topic.name).toBe("Topic 1");
  });

  it("respects the limit and copes with nothing left", () => {
    const s = subject("A", [["not-started", "not-started", "not-started"]]);
    expect(nextUp([s], 2)).toHaveLength(2);
    expect(nextUp([subject("A", [["done"]])])).toEqual([]);
    expect(nextUp([])).toEqual([]);
  });
});

describe("inFlightSubjects", () => {
  it("keeps only subjects that are started but unfinished", () => {
    const untouched = subject("Untouched", [["not-started"]]);
    const started = subject("Started", [["done", "not-started"]]);
    const doing = subject("Doing", [["in-progress", "not-started"]]);
    const finished = subject("Finished", [["done"]]);
    const empty = subject("Empty", []);

    expect(
      inFlightSubjects([untouched, started, doing, finished, empty]).map((s) => s.name),
    ).toEqual(["Started", "Doing"]);
  });
});

describe("focusSubject", () => {
  it("picks the unfinished subject that's furthest along", () => {
    const barely = subject("Barely", [["done", "not-started", "not-started", "not-started"]]);
    const nearly = subject("Nearly", [["done", "done", "done", "not-started"]]);
    expect(focusSubject([barely, nearly])?.name).toBe("Nearly");
  });

  it("falls back to the first subject when nothing is in flight", () => {
    const one = subject("One", [["not-started"]]);
    const two = subject("Two", [["not-started"]]);
    expect(focusSubject([one, two])?.name).toBe("One");
  });

  it("returns null when there's nothing at all", () => {
    expect(focusSubject([])).toBeNull();
  });
});

describe("accents", () => {
  it("gives the same subject the same accent every time", () => {
    expect(accentFor("subj_abc")).toBe(accentFor("subj_abc"));
  });

  it("depends on the ID, not on position, so deleting one doesn't repaint the rest", () => {
    const ids = ["subj_a", "subj_b", "subj_c", "subj_d"];
    const before = ids.map(accentFor);
    const after = ids.filter((id) => id !== "subj_b").map(accentFor);
    expect(after).toEqual([before[0], before[2], before[3]]);
  });

  it("only ever returns a defined accent", () => {
    for (let i = 0; i < 200; i++) {
      expect(accentFor(`subj_${i}`).hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("takes an initial from the first letter or digit", () => {
    expect(initialOf("typescript")).toBe("T");
    expect(initialOf("  go  ")).toBe("G");
    expect(initialOf("3D modelling")).toBe("3");
    expect(initialOf("→ design")).toBe("D");
    expect(initialOf("   ")).toBe("?");
  });
});
