# Spec research — Issue #14: more horizontal space at the start of each measure

Phase 1 (Spec) artifact. Owner: spec-analyst. Driven by an iterative Q&A with
the spec-researcher teammate. This file is the running record of questions,
findings, and the testable requirements we land on.

## Problem statement (from `0-prompt/prompt.md`)

The Piano block's rendered grand-staff sheet music crowds the first note of a
measure right up against the measure's left edge / barline. The owner wants
more horizontal lead-in space at the start of a measure so the opening note has
room to breathe instead of starting flush against the left edge. Applies to
both staves (treble + bass) of the grand staff.

## Codebase grounding (spec-analyst, before the Q&A)

The pure layout layer lives in `src/notation/layout.js` (geometry in staff-space
"sp" units); constants live in `src/notation/constants.js`; the SVG emit layer
is `src/notation/svg.js`. Tests in `src/notation/__tests__/layout.test.js`.

Key facts about how a measure's first note is currently placed:

- `buildLayoutModel` walks each measure and builds a `columnX` map. The first
  column is placed at `cx = leadInset` (layout.js ~line 1987), where
  `leadInset = (localIdx > 0 ? sectionReserve : 0) + noteAccidentalLead`.
- In the COMMON case (no opening accidental, not a mid-system section change)
  `leadInset = 0`, so the **first note's center sits at the measure's left edge
  X** (`x = STAFF_MARGIN_X + reserve` for a system's first measure, or the
  previous measure's right edge for interior measures).
- The only existing "space" before the first note is:
  - `BARLINE_POST_PAD = 0.7` sp — whitespace folded into the PREVIOUS measure's
    trailing pad (`barlineTrailingPad`), so an interior measure's note clears the
    bar by 0.7 sp (still < a notehead diameter ≈ 1.18 sp from the bar stroke).
  - `STAFF_MARGIN_X = 1.5` sp + the leading reserve (clef/key/time) for a
    system's first measure — but that reserve is about the clef block, not a
    musical lead-in, and a plain interior measure gets none of it.
  - `ACCIDENTAL_LEAD_EXTRA = 1` sp, added ONLY when the opening note has an
    accidental.
- Relevant constants: `MIN_ADV = 2.2`, `ADV_K = 3.0`, `NOTEHEAD_RX = 0.6`
  (notehead ≈ 1.18 sp wide), `EMPTY_MEASURE_WIDTH = 3.3`,
  `BARLINE_POST_PAD = 0.7`, `ACCIDENTAL_LEAD_EXTRA = 1`.

Existing tests that ENCODE the current "hug the left edge" behavior (these are
the tests that must be revised by the eventual change, and they pin the exact
current contract):

- layout.test.js ~2092 "a whole-measure note is left-aligned (not centered)
  near the bar": `expect(m.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)`.
- layout.test.js ~2138 "an opening note hugs the measure start…":
  `expect(plain.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` and the sharp case
  is `> plain`.
- layout.test.js ~2030 "every barline leaves a gap wider than a notehead before
  the next measure": `expect(measures[i].x - barX).toBeGreaterThan(NOTEHEAD_RX)`
  — this is a barline→measure-edge gap, satisfied by `BARLINE_POST_PAD`; it does
  NOT currently guarantee a barline→first-NOTE gap.

So the request reduces to: introduce a leading gap between a measure's left edge
(barline) and its first note column, applied to every measure on both staves.

## Q&A log

### Q1 — Where is the first note's X computed; is there a single chokepoint?

**Researcher findings (confirmed against code):**

- First grid column placement: `src/notation/layout.js:1986-1991` (the measure
  walk inside `buildLayoutModel`). The first column (onset 0 = the measure's
  first note) is placed at `cx = leadInset`; subsequent columns advance from
  there. So the opening note's MEASURE-RELATIVE X equals `leadInset`.
- `leadInset` is defined at `layout.js:1974-1976` as
  `(localIdx > 0 ? sectionReserve : 0) + noteAccidentalLead`. For an ordinary
  measure (no mid-system section change, no opening accidental) `leadInset = 0`
  → the first note's center sits AT the measure's left edge. This is the
  "crammed against the barline" behavior.
- The only existing leading room is conditional: `ACCIDENTAL_LEAD_EXTRA = 1` sp
  (`constants.js:145`, gated by `firstColumnHasAccidental`, `layout.js:2214`)
  and `sectionReserve`/`inlineReserveWidth` (mid-system clef/key/time changes).
  Neither fires for an ordinary measure.
- The inter-measure space that DOES exist is on the TRAILING side:
  `BARLINE_POST_PAD = 0.7` sp + barline stroke width via `barlineTrailingPad`
  (`layout.js:1272`), folded into the PREVIOUS measure's width. Its own doc
  comment says it is "Kept small so the opening note sits close to the bar."
- Units: staff-spaces (sp); `SP_PX = 8` (`constants.js:19`), staff height 4 sp.

**Single chokepoint (key for the design):** Both hands share the per-measure
`columnX` map, so the first column's X is set once per measure. Two clean,
already-present mechanisms exist:

1. `leadInset` at `layout.js:1974` (placement) + the matching `m.contentWidth`
   term at `layout.js:1767` (packing budget) — exactly how `noteAccidentalLead`
   is threaded today (added to BOTH so placement and wrap budget stay in sync).
2. `measureLayout` ALREADY accepts a `leadingPad` option (`layout.js:795,825`)
   that offsets the first column and is folded into `ml.width`; today
   `buildLayoutModel` only ever passes `trailingPad` (`layout.js:1742-1744`), so
   `leadingPad` is unused for a generic per-measure lead-in. Wiring a constant
   lead-in through `leadingPad` would update both placement and width in one go.

Either path applies uniformly to EVERY measure on BOTH staves at once. The SVG
emit layer (`svg.js`) is a thin consumer of `measure.x` + per-note `note.x` and
re-derives nothing, so the change is confined to the pure layout layer.

**Tests pinning the current flush behavior (must be revised):**
`layout.test.js:2118-2121` and `:2138-2161` assert `notes[0].x < NOTEHEAD_RX`
(≈ 0.6 sp); `:2030-2040` asserts only a barline→measure-EDGE gap > NOTEHEAD_RX
(not a barline→first-NOTE gap).

### Q2 — Scope + first-of-system handling (asked)
