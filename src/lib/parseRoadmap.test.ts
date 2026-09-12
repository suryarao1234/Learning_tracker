import { describe, expect, it } from "vitest";
import { parseRoadmap } from "./parseRoadmap";
import type { ParsedSubject } from "../types";

/** Compact view of a parse result, so expectations read like the input. */
function shape(subject: ParsedSubject) {
  return {
    name: subject.name,
    topics: subject.topics.map((topic) => [
      topic.name,
      topic.subtopics.map((s) => s.name),
    ]),
  };
}

describe("headings", () => {
  it("uses a single top heading as the subject and the next level as topics", () => {
    const result = parseRoadmap(`
# TypeScript

## Language basics
- Primitive types
- Type inference

## Type system
- Generics
`);
    expect(shape(result.subject)).toEqual({
      name: "TypeScript",
      topics: [
        ["Language basics", ["Primitive types", "Type inference"]],
        ["Type system", ["Generics"]],
      ],
    });
    expect(result.ambiguous).toBe(false);
  });

  it("leaves the subject blank when there is no single root heading", () => {
    const result = parseRoadmap(`
## Basics
- a
- b

## Advanced
- c
- d
`);
    expect(shape(result.subject)).toEqual({
      name: "",
      topics: [
        ["Basics", ["a", "b"]],
        ["Advanced", ["c", "d"]],
      ],
    });
  });

  it("treats deeper headings as subtopics, not as topics", () => {
    const result = parseRoadmap(`
# Python
## Phase 1
### Variables
### Control flow
## Phase 2
### Functions
`);
    expect(shape(result.subject)).toEqual({
      name: "Python",
      topics: [
        ["Phase 1", ["Variables", "Control flow"]],
        ["Phase 2", ["Functions"]],
      ],
    });
  });

  it("prefers headings over bullets when a topic contains both", () => {
    const result = parseRoadmap(`
# Python
## Phase 1
### Variables
- int and float
- str
### Control flow
- if / else
`);
    expect(shape(result.subject).topics).toEqual([
      ["Phase 1", ["Variables", "Control flow"]],
    ]);
    // The bullets under each subtopic are one level too deep to keep.
    expect(result.ignoredCount).toBe(3);
  });

  it("reads setext-underlined headings", () => {
    const result = parseRoadmap(`
Rust
====

Ownership
---------
- Borrowing
- Lifetimes
`);
    expect(shape(result.subject)).toEqual({
      name: "Rust",
      topics: [["Ownership", ["Borrowing", "Lifetimes"]]],
    });
  });
});

describe("lists", () => {
  it("falls back to top-level bullets as topics when there are no headings", () => {
    const result = parseRoadmap(`
- Basics
  - Variables
  - Types
- OOP
  - Classes
`);
    expect(shape(result.subject)).toEqual({
      name: "",
      topics: [
        ["Basics", ["Variables", "Types"]],
        ["OOP", ["Classes"]],
      ],
    });
    expect(result.ambiguous).toBe(false);
  });

  it("handles numbered lists and mixed markers", () => {
    const result = parseRoadmap(`
1. Basics
   * Variables
   * Types
2) OOP
   + Classes
(3) Tooling
   - Linters
`);
    expect(shape(result.subject).topics).toEqual([
      ["Basics", ["Variables", "Types"]],
      ["OOP", ["Classes"]],
      ["Tooling", ["Linters"]],
    ]);
  });

  it("treats a tab as one level deeper", () => {
    const result = parseRoadmap("- Basics\n\t- Variables\n- OOP\n\t- Classes");
    expect(shape(result.subject).topics).toEqual([
      ["Basics", ["Variables"]],
      ["OOP", ["Classes"]],
    ]);
  });

  it("does not invent a level for a stray extra space", () => {
    const result = parseRoadmap(`
- Basics
  - Variables
   - Types
- OOP
  - Classes
`);
    expect(shape(result.subject).topics).toEqual([
      ["Basics", ["Variables", "Types"]],
      ["OOP", ["Classes"]],
    ]);
  });

  it("uses a bare title line above a list as the subject", () => {
    const result = parseRoadmap(`
Python Learning Roadmap

1. Basics
   - Variables
2. OOP
   - Classes
`);
    expect(shape(result.subject)).toEqual({
      name: "Python Learning Roadmap",
      topics: [
        ["Basics", ["Variables"]],
        ["OOP", ["Classes"]],
      ],
    });
  });

  it("uses a bare title line above sibling sections as the subject", () => {
    const result = parseRoadmap(`
Learning Rust: A Structured Path

**Phase 1 — Fundamentals**
  - Ownership and borrowing
  - Structs and enums

**Phase 2 — Intermediate**
  - Traits and generics

**Phase 3 — Advanced**
  - Lifetimes in depth
`);
    expect(shape(result.subject)).toEqual({
      name: "Learning Rust: A Structured Path",
      topics: [
        ["Phase 1 — Fundamentals", ["Ownership and borrowing", "Structs and enums"]],
        ["Phase 2 — Intermediate", ["Traits and generics"]],
        ["Phase 3 — Advanced", ["Lifetimes in depth"]],
      ],
    });
    expect(result.ambiguous).toBe(false);
  });

  it("does not mistake an empty heading for a title", () => {
    const result = parseRoadmap(`
## Setup
## Basics
- a
## Advanced
- b
`);
    expect(result.subject.name).toBe("");
    expect(result.subject.topics.map((t) => t.name)).toEqual(["Setup", "Basics", "Advanced"]);
  });

  it("treats bare label lines between lists as topics", () => {
    const result = parseRoadmap(`
**Basics**
- Variables
- Types

**Advanced**
- Generics
`);
    expect(shape(result.subject)).toEqual({
      name: "",
      topics: [
        ["Basics", ["Variables", "Types"]],
        ["Advanced", ["Generics"]],
      ],
    });
  });
});

