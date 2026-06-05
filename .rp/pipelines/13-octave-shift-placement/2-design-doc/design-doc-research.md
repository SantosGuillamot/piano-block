# Design-doc research — Fix octaveShift ottava placement (#13)

Phase: Design (analyst). Running record of the architecture/technical Q&A between
`design-doc-analyst` (decides) and `design-doc-researcher` (gathers evidence). The
`design-doc-writer` consumes this afterward to author `design-doc.md`.

This phase settles HOW to implement the approved `spec.md`, not WHAT to build. The
spec (R1.1–R1.6, R2.1–R2.3) is the contract; Out of Scope is fixed (no `ottavaFor`
change, no schema change, `renderOttava` stays as-is — it must keep consuming the
same `{ hand, label, placement, x1, x2, y }` model).

## Design surface (grounded in code, pre-Q&A)

All in `src/notation/layout.js` unless noted.

Bug 1 (LH-above placement) and Bug 2 (rest-only/sparse span) both live in
`buildSystemTexts` (2859–2943), specifically the ottava `flush()` (2899–2940):

- `2904` — `if (ott && run.xs.length > 0)`: skip-when-no-noteheads → Bug 2 drop.
- `2911–2912` — `x1 = Math.min(...run.xs) − NOTEHEAD_RX`, `x2 = Math.max(...run.xs)
  + NOTEHEAD_RX`: notehead-only span → Bug 2 under-span.
- `2915–2918` — `placement === "above" ? band.ottavaAboveLaneY : staffBottomY + 2`:
  the "above" branch is hand-AGNOSTIC (always the top-margin lane) → Bug 1.
- `2933–2937` — `run.xs` is filled ONLY from `laid.notes` (noteheads).

Vertical layout (the band, 1875–1915) and its flexes:

- `effectiveInterStaffGap` (1858–1863) = `max(INTRA_STAFF_GAP, belowRHStack +
  aboveLHStack + (both ? MID_GAP : 0))`. Flexes only for the below-RH and above-LH
  NOTE-STACK depths — NOT for raw LH ledger/high-note extent, NOT for any ottava.
- `lhTopY = rhBottomY + effectiveInterStaffGap` (1863); `band.leftStaffTopY = lhTopY`.
- `belowRHStack = stackDepth(occ.belowRH, belowRHBase)` (1841); `belowRHBase =
  DYNAMICS_LANE_RESERVE (6.9)` when RH has a point dynamic OR hairpin, else
  `NOTE_GAP_STAFF (1)` (1833–1835). `stackDepth(n, base) = n>0 ? base + (n−1)*STACK_STEP
  + DESCENT : 0` (1839–1840). So belowRHStack is 0 when there are no below-RH NOTES,
  even if the RH prints a dynamic with no below-note. (Confirm in Q.)
- `aboveLHStack = stackDepth(occ.aboveLH, NOTE_GAP_STAFF)` (1844) — above-LH NOTE
  annotations only; raw LH high notes/ledgers are NOT in here.
- `band.bands.aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` (1905) — the existing
  above-LH note band, grows up into the gap.

Top margin: `topMarginLayout` (2794–2839) stacks above-RH notes, then (if
`systemHasOttavaAbove`) an ottava lane (`ottavaAboveLaneY`), then tempo. The trigger
`systemHasOttavaAbove` (2649–2653) = `rightHand.octaveShift > 0 || leftHand.octaveShift
> 0` — fires on EITHER hand (R1.5: must become RH-only).

Constants (constants.js): `OTTAVA_SIZE=2.2`, `NOTE_GAP_STAFF=1`, `INTRA_STAFF_GAP=8`,
`MID_GAP=1.2`, `STACK_STEP=NOTE_SIZE+TEXT_LANE_GAP=3.4`, `DESCENT=0.22*NOTE_SIZE=0.616`,
`DYNAMICS_LANE_RESERVE=6.9`, `NOTEHEAD_RX=0.6`, `EMPTY_MEASURE_WIDTH=3.3`,
`STAFF_HEIGHT_SP=4`, `ABOVE_STAFF_PAD=1`, `TEXT_LANE_GAP=0.6`.

SVG: `renderOttava` (svg.js:1149–1173) reads `ottava.x1/x2/y/label/hand`. The label
text anchors at `x1`; the dashed line runs `x1 + OTTAVA_SIZE*1.5 .. x2` at `y`. So
`y` is a text baseline (label + bracket line share it).

## Open design topics (to close in Q&A)

1. The new LH-above lane: where in the gap, how its Y is computed, what it must clear.
2. How `effectiveInterStaffGap` must reserve room for that lane (and the missing raw
   LH ledger extent + RH dynamics-row reach it must also clear).
3. Splitting `systemHasOttavaAbove` per hand (RH drives top margin; LH drives gap).
4. Both-hands-above coexistence (falls out of 1–3, but verify no overlap).
5. The per-system x-span rule (measure extent + first-note left refinement) for Bug 2.
6. The model contract handed to `renderOttava` (must stay `{hand,label,placement,
   x1,x2,y}`); confirm nothing else reads ottava fields.
7. New constants/fields on `band`; data flow between `effectiveInterStaffGap`,
   `topMarginLayout`, `band`, and `buildSystemTexts`.

## Settled independently (analyst code-reading, pre/parallel to Q&A)

