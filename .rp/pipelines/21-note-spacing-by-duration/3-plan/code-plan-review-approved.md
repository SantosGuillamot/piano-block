# Code plan review — APPROVED

**Issue:** #21 — Space notes horizontally according to their duration
**Target:** `.rp/pipelines/21-note-spacing-by-duration/3-plan/code-plan.md`
**Reviewed version:** worktree commit `0647132` ("Add code plan (code-plan-writer)").
**Verdict:** APPROVED (singleton terminator). Two non-blocking nits below; neither blocks.

## Verdict summary

The code plan is complete, feasible, and faithfully aligned with `spec.md` and the
approved design doc. It is correctly scoped as a **TEST-ONLY** change touching
exactly two files (`layout.test.js`, `svg.test.js`), with **zero source edits**.
Every task block is self-contained (Goal / Files / Changes / Depends on / Traces
to / Acceptance); the per-AC coverage is exhaustive and non-overlapping; the
matcher policy invents no pixel ratios; fixtures use the repo's `{ step, octave }`
pitch objects and `{ beats, beatType }` time-signature shape; dependencies and
order are correct; acceptance criteria are objective. Every load-bearing claim was
independently verified against the live code in the worktree, and the concrete
numeric assertions were re-run through Jest.

## Independent verification (live code + live run)

**Formula / model wiring — VERIFIED**
- `advanceFor(delta, { extra }) = MIN_ADV + ADV_K·sqrt(max(delta,0)) + max(extra,0)`
  (`layout.js:778-780`).
- Column object is literally `{ onset, x, advance }` with
  `advance = advanceFor(next − onset, …)`; the last column gaps to
  `measureEnd = max(handEnd(right), handEnd(left), 0)` (`layout.js:838-849`). So
  `columns[i].advance` IS the per-column gap — the plan's "read it directly, no X
  subtraction" is correct.
- `eventDuration` / `handOnsets` / `handEnd` / `unionGrid` (`layout.js:361, 715,
  732, 752`) operate purely on `duration`/`dots` — **pitch-independent**. This is
  what makes the plan's single shared pitch-carrying fixture valid at BOTH the
  `measureLayout` layer (ignores pitches) and the `buildLayoutModel`/`renderSvg`
  layer (skips pitch-less notes). Confirmed.

**Fixture traps — VERIFIED REAL**
- **R-G (pitch-less skip):** `layout.js:1471` — `if (positions.length === 0) {
  collectEventTexts(...); return; }` returns before pushing to `notes[]`. A
  pitch-less or string-pitch note is silently dropped; fixtures fed to the
  model/render path MUST carry `{ step, octave }`. Real.
- **R-C (chord cx skew):** `svg.js:730` — `cx = note.x + (head.displaced ? dx*2 :
  0)`; `[data-notehead]` at `svg.js:738`. Single-pitch fixtures for any cx/note.x
  comparison is required; proving AC5 at `measureLayout` (not cx) is correct.
- **R-B (inter-note X-gap):** for `[8,8,8,8,q,q]` the grid is `[0,0.5,1,1.5,2,3]`,
  measureEnd 4; col3 (last-eighth → first-quarter, onset 1.5→2) is itself an
  eighth gap (Δ=0.5), and col4 (onset 2→3) is the genuine q→q gap. Confirmed live
  — comparing the eighth-led columns against **col 4**, not col 3, is necessary.

