# Personal Learning Tracker

A frontend-only, local-first tracker for AI-generated learning roadmaps. Paste a
roadmap in Markdown or plain text, review the structure it gets parsed into, and
track your way through Subjects → Topics → Subtopics over time.

No backend, no accounts. Everything lives in this browser's `localStorage`.

## Running it

```bash
npm install
npm run dev      # dev server
npm run test     # unit tests (vitest)
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## Stack

React + TypeScript on Vite, Tailwind CSS, plain React state and Context. No
state-management library, no charting library, no IndexedDB — the data model is
small enough (dozens to low hundreds of topics) that a single JSON blob in
`localStorage` is the right size of solution.

## Layout

| Path | What's there |
| --- | --- |
| `src/types.ts` | The data model, plus the pre-ID `Parsed*` shapes the importers produce |
| `src/lib/storage.ts` | `loadData` / `saveData` / `resetData`, validation, and the schema-migration hook |
| `src/lib/parseRoadmap.ts` | The local Markdown / plain-text parser and its ambiguity check |
| `src/lib/normalize.ts` | Name cleanup and the normalized key used for matching and merging |
| `src/lib/draft.ts` | The editable form of a parsed subject, its edit operations and validation |
| `src/lib/progress.ts` | Completion counts for a topic, a subject, and everything |
| `src/lib/subject.ts` | Building a stored subject from a reviewed tree, and setting a status |
| `src/lib/sampleData.ts` | The built-in sample subject |
| `src/state/` | The Context that holds `LearningData` and persists it on change |
| `src/components/` | Shared UI pieces |

## Storage notes

Every `localStorage` access is wrapped: a full quota, private-browsing mode, or
a corrupted blob surfaces as a banner rather than a crash. Data that can't be
parsed is moved to `learning-tracker:data-backup` instead of being overwritten,
so it stays recoverable by hand.

`schemaVersion` is checked on load and run through a migration table. The table
is empty today — v1 is the only schema — but the plumbing is there so a future
schema change is an additive edit rather than a reason to discard saved
progress.

## Build status

- [x] 1. Scaffold, data types, storage layer, reset action
- [x] 2. Local Markdown/list parser
- [x] 3. Import flow UI (paste → parse → editable preview → save)
- [x] 4. Tracker UI (sidebar, status toggles, completion %)
- [ ] 5. Re-import / merge logic
- [ ] 6. Gemini API fallback + settings screen
- [ ] 7. JSON export / import backup

Out of scope for v1: notes, resources, spaced repetition, streaks, confidence
scores.