### Model contract to `renderOttava` (topic 6) — SETTLED, no change.
The ONLY consumer of `texts.ottavas` is the loop at `svg.js:1117-1118` →
`renderOttava` (`svg.js:1149-1173`), which reads exactly `ottava.hand` (→ `data-hand`),
`ottava.label`, `ottava.x1`, `ottava.x2`, `ottava.y`. `ottava.placement` is consumed
ONLY inside `buildSystemTexts` to choose `y`; the SVG layer never reads it. So the
emitted model object stays `{ hand, label, placement, x1, x2, y }` — NO new fields.
The LH-above fix is purely a different `y` value (and a corrected x-span) computed in
`buildSystemTexts`; `renderOttava` is untouched (matches spec Out-of-Scope).

### Geometry primitives confirmed (for the Q&A decisions):
- Top staff line is `sFromBottom = 8` in any clef's own frame; `staffStepToY(s,
  bottomLineY) = bottomLineY − s*0.5` (`layout.js:148-149`). So a LH note at step
  `s > 8` sits `(s−8)*0.5` sp above the LH top line — `lhAboveTopExtent` can mirror
  `ledgerTopExtent` (`layout.js:2148-2159`) over LH/bass notes.
- RH below-staff region lower edges (relative to rhBottomY): hairpin lane lower edge
  `= HAIRPIN_LANE_DY(3.0) + HAIRPIN_APERTURE/2(0.5) = 3.5`; point-dynamic baseline
  `≈ 3.5` with glyph body extending further down. `DYNAMICS_LANE_RESERVE(6.9)` is the
  dodge a below-NOTE uses, NOT the row's own reach (constants.js:183-196).
- `belowRHStack = stackDepth(occ.belowRH, belowRHBase)` is 0 when `occ.belowRH===0`,
  EVEN IF the RH prints a dynamic/hairpin (`stackDepth` returns 0 for n=0,
  `layout.js:1839-1840`). So a dynamics-only/hairpin-only RH reaches ~rhBottomY+3.5
  but contributes 0 to `effectiveInterStaffGap` today — the gap-reservation hole the
  LH-above lane must independently cover. (To be confirmed by researcher in Q1.)

### Test-preservation constraints the design must respect:
- `layout.test.js:1989-1991` asserts EVERY "above" ottava sits at
  `band.ottavaAboveLaneY` (COMPREHENSIVE_SONG = RH-only +1). ⇒ the design MUST keep
  `ottavaAboveLaneY` as the RH-above lane and put the LH-above lane on a SEPARATE band
  field. The "above" branch in `buildSystemTexts` selects per hand.
- `layout.test.js:1979-1985` asserts top-margin stacking order (RH content only) —
  unaffected by an inter-staff-gap LH lane.
- `layout.test.js:1994-2028` "top margin flexes" compares RH+1 vs no-shift — the
  per-hand `systemHasOttavaAbove` split must keep RH+1 reserving the top lane.

## Q&A log

(Questions sent one at a time; evidence + decision recorded as each resolves.)

### Q1 — RESOLVED. Bounds of the new LH-above lane; the gap-reservation hole.

Researcher evidence (confirming the analyst's independent read):
- (a) LH high-note extent above the LH top line: NO helper computes it today.
  `ledgerTopExtent` (2148) scans the RH/treble staff only. `handStepsFor(events,
  clef)` (2189) already exists and works for any clef — `measureMinLeftSteps` calls
  it with `"bass"` for the BOTTOM extent. So a new `lhAboveTopExtent(members)` can
  mirror `ledgerTopExtent` using bass steps: per measure, max LH `sFromBottom`, →
  `max(0, (maxLeftStep − 8) * 0.5)` sp above lhTopY. (Top line = sFromBottom 8;
  0.5 sp/step — confirmed `staffStepToY`, layout.js:148-149.) Today NOTHING reserves
  gap room for raw LH high notes, so a fixed `leftStaffTopY − k` ottava collides with
  them (draws the 8va BELOW the notes) — exactly the spec R1.3 rejection.
- (b) RH below-staff region reach: confirmed `belowRHStack = stackDepth(occ.belowRH,
  belowRHBase)` is 0 when `occ.belowRH === 0`, EVEN IF the RH prints a dynamic or
  hairpin (`stackDepth` returns 0 for n=0). So a dynamics-only / hairpin-only RH
  reaches ~rhBottomY + 3.5 (hairpin lower edge = HAIRPIN_LANE_DY 3.0 + APERTURE/2
  0.5; point-dynamic baseline ≈ 3.5) but contributes 0 to `effectiveInterStaffGap`.
  This is a real gap-reservation hole the LH-above lane must independently cover.
- `effectiveInterStaffGap` (1859-1862) is exactly where the new reservation folds in.
- `systemHasOttavaAbove` (2649-2652) fires on EITHER hand; its ONLY consumer is the
  ottava block in `topMarginLayout` (2821-2825). Splitting to RH-only is a
  one-condition change (R1.5).

DECISION (Q1): The LH-above lane sits in a free window of the inter-staff gap bounded
ABOVE (smaller Y) by the bottom of region (b) [RH below-staff content] and BELOW
(larger Y) by the top of region (a) [LH high notes/ledgers]. Because neither (a)'s raw
ledger extent nor (b)'s dynamics-only reach is in `effectiveInterStaffGap` today, the
gap MUST grow by a new term that reserves room for the LH-above ottava lane stacked
above the LH high-note extent, while also keeping clearance from the RH below-staff
region. Exact formula decided in Q2.

### Q2 — RESOLVED. Gap-reservation formula + LH-above lane Y.

Researcher evidence (measured against spec-research Q3 values: rhBottomY=9, lhTopY=17,
lhBottomY=21):

(a) NEW helper `lhAboveTopExtent(members)` mirrors `ledgerTopExtent` (2148-2159) but
over the LH/bass staff in the UP direction, reusing `handStepsFor(leftHand, "bass")`
(2189-2203):
```
function lhAboveTopExtent(members) {
  let maxAbove = 8;                       // LH top line = sFromBottom 8
  for (const m of members)
    for (const s of handStepsFor(m.measure?.leftHand, "bass"))
      if (s > maxAbove) maxAbove = s;
  return Math.max(0, (maxAbove - 8) * 0.5);   // sp above lhTopY
}
```
VERIFIED: C5 = bass step 17 → 4.5 sp above lhTopY (y=12.5 ✓); G5 = step 21 → 6.5 sp
(y=10.5 ✓). Counts noteHEAD centers only (same simplification ledgerTopExtent makes
for RH) — a small pad clears the glyph body if desired.

(b) RH below-staff region's downward reach below rhBottomY:
- point dynamic glyph body bottom ≈ 3.5 (baseline) + 0.616 (DESCENT) ≈ 4.12 sp;
- hairpin lane lower edge = HAIRPIN_LANE_DY(3.0) + HAIRPIN_APERTURE/2(0.5) = 3.5 sp;
- below-RH notes (when present) add `belowRHStack` on top.
CONFIRMED HOLE: `stackDepth(0, 6.9) = 0` — a dynamics-only / hairpin-only RH
(occ.belowRH===0) reserves NOTHING in the gap today even though the row occupies it.
So the gap's RH-below reach must be an explicit max, independent of occ.belowRH:
```
regionB_reach = max(
  belowRHStack,                       // below-RH note stack (already has the 6.9 base when notes+dyn)
  rhHasDynamics ? ~4.12 : 0,          // dynamic glyph body — NEW (occ-independent)
  rhHasHairpin  ? 3.5  : 0,           // hairpin lane lower edge — NEW (occ-independent)
)
```

DECISIONS (Q2):
- effectiveInterStaffGap gains a THIRD max-arm, gated by LH-positive shift on the
  system (`systemHasLeftOttavaAbove`, see Q3):
```
ottavaLaneReserve = max(lhAboveTopExtent, aboveLHStack) + OTTAVA_LANE_PAD + OTTAVA_SIZE
effectiveInterStaffGap = max(
  INTRA_STAFF_GAP,                                   // 8 floor — unchanged
  belowRHStack + aboveLHStack + (both ? MID_GAP : 0),// existing arm — unchanged
  hasLHOttavaAbove
    ? regionB_reach + MID_GAP + ottavaLaneReserve    // NEW arm
    : 0,
)
```
  The NEW arm stacks: region (b) from the top of the gap downward, a MID_GAP, then the
  LH-above column (LH high notes/aboveLH-notes, a pad, the OTTAVA_SIZE band) from
  lhTopY upward. `max(lhAboveTopExtent, aboveLHStack)` is the "top of region (a)" — the
  ottava must clear BOTH the raw LH high notes AND the aboveLH note annotations (both
  sit just above lhTopY; aboveLH band baseY = lhTopY − NOTE_GAP_STAFF, 1905).
- LH-above ottava label baseline Y:
```
band.ottavaLeftAboveLaneY = lhTopY − max(lhAboveTopExtent, aboveLHStack) − OTTAVA_LANE_PAD
```
  Baseline = BOTTOM of the OTTAVA_SIZE band (mirrors topMargin convention, below);
  the glyph rises OTTAVA_SIZE above the baseline, into the reserved MID_GAP/region-(b)
  clearance. No-overlap invariant holds because the gap was grown to fit the column.
- OTTAVA band convention (verified at topMarginLayout 2821-2824): `ottavaD = d;
  topExtent = d + OTTAVA_SIZE`. The lane baseline is at distance `d` above the staff
  top (the BOTTOM of the band); the glyph occupies OTTAVA_SIZE ABOVE the baseline. The
  LH-gap lane reuses this exact convention — baseline clears the notes below, glyph
  rises OTTAVA_SIZE toward the RH region above.
- OTTAVA_LANE_PAD: a small clearance pad above the LH notes before the bracket
  baseline. Reuse an existing constant rather than invent one — candidates
  NOTE_GAP_STAFF(1) or ABOVE_STAFF_PAD(1). (Confirm choice in Q6/constants.)

Concrete-case check (to be walked in Q3 with both-hands + dynamics):
- LH-only +1, no LH highs, no RH below: column = 0 + pad(1) + 2.2 = 3.2 < 8 ⇒ gap
  stays at INTRA_STAFF_GAP floor 8, lhTopY=17; ottava baseline = 17 − 0 − 1 = 16,
  glyph top = 16 − 2.2 = 13.8; RH region bottom = 9 ⇒ 4.8 sp clearance. ✓
- LH +1 with G5 high note (6.5 above lhTopY): the column = 6.5 + 1 + 2.2 = 9.7;
  with no RH below, the new arm = 0 + MID_GAP(1.2) + 9.7 = 10.9 > 8 ⇒ gap GROWS to
  10.9, lhTopY = 9 + 10.9 = 19.9; ottava baseline = 19.9 − 6.5 − 1 = 12.4, glyph top
  = 10.2; G5 top sits at lhTopY − 6.5 = 13.4 (below baseline 12.4 ⇒ note is lower on
  page, ottava sits ABOVE it ✓). RH region bottom = 9 ⇒ glyph top 10.2 clears it. ✓

### Settled independently (analyst, parallel to Q3): data flow + consistency proof.

DATA FLOW (linear, single per-system pass, all in the block ~1807-2098):
  members → bandOccupancy/predicates (occ, rhHasDynamics/Hairpin,
  systemHasLeftOttavaAbove) → effectiveInterStaffGap (new arm) → lhTopY → `band`
  literal (1875-1915, now also carrying `ottavaLeftAboveLaneY`) → buildSystemTexts
  (called 2086, reads `band`) → system.texts.ottavas; the SAME `band` is stored at
  system.band (2098), so tests read `sys.band.ottavaLeftAboveLaneY`.
  `topMarginLayout` (called 1851) is upstream of the gap and uses only RH content; its
  internal `systemHasOttavaAbove` becomes `systemHasRightOttavaAbove`.

GATE↔RUN CONSISTENCY (proof, no edge case): the LH-above run flushes only in the
`placement === "above"` branch, i.e. when `ott.placement === "above"` ⇔
`run.shift > 0` ⇔ `m.ctx.leftHand.octaveShift > 0` for some member. The gate
`systemHasLeftOttavaAbove(members) = members.some(m => m.ctx.leftHand.octaveShift > 0)`
reads the SAME field over the SAME members. So whenever the LH "above" emit reads
`band.ottavaLeftAboveLaneY`, the gate was true ⇒ the field is non-null. A NEGATIVE LH
shift forms a run too, but it takes the "below" branch (`staffBottomY + 2`) and never
reads `ottavaLeftAboveLaneY`; the gate (positive-only) correctly stays false for it.
They cannot disagree. (When no LH-above shift exists, `ottavaLeftAboveLaneY` is null
and is never read.)

### Q2 — REFINED (researcher A2: full end-to-end simulation, 4 cases). FINAL FORMULA.

```
rhBelowRegionReach = max(
  belowRHStack,                                  // below-RH NOTE stack (has 6.9 base when notes+dyn)
  (rhHasDynamics || rhHasHairpin) ? RH_BELOW_REGION_EDGE : 0,   // occ-independent — covers dynamics-only
)
lhAboveColumn = (systemHasLeftOttavaAbove)
  ? max(lhAboveExtent, aboveLHStack) + GAP_PAD + OTTAVA_SIZE
  : 0
