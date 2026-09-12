import { createContext } from "react";
import type { LearningData } from "../types";

export type LearningDataContextValue = {
  data: LearningData;
  /** Replaces the whole store. Every mutation helper funnels through this. */
  setData: (updater: LearningData | ((prev: LearningData) => LearningData)) => void;
  /** Wipes stored data after the caller has confirmed with the user. */
  resetAll: () => void;
  /** Replaces current data with the built-in sample subject. */
  loadSample: () => void;
  /** Most recent storage failure, or null. Cleared by dismissError. */
  storageError: string | null;
  dismissError: () => void;
};

export const LearningDataContext = createContext<LearningDataContextValue | null>(null);
