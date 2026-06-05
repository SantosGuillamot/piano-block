# Design doc — Fix octaveShift ottava placement for left and right hands (#13)

## Overview / Context

The piano-block notation engine renders each hand's `octaveShift` setting as an
**ottava marking**: a dashed bracket with an italic label ("8va", "15ma", "8vb",
"15mb") drawn over the affected notes. A grand staff has two staves — the right
hand on the top (treble) staff, the left hand on the bottom (bass) staff. A
positive `octaveShift` produces an "above" marking; a negative one produces a
"below" marking. The marking is restated once per wrapped system (line) for every
system the run of notes spans.

Two placement bugs are in scope (the spec contract is R1.1–R1.6 and R2.1–R2.3):

1. **Wrong staff for a left-hand "above" marking (Bug 1).** A left-hand positive
   `octaveShift` (e.g. +1 → "8va") draws its bracket above the **right-hand
   (top / treble) staff** instead of above the **left-hand (bottom / bass)
   staff**, so it sits over the wrong staff, visually detached from the notes it
   annotates. The "above" emit branch always uses the single top-margin lane,
   regardless of which hand owns the shift. (The "below" branch is already
   hand-aware — it uses each hand's own `staffBottomY` — so "below" markings for
   both hands already land correctly.)

2. **Bracket dropped on rest-only systems + sparse under-span (Bug 2).** A
   bracket is silently omitted on any system whose portion of an `octaveShift`
   run contains no noteheads for that hand (rest-only), because the horizontal
   span is built solely from notehead X positions and the emit step is skipped
   when that list is empty. The same notehead-only spanning also causes a
   pre-existing under-span: a sparse run (e.g. a single note in a middle measure)
   draws a tiny bracket around that lone note instead of covering the measures the
   run actually spans.

This is a focused bug fix to ottava-bracket placement and per-system consistency.
It does not add features or change the song schema. **All changes are in
`src/notation/layout.js`.** There is no change to `constants.js` (zero new
constants), `svg.js` (the `renderOttava` draw layer is untouched), the
`ottavaFor` sign→label/placement mapping, or the song schema.

### Relevant layout machinery (the facts the design rests on)

Smaller Y is higher on the page throughout. All references below are in
`src/notation/layout.js` unless noted.

**Per-system vertical band (`band`, ~1875–1915).** Each wrapped system computes
one `band` object carrying the staff Y references and the flexible above-staff
lanes:

- `band.rightStaffTopY` / `band.rightStaffBottomY` — top staff (right hand).
- `band.leftStaffTopY` (= `lhTopY`) / `band.leftStaffBottomY` — bottom staff
  (left hand).
- `band.ottavaAboveLaneY` — a single lane in the **top margin**, above the top
  staff, used for "above" ottavas today (set from `top.ottavaAboveLaneY`).
- `band.bands.aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` — the existing above-LH
  *note* annotation band; its stack grows up into the inter-staff gap.

The band is built once per system and stored at `system.band`, so tests read
`sys.band.<field>`. It then flows into `buildSystemTexts(members, measureModels,
band)` (called at ~2086), which emits the ottava bracket models.

**The inter-staff gap (`effectiveInterStaffGap`, ~1858–1863).** The vertical
space between the two staves. Today:

```
const bothInterStaff = occ.belowRH > 0 && occ.aboveLH > 0;
const effectiveInterStaffGap = Math.max(
  INTRA_STAFF_GAP,                                          // 8 sp floor
  belowRHStack + aboveLHStack + (bothInterStaff ? MID_GAP : 0),
);
const lhTopY = rhBottomY + effectiveInterStaffGap;
```

It flexes only for the **below-RH** and **above-LH note-stack depths**
(`belowRHStack`, `aboveLHStack`). It reserves room for **no ottava** and for **no
raw left-hand high-note / ledger extent**. Two consequences matter here:

- `stackDepth(n, base) = n > 0 ? base + (n−1)*STACK_STEP + DESCENT : 0` returns
  **0 when `n === 0`**. So `belowRHStack` is 0 when there are no below-RH *notes*,
  even when the RH prints a point dynamic or a hairpin lane that physically
  occupies the top of the gap (its reach is ~`rhBottomY + 3.5`). This is a real
  gap-reservation hole: a dynamics-only / hairpin-only RH reserves nothing in the
  gap today.
- Raw LH high notes / ledgers above the LH top line are **not** reflected in the
  gap at all (`aboveLHStack` counts above-LH note *annotations*, not raw
  pitches). A fixed `leftStaffTopY − k` ottava would collide with them.

**`systemHasOttavaAbove` (~2649–2653).** Returns true when **either** hand has a
positive shift:

```
function systemHasOttavaAbove(members) {
  return members.some(
    (m) => m.ctx.rightHand.octaveShift > 0 || m.ctx.leftHand.octaveShift > 0,
  );
}
```

Its **only caller** is `topMarginLayout` (one call at ~2821; no svg.js or test
reference). It is the trigger that reserves the top-margin ottava lane and
deepens the top margin — and because it fires on *either* hand, a left-hand-only
shift over-reserves the top margin today (Bug 1's secondary symptom, R1.5).

**`topMarginLayout(members, ledgerTop, aboveRHCount)` (~2794–2839).** Stacks
above-RH note lanes, then (if `systemHasOttavaAbove`) an ottava lane, then tempo,
all above the staff. The ottava block (~2821–2825) establishes the band
convention that the LH-gap lane mirrors:

```
if (systemHasOttavaAbove(members)) {
  ottavaD = d;
  topExtent = d + OTTAVA_SIZE;   // glyph occupies OTTAVA_SIZE ABOVE the baseline
  d = topExtent + TEXT_LANE_GAP;
}
// ...
ottavaAboveLaneY: at(ottavaD)    // baseline = the LOW edge of the lane
```

The lane baseline (`ottavaAboveLaneY`) is the **low edge** of an `OTTAVA_SIZE`-tall
band; the glyph rises `OTTAVA_SIZE` **above** the baseline. `topMarginLayout`
reads only above-RH inputs (members, `ledgerTopExtent`, `occ.aboveRH`) — it never
reads `lhTopY`, the gap, or any LH content — so it is strictly upstream of the gap
computation (`rhBottomY = topMargin + STAFF_HEIGHT_SP`).

**The ottava emit (`buildSystemTexts`, ~2896–2940).** Per hand, it walks the
system's members, groups contiguous same-shift runs, and flushes one bracket per
run:

```
const ott = ottavaFor(run.shift);
if (ott && run.xs.length > 0) {                       // (A) skip-when-no-noteheads
  const staffBottomY =
    hand === "rightHand" ? band.rightStaffBottomY : band.leftStaffBottomY;
  ottavas.push({
    hand, label: ott.label, placement: ott.placement,
    x1: Math.min(...run.xs) - NOTEHEAD_RX,            // (B) notehead-only span
    x2: Math.max(...run.xs) + NOTEHEAD_RX,            // (B)
    y: ott.placement === "above"                       // (C) hand-AGNOSTIC "above"
      ? band.ottavaAboveLaneY
      : staffBottomY + 2,
  });
}
// run.xs is filled ONLY from laid.notes (noteheads), per measure.
```

(A) is the rest-only drop (Bug 2 / R2.1). (B) is the notehead-only span — both the
sparse under-span (Bug 2 / R2.2) and the cause of the rest-only empty `xs`. (C) is
the hand-agnostic "above" lane (Bug 1 / R1.2).

**`ottavaFor(octaveShift)` (~1077).** Maps the resolved shift to
`{ label, placement }`: `1`→"8va"/above, `2`→"15ma"/above, `−1`→"8vb"/below,
`−2`→"15mb"/below; returns `null` for `0`/absent **and** for out-of-range shifts
like `±3` (no `OTTAVA_LABELS` entry). **Out of scope — unchanged.**

**`renderOttava(ottava)` (svg.js ~1149–1173).** The only consumer of
`texts.ottavas`. It reads exactly `ottava.hand` (→ `data-hand`), `ottava.label`,
`ottava.x1`, `ottava.x2`, `ottava.y`. The label `<text>` anchors at `x1, y`; the
dashed `<line>` runs `x1 + OTTAVA_SIZE*1.5 … x2` at `y`. Both the text and the
line share `y`, and SVG text ascends above its baseline, so the glyph body
occupies `[y − OTTAVA_SIZE, y]`: **`y` is the low edge of the marking.**
`ottava.placement` is read **only** inside `buildSystemTexts` to choose `y`; the
SVG layer never reads it. **Out of scope — unchanged.**

**Geometry primitives.** The top staff line is `sFromBottom = 8` in any clef's own
frame; `staffStepToY(s, bottomLineY) = bottomLineY − s*0.5`. So a note at step
`s > 8` sits `(s−8)*0.5` sp above its staff's top line — this lets a new helper
mirror `ledgerTopExtent` over the LH/bass notes in the *up* direction.
`handStepsFor(events, clef)` (~2189) already yields every laid-out `sFromBottom`
for a hand under a given clef.

**Constants (constants.js).** `OTTAVA_SIZE = 2.2`, `NOTE_GAP_STAFF = 1`,
`INTRA_STAFF_GAP = 8`, `MID_GAP = 1.2`, `STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP = 3.4`,
`DESCENT = 0.22*NOTE_SIZE = 0.616`, `DYNAMICS_LANE_RESERVE = 6.9`,
`NOTEHEAD_RX = 0.6`, `EMPTY_MEASURE_WIDTH = 3.3`, `STAFF_HEIGHT_SP = 4`,
`ABOVE_STAFF_PAD = 1`, `TEXT_LANE_GAP = 0.6`.

---

## The design

### Architecture at a glance

The fix is purely a layout-module change with a strict, single-direction data
flow already present in the per-system block (no new ordering dependency):

```
members
  → occ / rhHasDynamics / rhHasHairpin / aboveLHStack            (existing)
  → systemHasLeftOttavaAbove(members), lhAboveTopExtent(members) (new inputs)
  → effectiveInterStaffGap  [+ NEW third max-arm, LH-gated]
  → lhTopY
  → band literal  [+ NEW field ottavaLeftAboveLaneY]
  → buildSystemTexts(members, measureModels, band)
  → system.texts.ottavas  → renderOttava (UNCHANGED)
```

`topMarginLayout` is computed *before* the gap (it needs only above-RH inputs),
so swapping its internal trigger to the right-hand-only predicate has no effect on
downstream gap/band math beyond making the top-margin ottava lane RH-driven.

### Bug 1 — per-hand "above" placement

Bug 1 splits into two coupled changes: the **top-margin lane** must be reserved by
the **right hand only**, and the **left-hand "above" bracket** must live in a new
reserved lane **inside the inter-staff gap**, above the LH notes it annotates and
clear of the RH below-staff region.

**Split the trigger (R1.5).** Replace `systemHasOttavaAbove` with two trivial
per-hand predicates:

```
function systemHasRightOttavaAbove(members) {
  return members.some((m) => m.ctx.rightHand.octaveShift > 0);
}
function systemHasLeftOttavaAbove(members) {
  return members.some((m) => m.ctx.leftHand.octaveShift > 0);
}
```

`topMarginLayout`'s single call (~2821) becomes `systemHasRightOttavaAbove(members)`;
the old combined predicate is dropped. Now a left-hand-only positive shift leaves
`ottavaD` null ⇒ `ottavaAboveLaneY` null and the top margin collapses to its
no-shift baseline (R1.5). `topMarginLayout`'s signature and return shape are
unchanged — `ottavaAboveLaneY` is still a field; it is just driven by the RH alone.

**New helper `lhAboveTopExtent(members)` (mirrors `ledgerTopExtent`, up, LH/bass).**
The gap must know how far the LH's own high notes / ledgers reach above the LH top
line, so the new lane can clear them. No helper computes this today.
`ledgerTopExtent` scans the *RH/treble* staff; this new helper mirrors it over the
*LH/bass* staff in the up direction:

```
function lhAboveTopExtent(members) {
  let maxAbove = 8;                                   // LH top line = sFromBottom 8
  for (const m of members)
    for (const s of handStepsFor(m.measure?.leftHand, m.ctx.leftHand.clef))
      if (s > maxAbove) maxAbove = s;
  return Math.max(0, (maxAbove - 8) * 0.5);            // sp above lhTopY
}
```

Verified: a LH C5 = bass step 17 → 4.5 sp above `lhTopY`; G5 = step 21 → 6.5 sp.
It counts notehead centers only — the same simplification `ledgerTopExtent` makes
for the RH. (See "Noted design consideration" for the clef argument.)

**Grow the inter-staff gap to reserve the LH-above lane (R1.3).** A fixed
`leftStaffTopY − k` offset is explicitly rejected by the spec — it collides with
LH high notes (drawing the "8va" *below* them) and with the RH below-staff
dynamics row. Instead, `effectiveInterStaffGap` gains a **third max-arm**, gated
by a left-hand positive shift on the system. Computed beside `occ` /
`rhHasDynamics` / `aboveLHStack`:

```
const hasLHOttavaAbove = systemHasLeftOttavaAbove(members);
const lhAboveExtent = lhAboveTopExtent(members);

// RH below-staff region's downward reach — independent of occ.belowRH, so a
// dynamics-only / hairpin-only RH (occ.belowRH === 0) still reserves its row.
const rhBelowRegionReach = Math.max(
  belowRHStack,
  (rhHasDynamics || rhHasHairpin) ? DYNAMICS_LANE_RESERVE : 0,
);

// The LH-above column rising from lhTopY: clear the taller of the raw LH highs
// and the above-LH note annotations, a pad, then the OTTAVA_SIZE band.
const lhAboveColumn = hasLHOttavaAbove
  ? Math.max(lhAboveExtent, aboveLHStack) + NOTE_GAP_STAFF + OTTAVA_SIZE
  : 0;

const bothRegions = rhBelowRegionReach > 0 && lhAboveColumn > 0;
const effectiveInterStaffGap = Math.max(
  INTRA_STAFF_GAP,                                          // 8 floor — unchanged
  belowRHStack + aboveLHStack + (bothInterStaff ? MID_GAP : 0), // existing arm
  rhBelowRegionReach + (bothRegions ? MID_GAP : 0) + lhAboveColumn, // NEW arm
);
```

The new arm stacks, top-of-gap downward: the RH below-staff region (region b), a
`MID_GAP` only when both regions are present, then the LH-above column (region a +
pad + the `OTTAVA_SIZE` band) rising from `lhTopY`. `max(lhAboveExtent,
aboveLHStack)` is "the top of region (a)" — the ottava must clear **both** the raw
LH high notes **and** the above-LH note annotations (the latter sit at
`aboveLH.baseY = lhTopY − NOTE_GAP_STAFF`). Because `effectiveInterStaffGap` is a
**max** across arms (not a sum), `aboveLHStack` appearing in two arms is not
double-counted; each arm is its own self-consistent stacking and the gap takes the
tallest.

**New band field `ottavaLeftAboveLaneY` (R1.2).** Added to the band literal next
to `ottavaAboveLaneY`:

```
ottavaLeftAboveLaneY: hasLHOttavaAbove
  ? lhTopY - Math.max(lhAboveExtent, aboveLHStack) - NOTE_GAP_STAFF
  : null,
```

This baseline is the **low edge** of the `OTTAVA_SIZE` band — the same convention
as the top-margin lane (`ottavaAboveLaneY`) and the same `y` semantics
`renderOttava` expects. The glyph rises `OTTAVA_SIZE` above this baseline into the
clearance the gap reserved. It is `null` whenever no LH-above shift is present, and
is never read in that case (proof below).

**Per-hand "above" emit selection (R1.2 / R1.6).** In `buildSystemTexts`, the
"above" branch selects the lane per hand; the "below" branch is untouched:

```
const aboveY = hand === "rightHand"
  ? band.ottavaAboveLaneY
  : band.ottavaLeftAboveLaneY;
// ...
y: ott.placement === "above" ? aboveY : staffBottomY + 2,
```

RH "above" → `band.ottavaAboveLaneY` (the top-margin lane, unchanged — this is
exactly what the COMPREHENSIVE_SONG test asserts). LH "above" →
`band.ottavaLeftAboveLaneY` (the new gap lane). When both hands have a positive
shift on the same system (R1.6), the two land in distinct vertical zones — RH in
the top margin, LH in the gap — and cannot overlap because they are separated by
the whole top staff and the upper part of the gap.

**Null-safety (no silent fallback).** When `placement === "above"` and
`hand === "leftHand"`, `aboveY = band.ottavaLeftAboveLaneY` is **provably
non-null**: the LH-above flush happens only when `ott.placement === "above"` ⇔
`run.shift > 0` ⇔ some member has `leftHand.octaveShift > 0`, which is exactly the
condition the gate `systemHasLeftOttavaAbove(members)` reads over the same members.
A *negative* LH shift forms a run too, but it takes the "below" branch
(`staffBottomY + 2`) and never reads `ottavaLeftAboveLaneY`; the positive-only gate
correctly stays false for it. The two cannot disagree. The plan/code therefore
**must not** add a `?? ottavaAboveLaneY` fallback — that would silently
reintroduce Bug 1's wrong-staff placement if it ever fired. An explicit assert at
the LH-above emit is an acceptable belt-and-braces alternative to relying on the
proven invariant.

### Bug 2 — per-system measure-extent x-span

The fix replaces the notehead-only span with a **measure-extent** span keyed to
the run's first and last *measures*, and replaces the skip-when-no-noteheads guard
with a covers-at-least-one-measure guard. Every measure model carries `.x` (its
absolute left edge) and `.width`, and these come from the spacing grid, not from
notes — so they exist and are monotone even for a rest-only or empty measure
(`width ≥ EMPTY_MEASURE_WIDTH = 3.3`, never 0).

**Run shape — drop `xs`, track first/last measure models:**

```
run = { shift, firstModel, lastModel, firstHandNotes }
```

In the per-measure loop, when a measure contributes to a run:

```
if (!run.firstModel) {
  run.firstModel = measureModels[i];
  run.firstHandNotes = laid.notes;   // laid = right|left, the same list read today
}
run.lastModel = measureModels[i];
```

A **rest-only measure still sets `firstModel`/`lastModel`** (the shift comes from
`ctx`, not from notes) — that is precisely what makes a rest-only system emit a
bracket (R2.1). `run.firstHandNotes` is keyed to the **first run-measure's own
notes**, deliberately *not* a global note list.

**x-span formula:**

```
x2 = run.lastModel.x + run.lastModel.width;                 // last run-measure right barline
const firstNotesX = run.firstHandNotes.map((n) => run.firstModel.x + n.x);
x1 = firstNotesX.length > 0
  ? Math.min(...firstNotesX) - NOTEHEAD_RX                  // left-start refinement, when present
  : run.firstModel.x;                                       // else the measure's left edge
```

- `x2` is the last run-measure's right barline. Since the last note is inside the
  last measure, `x + width ≥ lastNoteX`; dropping the old `max(xs) + NOTEHEAD_RX`
  only ever *extends* to the true barline, never shortens (R2.2).
- `x1` keys the left-start refinement to the **first run-measure's own notes**,
  **not** a global min over all run notes. A global min would *under-span* a sparse
  run whose lone note is in a later measure (e.g. `[rest, note, rest]` → the global
  min jumps `x1` to the middle note — the exact R2.2 defect). Keying to the first
  measure gives `x1 = firstModel.x` for a rest-leading run and preserves today's
  `firstNoteX − NOTEHEAD_RX` for a note-bearing first measure.

**New guard:**

```
if (ott && run.firstModel) {
```

`run.firstModel` is set whenever the run covers ≥ 1 measure, so this fires on
rest-only systems too (replacing the dropped `run.xs.length > 0`). The `&& ott`
half is **kept** because `ottavaFor` returns `null` for out-of-range shifts
(`±3`): those are truthy, so they start a run and set `firstModel`, but have no
label — `&& ott` correctly drops them.

**One bracket per system, multi-system preserved (R2.3).** `buildSystemTexts` is
called once per wrapped system with that system's own `measureModels` slice, so a
multi-system note-bearing run still yields exactly one bracket per system, each
spanning its own measure portion. Only the per-system-local x1/x2 formula changed.

### Model contract — unchanged

The emitted ottava object stays **exactly** `{ hand, label, placement, x1, x2, y }`
— no new fields. `renderOttava` reads only `hand` / `label` / `x1` / `x2` / `y` and
stamps `data-hand`; it needs **no change**. The only behavioral diffs are the
*values* `buildSystemTexts` computes: the LH-above `y` (now `ottavaLeftAboveLaneY`
instead of the top-margin lane) and the corrected measure-extent `x1`/`x2`. This
matches the spec Out-of-Scope: no change to `ottavaFor`, the song schema, or the
SVG draw layer.

---

## Key decisions and trade-offs

### KD1 — LH-above lane lives in the inter-staff gap, reserved by a gap flex (not a fixed offset)

The spec rejects a fixed `leftStaffTopY − k` offset (R1.3): it has been shown to
collide with LH high notes and the RH below-staff dynamics row. The chosen design
grows `effectiveInterStaffGap` by a new max-arm so the lane is *reserved* room
between the RH below-staff region (above) and the LH high notes / above-LH notes
(below). **Trade-off:** the gap can grow taller than today when a LH-above shift
coincides with LH highs and/or an RH dynamics row, pushing the LH staff lower —
but that growth is exactly the room the marking needs, and the spec's no-overlap +
correct-ordering requirement is unconditional. **Rejected alternative:** the fixed
offset (cheaper, no gap change) — rejected by the spec for the collisions above.

### KD2 — `rhBelowRegionReach` uses `DYNAMICS_LANE_RESERVE`, occ-independent

`belowRHStack` is 0 when `occ.belowRH === 0`, even when the RH prints a
dynamics-only or hairpin-only row that physically reaches ~`rhBottomY + 3.5`. The
new arm therefore takes an explicit `Math.max(belowRHStack, (rhHasDynamics ||
rhHasHairpin) ? DYNAMICS_LANE_RESERVE : 0)`, independent of the note count, so the
LH-above lane clears the RH row even when no below-RH note exists. **Why
`DYNAMICS_LANE_RESERVE` (6.9):** it is already the canonical "depth a below
annotation dodges to clear the whole below-staff dynamics region," so reusing it is
semantically honest and **adds zero new constants**. **Trade-off:** ~2.8 sp more
whitespace than the tight true edge (~4.12 sp, the dynamic glyph body bottom). This
extra air only appears in the rare LH-above + RH-dynamics-only combination and
never causes a collision. **Rejected alternative:** a new `RH_BELOW_REGION_EDGE ≈
4.12` constant — tighter, but introduces a new magic number for a rare case; the
plan may choose it if whitespace matters, since both satisfy the no-overlap
invariant.

### KD3 — `GAP_PAD = NOTE_GAP_STAFF (1)`; lane baseline is the band's low edge

The pad between the LH content top and the ottava baseline reuses `NOTE_GAP_STAFF`,
matching the existing above-LH band convention (`aboveLH.baseY = lhTopY −
NOTE_GAP_STAFF`). The lane baseline (`ottavaLeftAboveLaneY`) is the **low edge** of
an `OTTAVA_SIZE`-tall band, mirroring the top-margin lane and matching the `y`
semantics `renderOttava` expects (the glyph ascends `OTTAVA_SIZE` above `y`). This
keeps the two "above" lanes consistent and adds **zero new constants**. Net new
symbols across the whole fix: 0 new constants, 1 new helper (`lhAboveTopExtent`),
1 new band field (`ottavaLeftAboveLaneY`), 2 split predicates (one replaces
`systemHasOttavaAbove`).

### KD4 — Split `systemHasOttavaAbove` into RH and LH predicates

The top-margin reservation must be RH-only (R1.5), and the gap reservation must be
LH-only. The combined predicate had exactly one caller, so the split is a
one-condition change with no ripple: `topMarginLayout` uses
`systemHasRightOttavaAbove`; the gap arm and band field use
`systemHasLeftOttavaAbove`. **Rejected alternative:** keeping the combined
predicate and gating per branch — rejected because the top margin would still
over-reserve for a LH-only shift, violating R1.5.

### KD5 — x1 keyed to the FIRST run-measure's own notes, not a global min

The naive `Math.min(...allRunNotes) − NOTEHEAD_RX` under-spans a sparse run whose
lone note is in a later measure (the global min jumps `x1` rightward to that note).
Keying the left-start refinement to the **first run-measure's** notes gives
`x1 = firstModel.x` for a rest-leading run and preserves today's behavior for a
note-bearing first measure. This single rule fixes both the rest-only drop and the
sparse under-span without a special case. **Rejected alternative:** the global-min
formula — rejected; it is the R2.2 defect itself.

### KD6 — No silent `?? ottavaAboveLaneY` fallback on the LH-above lane

A defensive fallback to the top-margin lane would silently reintroduce Bug 1's
wrong-staff placement if it ever fired. The gate↔run null-consistency is provable
(shared `octaveShift > 0` ⇔ `ottavaFor` "above"), so the LH lane is non-null
whenever it is read. Prefer the proven invariant (optionally an explicit assert) so
a future divergence surfaces loudly rather than mis-placing the bracket.

---

## Invariants (for the plan and tests to assert)

- **Ordering / no overlap (LH-above lane):**
  `ottavaLeftAboveLaneY < lhTopY − max(lhAboveExtent, aboveLHStack)` (the baseline
  sits above the LH content) **and**
  `ottavaLeftAboveLaneY − OTTAVA_SIZE > rhBottomY + rhBelowRegionReach` (the glyph
  top clears the RH below-staff region). Both are strict because `GAP_PAD > 0` and
  `MID_GAP > 0` add slack.
- **Per-hand "above":** RH "above" → `band.ottavaAboveLaneY` (unchanged); LH
  "above" → `band.ottavaLeftAboveLaneY` (in the gap, `< lhTopY`). "below" unchanged
  (`staffBottomY + 2`), per hand.
- **LH-only +1:** top margin equals the no-shift baseline; `ottavaAboveLaneY` is
  null/unchanged (R1.5).
- **Both +1:** two "above" brackets at distinct Y (RH top-margin `<` LH gap), no
  overlap (R1.6).
- **Span:** `x2 = lastModel.x + width`; `x1 =` first-run-measure's-own-notes min
  `− NOTEHEAD_RX` (else `firstModel.x`); a bracket is emitted on **every** system
  the run covers, including rest-only; one bracket per system; `x1 < x2` strictly
  (the `EMPTY_MEASURE_WIDTH` floor guarantees no degenerate zero-width bracket).

### Worked numbers (rhBottomY = 9, GAP_PAD = 1) — confirm the geometry

- **Collapse (LH +1, no LH highs, no RH below):** `lhAboveColumn = 0 + 1 + 2.2 =
  3.2 < 8` ⇒ gap stays at the `INTRA_STAFF_GAP` floor (8); existing geometry
  undisturbed. `lhTopY = 17`, `ottavaLeftAboveLaneY = 16`, glyph top `= 13.8`; RH
  region bottom `= 9` ⇒ 4.8 sp clearance.
- **LH +1 with a G5 high note (6.5 above lhTopY), no RH below:** new arm `= 0 +
  MID_GAP(1.2) + (6.5 + 1 + 2.2) = 10.9 > 8` ⇒ gap grows to 10.9, `lhTopY = 19.9`;
  baseline `= 19.9 − 6.5 − 1 = 12.4`, glyph top `= 10.2`; G5 top sits at `lhTopY −
  6.5 = 13.4` (below the baseline ⇒ the ottava is above the note); RH region bottom
  9 ⇒ glyph clears it.
- **Both hands +1, no other content:** top margin 5, `ottavaAboveLaneY = 4` (RH,
  top margin); gap stays 8 (LH column 3.2 < 8), `lhTopY = 17`,
  `ottavaLeftAboveLaneY = 16` (LH, gap). The two "above" lanes are 12 sp apart and
  distinct.

---

## Risks and backward-compatibility analysis

**The new gap arm and `lhAboveTopExtent` are inert for the entire current suite —
proven, not assumed.** A scan of `src/notation/__tests__/` shows **every**
`octaveShift` fixture is a *right-hand* shift; the only `leftHand.octaveShift`
reference asserts the diff is `false` (LH shift unchanged = 0). No fixture sets
`leftHand.octaveShift > 0`, so `systemHasLeftOttavaAbove` is false everywhere ⇒
the new gap arm gates to 0 ⇒ `effectiveInterStaffGap` is byte-for-byte unchanged
for all existing fixtures ⇒ no currently-asserted band Y (`lhTopY`,
`ottavaAboveLaneY`, `annotationAboveRHLaneY`, etc.) can shift. Separately, every
gap/band-Y-asserting fixture has LH pitches **below** the bass top line
(C3/G3/B2/F#2 ⇒ step `< 0` ⇒ `lhAboveTopExtent = 0`), so even where the helper
runs it contributes 0. The LH-above path is entirely new/untested today.

**No test asserts an ottava `x1`/`x2`.** A re-grep confirms all `x1`/`x2`
assertions belong to beams/ties/slurs/hairpins, never ottavas. The measure-extent
span change therefore breaks zero existing assertions. The SVG test asserts only
that an ottava element *exists* (RH fixture) — no x/y/shape assertion.

**The RH-only top-margin split preserves the RH fixtures.** The "stack above the
staff" test (RH +1) still fires the RH predicate ⇒ `ottavaAboveLaneY` reserved. The
"top margin flexes" test compares RH +1 vs no-shift (never a LH-only case), so the
per-hand split leaves both sides unchanged. The COMPREHENSIVE_SONG test that
asserts every "above" ottava sits at `band.ottavaAboveLaneY` stays green because
that fixture is RH-only and RH "above" still selects `ottavaAboveLaneY`. (This is
why the design keeps `ottavaAboveLaneY` as the RH lane and adds a *separate*
`ottavaLeftAboveLaneY`, rather than renaming.)

**Risk: ordering dependency.** `topMarginLayout` runs before the gap and reads only
above-RH inputs, so the RH-only predicate swap cannot perturb the gap/band math.
The data flow is strictly top-margin → gap → band → `buildSystemTexts`.

**Net result:** existing tests stay green; the five new spec-acceptance tests
(LH-above placement; no top-margin over-reservation for a LH-only shift; both hands
"above"; rest-only + sparse span; multi-system regression guard) exercise the new
LH and Bug-2 paths.

### Noted design consideration (non-blocking; for the code-plan to decide)

`lhAboveTopExtent` should ideally pass the measure's **actual** LH clef
(`m.ctx.leftHand.clef`) to `handStepsFor`, not hardcode `"bass"`, so a tenor/alto
LH staff (e.g. COMPREHENSIVE_SONG's section 2 switches the LH clef to "tenor")
computes the correct step. `ledgerBottomExtent` (~2184, via `measureMinLeftSteps`)
hardcodes `"bass"` and has the **same latent limitation**. Matching it (hardcode
`"bass"`) is consistent-but-imperfect; using `m.ctx.leftHand.clef` is strictly more
correct and cheap. This does **not** affect any current fixture (the LH-above gate
is off for all of them) and is **not** a scope expansion — it is a noted
consideration for the code-plan to settle. The design above reads
`m.ctx.leftHand.clef` as the recommended choice; either is regression-safe.