describe("cleanup", () => {
  it("strips checkboxes, emphasis, code ticks, links and trailing colons", () => {
    const result = parseRoadmap(`
# **Go**
## Basics:
- [ ] \`goroutines\`
- [x] *channels*
- [Effective Go](https://go.dev/doc/effective_go)
`);
    expect(shape(result.subject)).toEqual({
      name: "Go",
      topics: [["Basics", ["goroutines", "channels", "Effective Go"]]],
    });
  });

  it("keeps underscores, which are more often names than emphasis", () => {
    const result = parseRoadmap("# Python\n## Dunder methods\n- __init__\n- snake_case naming");
    expect(shape(result.subject).topics).toEqual([
      ["Dunder methods", ["__init__", "snake_case naming"]],
    ]);
  });

  it("ignores code fences, horizontal rules and prose commentary", () => {
    const result = parseRoadmap(`
# SQL

This roadmap assumes you already know how a relational database works.

---

## Joins
- Inner join
\`\`\`sql
SELECT * FROM a JOIN b ON a.id = b.a_id;
\`\`\`
- Outer join
`);
    expect(shape(result.subject)).toEqual({
      name: "SQL",
      topics: [["Joins", ["Inner join", "Outer join"]]],
    });
    expect(result.ignoredCount).toBeGreaterThan(0);
  });

  it("drops hard-wrapped prose, whose lines end mid-sentence", () => {
    const result = parseRoadmap(`
To learn web development you should start with HTML and CSS, then pick up
JavaScript. After that, learn a framework like React. Finally, study how
backends work and build a full-stack project.
`);
    expect(result.subject.topics).toEqual([]);
    expect(result.ambiguous).toBe(true);
  });

  it("keeps a wordy bullet, which is structure the user typed", () => {
    const result = parseRoadmap(`
# Web
## Start here
- Learn how the browser turns HTML and CSS into the page you actually see
`);
    expect(shape(result.subject).topics).toEqual([
      ["Start here", ["Learn how the browser turns HTML and CSS into the page you actually see"]],
    ]);
  });

  it("merges duplicate topics and drops duplicate subtopics", () => {
    const result = parseRoadmap(`
# Java
## Basics
- Variables
- Types
## Basics
- Types
- Loops
`);
    expect(shape(result.subject).topics).toEqual([
      ["Basics", ["Variables", "Types", "Loops"]],
    ]);
  });
});

describe("ambiguity detection", () => {
  it("flags text with no headings or lists at all", () => {
    const result = parseRoadmap(
      "Start by learning the fundamentals, then move on to the harder material.",
    );
    expect(result.ambiguous).toBe(true);
    expect(result.reasons.join(" ")).toContain("No headings or lists");
  });

  it("flags empty input", () => {
    const result = parseRoadmap("   \n\n  ");
    expect(result.ambiguous).toBe(true);
    expect(result.subject.topics).toEqual([]);
  });

  it("flags a flat list, where every topic lacks subtopics", () => {
    const result = parseRoadmap("- Variables\n- Types\n- Loops\n- Classes");
    expect(result.ambiguous).toBe(true);
    expect(result.reasons.join(" ")).toContain("no subtopics");
  });

  it("accepts a tree where at most 30% of topics are bare", () => {
    // 1 bare topic out of 4 = 25%.
    const result = parseRoadmap(`
# Ruby
## A
- a1
## B
- b1
## C
- c1
## D
`);
    expect(result.subject.topics).toHaveLength(4);
    expect(result.ambiguous).toBe(false);
  });

  it("flags a tree where more than 30% of topics are bare", () => {
    // 2 bare topics out of 4 = 50%.
    const result = parseRoadmap(`
# Ruby
## A
- a1
## B
- b1
## C
## D
`);
    expect(result.ambiguous).toBe(true);
  });
});

describe("robustness", () => {
  it("never throws on hostile input", () => {
    const inputs = [
      "",
      "#",
      "###### ",
      "-",
      "- ",
      "---",
      "```",
      "```\nunclosed fence\n",
      "*".repeat(500),
      "# a\n".repeat(200),
      "\t\t\t- deep\n",
      "1.".repeat(100),
    ];
    for (const input of inputs) {
      expect(() => parseRoadmap(input)).not.toThrow();
    }
  });

  it("produces names free of leftover markup", () => {
    const result = parseRoadmap("# ## Weird ##\n- **[a](b)**\n  - `c`");
    const names = [
      result.subject.name,
      ...result.subject.topics.flatMap((t) => [t.name, ...t.subtopics.map((s) => s.name)]),
    ];
    for (const name of names) {
      expect(name).not.toMatch(/[*`#[\]]/);
      expect(name.trim()).toBe(name);
    }
  });
});
