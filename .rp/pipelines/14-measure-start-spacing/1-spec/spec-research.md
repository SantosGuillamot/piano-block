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

**Numerical trace (researcher, A1 follow-up — confirms the magnitude):**

- INTERIOR measure, regular bar, no accidental: the next measure's left edge is
  `x_next = x_prev + scaledContent + trailingPad`, where
  `trailingPad = barlineSpec("regular").width + BARLINE_POST_PAD = 0.13 + 0.7 =
  0.83` sp. So `x_next` is exactly `BARLINE_POST_PAD = 0.7` sp right of the
  barline stroke's right edge. With `leadInset = 0`, the first note's CENTER =
  `x_next`. The barline-stroke→note-center gap ≈ 0.7 sp; minus the notehead left
  half-width `NOTEHEAD_RX = 0.6`, the VISIBLE whitespace from barline to notehead
  left edge is only ≈ 0.1 sp — this is the "crammed" look.
- SYSTEM-FIRST measure: left edge at `x = STAFF_MARGIN_X + reserve`
  (`layout.js:1966`); `reserve` includes `RESERVE_PAD = 1` sp after the
  clef/keysig/timesig block. With `leadInset = 0` the first note hugs that edge,
  i.e. it already gets `RESERVE_PAD = 1` sp past the time signature. A
  section change at a system head does NOT add `sectionReserve` to `leadInset`
  (gated on `localIdx > 0`, `layout.js:1975`) because the head `reserve` already
  restates clef/key/time.

**Caveats the researcher flagged (facts, not design):**

- `leadInset` also feeds standalone-annotation X (beat-0 → `leadInset`,
  `layout.js:1604/1642`, used by `collectStandaloneAnnotations` at 2042-2051)
  and `scaledContent = leadInset + scaledGrid` (`layout.js:1982`), which sets
  `measureRightX` and thus measure width. So any lead-in added to `leadInset`
  MUST also be added to the measure's intrinsic `contentWidth` used for packing
  (`layout.js:1767`), exactly as `noteAccidentalLead` already is.
- `leadInset` is NOT scaled by justify (only `scaledGrid` is,
  `layout.js:1980-1982`). A constant lead-in therefore stays fixed under
  justification — the desirable behavior for an engraving lead-in.

### Q2 — Scope across measure types + downstream consumers

**Researcher findings (A2):**

(a) SYSTEM-FIRST measure. Its left edge is `STAFF_MARGIN_X + reserve`
(`layout.js:1966`); the positioned reserve model lays out brace
(`BRACE_WIDTH=1.5`) → clef (`CLEF_WIDTH=3.8`) → keysig cluster → time sig, then
`reserve` adds `RESERVE_PAD = 1` sp at the end (`layout.js:1291,1318`). So a
system-first measure's first note ALREADY sits ~1 sp (`RESERVE_PAD`) past the
clef/keysig/timesig block. Crucially, a system-first measure has NO left barline
(left barlines are only drawn for `repeat-start`, never the score's first
measure; ordinary barlines are drawn at each measure's END — `layout.js:2021,
2028-2032`). So the system-first "left edge" is the reserve/clef block, not a
barline. Adding the SAME additive lead-in to `leadInset` for ALL measures would
give the system-first note `RESERVE_PAD (1) + lead-in` of clearance — i.e. it
would be indented MORE than an interior measure's barline gap (the lead-in
stacks on top of `RESERVE_PAD`).

(b) INTERIOR measures — confirmed. Every interior measure's first column sits at
`cx = leadInset` (`layout.js:1987`), shared by both hands via the single
`columnX` map. A generic lead-in added to `leadInset` applies to both staves
uniformly — same rail as `noteAccidentalLead`/`ACCIDENTAL_LEAD_EXTRA`.

(c) EMPTY measure — no first note, so a lead-in is visually irrelevant, but
HARMLESS and self-consistent via the existing width accounting: an empty grid
returns `columns: []`, `contentWidth = EMPTY_MEASURE_WIDTH = 3.3`; the lead-in
just widens it (and must be in `contentWidth` for packing). No NaN/crash
(empty-grid short-circuit, `layout.js:810-820`). Only effect: an empty measure
gets slightly wider — arguably desirable for consistent measure starts.

(d) Downstream consumers — NOTHING assumes column-0 X == 0:
- Notes/rests/stems/flags/ledgers/dots/accidentals: `x = columnX.get(onsets[idx])
  ?? 0` (`layout.js:1438`); the `?? 0` is a missing-key fallback, not a
  column-0-at-0 assumption — a present onset returns its real `columnX` value.
- Beams: built from `note.x` — move with the notes.
- Ties/slurs/hairpins/point-dynamics: anchored at `measureX + note.x`
  (`layout.js:2375`) — consistent.
- Standalone annotations: built explicitly in the `leadInset` frame
  (beat-0 → `leadInset`, `layout.js:1604,1642,1645-1646`) and receive `leadInset`/
  `scaledContent` directly (`layout.js:2048-2049`) — track the shift automatically.
- Barlines: end bar at `measureRightX = x + scaledContent`
  (`scaledContent = leadInset + scaledGrid`) — moves right by the lead-in, i.e.
  the measure simply gets wider on the LEFT. A `repeat-start` LEFT bar is drawn
  at `x` (the measure's left edge, BEFORE the lead-in), so a left barline stays
  flush at the boundary and the first note sits the lead-in past it — correct
  engraving. These code paths are ALREADY exercised with a nonzero `leadInset`
  today (via `noteAccidentalLead`/`sectionReserve`), so a generic lead-in rides
  the same rails.

**The one hard invariant:** the lead-in MUST be folded into the measure's
`contentWidth` used for system packing (`layout.js:1767`, where
`noteAccidentalLead`/`sectionReserve` already are), or packing/justify mis-budgets.

**DECISION (D1) — scope of the lead-in (resolved autonomously):**
Apply the lead-in to EVERY measure's first column (both hands) via the
`leadInset` (placement) + `contentWidth` (packing) rail, INCLUDING the
system-first and section-first measures. Rationale grounded in the issue + code:

- The issue says "EACH measure should begin with enough horizontal breathing
  room," and the screenshot shows crowding both right after the clef block (a
  system-first measure) and in interior measures. So the requirement is
  every-measure, not interior-only.
- We do NOT special-case the system-first measure to subtract `RESERVE_PAD`.
  `RESERVE_PAD = 1` sp is the clef-block trailing slack, a DIFFERENT engraving
  concern from a musical note lead-in; engraving practice routinely leaves a bit
  more air after a clef/key/time block before the first note than after a plain
  interior barline. Letting the lead-in stack on top of `RESERVE_PAD` at a system
  head is acceptable and conventional (the opening of a line gets a touch more
  room). This keeps the change to ONE uniform mechanism (no branching on
  measure position), which is simpler and matches how `noteAccidentalLead` is
  applied unconditionally-by-predicate today.
- Net: the testable contract becomes "the first note's measure-relative X
  (`notes[0].x`) is ≥ the lead-in on every measure," uniformly, rather than a
  position-dependent rule. (The exact magnitude is Q3.)

This is a real design choice; the design phase MAY instead choose to equalize
(fold the lead-in into the reserve so system-first == interior gap). Either is
defensible. The spec's REQUIREMENT is the visible barline/boundary→notehead gap;
the uniform-`leadInset` approach is the recommended default and the one the
acceptance tests below are written against.

### Q3 — Concrete, testable lead-in magnitude (asked)
