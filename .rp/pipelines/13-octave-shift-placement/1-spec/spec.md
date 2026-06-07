# Spec — Fix octaveShift ottava placement for left and right hands (#13)

## Overview

The piano-block notation engine renders each hand's `octaveShift` setting as an
ottava marking: a dashed bracket with a label ("8va", "15ma", "8vb", "15mb")
drawn over the affected notes. A grand staff has two staves — the right hand on
the top (treble) staff and the left hand on the bottom (bass) staff. A positive
`octaveShift` produces an "above" marking; a negative one produces a "below"
marking. The marking is restated once per system (line) for every system the run
of notes spans.

Two placement bugs are reported:

1. **Wrong staff for a left-hand "above" marking.** A left-hand positive
   `octaveShift` (e.g. +1 → "8va") draws its bracket above the **right-hand
   (top / treble) staff** instead of above the **left-hand (bottom / bass)
   staff**. The bracket therefore sits over the wrong staff, visually detached
   from the notes it annotates. Root cause: in the bracket-emit code the "above"
   branch always uses `band.ottavaAboveLaneY` — a single lane reserved above the
   top staff — regardless of which hand owns the shift. (The "below" branch is
   already hand-aware: it uses each hand's own `staffBottomY`, so left- and
   right-hand "below" markings already land correctly.)

2. **Bracket dropped on rest-only systems.** A bracket is silently omitted on
   any system whose portion of an `octaveShift` run contains no noteheads for
   that hand (e.g. the hand has only rests in that system's measures). Root
   cause: the bracket's horizontal span is built solely from notehead X
   positions, and the emit step is skipped when that list is empty. The owner
   reported this as "a right-hand shift not showing on the first line," but it is
   not specific to the right hand or to the first line — it affects either hand
   and any system whose run-portion is rest-only. The same notehead-only spanning
   also causes a pre-existing under-span: a sparse run (e.g. a single note in a
   middle measure) draws a tiny bracket around that note instead of covering the
   measures the run actually spans.

This is a focused bug fix to ottava-bracket placement and per-system
consistency. It does not add features or change the song schema.

### Key facts about the current layout

The system-text builder groups, per hand, contiguous runs of measures sharing a
non-zero `octaveShift` and emits one bracket per run per system. Relevant
vertical references on each system's `band` (smaller Y is higher on the page):

- `band.rightStaffTopY` / `band.rightStaffBottomY` — top staff (right hand).
- `band.leftStaffTopY` / `band.leftStaffBottomY` — bottom staff (left hand).
- `band.ottavaAboveLaneY` — a single lane in the **top margin**, above the top
  staff, used for "above" ottavas today.
- The **inter-staff gap** is the space between the two staves; its size is
  computed by `effectiveInterStaffGap`, which today flexes only for the
  `belowRH` (right-hand below-staff) and `aboveLH` (left-hand above-staff) note
  stacks — it accounts for **no ottava** and for **no raw left-hand high-note /
  ledger extent**.
- `systemHasOttavaAbove` returns true when **either** hand has a positive shift;
  it is the trigger that reserves the top-margin ottava lane and deepens the top
  margin.

Each measure has a layout model carrying `x` (measure left edge, absolute system
X) and `width`, so `x + width` is the right-barline X. These measure edges come
from the spacing grid, not from notes, so they exist and are monotone even for a
rest-only or empty measure (`width ≥ EMPTY_MEASURE_WIDTH = 3.3`, never 0).

## Requirements

### R1 — Per-hand "above" ottava placement (Bug 1)

- **R1.1** A **right-hand** positive `octaveShift` ("8va" / "15ma") draws its
  bracket above the right-hand (top / treble) staff in the top-margin ottava lane
  (`band.ottavaAboveLaneY`). This is today's behavior and is unchanged.

- **R1.2** A **left-hand** positive `octaveShift` ("8va" / "15ma") draws its
  bracket above the left-hand (bottom / bass) staff — i.e. in the inter-staff
  gap, above `band.leftStaffTopY` — **not** above the top staff. (Today it
  wrongly sits at `band.ottavaAboveLaneY`; this is the reported bug.)

- **R1.3** The left-hand "above" ottava must occupy a **reserved lane within the
  inter-staff gap** that clears both:
  - (a) the left-hand staff's own high notes / ledger lines above its top line,
    and
  - (b) the right-hand staff's below-staff region (its `belowRH` note stack and
    any point-dynamic row or hairpin lane).

  A fixed `leftStaffTopY − k` offset is **insufficient** and is rejected: it has
  been shown to collide with left-hand high notes (drawing the "8va" *below* the
  notes it annotates) and with the right-hand below-staff dynamics row. The
  inter-staff gap flex (`effectiveInterStaffGap`) must grow to include this lane.
  The bracket must sit **above** the left-hand notes it annotates and must not
  overlap right-hand below-staff content. Exact geometry is left to the design
  and plan phases; the requirement is no-overlap plus correct vertical ordering.

