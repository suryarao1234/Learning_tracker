import { createContext } from "react";
import type { LearningData, Subject, SubtopicStatus } from "../types";

export type LearningDataContextValue = {
  data: LearningData;
  /** Replaces the whole store. Every mutation helper funnels through this. */
  setData: (updater: LearningData | ((prev: LearningData) => LearningData)) => void;
  /** Appends a fully-formed subject, IDs already assigned. */
  addSubject: (subject: Subject) => void;
  /** Replaces a subject in place, matched by ID. Used by the re-import merge. */
  updateSubject: (subject: Subject) => void;
  /** Marks one subtopic. A no-op click changes nothing and saves nothing. */
  setSubtopicStatus: (
    subjectId: string,
    topicId: string,
    subtopicId: string,
    status: SubtopicStatus,
  ) => void;
  /** Wipes stored data after the caller has confirmed with the user. */
  resetAll: () => void;
  /** Replaces current data with the built-in sample subject. */
  loadSample: () => void;
  /** Most recent storage failure, or null. Cleared by dismissError. */
  storageError: string | null;
  dismissError: () => void;
};

export const LearningDataContext = createContext<LearningDataContextValue | null>(null);
