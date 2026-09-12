import type { LearningData, ParsedSubject, Subject } from "../types";
import { CURRENT_SCHEMA_VERSION } from "../types";
import { newId } from "./id";

/**
 * Turns a parsed tree into a stored Subject, assigning fresh IDs. Used by the
 * sample data below and, from the import flow on, by every fresh import.
 */
export function subjectFromParsed(
  parsed: ParsedSubject,
  sourceRoadmap: string,
): Subject {
  const now = new Date().toISOString();
  return {
    id: newId("subj"),
    name: parsed.name,
    sourceRoadmap,
    topics: parsed.topics.map((topic) => ({
      id: newId("top"),
      name: topic.name,
      subtopics: topic.subtopics.map((subtopic) => ({
        id: newId("sub"),
        name: subtopic.name,
        status: "not-started" as const,
      })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

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

/**
 * Hardcoded data used to exercise the storage layer before the importer
 * exists. Loaded on demand from the UI, never automatically.
 */
export function sampleData(): LearningData {
  const subject = subjectFromParsed(SAMPLE_PARSED, SAMPLE_ROADMAP);
  subject.topics[0].subtopics[0].status = "done";
  subject.topics[0].subtopics[1].status = "done";
  subject.topics[0].subtopics[2].status = "in-progress";
  subject.topics[1].subtopics[0].status = "in-progress";
  return { schemaVersion: CURRENT_SCHEMA_VERSION, subjects: [subject] };
}
