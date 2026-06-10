# Code review — APPROVED

Pipeline: `27-beamed-note-stems` (phase 4 — Code)
Reviewer: code-reviewer (iteration N=1)
Batch: `git diff 8c6a9af..HEAD` (excluding `.rp/`)

- Task 1 — bbb9751 "Shift beamed stems to the notehead edge (code-writer)"
- Task 2 — 0e5be5f "Update stem-up beam test for edge offset (code-writer)"
- Task 3 — ac5d518 "Add stem-down and per-kind beam X coverage (code-writer)"

## Verdict

Approved. The batch implements the plan exactly, satisfies spec R1–R6 and the
applicable acceptance criteria (AC1–AC4, AC7, AC8), and the unit suite passes
apart from one verified pre-existing failure (details below).

## What was verified

### Task 1 — layout.js change (traces to R1, R2, R3, R4, R5)

- `beamGeometry` (`src/notation/layout.js:505-583`) introduces `stemDx`
  (`+NOTEHEAD_RX` up / `−NOTEHEAD_RX` down) and `shiftedMembers` immediately
  after the direction is computed, exactly as the plan specifies, with the
  required explanatory comment.
- All four X readers (stems map, primary beam, secondary-beam loop, stub loop)
  plus the cosmetic `beamY` computation read `shiftedMembers`. No raw
  `members[...].x` read remains in the function body after the shift.
- `shiftedMembers` is a fresh array of fresh objects (`map` + spread); neither
  `members` nor the source notes are mutated. No new import was added
  (`NOTEHEAD_RX` was already imported).
- `src/notation/svg.js` is byte-for-byte unchanged (confirmed via diff stat
  against the base ref). `renderBeam` draws `stem.x` / `segment.x1` /
  `segment.x2` verbatim, so the offset is applied at exactly one point (R1).

### Task 2 — stem-up test update (traces to R6.1, R6.2; AC1, AC3, AC4, AC7)

- The breaking primary-beam expectation is updated to
  `{ level: 1, x1: 0 + NOTEHEAD_RX, x2: 4 + NOTEHEAD_RX }` and the test is
  extended with the stem-X array assertion and the level-1 first/last-stem
  equality (`beams[0].x1 === stems[0].x`, `beams[0].x2 === stems.at(-1).x`).
- Derived geometry uses constant expressions (`0 + NOTEHEAD_RX`), not bare
  literals, per house style.

### Task 3 — stem-down + per-kind coverage (traces to R6.2, R6.3; AC2, AC3, AC7)

- A new stem-down test (`topStep: 6, bottomStep: 6` → `direction === "down"`)
  asserts the `−NOTEHEAD_RX` stem X and the matching level-1 beam X, including
  the first/last-stem equality.
- The secondary-beam test selects the level-2 segment by
  `geo.beams.find((b) => b.level === 2)` and asserts the adjacent-stems span
  (`0 + NOTEHEAD_RX` → `4 + NOTEHEAD_RX`), not the first/last-stem rule.
- The stub test asserts the kept endpoint `x2 === 4 + NOTEHEAD_RX` and the
  unchanged length `x2 − x1 === NOTEHEAD_RX * 1.5`.
- No test outside the `beamGeometry` describe block was modified.

### Suite, scope, and pre-existing failure

- `npm run test:unit` at HEAD: 401 passed, 1 failed — the failure is the known
  `tempoLaneY` assertion (`layout.test.js:2301`, "layout-polish fixes › a head
  system opening on measure 1 …"), unrelated to this batch.
- Independently verified pre-existing: the suite was run at the base ref
  8c6a9af in a throwaway worktree and shows the identical single failure
  (400 passed, 1 failed). The batch adds exactly one passing test and breaks
  nothing.
- Scope (AC8): the only files changed are `src/notation/layout.js` and
  `src/notation/__tests__/layout.test.js`. No edits to `svg.js`, `svg.test.js`,
  `constants.test.js`, Playwright specs, editor, PHP, or view bootstrap, and
  no optional overflow/DOM tests were added (both declined per design doc).
- `biome lint` is clean on both changed files.

## Non-blocking observation

`biome format` would reflow a few of the new lines (e.g. the
`Math.min(shiftedMembers[i].beamCount, …)` line and the inline
`toMatchObject({...})` calls) — but both files already failed `biome format`
identically at the base ref, so this is pre-existing, unenforced formatting
drift in the repo, not a regression introduced by the batch. No action
required for approval.