bothRegions = rhBelowRegionReach > 0 && lhAboveColumn > 0
effectiveInterStaffGap = max(
  INTRA_STAFF_GAP,                                       // 8 floor — unchanged
  belowRHStack + aboveLHStack + (bothNotes ? MID_GAP : 0),// existing arm — unchanged
  rhBelowRegionReach + (bothRegions ? MID_GAP : 0) + lhAboveColumn,  // NEW arm
)
lhTopY = rhBottomY + effectiveInterStaffGap
band.ottavaLeftAboveLaneY = systemHasLeftOttavaAbove
  ? lhTopY − max(lhAboveExtent, aboveLHStack) − GAP_PAD
  : null
```
Where (chosen): `GAP_PAD = NOTE_GAP_STAFF (1)`; `RH_BELOW_REGION_EDGE` = either the
TIGHT true edge `3.5 + DESCENT ≈ 4.12` (dynamic glyph body bottom, which dominates the
hairpin edge 3.5) OR — to add ZERO new magic numbers — reuse `DYNAMICS_LANE_RESERVE
(6.9)` (slightly more whitespace, fully safe). RECOMMENDATION: reuse
DYNAMICS_LANE_RESERVE for the RH-below-region term — it is the same constant the
below-note dodge already uses for "clear the whole dynamics region," so it is the
semantically-honest reservation and introduces no new number. (Plan may pick the tight
4.12 if whitespace matters; both satisfy the no-overlap invariant.)

KEY VERIFIED BEHAVIORS (researcher simulation, rhBottomY=9, GAP_PAD=1):
- COLLAPSE: LH +1, no LH highs, no RH below ⇒ lhAboveColumn = 0+1+2.2 = 3.2; new arm
  = 3.2 < 8 ⇒ gap stays 8, geometry of existing fixtures UNDISTURBED. The gap grows
  ONLY when LH highs / aboveLH notes / RH-below content push the column past 8.
- Case A (LH+1, G5, no RH below): gap 10.9, lhTopY 19.9, ottavaY 12.4, glyphTop 10.2,
  G5 top 13.4, rhBelowBottom 9 ⇒ ottava above G5, glyph clears RH. ✓
- Case B (LH+1, G5, RH point dynamic, edge=4.12): gap 15.02, lhTopY 24.02, ottavaY
  16.52, glyphTop 14.32, G5 top 17.52, rhDynBottom 13.12 ⇒ clears both. ✓
- Case C (LH+1, low LH, RH dynamic): gap 8.52, ottavaY 16.52, glyphTop 14.32,
  rhDynBottom 13.12 ⇒ clears. ✓
- Case D (LH+1, aboveLH NOTES×2 → aboveLHStack 4.42, RH hairpin): gap 12.92, ottavaY
  15.9, glyphTop 13.7, aboveLH-note top 17.5, rhHairpinBottom 12.5 ⇒ ottava clears the
  LH-above NOTE annotations too (column uses max(lhAboveExtent, aboveLHStack)). ✓

ORDERING INVARIANT (for plan/code/tests to assert):
  ottavaLeftAboveLaneY  <  lhTopY − max(lhAboveExtent, aboveLHStack)        (above LH content)
  AND
  ottavaLeftAboveLaneY − OTTAVA_SIZE  >  rhBottomY + rhBelowRegionReach     (glyph top clears RH region)
(smaller Y = higher; both are strict because GAP_PAD>0 and MID_GAP>0 add slack.)

ASCENT CONVENTION (confirmed vs SVG): `renderOttava` (svg.js:1149-1173) draws the label
<text> AND the dashed <line> both at `y = ottava.y` (the baseline = LOW edge); SVG text
ascends above its baseline, so the glyph body occupies [ottava.y − OTTAVA_SIZE,
ottava.y]. So `ottava.y` must be the LOW edge of the reserved lane, and OTTAVA_SIZE of
clearance is reserved ABOVE it (toward the RH region) — which the column's `+ OTTAVA_SIZE`
term does. This is the exact MIRROR of the RH-above top-margin lane, NOT the below case.

### Q3 — RESOLVED. Per-hand split, wiring, both-hands coexistence, emit selection.

Researcher A3 evidence:
- THE SPLIT — two trivial predicates:
  `systemHasRightOttavaAbove(members) = members.some(m => m.ctx.rightHand.octaveShift > 0)`
  `systemHasLeftOttavaAbove(members)  = members.some(m => m.ctx.leftHand.octaveShift  > 0)`
  (i) `systemHasOttavaAbove` has EXACTLY ONE caller — `topMarginLayout` line 2821 (grep:
  def at 2649 + one call). No svg.js / test reference. Safe to replace the call with
  `systemHasRightOttavaAbove` and drop the old predicate.
  (ii) LH-only +1 ⇒ `systemHasRightOttavaAbove`=false ⇒ ottavaD stays null ⇒
  ottavaAboveLaneY=null and topMargin = no-shift baseline (R1.5 / new-test-2). Existing
  "top margin flexes" test (1994-2028, COMPREHENSIVE_SONG RH+1 vs plain) is RH+1-vs-none,
  never LH-only ⇒ GREEN. (iii) "stack above the staff" (1972-1992, RH+1) ⇒ RH predicate
  fires ⇒ ottavaAboveLaneY reserved ⇒ GREEN.
- WIRING — all in the per-system block (1807-1915), `members` already in scope (1790):
  compute `systemHasLeftOttavaAbove(members)` + `lhAboveExtent` + `lhAboveColumn` beside
  occ/rhHasDynamics (1823-1827); fold the 3rd arm into effectiveInterStaffGap (1859);
  add `band.ottavaLeftAboveLaneY` to the band literal (null when no LH-above). The ONLY
  change inside `topMarginLayout` is swapping its internal 2821 call to
  `systemHasRightOttavaAbove`; its signature/return shape (ottavaAboveLaneY still a field)
  is unchanged. `band` already flows into `buildSystemTexts` as the 3rd arg (2086/2859).
- BOTH-HANDS (R1.6) concrete (RH+1 & LH+1, no other content): topMargin=5,
  rhStaffTopY=5, rhBottomY=9, ottavaAboveLaneY=4 (RH, top margin), gap=8 (LH column
  3.2<8 ⇒ no grow), lhTopY=17, ottavaLeftAboveLaneY=16 (LH, gap). RH lane 4 above
  rhStaffTopY 5 ✓; LH lane 16 strictly inside gap (9..17) ✓; 12 sp apart, distinct.
  Matches spec-research Q1 measured (RH+1→4; LH+1 should be ~16). new-test-3 asserts two
  above brackets at distinct Ys (RH.y≈ottavaAboveLaneY, LH.y≈ottavaLeftAboveLaneY, RH.y
  < LH.y).
- EMIT SELECTION (replaces 2915-2918):
```
y = ott.placement === "above"
    ? (hand === "rightHand" ? band.ottavaAboveLaneY : band.ottavaLeftAboveLaneY)
    : staffBottomY + 2;
