export const CURRENT_SCHEMA_VERSION = 1;

export type SubtopicStatus = "not-started" | "in-progress" | "done";

export type Subtopic = {
  id: string;
  name: string;
  status: SubtopicStatus;
};

export type Topic = {
  id: string;
  name: string;
  subtopics: Subtopic[];
};

export type Subject = {
  id: string;
  name: string;
  /** Raw pasted text, preserved permanently so a roadmap can be re-parsed later. */
  sourceRoadmap: string;
  topics: Topic[];
  createdAt: string;
  updatedAt: string;
};

export type LearningData = {
  schemaVersion: 1;
  subjects: Subject[];
};

/** The shape the parsers (local or Gemini) produce, before IDs are assigned. */
export type ParsedSubject = {
  name: string;
  topics: ParsedTopic[];
};

export type ParsedTopic = {
  name: string;
  subtopics: ParsedSubtopic[];
};

export type ParsedSubtopic = {
  name: string;
};

export function emptyData(): LearningData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, subjects: [] };
}
