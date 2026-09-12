import {
  CURRENT_SCHEMA_VERSION,
  emptyData,
  type LearningData,
  type Subject,
  type Subtopic,
  type SubtopicStatus,
  type Topic,
} from "../types";
import { newId } from "./id";

export const STORAGE_KEYS = {
  data: "learning-tracker:data",
  /** Where a corrupted blob is parked instead of being silently overwritten. */
  corruptBackup: "learning-tracker:data-backup",
} as const;

/* ------------------------------------------------------------------ *
 * Error reporting
 *
 * localStorage fails in real, boring ways: quota exceeded, Safari private
 * browsing, a corrupted blob, disabled site data. None of those should take
 * the app down, but the user should still be told, so failures are reported
 * through listeners instead of thrown.
 * ------------------------------------------------------------------ */

export type StorageErrorListener = (message: string) => void;

const errorListeners = new Set<StorageErrorListener>();

export function onStorageError(listener: StorageErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function reportError(message: string, cause?: unknown): void {
  if (cause !== undefined) console.error(message, cause);
  for (const listener of errorListeners) {
    try {
      listener(message);
    } catch {
      /* a broken listener must not break storage */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Raw localStorage access (never throws)
 * ------------------------------------------------------------------ */

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    reportError(
      "Couldn't read from this browser's local storage. Your progress won't be remembered in this session.",
      err,
    );
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    const quotaExceeded =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    reportError(
      quotaExceeded
        ? "This browser's local storage is full, so the last change wasn't saved. Export a backup and remove some subjects."
        : "Couldn't save to this browser's local storage, so the last change wasn't saved. Private browsing mode is the usual cause.",
      err,
    );
    return false;
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    reportError("Couldn't clear this browser's local storage.", err);
  }
}

/* ------------------------------------------------------------------ *
 * Validation / normalization
 *
 * Anything read back from storage is untrusted: it may come from an older
 * build, a hand-edited blob, or a truncated write. Rather than trusting the
 * declared type, every field is coerced back into shape and anything
 * unrecoverable is dropped.
 * ------------------------------------------------------------------ */

const STATUSES: SubtopicStatus[] = ["not-started", "in-progress", "done"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asIsoDate(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return new Date().toISOString();
}

function normalizeSubtopic(raw: unknown): Subtopic | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name).trim();
  if (!name) return null;
  const status = STATUSES.includes(raw.status as SubtopicStatus)
    ? (raw.status as SubtopicStatus)
    : "not-started";
  return { id: asString(raw.id) || newId("sub"), name, status };
}

function normalizeTopic(raw: unknown): Topic | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name).trim();
  if (!name) return null;
  const subtopics = Array.isArray(raw.subtopics)
    ? raw.subtopics.map(normalizeSubtopic).filter((s): s is Subtopic => s !== null)
    : [];
  return { id: asString(raw.id) || newId("top"), name, subtopics };
}

function normalizeSubject(raw: unknown): Subject | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name).trim();
  if (!name) return null;
  const topics = Array.isArray(raw.topics)
    ? raw.topics.map(normalizeTopic).filter((t): t is Topic => t !== null)
    : [];
  return {
    id: asString(raw.id) || newId("subj"),
    name,
    sourceRoadmap: asString(raw.sourceRoadmap),
    topics,
    createdAt: asIsoDate(raw.createdAt),
    updatedAt: asIsoDate(raw.updatedAt),
  };
}

/**
 * Coerce an arbitrary parsed value into valid LearningData.
 * Returns null only when the value isn't recognizable as this app's data at all.
 */
export function normalizeData(raw: unknown): LearningData | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.schemaVersion !== "number") return null;
  if (!Array.isArray(raw.subjects)) return null;
  const subjects = raw.subjects
    .map(normalizeSubject)
    .filter((s): s is Subject => s !== null);
  return { schemaVersion: CURRENT_SCHEMA_VERSION, subjects };
}

/* ------------------------------------------------------------------ *
 * Migrations
 *
 * Each entry upgrades data from version N to version N+1. There is nothing to
 * do at v1 today, but the machinery exists so a future schema change is an
 * additive edit here rather than a reason to discard everyone's data.
 * ------------------------------------------------------------------ */

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 1: (data) => ({ ...data, schemaVersion: 2, /* ...changes... */ }),
};

export function migrate(raw: unknown): LearningData | null {
  if (!isRecord(raw)) return null;
  let current = raw;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    // Data written by a newer build of the app. Normalizing is the best we can
    // do; unknown fields are dropped rather than guessed at.
    reportError(
      "This data was saved by a newer version of the app. Some information may not be shown correctly.",
    );
    return normalizeData(current);
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      reportError(`No migration available from schema version ${version}.`);
      return normalizeData({ ...current, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
    current = migration(current);
    version = typeof current.schemaVersion === "number" ? current.schemaVersion : version + 1;
  }

  return normalizeData(current);
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function loadData(): LearningData {
  const raw = safeGetItem(STORAGE_KEYS.data);
  if (raw === null) return emptyData();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Park the unreadable blob rather than overwriting it — it may still be
    // recoverable by hand, and quietly destroying someone's progress is worse
    // than starting empty.
    safeSetItem(STORAGE_KEYS.corruptBackup, raw);
    reportError(
      "Your saved data couldn't be read and has been set aside under a backup key. Starting with an empty tracker.",
      err,
    );
    return emptyData();
  }

  const migrated = migrate(parsed);
  if (!migrated) {
    safeSetItem(STORAGE_KEYS.corruptBackup, raw);
    reportError(
      "Your saved data wasn't in a recognizable format and has been set aside under a backup key. Starting with an empty tracker.",
    );
    return emptyData();
  }
  return migrated;
}

export function saveData(data: LearningData): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch (err) {
    reportError("Couldn't serialize your data, so the last change wasn't saved.", err);
    return;
  }
  safeSetItem(STORAGE_KEYS.data, serialized);
}

/** Wipes stored learning data. The confirmation prompt belongs in the UI. */
export function resetData(): LearningData {
  safeRemoveItem(STORAGE_KEYS.data);
  return emptyData();
}
