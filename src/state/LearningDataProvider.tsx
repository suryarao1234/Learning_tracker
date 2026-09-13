import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadData, onStorageError, resetData, saveData } from "../lib/storage";
import { sampleData } from "../lib/sampleData";
import { loadGeminiApiKey, saveGeminiApiKey } from "../lib/settings";
import { setSubtopicStatus as applySubtopicStatus } from "../lib/subject";
import type { LearningData, Subject, SubtopicStatus } from "../types";
import { LearningDataContext, type LearningDataContextValue } from "./learningDataContext";

export function LearningDataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<LearningData>(() => loadData());
  const [storageError, setStorageError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => loadGeminiApiKey());

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

  const updateSubject = useCallback((subject: Subject) => {
    setDataState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((existing) =>
        existing.id === subject.id ? subject : existing,
      ),
    }));
  }, []);

  const setSubtopicStatus = useCallback(
    (subjectId: string, topicId: string, subtopicId: string, status: SubtopicStatus) => {
      setDataState((prev) =>
        applySubtopicStatus(prev, subjectId, topicId, subtopicId, status),
      );
    },
    [],
  );

  const setGeminiApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    saveGeminiApiKey(trimmed);
    setGeminiApiKeyState(trimmed);
  }, []);

  const resetAll = useCallback(() => {
    setDataState(resetData());
  }, []);

  const loadSample = useCallback(() => {
    setDataState(sampleData());
  }, []);

  const dismissError = useCallback(() => setStorageError(null), []);

  const value = useMemo<LearningDataContextValue>(
    () => ({
      data,
      setData,
      addSubject,
      updateSubject,
      setSubtopicStatus,
      geminiApiKey,
      setGeminiApiKey,
      resetAll,
      loadSample,
      storageError,
      dismissError,
    }),
    [
      data,
      setData,
      addSubject,
      updateSubject,
      setSubtopicStatus,
      geminiApiKey,
      setGeminiApiKey,
      resetAll,
      loadSample,
      storageError,
      dismissError,
    ],
  );

  return (
    <LearningDataContext.Provider value={value}>{children}</LearningDataContext.Provider>
  );
}
