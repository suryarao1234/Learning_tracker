import type { LearningData, ParsedSubject } from "../types";
import { CURRENT_SCHEMA_VERSION } from "../types";
import { subjectFromParsed } from "./subject";

const SAMPLE_ROADMAP = `# TypeScript

## Language basics
- Primitive types
- Arrays and tuples
- Type inference

## Type system
- Unions and intersections
- Generics
- Conditional types

## Tooling
- tsconfig options
- Declaration files
`;

const SAMPLE_PARSED: ParsedSubject = {
  name: "TypeScript",
  topics: [
    {
      name: "Language basics",
      subtopics: [
        { name: "Primitive types" },
        { name: "Arrays and tuples" },
        { name: "Type inference" },
      ],
    },
    {
      name: "Type system",
      subtopics: [
        { name: "Unions and intersections" },
        { name: "Generics" },
        { name: "Conditional types" },
      ],
    },
    {
      name: "Tooling",
      subtopics: [{ name: "tsconfig options" }, { name: "Declaration files" }],
    },
  ],
};

/** A ready-made subject, for trying the tracker without pasting a roadmap. */
export function sampleData(): LearningData {
  const subject = subjectFromParsed(SAMPLE_PARSED, SAMPLE_ROADMAP);
  subject.topics[0].subtopics[0].status = "done";
  subject.topics[0].subtopics[1].status = "done";
  subject.topics[0].subtopics[2].status = "in-progress";
  subject.topics[1].subtopics[0].status = "in-progress";
  return { schemaVersion: CURRENT_SCHEMA_VERSION, subjects: [subject] };
}