- **R1.4** Negative ("below") shifts are **unchanged** and already correct
  per-hand: a left-hand "8vb" / "15mb" sits below the bottom staff; a right-hand
  "8vb" / "15mb" sits below the top staff (in the inter-staff gap). The "below"
  branch is not modified.

- **R1.5** The top-margin reservation must be **per-hand**: the top-margin ottava
  lane (and the deepened top margin) is reserved **only** when a right-hand
  positive shift is present. A left-hand-only positive shift must **not** deepen
  the top margin — its bracket lives in the inter-staff gap. Today
  `systemHasOttavaAbove` triggers on either hand and over-reserves the top margin
  (~2.8 sp) for a left-hand-only shift; this trigger must be split so the
  top-margin lane is driven by the right hand only.

- **R1.6** When both hands have a positive shift on the same system, the
  right-hand bracket sits in the top-margin lane and the left-hand bracket in the
  inter-staff-gap lane. The two occupy distinct vertical zones and must not
  overlap each other or any notes / dynamics.

### R2 — Consistent appearance across every system the run spans (Bug 2)

- **R2.1** A bracket is emitted on **every** system that a non-zero `octaveShift`
  run spans, including a system whose portion of the run contains **no
  noteheads** for that hand (rest-only). Today such a system silently drops the
  bracket because the horizontal span is built only from notehead positions.

- **R2.2** On each system, the bracket spans the run-portion's **measure
  extent**: from the first run-measure's left edge (or, when a note is present,
  the first note's X minus the notehead radius `NOTEHEAD_RX`, preserving the
  left-start refinement) to the last run-measure's right edge (`x + width`). This
  single rule fixes both the rest-only drop (R2.1) and the pre-existing
  under-span where a sparse run drew a tiny bracket around a lone note. Measure
  edges are always present and monotone, even for rest-only or empty measures.

- **R2.3** Multi-system note-bearing runs already restate one bracket per system
  correctly (each system builds its run from its own measure slice). This
  behavior must not regress.

## Out of Scope

- **`ottavaFor` sign → label / placement mapping** — `1` → "8va", `2` → "15ma",
  `-1` → "8vb", `-2` → "15mb"; positive = above, negative = below. Unchanged.
- **Song schema and `octaveShift` field semantics** — no new fields, no schema
  changes.
- **The SVG `renderOttava` draw layer** — it is already hand-agnostic, consuming
  the layout-computed `y`, `x1`, `x2` and stamping `data-hand`. All placement
  logic stays in the layout module; no SVG-layer change is expected beyond what
  the layout already feeds it.
- **No new features.** This is a focused bug fix; do not broaden scope.

## Acceptance Criteria

### Existing tests must stay green (zero existing assertions break)

No existing test asserts an ottava bracket's `x1` / `x2`, and no existing fixture
exercises a left-hand "above" ottava, so the following remain unchanged and must
continue to pass:

- `ottavaFor` label / placement helper test.
- "starts an 8va ottava for the RH octave shift" (right-hand-only fixture).
- "tempo, ottava, and note lanes stack above the staff" — its fixture has only a
  right-hand positive shift, so all "above" ottavas remain at
  `band.ottavaAboveLaneY`.
- "the top margin flexes…" — compares a right-hand +1 shift versus no shift;
  neither is a left-hand-only case, so the per-hand `systemHasOttavaAbove` split
  does not change either side.
- The SVG test asserting an ottava element exists (right-hand fixture).

### New tests to add

1. **Left-hand "above" placement.** A left-hand `octaveShift` of +1 produces an
   "above" ottava whose `y` is in the inter-staff gap above `band.leftStaffTopY`
   (and **not** at `band.ottavaAboveLaneY`), and which clears the left-hand high
   notes / ledger lines and the right-hand below-staff dynamics region (no
   overlap; the bracket sits above the annotated left-hand notes).

2. **No top-margin over-reservation for a left-hand-only shift.** With a
   left-hand-only +1 shift, the top margin (and `band.ottavaAboveLaneY`) is
   **not** reserved for a right-hand lane: the top margin equals the no-shift
   baseline given identical above-the-right-staff content.

3. **Both hands "above".** With both hands at +1, two "above" brackets are
   emitted at distinct Y values (right hand in the top-margin lane, left hand in
   the inter-staff-gap lane) and they do not overlap each other.

4. **Rest-only and sparse run spanning (Bug 2).** A system whose portion of an
   `octaveShift` run has no noteheads (rest-only) still emits a bracket; and a
   sparse run (e.g. a single note in a middle measure) spans the run's measure
   extent rather than just ±`NOTEHEAD_RX` around the lone note.

5. **Multi-system regression guard.** A multi-system note-bearing run still emits
   exactly one bracket per system it spans.

### Behavioral checks

- A right-hand "8va" / "15ma" still renders above the top staff in the top-margin
  lane.
- A left-hand "8va" / "15ma" renders above the bottom staff in the inter-staff
  gap, above the notes it annotates.
- Left- and right-hand "8vb" / "15mb" markings are unchanged.
- Brackets appear on every system a run spans, including rest-only systems, and
  span the full measure extent of the run-portion on each system.
