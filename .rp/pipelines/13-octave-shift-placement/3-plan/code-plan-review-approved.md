# Code-plan review — APPROVED (#13)

Reviewer: `code-plan-reviewer`. Document under review:
`.rp/pipelines/13-octave-shift-placement/3-plan/code-plan.md`. Verdict: **APPROVE**.

The plan faithfully and completely implements the APPROVED design
(`2-design-doc/design-doc.md`) and satisfies every spec requirement
(`1-spec/spec.md` R1.1–R1.6, R2.1–R2.3). Every load-bearing code claim was
verified against `src/notation/layout.js`, `src/notation/svg.js`, and
`src/notation/__tests__/{layout,svg}.test.js`. The baseline was reproduced.

## Baseline reproduced

- `npm run test:unit` runs `wp-scripts test-unit-js`; raw `npx jest` is correctly
  excluded. **At HEAD (`a4d5008`): 360 tests across 6 suites, all green** — I ran
  it. The gate is keyed to "the full `npm run test:unit` suite stays green," not a
  literal count, so the historical "~1315" discrepancy is immaterial.

## Source anchors — all confirmed

- `systemHasOttavaAbove` is defined at 2649–2653 with the `rightHand || leftHand`
  OR predicate; its **only** reference is the single call at 2821 (grep: exactly
  two occurrences in `src/`, none in svg.js or tests). T2's split-and-repoint is a
  clean one-condition change with no ripple.
- Gap block (`bothInterStaff` 1858, `effectiveInterStaffGap` 1859–1862, `lhTopY`
  1863); band literal 1875–1915 with `ottavaAboveLaneY: top.ottavaAboveLaneY` at
  1886 and `aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` at 1905 — all as cited.
- `buildSystemTexts` 2859–2943: guard `if (ott && run.xs.length > 0)` at 2904,
  notehead-only span at 2911–2912, hand-agnostic "above" at 2915–2918, run init
  `run = { shift, xs: [] }` at 2931, `run.xs.push(measureModels[i].x + n.x)` at
  2936 — all as cited. T5/T6 edits land on the right lines.
- `ledgerTopExtent` 2148–2159; `measureMinLeftSteps → handStepsFor(measure?.leftHand,
  "bass")` 2184–2186; `handStepsFor(events, clef)` 2189–2203. The plan correctly
  notes the sibling's latent `"bass"` hardcode and correctly leaves it untouched
  (out of scope).
