# Design-doc Research: Remove measure numbers from the notation

_Issue #25 — https://github.com/SantosGuillamot/piano-block/issues/25_

This is the running record for the design-doc phase. Each design decision traces
to a spec requirement / acceptance criterion. Options with real trade-offs are
surfaced; mechanical removals are recorded as decisions with rationale.

## Inputs

- Approved spec: `1-spec/spec.md` (R1–R5 / AC1–AC6).
- Spec research: `1-spec/spec-research.md` (grounds the code locations and the
  KEEP / REMOVE boundary).

## Grounding from the source (re-verified directly, design phase)

The label is a single, well-contained feature with one producer and one consumer:

- **Producer (model):** `src/notation/layout.js:2956-2964` — `buildSystemTexts()`
  computes `measureNumber`: `null` when the system opens on measure 1, else
  `{ text: String(head.number), x, y }` placed above-left of the first measure.
  Returned in the texts object at `layout.js:3030`
  (`return { tempos, measureNumber, ottavas }`).
- **Consumer (SVG):** `src/notation/svg.js:1104-1115` — `renderSystemTexts()`
  emits `<text data-text="measure-number" font-size=MEASURE_NUMBER_SIZE>` when
  `texts.measureNumber` is truthy.
- **Top-margin reservation:** `src/notation/layout.js:2874-2878` —
  `topMarginLayout()` sets `showsMeasureNumber = members[0]?.number !== 1` and
  folds `MEASURE_NUMBER_SIZE + 1` into `innerZone` for numbered systems. There is
  also an explanatory comment (layout.js:2870-2873) that references the measure
  number and would become stale.
- **Constant:** `src/notation/constants.js:180` — `MEASURE_NUMBER_SIZE = 2.2`,
  with a doc comment. Imported in `layout.js:49` and `svg.js:35`. After removing
  the label + reservation, BOTH uses vanish → constant + both imports are dead.
- **Internal counter (KEEP):** `src/notation/layout.js:1730-1745` — the sequential
  1..N `number` per measure, propagated to `measureModel.number` and ultimately to
  the SVG `data-measure` attribute. Unrelated to the visible label; must stay (R5 /
  AC5). Verified ottava keys off `octaveShift` and tempo off tempo diffs, NOT
  `.number`, so the counter is retained solely because it feeds `data-measure`.