```
  The only reader of `band.ottavaAboveLaneY` is this emit line (2917); `renderOttava`
  reads the emitted `ottava.y`, not the band field. Gate↔run null-consistency is provable
  (shared `octaveShift > 0` ⇔ ottavaFor "above"); researcher RECOMMENDS asserting
  `ottavaLeftAboveLaneY != null` at the LH-above emit rather than a silent fallback, so a
  future divergence surfaces loudly. DECISION: adopt the assert (or rely on the proven
  invariant) — do NOT add a silent `?? ottavaAboveLaneY` fallback (that would re-introduce
  Bug 1's wrong-staff placement if it ever fired).

### Q4 — RESOLVED. Per-system x-span rule (Bug 2). IMPORTANT x1 CORRECTION.

Researcher A4 confirmed x2 and the run shape, but CAUGHT a real defect in the naive x1
(global-min) proposal and corrected it.

RUN-OBJECT SHAPE (revised — `xs` is DROPPED):
```
run = { shift, firstModel, lastModel, firstHandNotes }
// per contributing measure i (shift = m.ctx[hand].octaveShift, read at 2924):
if (!run.firstModel) {
  run.firstModel = measureModels[i];
  run.firstHandNotes = (hand === "rightHand" ? measureModels[i].right : measureModels[i].left).notes;
}
run.lastModel = measureModels[i];
```
A rest-only measure STILL sets firstModel/lastModel (shift comes from ctx, not notes) —
this is what makes R2.1 (rest-only emit) work. The run is contiguous & same-shift (reset
at 2929, flush on !shift at 2925). `measureModels[i]` carries `.x` (2071) and `.width`
(2072). The old `run.xs` global note list is NO LONGER NEEDED (neither x1 nor x2 uses it).

X1/X2 FORMULA (FINAL):
```
x2 = run.lastModel.x + run.lastModel.width                       // last run-measure right barline
const firstNotesX = run.firstHandNotes.map(n => run.firstModel.x + n.x);
x1 = firstNotesX.length > 0 ? Math.min(...firstNotesX) − NOTEHEAD_RX : run.firstModel.x;
```
CRITICAL: x1 keys the left refinement to the FIRST RUN-MEASURE's OWN notes, NOT the
global min over all run notes. The naive `min(...allXs) − NOTEHEAD_RX` UNDER-spans a
sparse run whose lone note is in a LATER measure (e.g. [rest, note, rest] → global-min
jumps x1 to the middle note = the exact R2.2 defect). Researcher simulated: global-min
gives {x1:18.4,x2:30} (WRONG); first-measure-keyed gives {x1:10,x2:30} (correct).
- x2 monotonicity: last note ⊂ last measure ⇒ x+width ≥ lastNoteX; dropping the old
  max(xs)+RX only ever EXTENDS to the true barline, never shortens. ✓
- Left refinement PRESERVED for note-bearing first measures (dense run: first note absX
  12 → x1 = 11.4, identical to today). Single-measure run identical to today. ✓
- NO clamp on x1 (the ≤NOTEHEAD_RX dip into the leading reserve is today's behavior). ✓
- `[rest, note, …]` run (first measure rest-only): x1 = firstModel.x (the rest measure's
  left edge), NOT the later note — spec-correct ("first note's X when a note is present"
  refers to a note AT the run's start; otherwise the measure edge). ACCEPTED.

GUARD (FINAL): `if (ott && run.firstModel)`. Keep BOTH halves: `ottavaFor(shift)` (1077)
returns null for out-of-range shifts (3, −3 — truthy, so they start a run & set
firstModel, but have no OTTAVA_LABELS entry), and the `&& ott` half correctly drops those.
The old `run.xs.length > 0` guard is REPLACED by `run.firstModel` (run covers ≥1 measure).

VERIFIED CASES (researcher simulation):
(i) sparse (1 note in middle of 3): x1=firstModel.x=10, x2=30 — spans all 3. ✓
(ii) rest-only run-portion: emits now; {x1:10, x2:23}. ✓
(iii) multi-system note-bearing run: each system's `buildSystemTexts` call (2086) uses its
own measureModels slice ⇒ one bracket per system, each spanning its own portion. R2.3
preserved (only the x1/x2 formula changed; it's per-system-local). ✓
EMPTY-MEASURE EDGE: width ≥ EMPTY_MEASURE_WIDTH(3.3), x monotone ⇒ x1 < x2 strictly even
for a single empty rest-only measure. No degenerate zero-width bracket. ✓
TEST IMPACT: re-grep confirms NO test asserts ottava x1/x2 (all x1/x2 assertions are
beams/ties/slurs/hairpins). The span change breaks zero assertions.

### Settled independently (analyst, parallel to Q5): NEW GAP ARM IS DORMANT IN ALL EXISTING FIXTURES.

Grep of `src/notation/__tests__/` for `octaveShift`: EVERY usage is a RIGHT-hand shift
(layout.test.js:916/953/997 RH +1; svg.test.js:1262 RH +1) or a context-resolution
helper test. The ONLY `leftHand.octaveShift` reference is layout.test.js:1018, which
asserts the diff is `false` (LH shift unchanged = 0). NO fixture has a LEFT-hand positive
octaveShift. Therefore `systemHasLeftOttavaAbove` is FALSE for every existing fixture ⇒
the new gap arm is gated to 0 ⇒ `effectiveInterStaffGap` is byte-for-byte unchanged for
all existing fixtures ⇒ no currently-asserted band Y (lhTopY, ottavaAboveLaneY,
annotationAboveRHLaneY, etc.) can shift. `lhAboveTopExtent` may compute a value for a
fixture with LH high notes, but it feeds ONLY the gated arm, so it is inert without a LH
positive shift. CONCLUSION: the LH-above path is entirely new/untested (as spec-research
established); existing geometry is provably untouched. Regression risk 5(c) = nil for the
current suite. (Researcher to corroborate via independent fixture scan in A5.)

### Q5 — RESOLVED. Constants/naming, model contract, ordering, regression scan.

Researcher A5:
- CONSTANTS — ZERO NEW. RH-below-region term = `(rhHasDynamics || rhHasHairpin) ?
  DYNAMICS_LANE_RESERVE : 0` taken in a max() with belowRHStack — DYNAMICS_LANE_RESERVE
  (6.9) is ALREADY the canonical "depth a below annotation dodges to clear the whole
  below-staff dynamics region" (constants.js:189-196), so reusing it is semantically
  honest (the ~2.8 sp of extra air vs the tight 4.12 only appears in the rare LH-above +
  RH-dynamics-only combo, never a collision). Inline expression, no named constant.
  GAP_PAD = NOTE_GAP_STAFF (1) — matches aboveLH's `lhTopY − NOTE_GAP_STAFF` (1905).
  FINAL new-symbol list: 0 new constants; 1 new helper (lhAboveTopExtent); 1 new band
  field; 2 split predicates (one replaces systemHasOttavaAbove).
- NAMING (house style): helper `lhAboveTopExtent(members)` (mirrors ledgerTopExtent /
  ledgerBottomExtent, `<thing>Extent`); band field `ottavaLeftAboveLaneY` (parallels the
  existing `ottavaAboveLaneY` = the RH/top lane, `<thing>LaneY`); predicates
  `systemHasRightOttavaAbove` / `systemHasLeftOttavaAbove` (`systemHas<Thing>`). DO NOT
  rename the existing `ottavaAboveLaneY` (would churn passing tests at 1980/1990 and the
  topMarginLayout return key) — keep it as the RH lane; add `ottavaLeftAboveLaneY`.
- MODEL CONTRACT — SIGNED OFF. Emitted ottava stays EXACTLY `{ hand, label, placement,
  x1, x2, y }` (2907-2919) — no new fields. `renderOttava` (svg.js:1149-1173) reads only
  hand/x1/x2/y/label, stamps data-hand — ZERO changes. Only output diffs: LH-above y →
  `ottavaLeftAboveLaneY`; x1/x2 → measure-extent. svg.test.js asserts only that the
  ottava element EXISTS (RH fixture) — no x/y/shape assertion → nothing breaks.
- ORDER-OF-OPS — sound, no hidden dependency: `topMarginLayout` (1851) takes only
  above-RH inputs (members, ledgerTopExtent, occ.aboveRH); never reads lhTopY/gap/LH.
  topMargin is final before the gap (rhBottomY = topMargin + STAFF_HEIGHT at 1853). THEN
  gap arm (occ/rhHasDynamics/rhHasHairpin/lhAboveTopExtent/aboveLHStack/
  systemHasLeftOttavaAbove, all available by 1844) → effectiveInterStaffGap (1859) →
  lhTopY (1863) → band literal (1875) with both ottava lane fields. Strict dataflow:
  top-margin → gap → band.
- (a) Bottom-margin flex (1869-1872) independent (below-LH only) — no interaction.
- (b) aboveLHStack NOT double-counted: effectiveInterStaffGap is a MAX across arms, not a
  sum; each arm is a self-consistent stacking. The new arm's `max(lhAboveExtent,
  aboveLHStack)` is correct (both occupy the just-above-lhTopY zone; ottava clears the
  taller). No over-reservation.
- (c) REGRESSION SCAN — CLEAN (corroborates analyst): every gap/band-Y-asserting fixture
  (bareSong/songWith around layout.test.js:2180-2247 → asserts at 2252/2271/2292/2563/
  2587; COMPREHENSIVE_SONG) has LH pitches BELOW the bass top line (C3/G3/B2/F#2 → step
  < 0 ⇒ lhAboveTopExtent=0) AND no leftHand.octaveShift > 0 (gate off). So both the gate
  and lhAboveTopExtent contribute 0 → effectiveInterStaffGap byte-for-byte unchanged →
  all asserted Ys stay green. No fixture exercises the LH-above path.

FLAG FOR CODE-PLAN (not a blocker): `lhAboveTopExtent` should ideally pass the measure's
ACTUAL LH clef (`m.ctx.leftHand.clef`) to `handStepsFor`, not hardcode `"bass"`, so a
tenor/alto LH staff (e.g. COMPREHENSIVE_SONG section 2 switches LH clef to "tenor")
computes the correct step. `ledgerBottomExtent` (2184) hardcodes "bass" and has the same
latent limitation; matching it (hardcode "bass") is consistent-but-imperfect, while
using `m.ctx.leftHand.clef` is strictly more correct and cheap. The code-plan should
decide; it does not affect any current fixture (the gate is off for all of them).

---

## DECIDED DESIGN (final — input for `design-doc.md`)

All changes are in `src/notation/layout.js`. NO change to `constants.js` (zero new
constants), `svg.js` (`renderOttava` untouched), `ottavaFor`, or the song schema. The
emitted ottava model stays `{ hand, label, placement, x1, x2, y }`.

### D0 — Touch list (5 edits + 1 new helper, all in layout.js)
1. NEW helper `lhAboveTopExtent(members)` — near `ledgerTopExtent` (2148).
2. SPLIT `systemHasOttavaAbove` (2649-2653) → `systemHasRightOttavaAbove` +
   `systemHasLeftOttavaAbove`.
3. `topMarginLayout` (2821) — swap its internal call to `systemHasRightOttavaAbove`.
4. Per-system block (~1823-1915) — compute the LH-above inputs, add the 3rd gap arm,
   add `band.ottavaLeftAboveLaneY`.
5. `buildSystemTexts` ottava loop (2896-2940) — new run shape + measure-extent x-span +
   per-hand "above" Y selection + new guard.

### D1 — New helper `lhAboveTopExtent(members)` (mirrors `ledgerTopExtent`, UP, LH/bass)
```
function lhAboveTopExtent(members) {
  let maxAbove = 8;                              // LH top line = sFromBottom 8
  for (const m of members)
    for (const s of handStepsFor(m.measure?.leftHand, m.ctx.leftHand.clef /* or "bass" */))
      if (s > maxAbove) maxAbove = s;
  return Math.max(0, (maxAbove - 8) * 0.5);       // sp above lhTopY
}
```
Clef choice: prefer `m.ctx.leftHand.clef` (correct for tenor/alto LH); `"bass"` matches
`ledgerBottomExtent`'s existing simplification. Either is regression-safe (no current
fixture activates this). VERIFIED: C5→4.5, G5→6.5 sp above lhTopY.

### D2 — Per-hand predicate split (replaces `systemHasOttavaAbove`, 2649-2653)
```
function systemHasRightOttavaAbove(members) {
  return members.some((m) => m.ctx.rightHand.octaveShift > 0);
}
function systemHasLeftOttavaAbove(members) {
  return members.some((m) => m.ctx.leftHand.octaveShift > 0);
}
```
`topMarginLayout`'s 2821 call → `systemHasRightOttavaAbove(members)` (its ONLY caller).
This makes the top-margin ottava lane RH-only (R1.5).

### D3 — Inter-staff gap reservation (per-system block, around 1844-1863)
Compute beside `occ`/`rhHasDynamics`/`aboveLHStack`:
```
const hasLHOttavaAbove = systemHasLeftOttavaAbove(members);
const lhAboveExtent = lhAboveTopExtent(members);
const rhBelowRegionReach = Math.max(
  belowRHStack,
  (rhHasDynamics || rhHasHairpin) ? DYNAMICS_LANE_RESERVE : 0,
);
const lhAboveColumn = hasLHOttavaAbove
  ? Math.max(lhAboveExtent, aboveLHStack) + NOTE_GAP_STAFF + OTTAVA_SIZE
  : 0;