- `topMarginLayout` 2794–2839; ottava block 2821–2824; `at(null) → null` at 2832,
  so a LH-only shift yields `ottavaAboveLaneY: null` (T7 test #2 assertion sound).

## Data-path and constant validity

- `m.measure?.leftHand` (events array) and `m.ctx.leftHand.clef` are both valid
  access paths (used at 1742/2001/2061/2227 and 1759/1932/2312 respectively), so
  T1's `lhAboveTopExtent` is implementable exactly as written.
- All constants the new arm/field use (`DYNAMICS_LANE_RESERVE` 6.9, `OTTAVA_SIZE`
  2.2, `NOTE_GAP_STAFF` 1, `MID_GAP` 1.2, `INTRA_STAFF_GAP` 8, `NOTEHEAD_RX` 0.6,
  `EMPTY_MEASURE_WIDTH` 3.3, `STAFF_HEIGHT_SP` 4) are already imported into
  `layout.js`. **Zero new constants** is achievable.
- `measureModels[i]` carries `.x` (2071), `.width = scaledContent` (2072), `.right`
  / `.left` (2074–2075), and `system.measures = measureModels` (2100). Crucially
  `width` is `scaledContent` (not `ml.width` incl. trailing pad), and the right
  barline is `measureRightX = x + scaledContent` (2018), so T6's
  `x2 = lastModel.x + lastModel.width` is exactly the right-barline X. Span change
  is correct, not merely plausible.
- T1 worked numbers recomputed from `CLEF_REF.bass = {F,3,sFromBottom 6}`: C5→17→
  4.5 sp, G5→21→6.5 sp, C3→3→0 sp. Exact.

## Out-of-Scope respected

- `renderOttava` (svg.js 1149–1173) reads only `hand`, `x1`, `y`, `label`, `x2` —
  it never reads `placement`. The model contract `{ hand, label, placement, x1,
  x2, y }` is preserved; the SVG draw layer needs no edit. `ottavaFor` (1077–1086)
  returns `null` for `±3` (no `OTTAVA_LABELS` entry), which is exactly why T6 keeps
  the `&& ott` half of the guard. No schema/`ottavaFor`/`renderOttava` change.

## Regression safety — verified, not assumed

- The new gap arm is **inert for the current suite**: `hasLHOttavaAbove` is false
  for every existing fixture (grep confirms no `leftHand.octaveShift > 0`), so
  `lhAboveColumn = 0`, `bothRegions = false`, and the arm collapses to
  `rhBelowRegionReach`. I hand-verified the one fixture that asserts an exact flexed
  gap with RH dynamics + 3 below-RH notes ("adds MID_GAP only when both",
  layout.test.js 2567–2601): there `rhBelowRegionReach = max(belowRHStack, 6.9) =
  belowRHStack ≤ existing arm`, so `effectiveInterStaffGap` is byte-for-byte
  unchanged on both the `belowRHOnly` (14.316) and `both` (23.932) sides. The
  `INTRA_STAFF_GAP`-floor test (`bareSong`, 2249–2258) and the below-RH baseY tests
  (2336–2407, which read `bands.*.baseY`, computed before the gap) are likewise
  untouched.
- No existing test asserts an ottava `x1`/`x2`: all `x1`/`x2` assertions in
  layout/svg tests belong to hairpin wedges (svg.test.js 1020–1182); the only
  ottava SVG assertion is existence-only (`[data-text="ottava"]`, svg.test.js
  1300). The measure-extent span change breaks zero existing assertions.
- The RH-only top-margin split preserves the RH fixtures: "tempo, ottava… stack"
  (1972–1992, asserts every above ottava `o.y ≈ ottavaAboveLaneY`), "top margin
  flexes" (1994–2028, RH +1 vs no-shift), and "starts an 8va…" (1863–1870) are all
  RH-only, so RH "above" still selects `ottavaAboveLaneY` and the predicate split
  is invisible to them.

## Task quality, ordering, dependencies

- Each task block is concrete and independently TDD-implementable. Dependency edges
  are correct: **T3** needs T1 (`lhAboveTopExtent`) + T2 (`systemHasLeftOttavaAbove`);
  **T4** needs T3 (`hasLHOttavaAbove`/`lhAboveExtent` + reserved room); **T5** needs
  T4 (`band.ottavaLeftAboveLaneY`); **T6** is independent of the Bug-1 chain but
  shares `flush()` and is sequenced after for a clean history; **T7** needs T1–T6.
  T2 correctly repoints the single `topMarginLayout` call.
- The two folded-in non-blocking notes are handled sanely and without over-reach:
  (1) T1 reads `m.ctx.leftHand.clef` (strictly more correct, regression-free; the
  sibling `measureMinLeftSteps` is explicitly left untouched); (2) T7 enforces the
  glyph-top-vs-`rightStaffBottomY` bound as `>=` rather than over-asserting a strict
  `>` the spec does not require (it can touch equality only in the content-free
  extreme). KD6's "no `?? ottavaAboveLaneY` fallback" is correctly carried into T5.

## Acceptance ↔ spec mapping

The five T7 tests map 1:1 to the spec's "New tests to add": (1) LH-above
placement + Y in the gap, not the top-margin lane, with strict baseline-above-LH
bound (sound: `ottavaLeftAboveLaneY = lhTopY − max(...) − NOTE_GAP_STAFF`, and
`NOTE_GAP_STAFF = 1 > 0`); (2) LH-only no top-margin over-reservation
(`ottavaAboveLaneY` null, equal `topMargin`); (3) both-hands distinct Ys with
`ottavaAboveLaneY < ottavaLeftAboveLaneY` (geometrically forced: top-margin lane is
above `rightStaffTopY`, gap lane below `rightStaffBottomY`); (4) rest-only emission
+ sparse measure-extent span (R2.1/R2.2); (5) multi-system one-per-system restate
(R2.3 — structurally guaranteed by the per-system `measureModels` slice at 1786/
1965/2086). The full-suite green gate is keyed to `npm run test:unit`.

## Conclusion

No substantive defect found: no task is unimplementable as written, no requirement
is missing, no dependency/order is wrong, and the test gate is correct. **APPROVED.**