**Imports — VERIFIED (plan's "add none" is accurate)**
- `layout.test.js` imports `EMPTY_MEASURE_WIDTH`, `MAX_STRETCH`,
  `MEASURE_START_PAD` from `../constants.js` (lines 17, 23, 24) and `advanceFor`,
  `eventDuration`, `measureLayout`, `systemScale`, `buildLayoutModel`, `handEnd`,
  `handOnsets`, `unionGrid` from `../layout.js` (lines 34+). `svg.test.js` imports
  `buildLayoutModel` and `renderSvg` (lines 12-13). All needed symbols already
  exist; no new imports required.

**Reused cases / conventions — VERIFIED at cited lines**
- Empty measure `layout.test.js:841`; over-full no-throw `:852` (asserts only
  not-throw / 20 cols / finite — so AC9's all-advances-equal + strict-mono-X +
  ts-blind deep-equal are genuinely additive); under-full ts-blind `:866`;
  `systemScale` policy (ragged-last / cap / downscale) `:1789-1813`. The
  `{ beats, beatType }` time-sig shape is the repo convention at `:874`. The
  `(#13: …)` issue-in-comment convention is at `:3656`. The `renderSvg — X`
  describe naming and the hairpin feature block with trailing `(ACn)` titles are
  at `svg.test.js:1004, 1150, 1186, 1222`; the cx idiom (`#rightHand-note-${i}` →
  `[data-notehead]` → `getAttribute("cx")` + `toBeCloseTo(_, 6)`) at `:305-317`.

**Baseline — VERIFIED:** `npm run test:unit` → `Tests: 381 passed` with zero
source changes. The test-only premise holds.

**Live numeric re-run (production path through Jest) — VERIFIED:**
- AC1: grid `[0,0.5,1,1.5,2,3]`; cols 0–3 mutually equal and each
  `< col4 (q→q)`; col0 = `advanceFor(0.5)`, col4 = `advanceFor(1)`; col3 itself =
  `advanceFor(0.5)` (R-B trap genuine).
- AC3: `eventDuration({ duration:"quarter", dots:1 })` = 1.5.
- AC8: `measureLayout([q,q]).columns[0].advance` ≈ `measureLayout([8,8,8,8,q,q])
  .columns[4].advance` (both 5.2, Δ < 1e-10).
- AC10-model: `buildLayoutModel(songOf(AC1_EVENTS), 1000)` →
  `right.notes` length 6; leading-eighth gap < trailing q→q gap.
- AC7: `buildLayoutModel(8×[8,8,q,q], 140)` → 2 systems; `advanceScale =
  [1.023668…, 1]` (system 0 > 1 and ≤ MAX_STRETCH; last system 1, ragged);
  system-0 eighth gap < quarter gap; `quarterGap/eighthGap ===
  advanceFor(1)/advanceFor(0.5)`; lead-in `notes[0].x === MEASURE_START_PAD`
  (1.0) even at scale 1.0237.
- The scratch harness also incidentally tripped `@wordpress/jest-console` on a
  `console.log`, empirically confirming the plan's "no `console.*` in tests"
  constraint (plan §0, §"Final verification").

## Coverage, scope, and matcher policy

- **Coverage is exhaustive and non-overlapping.** The AC→Task map (plan lines
  457-472) maps every AC1–AC10 and every edge A–G: AC1/AC2+F/AC3/AC5/AC6 (Task 1);
  AC4+D / AC8+B / AC9 (Task 2); AC7+A / AC10-model (Task 3); AC10-DOM (Task 4);
  edges C→AC3, E→AC5, G→AC6; empty / malformed → REUSE / upstream. Matches the
  design's §3.1 seam table and §4 per-AC matrix exactly. R6 (beamed short vs
  longer) is correctly subsumed by AC1's eighth-vs-quarter ordering — beaming
  logic is out of scope and beamed eighths are merely *used* as a fixture; no
  separate test is dropped.
- **Scope stays TEST-ONLY.** Only `layout.test.js` and `svg.test.js` are touched;
  the plan repeatedly and correctly forbids editing `layout.js` / `svg.js` /
  `constants.js` / the Playwright spec / any `.rp/` artifact, and instructs the
  coder to STOP and report a blocker rather than edit source. No scope creep.
- **Matcher policy invents no pixel ratios.** Ordinal `<`/`>` (`toBeLessThan` /
  `toBeGreaterThan`, plus `toBeLessThanOrEqual(MAX_STRETCH)`) for orderings;
  `toBeCloseTo(_, 10)` for sqrt-irrational sp arithmetic and ratios (never `toBe`);
  `toBeCloseTo(_, 6)` for DOM cx; `toEqual` for exact grids / onsets / deep-equal;
  `toBe` only for the exactly-representable `MEASURE_START_PAD` (1.0). Constants
  are asserted against the import (`advanceFor(Δ)`, `MAX_STRETCH`,
  `MEASURE_START_PAD`), so a deferred OQ1/OQ2 constant tune keeps tests green as
  long as ordering holds. Faithful to the spec's "ordinal, not invented ratios".
- **Fixtures use repo shapes.** `{ step, octave }` pitch objects on every
  model/render-path event (R-G); `{ beats, beatType }` time-signature shape for
  the AC9 ts-blind deep-equal (reviewer nit 1). The `songOf` helper mirrors the
  existing `songWithNotes` (`layout.test.js:1463`); `svg.test.js` inlines its own
  song (the two files do not share fixture imports).
- **Dependencies / order correct.** Task 1 defines the shared `AC1_EVENTS` /
  `songOf`; Tasks 2 and 3 depend on Task 1 (same describe, reuse the fixture);
  Task 4 is self-contained. Acceptance criteria per task are objective and the
  cumulative test-count arithmetic (381 + 11 = 392) is internally consistent.

## Non-blocking nits (do NOT block; for the code phase)

1. **Formula line reference.** The plan cites `layout.js:778` for `advanceFor`;
   the function declaration is line 778 and its `return` is 779. Cosmetic; the
   code phase asserts against the imported `advanceFor`, never a line number.

2. **Constant import provenance.** The plan correctly says "all imports exist, add
   none", but does not spell out that `MAX_STRETCH` / `MEASURE_START_PAD` /
   `EMPTY_MEASURE_WIDTH` come from `../constants.js` while `advanceFor` /
   `measureLayout` / `buildLayoutModel` / `systemScale` come from `../layout.js`.
   Reading the existing import blocks makes this obvious and the coder won't go
   wrong, but a one-line note would preclude accidentally importing a constant
   from the wrong module (a mistake I hit in my own scratch harness — `MAX_STRETCH`
   is NOT re-exported from `layout.js`). Purely defensive; not required.

Neither nit affects correctness or the definition of done. Approved.
