# Code Review

## Verdict: approved

## Batch scope

Tasks reviewed (Task 1–Task 8 of `3-plan/code-plan.md`):

- **Task 1** — Remove the `measureNumber` producer in `buildSystemTexts` (`layout.js`). Commit `c6073b6`.
- **Task 2** — Collapse the top-margin number reservation in `topMarginLayout` (`layout.js`). Commit `7283315`.
- **Task 3** — Remove the measure-number emit block in `renderSystemTexts` (`svg.js`). Commit `c32d38f`.
- **Task 4** — Delete the orphaned `MEASURE_NUMBER_SIZE` constant and its two imports (`constants.js`, `layout.js`, `svg.js`). Commit `ff1b810`.
- **Task 5** — Scrub the three measure-number-referencing comments outside the edited functions in `layout.js`. Commit `73f6934`.
- **Task 6** — Add a DOM-level absence test for a wrapping song in `svg.test.js`. Commit `7f10d10`.
- **Task 7** — Replace the old behavior test and add the later-system lane-placement test in `layout.test.js`. Commit `31b5857`.
- **Task 8** — Verify clean build, lint, and full test suite (verification-only, no file change). Re-run independently in this review.

Base ref: `dce90f9`. Batch diff inspected: `dce90f9..HEAD`.

## Summary

This is a clean, well-contained removal that matches the plan and design exactly. The
measure-number label was excised along its entire single producer → spacing → consumer →
constant path with no scope creep and no collateral edits: the producer
(`buildSystemTexts`) no longer computes or returns the `measureNumber` field and its dead
`const head = members[0]` binding is gone; the spacing authority (`topMarginLayout`)
collapses `innerZone` to bare `ledgerTop` with the `showsMeasureNumber` line and the
one-argument `Math.max` removed; the consumer (`renderSystemTexts`) emits no
`data-text="measure-number"` node; and the `MEASURE_NUMBER_SIZE` constant plus both
imports are deleted. The three stale comments outside the edited functions are scrubbed to
their truthful end state, while the load-bearing internal `measureNumber` counter
(`layout.js:1729/1737/1744`), its flatten block-comment, and the `data-measure` write
(`svg.js:518`) are byte-for-byte intact (R5/AC5). The committed three-test guard is present
and passes non-vacuously: model-level absence, DOM-level absence (with wrap-guard and a
tempo positive-control), and the later-system lane-placement test (the one pixel-changing
path, AC3/R3/R4). The two first-system AC2 guard tests are untouched. All three verification
gates pass and the dead-reference sweep is clean. Approved.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit suite (Jest, all gates incl. behavior verification) | `npm run test:unit` | PASS — 6 suites, 388 tests, 0 failures |
| Lint (Biome) | `npm run lint` | PASS — 23 files checked, no errors/fixes |
| Build (wp-scripts) | `npm run build` | PASS — webpack compiled successfully |
| Dead-reference sweep — `MEASURE_NUMBER_SIZE` | `grep -rn "MEASURE_NUMBER_SIZE" src/` | PASS — no matches (AC6, Task 4) |
| Dead-reference sweep — `showsMeasureNumber` | `grep -rn "showsMeasureNumber" src/` | PASS — no matches (AC6, Task 2) |
| Dead-reference sweep — `measure-number` literal | `grep -rn "measure-number" src/` | PASS — production: none; only test comments/assertions (Task 3/6/7) |
| Dead-reference sweep — `measureNumber` field | `grep -rn "measureNumber" src/` | PASS — only the kept internal counter (`layout.js:1729/1737/1744`) + test assertions; no removed model field survives |
| Kept internal index intact (R5/AC5) | read `layout.js:1725-1748`, `grep data-measure svg.js` | PASS — counter + flatten comment unchanged; `data-measure` write at `svg.js:518` intact |
| Removed dead `head` binding in `buildSystemTexts` (Task 1 Acc.) | read `buildSystemTexts` | PASS — binding gone; the `const head = members[0]` at `layout.js:1808` is the unrelated, in-use `buildLayoutModel` system-loop binding |
| `buildSystemTexts` return shape (Task 1 Acc.) | read `layout.js:3006` | PASS — `return { tempos, ottavas };` |
| Modified JSDoc/comments truthful (Task 1/3/5, AC6) | read `layout.js:1416/1711/2134`, `svg.js:1090`, `buildSystemTexts` JSDoc | PASS — all four measure-number references scrubbed; non-measure content preserved |
| AC2 guard tests unchanged | `git diff dce90f9..HEAD -- layout.test.js` hunk inspection | PASS — first-system lane/top-margin tests outside all three diff hunks; byte-for-byte unchanged |
| Three-test guard executes non-vacuously | `npm run test:unit -- --verbose -t …` | PASS — model absence, DOM absence, later-system lane placement each run and pass |

## Behavior verification

The user-observable change is the absence of the line-start measure-number label. Per this
project's verification convention the renderer is pure (layout.js no-DOM; svg.js emits a DOM
tree tested in jsdom), so the unit suite IS the behavior verification; Playwright/wp-env e2e
is out of scope for this batch. Evidence captured:

- **Model-level absence** (`layout.test.js` — "no system carries a measure number, even when
  the song wraps"): builds `buildLayoutModel(COMPREHENSIVE_SONG, 30)`, asserts
  `model.systems.length > 1` (wrap-guard, non-vacuous), then
  `model.systems.every(s => s.texts.measureNumber === undefined)`, and that the head system
  still exposes `tempos`/`ottavas` arrays. Runs and passes.
- **DOM-level absence** (`svg.test.js` — "emits no measure-number node for a song that wraps
  to multiple systems"): renders an inline wrapping fixture at width 30, asserts
  `systems.length > 1`, asserts a positive control (`[data-text="tempo"]` count > 0 so the
  query idiom genuinely matches emitted nodes), then asserts zero
  `[data-text="measure-number"]` elements. Runs and passes.
- **Later-system lane placement** (`layout.test.js` — the AC3/R3/R4 guard on the only
  pixel-changing path): programmatically `.find(...)`s a later system (`i >= 1`,
  `number !== 1`, with a tempo and an above-ottava), asserts it exists, asserts
  `tempoLaneY < ottavaAboveLaneY < rightStaffTopY` and that each tempo/ottava mark lands on
  its lane baseline. Runs and passes — confirms no clipping/off-lane shift from the reclaimed
  whitespace.
- Built output (`build/`) contains no `measure-number` reference.

## Spec acceptance coverage

- **AC1** (no label on a wrapping song) — covered at both layers: model-level absence
  (`layout.test.js`) and DOM-level absence (`svg.test.js`), both wrap-guarded.
- **AC2** (single-line song emits no label; nothing else shifts) — holds by construction
  (measure 1 never numbered) and is guarded by the unmodified first-system lane/top-margin
  tests, confirmed byte-for-byte unchanged.
- **AC3** (above-staff marks survive on later lines) — later-system lane-placement test.
- **AC4** (no reserved whitespace) — `innerZone = ledgerTop` unconditionally; the
  reservation test ("the above-staff reservation depends only on the ledger extent") shows a
  formerly-numbered later head and a measure-1 head share identical band geometry.
- **AC5** (internal index intact) — counter, flatten comment, and `data-measure` write all
  unchanged; verified by read.
- **AC6** (clean build, no dead code) — all three gates pass; dead-reference sweep clean; all
  stale JSDoc/prose scrubbed.
