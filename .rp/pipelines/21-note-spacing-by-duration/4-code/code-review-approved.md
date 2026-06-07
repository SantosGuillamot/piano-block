# Code review — Issue #21 (phase 4, code) — APPROVED

**Verdict: APPROVED.** The full phase-4 batch (code-plan Tasks 1–4) is correct,
in scope, and complete. `npm run test:unit` is green at **392 passed** (381
baseline + 11 new), with **zero source changes**. Reviewed `cf5b488..HEAD`; the
working tree is clean.

## Scope (TEST-ONLY) — PASS

- `git diff --stat cf5b488..HEAD` shows ONLY the two test files:
  `src/notation/__tests__/layout.test.js` (+233) and
  `src/notation/__tests__/svg.test.js` (+42). No source (`layout.js`, `svg.js`,
  `constants.js`), no `.rp/`, no Playwright spec touched.
- No `console.*` in the additions (the `@wordpress/jest-console` preset would
  auto-fail).
- No new imports added. The one `import` substring in the diff is inside a
  comment. All symbols used are pre-existing imports: `advanceFor`,
  `eventDuration`, `measureLayout`, `buildLayoutModel` from `../layout.js`;
  `MAX_STRETCH`, `MEASURE_START_PAD` from `../constants.js`; `buildLayoutModel` +
  `renderSvg` in `svg.test.js`.

## Coverage (AC1–AC10 + edges A–G) — PASS

11 new `it`s, one per the plan's AC→Task map:

| AC / edge | Test | Seam |
| --- | --- | --- |
| AC1 | "spaces equal eighth columns equally and tighter than the quarter column" | layout |
| AC2 + edge F | "orders advances strictly by duration across the whole range" (5-link chain; first link is edge F) | layout |
| AC3 + edge C | "places a dotted quarter strictly between a quarter and a half" | layout |
| AC5 + edge E | "gives a chord the same column footprint as a single note of the same duration" | layout |
| AC6 + edge G | "spaces a single-duration measure uniformly" | layout |
| AC4 + edge D | "spaces rests by duration as full grid citizens" | layout |
| AC8 + edge B | "gives a quarter the same intrinsic advance regardless of its measure or neighbours" | layout |
| AC9 | "lays out an over-full measure blind to the time signature" | layout |
| AC7 + edge A | "preserves eighth-vs-quarter ordering and ratio under justification" | model |
| AC10 (model) | "keeps the eighth note.x gaps tighter than the q→q gap end-to-end" | model |
| AC10 (DOM) | "renders eighth noteheads closer together than the quarter noteheads" | render/DOM |

Canonical `AC1_EVENTS` + `songOf` are defined once at the top of the layout
describe and reused by AC8/AC9/AC10-model; the `svg.test.js` AC10-DOM fixture is
inlined (the two files share no fixture import, per design D-Fixtures). Empty /
malformed / `systemScale`-policy / under-full cases are correctly REUSED, not
duplicated.

## Correctness (non-vacuous, regression-catching) — PASS

Each assertion was checked against the live source and behaves exactly as
asserted (verified with a throwaway scratch run against `layout.js`, no edits
left behind):

- **AC1**: grid `[0, 0.5, 1, 1.5, 2, 3]`; cols 0–3 advance = `advanceFor(0.5)`
  (eighth), col 4 = `advanceFor(1)` (genuine q→q). The boundary col 3
  (onset 1.5→2) is itself an eighth gap (4.3213), so comparing cols 0–3 against
  **col 4** (not col 3) is the correct R-B-honoring choice.
- **AC3**: `eventDuration({duration:"quarter",dots:1})` = `BASE_DUR.quarter *
  DOT_MUL[1]` = 1.5 → `advanceFor(1.5)` = 5.8742, strictly between
  `advanceFor(1)` and `advanceFor(2)`.
