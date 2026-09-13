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
| `src/lib/merge.ts` | Diffing a new roadmap against a stored subject, and applying the result |
| `src/lib/gemini.ts` | The Gemini client: model constant, prompt, response schema, failure handling |
| `src/lib/settings.ts` | The Gemini API key, stored apart from the learning data |
| `src/lib/backup.ts` | Serializing, validating and merging a JSON backup file |
| `src/lib/accent.ts` | The per-subject colour, and the contrast-safe pairings it ships with |
| `src/lib/overview.ts` | What the dashboard derives: greeting, what's next, what to resume |
| `src/lib/progress.ts` | Completion counts for a topic, a subject, and everything |
| `src/lib/subject.ts` | Building a stored subject from a reviewed tree, and setting a status |
| `src/lib/sampleData.ts` | The built-in sample subject |
| `src/state/` | The Context that holds `LearningData` and persists it on change |
| `src/components/` | Shared UI pieces |

## Look and feel

A warm cream canvas with white cards, rounded corners and a rounded display
face, so tracking progress reads as something pleasant rather than a
spreadsheet. The shell is a sidebar of subjects, an overview dashboard, and a
subject detail view.

Colour is used in two separate roles, and they never mix:

- **Subject accents** — identity only. Three hues, assigned from the subject's
  own ID so the colour follows the subject rather than its position in a list.
  Validated with the dataviz palette checker under all-pairs (any two subjects
  can end up adjacent): lightness band, chroma floor, colour-vision separation
  and normal-vision separation all pass. Green is deliberately excluded.
- **Status** — green for done, amber for in progress, reserved and never reused
  as an accent, and always carried by a text label rather than colour alone.

Every text-on-colour pairing was measured rather than eyeballed. White sits on
the blue accent at 5.7:1, but only 2.2:1 on the orange and 2.7:1 on the pink, so
those two carry dark ink instead (6.9:1 and 5.8:1) and the hero stays vibrant.
Letter avatars use a tint of the accent with its own deep ink for the same
reason.

Everything on the dashboard is derived from what's tracked. There are no
streaks, no study-time totals and no schedule, because the app stores none of
those and showing them would be invention.

## Storage notes

Every `localStorage` access is wrapped: a full quota, private-browsing mode, or
a corrupted blob surfaces as a banner rather than a crash. Data that can't be
parsed is moved to `learning-tracker:data-backup` instead of being overwritten,
so it stays recoverable by hand.

`schemaVersion` is checked on load and run through a migration table. The table
is empty today — v1 is the only schema — but the plumbing is there so a future
schema change is an additive edit rather than a reason to discard saved
progress.

## Gemini

Optional, and off until you add your own API key in Settings. The local parser
always runs first; Gemini is only asked when the local read comes out ambiguous
by the rule in `parseRoadmap.ts` (no structure found, no topics, or more than
30% of topics with no subtopics).

The key is held in `localStorage` under its own key and sent directly to
Google from the browser. That is not a secure secret store, and the settings
screen says so plainly rather than implying otherwise. It is kept separate from
the learning data so that a backup export never carries it along.

Every failure — offline, rejected key, rate limit, a response that doesn't match
the schema — falls back to the local parser's result with a visible note
explaining what happened. The model name lives in one exported constant,
`GEMINI_MODEL`.

## Backup

Settings exports the whole `LearningData` object as a dated `.json` file, and
imports one back. An imported file is untrusted input like anything else read
from outside the app, so it runs through the same normalizer as stored data:
a file that isn't JSON, or has no `schemaVersion`, is refused with a reason,
and a hand-edited one is repaired rather than rejected.

Import offers two outcomes. **Replace** swaps everything, and says so in red.
**Merge** adds only the subjects you don't already have, reassigning IDs so
nothing can collide, and names the ones it left out. Merge deliberately doesn't
try to combine two versions of the same subject: that would mean silently
picking a winner for every status that differs, and getting it wrong loses
progress that can't be recovered.

Backups never contain the Gemini API key.

## Build status

- [x] 1. Scaffold, data types, storage layer, reset action
- [x] 2. Local Markdown/list parser
- [x] 3. Import flow UI (paste → parse → editable preview → save)
- [x] 4. Tracker UI (sidebar, status toggles, completion %)
- [x] 5. Re-import / merge logic
- [x] 6. Gemini API fallback + settings screen
- [x] 7. JSON export / import backup

All seven milestones are done.

Out of scope for v1: notes, resources, spaced repetition, streaks, confidence
scores.
