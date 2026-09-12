import { useContext } from "react";
import { LearningDataContext, type LearningDataContextValue } from "./learningDataContext";

export function useLearningData(): LearningDataContextValue {
  const value = useContext(LearningDataContext);
  if (!value) {
    throw new Error("useLearningData must be used inside <LearningDataProvider>");
  }
  return value;
}