- **AC7**: width 140 yields exactly 2 systems; system-0 scale ≈ 1.0237 (asserted
  by range `> 1` and `≤ MAX_STRETCH`, not the literal); last system ragged
  (`advanceScale === 1`); `notes[0].x === MEASURE_START_PAD` (lead-in unscaled);
  `eighthGap < quarterGap`; and `quarterGap/eighthGap === advanceFor(1)/
  advanceFor(0.5)` (the uniform scalar cancels — a genuine ratio-preservation
  lock that would fail if justification ceased to be a single scalar).
- **AC10 model/DOM**: the canonical `[8,8,8,8,q,q]` fixture surfaces 6 notes;
  leading-eighth gap < trailing q→q gap. The DOM test additionally guards all
  six `#rightHand-note-${i}` groups exist before reading `cx`.

These are not tautological — AC1/AC10 would fail under a flattened-spacing
regression, AC2 under any monotonicity break, AC7 under a non-uniform stretch.

### Traps honored

- **R-A**: every numeric expectation is `advanceFor(Δ)` / `MAX_STRETCH` /
  `MEASURE_START_PAD`; no raw `4.3213`/`5.2`/`1.0237` literals — a deferred
  OQ1/OQ2 constant tune keeps the suite green as long as ordering holds.
- **R-B**: eighth-led columns compared against the genuine q→q column (col 4 at
  layout; cols 2→3 / last-two in `[8,8,q,q]` and `[8,8,8,8,q,q]`), never the
  eighth-governed boundary.
- **R-C**: `cx`/`note.x` comparisons use single-pitch fixtures; AC5 proven at the
  `measureLayout` onset-grid level (advance + grid equality), not at `cx`.
- **R-D**: no cross-system absolute-gap assertion — no `systems[1]` note.x diff
  anywhere; AC8 is intrinsic-layer only.
- **R-G**: fixtures carry `{step, octave}` pitches; AC10-model asserts
  `notes.toHaveLength(6)` and AC9 `columns.toHaveLength(20)`, so a pitch-less
  skip fails loudly rather than silently passing.

## Matcher policy & conventions — PASS

- `toBeLessThan`/`toBeGreaterThan` (no tolerance) for ordering;
  `toBeLessThanOrEqual(MAX_STRETCH)` for the cap.
- `toBeCloseTo(_, 10)` for all sqrt-irrational sp arithmetic, ratios, and
  cross-measure equality; never `toBe` on an irrational.
- `toEqual` for grids and the AC9 ts-blind deep-equal (`{ beats, beatType }`
  shape used).
- `toBe` only for the exactly-representable cases: `MEASURE_START_PAD`, the
  ragged-last `advanceScale === 1`, and the finite-boolean `=== true`.
- The DOM AC10 inequality needs no tolerance; the `toBeCloseTo(_, 6)` DOM idiom
  was correctly not forced where an exact `< ` ordering suffices.
- Describe titles match exactly: `"duration-ordered horizontal spacing
  (issue #21)"` and `"renderSvg — duration-ordered spacing reaches the SVG
  (issue #21)"`. `it()` titles are behavior-first with a trailing `(ACn)`; the
  issue number lives only in the describe / block comment.

## Suite — PASS

`npm run test:unit` → `Test Suites: 6 passed`, `Tests: 392 passed, 392 total`,
~0.7s. Matches the planned +11. Working tree clean after review.

## Non-blocking nits (do NOT block)

1. **AC2 docstring count.** The comment calls it a "six-way strict chain" while
   the body is five `toBeLessThan` links over six durations (correct — 6 values
   need 5 links). Wording only; the assertions are right.
2. **Last-system `toBe(1)`.** `advanceScale === 1` for the ragged last system is
   an exact clamp floor, so `toBe(1)` is fine; if a future change ever made the
   ragged scale a computed value, `toBeCloseTo` would be safer. Not an issue
   today.

None of these affect correctness, scope, or the green suite. Approved as the
singleton terminator for phase 4.