const bothRegions = rhBelowRegionReach > 0 && lhAboveColumn > 0;
const effectiveInterStaffGap = Math.max(
  INTRA_STAFF_GAP,
  belowRHStack + aboveLHStack + (bothInterStaff ? MID_GAP : 0),   // existing arm
  rhBelowRegionReach + (bothRegions ? MID_GAP : 0) + lhAboveColumn, // NEW arm
);
```
(`bothInterStaff` is the existing `occ.belowRH > 0 && occ.aboveLH > 0` at 1858.)
COLLAPSE: with no LH highs / no RH below, lhAboveColumn = 0+1+2.2 = 3.2 < 8 ⇒ gap stays
at the INTRA_STAFF_GAP floor; the LH ottava fits inside today's gap and NO existing
geometry moves.

### D4 — New band field (band literal, 1875-1915)
```
ottavaLeftAboveLaneY: hasLHOttavaAbove
  ? lhTopY - Math.max(lhAboveExtent, aboveLHStack) - NOTE_GAP_STAFF
  : null,
```
This baseline is the LOW edge of the OTTAVA_SIZE band (mirrors topMargin convention; the
glyph rises OTTAVA_SIZE above it into the reserved clearance). Place it next to
`ottavaAboveLaneY` (1886).

### D5 — Ottava emit rewrite (`buildSystemTexts`, 2896-2940)
Run shape (drop `xs`): `run = { shift, firstModel, lastModel, firstHandNotes }`.
In the per-measure loop (2923-2938), when a measure contributes to a run:
```
if (!run.firstModel) {
  run.firstModel = measureModels[i];
  run.firstHandNotes = laid.notes;            // laid = right|left already read at 2933-2934
}
run.lastModel = measureModels[i];
```
(`laid.notes` is the same list read today; a rest-only measure sets first/lastModel but
contributes no notes.)
flush():
```
const ott = ottavaFor(run.shift);
if (ott && run.firstModel) {                    // NEW guard (≥1 measure; keep `&& ott` for out-of-range shifts)
  const staffBottomY = hand === "rightHand" ? band.rightStaffBottomY : band.leftStaffBottomY;
  const firstNotesX = run.firstHandNotes.map((n) => run.firstModel.x + n.x);
  const x1 = firstNotesX.length > 0 ? Math.min(...firstNotesX) - NOTEHEAD_RX : run.firstModel.x;
  const x2 = run.lastModel.x + run.lastModel.width;
  const aboveY = hand === "rightHand" ? band.ottavaAboveLaneY : band.ottavaLeftAboveLaneY;
  ottavas.push({
    hand, label: ott.label, placement: ott.placement,
    x1, x2,
    y: ott.placement === "above" ? aboveY : staffBottomY + 2,
  });
}
```
NULL-SAFETY: when `placement === "above"` and `hand === "leftHand"`, `aboveY =
band.ottavaLeftAboveLaneY` is provably non-null (gate ⇔ run; see Q3). Do NOT add a silent
`?? ottavaAboveLaneY` fallback (would re-introduce Bug 1). An assert is optional.

### D6 — Invariants for the plan/tests to assert
- Ordering (no overlap): `ottavaLeftAboveLaneY < lhTopY − max(lhAboveExtent,
  aboveLHStack)` AND `ottavaLeftAboveLaneY − OTTAVA_SIZE > rhBottomY + rhBelowRegionReach`.
- Per-hand "above": RH "above" → `band.ottavaAboveLaneY` (unchanged); LH "above" →
  `band.ottavaLeftAboveLaneY` (in the gap, < lhTopY). "below" unchanged (`staffBottomY+2`).
- LH-only +1 ⇒ topMargin == no-shift baseline; `ottavaAboveLaneY` null/unchanged.
- Both +1 ⇒ two "above" brackets at distinct Ys (RH top-margin < LH gap), no overlap.
- Span: x2 = lastModel.x+width; x1 = first-run-measure's-own-notes min − NOTEHEAD_RX
  (else firstModel.x); emitted on EVERY system the run covers incl. rest-only; one
  bracket per system. x1 < x2 strictly (EMPTY_MEASURE_WIDTH floor).

### D7 — Backward compatibility (proven)
No fixture sets `leftHand.octaveShift > 0` and no asserted-Y fixture has LH notes above
the bass top line, so the new gap arm + `lhAboveTopExtent` are inert for the entire
current suite. The x-span change touches no asserted ottava x1/x2 (none exist). All
existing tests stay green; the 5 new tests (spec Acceptance) exercise the new LH/Bug-2
paths.
