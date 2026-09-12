import { beforeEach, describe, expect, it } from "vitest";
import { loadData, normalizeData, resetData, saveData, STORAGE_KEYS } from "./storage";
import { sampleData } from "./sampleData";
import { emptyData } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("loadData", () => {
  it("returns empty data when nothing is stored", () => {
    expect(loadData()).toEqual(emptyData());
  });

  it("round-trips saved data", () => {
    const data = sampleData();
    saveData(data);
    expect(loadData()).toEqual(data);
  });

  it("parks unparseable data under the backup key and starts empty", () => {
    localStorage.setItem(STORAGE_KEYS.data, "{not json");
    expect(loadData()).toEqual(emptyData());
    expect(localStorage.getItem(STORAGE_KEYS.corruptBackup)).toBe("{not json");
  });

  it("parks unrecognizable data under the backup key and starts empty", () => {
    localStorage.setItem(STORAGE_KEYS.data, JSON.stringify({ hello: "world" }));
    expect(loadData()).toEqual(emptyData());
    expect(localStorage.getItem(STORAGE_KEYS.corruptBackup)).not.toBeNull();
  });

  it("drops malformed subjects rather than failing the whole load", () => {
    localStorage.setItem(
      STORAGE_KEYS.data,
      JSON.stringify({
        schemaVersion: 1,
        subjects: [
          { id: "a", name: "Good", topics: [], createdAt: "2024-01-01T00:00:00.000Z" },
          { id: "b" }, // no name
          "nonsense",
        ],
      }),
    );
    const loaded = loadData();
    expect(loaded.subjects).toHaveLength(1);
    expect(loaded.subjects[0].name).toBe("Good");
  });
});

describe("normalizeData", () => {
  it("repairs missing ids, statuses and timestamps", () => {
    const normalized = normalizeData({
      schemaVersion: 1,
      subjects: [
        {
          name: "Rust",
          topics: [{ name: "Ownership", subtopics: [{ name: "Borrowing", status: "nope" }] }],
        },
      ],
    });
    const subject = normalized!.subjects[0];
    expect(subject.id).toBeTruthy();
    expect(subject.sourceRoadmap).toBe("");
    expect(Date.parse(subject.createdAt)).not.toBeNaN();
    expect(subject.topics[0].subtopics[0].status).toBe("not-started");
  });

  it("rejects values that aren't this app's data", () => {
    expect(normalizeData(null)).toBeNull();
    expect(normalizeData([])).toBeNull();
    expect(normalizeData({ subjects: [] })).toBeNull();
    expect(normalizeData({ schemaVersion: 1 })).toBeNull();
  });

  it("keeps data written by a newer schema version rather than discarding it", () => {
    const normalized = normalizeData({
      schemaVersion: 99,
      subjects: [{ name: "Future", topics: [] }],
    });
    expect(normalized?.subjects).toHaveLength(1);
    expect(normalized?.schemaVersion).toBe(1);
  });
});

describe("resetData", () => {
  it("clears storage and returns empty data", () => {
    saveData(sampleData());
    expect(resetData()).toEqual(emptyData());
    expect(localStorage.getItem(STORAGE_KEYS.data)).toBeNull();
  });
});
