import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadData, onStorageError, resetData, saveData } from "../lib/storage";
import { sampleData } from "../lib/sampleData";
import type { LearningData, Subject } from "../types";
import { LearningDataContext, type LearningDataContextValue } from "./learningDataContext";

export function LearningDataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<LearningData>(() => loadData());
  const [storageError, setStorageError] = useState<string | null>(null);

  // Skip the write that would otherwise fire immediately after the initial
  // load: it saves nothing new, and if the stored blob was unreadable it would
  // overwrite the one copy the user might still recover by hand.
  const isFirstRender = useRef(true);

  useEffect(() => onStorageError(setStorageError), []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveData(data);
  }, [data]);

  const setData = useCallback<LearningDataContextValue["setData"]>((updater) => {
    setDataState((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const addSubject = useCallback((subject: Subject) => {
    setDataState((prev) => ({ ...prev, subjects: [...prev.subjects, subject] }));
  }, []);

  const resetAll = useCallback(() => {
    setDataState(resetData());
  }, []);

  const loadSample = useCallback(() => {
    setDataState(sampleData());
  }, []);

  const dismissError = useCallback(() => setStorageError(null), []);

  const value = useMemo<LearningDataContextValue>(
    () => ({ data, setData, addSubject, resetAll, loadSample, storageError, dismissError }),
    [data, setData, addSubject, resetAll, loadSample, storageError, dismissError],
  );

  return (
    <LearningDataContext.Provider value={value}>{children}</LearningDataContext.Provider>
  );
}
