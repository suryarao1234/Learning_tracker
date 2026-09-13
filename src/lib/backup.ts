import { CURRENT_SCHEMA_VERSION, type LearningData, type Subject } from "../types";
import { normalizeName } from "./normalize";
import { newId } from "./id";
import { normalizeData } from "./storage";

/**
 * Backup files hold exactly the LearningData object and nothing else. In
 * particular they never hold the Gemini API key, which lives under its own
 * storage key precisely so that it can't ride along in a file the user is
 * likely to email to themselves or drop in a shared folder.
 */

export function serializeBackup(data: LearningData): string {
  return JSON.stringify(data, null, 2);
}

export function backupFilename(date = new Date()): string {
  return `learning-tracker-${date.toISOString().slice(0, 10)}.json`;
}

export type BackupCounts = { subjects: number; topics: number; subtopics: number };

export function countContents(data: LearningData): BackupCounts {
  let topics = 0;
  let subtopics = 0;
  for (const subject of data.subjects) {
    topics += subject.topics.length;
    for (const topic of subject.topics) subtopics += topic.subtopics.length;
  }
  return { subjects: data.subjects.length, topics, subtopics };
}

/* ------------------------------------------------------------------ *
 * Reading a backup
 * ------------------------------------------------------------------ */

export type BackupReadResult =
  | { ok: true; data: LearningData; counts: BackupCounts; warning?: string }
  | { ok: false; message: string };

/**
 * Validates a file the user picked. This is the same untrusted-input problem
 * as reading from localStorage, so it runs through the same normalizer — but
 * failures are reported back to the caller for the import dialog rather than
 * through the global storage banner.
 */
export function parseBackup(text: string): BackupReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: "That file isn't valid JSON." };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "That doesn't look like a Learning Tracker backup." };
  }

  const version = (raw as Record<string, unknown>).schemaVersion;
  if (typeof version !== "number") {
    return {
      ok: false,
      message: "That file has no schemaVersion, so it isn't a Learning Tracker backup.",
    };
  }

  const data = normalizeData(raw);
  if (!data) {
    return { ok: false, message: "That backup's contents couldn't be read." };
  }

  const counts = countContents(data);
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: true,
      data,
      counts,
      warning: `This backup was written by a newer version of the app (schema ${version}). Anything this version doesn't understand has been left out.`,
    };
  }

  return { ok: true, data, counts };
}

/* ------------------------------------------------------------------ *
 * Merging a backup into what's already here
 * ------------------------------------------------------------------ */

export type BackupMergeResult = {
  data: LearningData;
  added: number;
  /** Subjects left out because one of the same name is already here. */
  skipped: string[];
};

/** Fresh IDs throughout, so an imported subject can never collide with a stored one. */
function withFreshIds(subject: Subject): Subject {
  return {
    ...subject,
    id: newId("subj"),
    topics: subject.topics.map((topic) => ({
      ...topic,
      id: newId("top"),
      subtopics: topic.subtopics.map((subtopic) => ({ ...subtopic, id: newId("sub") })),
    })),
  };
}

/**
 * Adds the subjects a backup has and the current data doesn't, leaving
 * everything already here untouched.
 *
 * Deliberately conservative about name collisions: combining two versions of
 * the same subject would mean silently picking a winner for every status that
 * differs, and getting that wrong loses progress the user can't get back. A
 * skipped subject is reported by name so they can rename one side and import
 * again, or use the roadmap re-import flow, which does ask.
 */
export function mergeBackup(
  current: LearningData,
  incoming: LearningData,
): BackupMergeResult {
  const existingNames = new Set(current.subjects.map((s) => normalizeName(s.name)));
  const added: Subject[] = [];
  const skipped: string[] = [];

  for (const subject of incoming.subjects) {
    const key = normalizeName(subject.name);
    if (existingNames.has(key)) {
      skipped.push(subject.name);
      continue;
    }
    existingNames.add(key);
    added.push(withFreshIds(subject));
  }

  return {
    data: { ...current, subjects: [...current.subjects, ...added] },
    added: added.length,
    skipped,
  };
}

/* ------------------------------------------------------------------ *
 * Download
 * ------------------------------------------------------------------ */

/** Hands the browser a file to save. Thin by design — the logic above is tested. */
export function downloadBackup(data: LearningData, filename = backupFilename()): void {
  const blob = new Blob([serializeBackup(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