- **Tests:** Only ONE test asserts the old label behavior —
  `src/notation/__tests__/layout.test.js:2218-2230` ("measure 1 is not numbered; a
  later system numbers its first measure"). Verified `svg.test.js` has NO
  `measure-number` reference (its `data-text` assertions are all for
  `annotation`/`tempo`/`ottava`), so no SVG test changes are forced by the removal.

## Q&A Log

(one topic at a time to design-doc-researcher; recorded in real time)

### Q1 — Shape of the model output: drop `measureNumber` field vs. keep it always-null?

**Spec link:** R1 (no label code path), AC6 (no dead code).

**Options:**
- **A — Remove the field entirely.** Delete the `measureNumber` computation in
  `buildSystemTexts`, drop it from the returned object (`{ tempos, ottavas }`),
  delete the `if (texts.measureNumber)` block in `renderSystemTexts`. Cleanest
  end state; no dead field; aligns with AC6. Cost: a reader doing
  `s.texts.measureNumber` gets `undefined` not `null` — but the only such reader
  is the test being replaced (svg.test.js has none).
- **B — Keep the field, force `null` always.** Smaller diff, preserves object
  shape. Cost: permanently-dead field + an unreachable consumer guard = the dead
  code AC6 warns against; stale JSDoc return type.

**Lean:** A. Field is internal model output, not a public API; B protects nothing.

**Decision: Option A — remove the field entirely.** Researcher confirmed via a
full `src/` consumer audit: `system.texts.measureNumber` is read in exactly TWO
places — the consumer guard (svg.js:1104-1105, deleted by A) and the test
(layout.test.js:2222,2226, replaced regardless). Every other `.texts` access
reads only `tempos`/`ottavas`. So `undefined`-vs-`null` breaks no real reader.

Concrete touch-points (all internal):
1. `buildSystemTexts` (layout.js:2956-2964) — delete the `measureNumber`
   computation.
2. `buildSystemTexts` return (layout.js:3030) — `return { tempos, ottavas };`.
3. `renderSystemTexts` (svg.js:1104-1115) — delete the `if (texts.measureNumber)`
   block.

**Doc-cleanliness addendum (researcher, folded into A for true AC6 compliance):**
- JSDoc return at layout.js:2928 must drop `measureNumber`:
  `@return {{ tempos: object[], ottavas: object[] }} The texts.`
- Function-header prose at layout.js:2912-2924 documents a "Measure number"
  bullet (lines 2919-2920) — trim that bullet too. Otherwise the removed field
  lingers as a documentation-level dead reference (same spirit as AC6).

**Rationale → spec:** R1 (renderer has no measure-number code path at all), AC6
(no dead code — including dead JSDoc/prose references).

### Q2 — Removing the top-margin reservation from `topMarginLayout`

**Spec link:** R4 / AC4 (no number-attributable whitespace; top margin must not
depend on the removed-number condition), R3 / AC3 (other above-staff marks stay
correctly placed — must not regress from the removal).

Current code (layout.js:2874-2878):
```
const showsMeasureNumber = members[0]?.number !== 1;
const innerZone = Math.max(
  ledgerTop,
  showsMeasureNumber ? MEASURE_NUMBER_SIZE + 1 : 0,
);
```
Plus a stale explanatory comment at layout.js:2869-2873 mentioning the measure
number / "Measure 1 is never numbered ... reserves no number room."

**Q2a — collapse `innerZone` to just `ledgerTop` (drop the `Math.max`)?**
Lean: yes. With the number term gone, `Math.max(ledgerTop)` == `ledgerTop`, so the
`Math.max` wrapper is vestigial (AC6 spirit). `ledgerTop` flows unchanged into
`d`/`topExtent` and the downstream lane stacking (annotation-above-RH, ottava,
tempo) is untouched → R3 holds. End state: `const innerZone = ledgerTop;` and
rewrite the 2869-2873 comment to drop the measure-number reference.

**Q2b — can removing the term DECREASE top margin and cause clipping/overlap
(R3/AC3 regression)?** Lean: no, airtight. The number contributed
`MEASURE_NUMBER_SIZE + 1 = 3.2`; it only bound `innerZone` when `ledgerTop < 3.2`.
In that regime `topExtent ≤ 3.2` and
`topMargin = max(SYSTEM_TOP_MARGIN=5, topExtent + ABOVE_STAFF_PAD=1) = max(5, ≤4.2)
= 5` — pinned to the floor regardless of the number. When ledger/ottava/tempo
already exceeded 3.2, THEY were binding, not the number → no change either way.
Since `3.2 < 4`, there is no path where the number alone drove `topMargin` above
the `SYSTEM_TOP_MARGIN` floor, so removal never reduces the margin below what
real content needs. Asked researcher to second-check the arithmetic.

**Decision: collapse to `const innerZone = ledgerTop;`** — delete the
`showsMeasureNumber` line (2874), drop the `Math.max` wrapper (now a one-arg
no-op), and rewrite the 2869-2873 comment to stop describing number reservation.
Researcher confirmed both sub-questions with verified constants (SYSTEM_TOP_MARGIN
= 5, ABOVE_STAFF_PAD = 1, MEASURE_NUMBER_SIZE = 2.2 ⇒ number term = 3.2) and a
full case trace:

- **Case 2 (ledgerTop ≥ 3.2):** number term never won the max → `innerZone`
  unchanged → `topMargin` pixel-identical. Trivially safe.
- **Case 1a (number binding, no above-staff lanes):** `topMargin = max(5, 4.2) =
  5` before and `max(5, <4.2) = 5` after → pixel-identical (floor absorbs it).
- **Case 1b (number binding AND a lane present):** removal lowers the lane stack
  uniformly onto `ledgerTop`; inter-lane `TEXT_LANE_GAP`s preserved, ledgers still
  cleared, no overlap/clipping introduced. This is the ONLY visible change, and it
  is precisely the intended R4/AC4 whitespace reclaim — NOT a regression.
- Arithmetic check answered: impossible for the number alone to drive `innerZone`
  above 4 (it is a constant 3.2), so it can never lift `topMargin` past the
  `SYSTEM_TOP_MARGIN=5` floor in the no-lane case.

**Rationale → spec:** R4/AC4 (top margin no longer depends on the removed-number
condition; reclaim is the intended outcome), R3/AC3 (no overlap/clipping —
downstream lane stacking untouched), AC6 (no vestigial `Math.max`/comment).

### Q3 — Remove `MEASURE_NUMBER_SIZE` constant + both imports (mechanical)

**Spec link:** AC6 (no dead code — unused constant must not linger).

Grep-verified reference set (whole repo): definition + doc comment
constants.js:179-180; import layout.js:49 (sole use = reservation at 2877,
removed in Q2); import svg.js:35 (sole use = label `font-size` at 1110, removed in
Q1). After Q1+Q2 both uses vanish → constant + doc comment + BOTH import lines are
dead and must be deleted. Asked researcher to confirm no other consumer and no
barrel/index re-export that would keep the export "used."

**Decision: delete the constant + its doc comment (constants.js:179-180) and BOTH
import lines (layout.js:49, svg.js:35).** Researcher confirmed exactly 5
references and nothing else; NO barrel/index file in `src/notation/` and NO
`export ... from` / `export *` re-export anywhere, so nothing keeps the export
"used" indirectly. AC6-clean.

### Q4 — Test replacement strategy for the removed behavior test

**Spec link:** AC1 (no measure-number text node emitted for any system in a
wrapping song), AC6 (build/lint clean). The only test asserting old behavior is
layout.test.js:2218-2230 (asserts `systems[0].texts.measureNumber` null + a later
system numbered ≥ 2); after Option A that field is gone, so this test MUST change.

**Options:**
- **A — model-level:** Replace in-place using `COMPREHENSIVE_SONG` at narrow width
  → assert EVERY system lacks a measure number
  (`model.systems.every(s => s.texts.measureNumber === undefined)`). Pros: same
  file/fixture, minimal churn, guards `buildSystemTexts`. Cons: asserts absence of
  a model key (indirect vs. the rendered DOM).
- **B — SVG/DOM-level:** New test in svg.test.js: render a wrapping song, assert
  `querySelectorAll('[data-text="measure-number"]').length === 0`. Pros: tests
  user-observable SVG, matches AC1's "no text node emitted" literally, reuses the
  existing `data-text` query idiom. Cons: new file, needs a wrapping song in the
  SVG path.
- **C — both:** model absence + DOM absence; maps AC1 to both layers.

**Lean:** C, lightweight — keep a model-level assertion in layout.test.js (guards
the producer `buildSystemTexts`) AND one DOM assertion in svg.test.js (guards the
consumer `renderSystemTexts`, matches AC1 literally). Covers both halves of the
producer/consumer split we're editing. Asked researcher whether one layer is
redundant, and whether svg.test.js has an existing wrapping-song fixture to reuse.

**Decision: Option C (lightweight) — one model-level test + one DOM-level test.**
Researcher agrees neither layer is redundant: the model test can't catch a
renderer regression and the DOM test can't pinpoint a producer regression; both
map to AC1. Concrete shapes:

- **Model test (layout.test.js, replacing 2218-2230):** reuse the in-file
  `COMPREHENSIVE_SONG` (layout.test.js:931) at width 30 (the existing wrapping
  idiom, cf. layout.test.js:1843); assert `model.systems.length > 1` (proves it
  actually wrapped — else the next assertion is vacuous), then
  `model.systems.every(s => s.texts.measureNumber === undefined)`. Prefer
  `=== undefined` over `!('measureNumber' in s.texts)` (reads better, not brittle
  to unrelated keys). Also assert `systems[0].texts` still has `tempos`/`ottavas`
  arrays so the test proves the texts object is otherwise intact (R3 adjacency).
- **DOM test (svg.test.js, NEW):** import is already in place (`renderSvg`,
  svg.test.js:13; pair with `buildLayoutModel`); render
  `renderSvg(buildLayoutModel(wrappingSong, 30))`; assert
  `svg.querySelectorAll('[data-text="measure-number"]').length === 0` (exact
  analog of the established `[data-text="annotation"]` idiom at svg.test.js:136/
  146/594). Also assert the model wrapped (`systems.length > 1`) so zero-nodes is
  not vacuously true.

**IMPORTANT practical constraint (must be a Plan-phase task):** there is NO shared
or exported wrapping fixture. svg.test.js's local `SONG` (svg.test.js:18-65) is a
2-measure single-system song that never wraps; `COMPREHENSIVE_SONG` lives in
layout.test.js:931, is local and NOT exported; there is no shared fixtures module
in `__tests__/`. So the svg.test.js DOM test needs its OWN small inline
multi-measure song that wraps at a narrow width (e.g. width 30). Recommend an
inline fixture (keeps svg.test.js self-contained, avoids coupling the two test
files) rather than exporting/duplicating `COMPREHENSIVE_SONG`.

**Rationale → spec:** AC1 (no text node emitted, asserted at both model and DOM
layers, with a wrap-guard so coverage is non-vacuous), R3 (texts object still
carries tempos/ottavas), AC6 (replaces the now-invalid old test).

## Cross-check (verified directly, post-Q&A)

- `buildSystemTexts` is called only at layout.js:2136; `renderSystemTexts` only at
  svg.js:316 (consuming `system.texts`). No other producers/consumers — the
  producer/consumer edit surface is exactly these two functions.
- `COMPREHENSIVE_SONG` defined at layout.test.js:931 (local, not exported).
- svg.test.js already imports `buildLayoutModel` (line 12) and `renderSvg`
  (line 13) — the DOM-test harness is in place; only a wrapping fixture is new.
- No re-export of `MEASURE_NUMBER_SIZE` from constants.js — dead-code chain clean.

## Consolidated Design

The change is a localized removal across two production files + one constant file,
plus a one-for-two test swap. It traces fully to the spec; no production code is
written in this phase. The complete edit set:

**Production — `src/notation/layout.js`:**
1. `topMarginLayout` (2865-2910): delete the `showsMeasureNumber` line (2874) and
   collapse `innerZone` to `const innerZone = ledgerTop;` (drop the now one-arg
   `Math.max`). Rewrite the explanatory comment (2869-2873) to stop describing
   measure-number reservation. → R4/AC4, R3/AC3.
2. `buildSystemTexts` (2930-3030): delete the `measureNumber` computation
   (2956-2964); change the return to `return { tempos, ottavas };` (3030); update
   the JSDoc return type (2928) to `{{ tempos: object[], ottavas: object[] }}`;
   trim the "Measure number" bullet from the header prose (2919-2920). → R1, AC6.
3. Remove the `MEASURE_NUMBER_SIZE` import (49). → AC6.

**Production — `src/notation/svg.js`:**
4. `renderSystemTexts` (1094-1122): delete the `if (texts.measureNumber) { … }`
   block (1104-1115); trim the "measure number" mention from the function's lead
   comment (1090-1092). → R1, AC1.
5. Remove the `MEASURE_NUMBER_SIZE` import (35). → AC6.

**Constant — `src/notation/constants.js`:**
6. Delete `MEASURE_NUMBER_SIZE` + its doc comment (179-180). → AC6.

**Tests:**
7. `src/notation/__tests__/layout.test.js`: replace the test at 2218-2230 with a
   model-level test asserting (a) `systems.length > 1`, (b) every system's
   `texts.measureNumber === undefined`, (c) `systems[0].texts` still has
   `tempos`/`ottavas`. → AC1, R3.
8. `src/notation/__tests__/svg.test.js`: NEW test rendering a NEW inline wrapping
   song at width 30, asserting `systems.length > 1` and zero
   `[data-text="measure-number"]` nodes. Requires a new inline wrapping fixture
   (none exists/shared today). → AC1.

**KEEP untouched (explicit non-edits):** the internal sequential `number`
(layout.js:1730-1745) → `measureModel.number` → SVG `data-measure` (svg.js:519)
[R5/AC5]; all tempo and ottava logic (keys off tempo diffs / `octaveShift`, never
`.number`) [R3/AC3]; the `song` attribute / schema / editor UI [out of scope].

## Open Questions

None blocking. All four design topics resolved with the researcher; every
decision traces to a spec requirement/AC. The single forward-looking item for the
Plan phase is the concrete shape of the new inline wrapping fixture in
svg.test.js (its exact measures/width) — a mechanical authoring detail, not a
design decision.

## Risks

- **R-1 (Low) — Reclaimed whitespace shifts a numbered system's lane stack
  (Case 1b).** Where the number was the binding `innerZone` term AND an above-staff
  lane is present, lanes drop onto `ledgerTop`. This is the intended R4/AC4 reclaim
  and was shown non-regressing (gaps preserved, ledgers cleared), but it is the
  only path that changes pixels. Mitigation: AC3-style test with tempo/ottava on a
  later system confirms marks remain present and unclipped.
- **R-2 (Low) — New svg.test.js fixture fails to actually wrap.** A zero-nodes
  assertion is vacuously true on a single-system song. Mitigation (already in the
  test design): assert `systems.length > 1` first.
- **R-3 (Very low) — A future reader re-adds a `measureNumber` key.** The
  `=== undefined` model assertion (not `'measureNumber' in texts`) is robust to
  unrelated key additions and would catch an actual re-add. Accepted.

