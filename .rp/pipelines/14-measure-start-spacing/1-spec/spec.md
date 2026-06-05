# Spec: More horizontal space at the start of each measure

## Overview

In the Piano block's rendered grand-staff sheet music (treble + bass staves),
the first note of each measure sits flush against the measure's left edge —
right up against the barline (or, on a system's first measure, immediately after
the clef/key/time block). With no leading breathing room, the opening note looks
crowded and the engraving reads as cramped. Concretely, on a plain interior
measure today the visible whitespace between the barline stroke and the first
notehead's left edge is only about 0.1 staff-space (sp), well under a single
notehead width (≈ 1.18 sp).

This feature introduces a consistent horizontal **lead-in** (opening clearance)
at the start of every measure, on both staves, so the first note has room to
breathe instead of hugging the boundary. The lead-in is a small, fixed amount of
empty space — roughly one notehead width — applied uniformly so the opening of
each measure looks deliberately spaced rather than jammed against the bar.

All measurements in this spec are in staff-spaces (sp), the geometry unit the
notation layer uses (a staff is 4 sp tall).

## Requirements

1. **Every measure gets a leading lead-in.** The first content column of each
   measure — whichever event occupies onset 0, a note or a rest — is inset from
   the measure's left edge by an "opening clearance" that is at least a defined
   minimum (`MEASURE_START_PAD`). Because both staves share a single per-measure
   column grid, the lead-in applies to the treble and bass first events together
   and identically.

2. **Lead-in magnitude.** For a measure whose opening note has no accidental,
   the opening clearance equals `MEASURE_START_PAD = 1.0` sp. This makes the
   visible barline-stroke → first-notehead-left-edge whitespace on an interior
   measure roughly 1.1 sp (versus ≈ 0.1 sp today) — clearly roomier, about one
   notehead width, and below the smallest note-to-note advance so the opening gap
   never looks larger than the spacing between successive notes.

3. **Composition with an opening accidental.** When the first note of a measure
   draws an accidental, the accidental glyph needs room to seat to the left of
   the notehead, between the boundary and the head. The opening clearance and the
   existing accidental lead occupy the same slot before the first column, so they
   compose by taking the larger of the two rather than stacking. The result is
   that an accidental-opening note lands at the same measure-relative position as
   a plain opening note, while the accidental glyph still draws to the left of the
   notehead with no loss of clearance compared with today.

4. **Lead-in is a fixed engraving offset, not stretched by justification.** The
   opening clearance is constant per measure and is not scaled when a system is
   stretched (justified) or compressed. Only the inter-note grid stretches; the
   lead-in stays the same width regardless of how wide or narrow the system is.

5. **Lead-in is accounted for in layout/packing width.** The opening clearance is
   included in each measure's intrinsic width used for line-breaking and
   justification, so that measures still wrap and justify correctly and the added
   space is reflected in where measures and the following barline land. (This is a
   correctness invariant: the lead-in widens the measure on its left, and that
   widening must be budgeted, not silently added on top.)

6. **Uniform across all measure types.** The lead-in applies to: the score's
   first measure, every system-first measure, every interior measure, and
   section-first measures (mid-system clef/key/time changes). For a section-first
   measure, the cautionary clef/key/time glyphs genuinely precede the first note,
   so the lead-in comes in addition to that reserved glyph space. For an empty
   measure (no events), there is no note to place; the measure simply becomes
   wider by the clearance, with no error.

7. **No regression in dependent rendering.** All elements that derive from the
   first note's position — notes, rests, beams, ties, slurs, hairpins, point
   dynamics, octave (ottava) brackets, standalone annotations, and barlines —
   stay mutually consistent after the shift. In particular, a `repeat-start` left
   barline remains flush at the measure boundary, with the first note sitting the
   opening clearance to its right. Trailing-bar spacing and the existing
   post-barline pad are unchanged.

## Out of Scope

- Changing inter-note (within-measure) spacing, the minimum/scaled note advance,
  beaming, chord stacking, or any vertical geometry.
- Reworking the trailing post-barline pad or trailing-bar / repeat geometry on
  the right side of a measure.
- Equalizing the system-first lead-in against the interior lead-in by folding the
  pad into the leading clef/key/time reserve. This is a viable alternative the
  design phase MAY adopt; the default reflected in the acceptance criteria below
  is a uniform additive lead-in applied to every measure (so a system-first
  measure's note sits the lead-in past the clef-block reserve, i.e. slightly
  more indented than an interior measure's barline gap — conventional engraving
  for the opening of a line). The required, testable outcome is the
  boundary → notehead gap; how system-first vs interior are balanced is open
  design latitude.

## Acceptance Criteria

These reference the existing test suite in `src/notation/__tests__/layout.test.js`,
where the current "hug the left edge" behavior is pinned and must be updated.
`MEASURE_START_PAD` is the new constant (1.0 sp); `NOTEHEAD_RX` (≈ 0.6 sp) is the
notehead half-width and `BARLINE_POST_PAD` (0.7 sp) is the existing post-barline
pad.

- **AC1 — Plain opening note lands at the lead-in.** Given a measure with no
  opening accidental and no section change, when the layout is built, then the
  first note's measure-relative X on each staff (`measure.right.notes[0].x` and
  `measure.left.notes[0].x`) is `toBeCloseTo(MEASURE_START_PAD)`. This replaces
  the current `< NOTEHEAD_RX` assertions at `layout.test.js:2120` and `:2159`.

- **AC2 — Barline-to-first-note gap is at least a notehead width.** Given an
  interior measure, when the layout is built, then the horizontal distance from
  the preceding barline stroke to the first notehead is at least about one
  notehead width — i.e. the absolute first-note X minus the barline stroke X is
  `≥ MEASURE_START_PAD + BARLINE_POST_PAD − NOTEHEAD_RX`. This strengthens the
  existing barline-gap test at `layout.test.js:2030-2040` from a barline →
  measure-edge gap to a barline → first-note gap.

- **AC3 — Accidental opening note matches the plain position.** Given two
  otherwise identical measures, one whose opening note has an accidental and one
  without, when both layouts are built, then the opening note's measure-relative
  X is the SAME in both cases, AND in the accidental case the accidental glyph's
  X is less than the notehead's X (the glyph draws to the left of the head). This
  rewrites `layout.test.js:2160`, which today asserts the sharp note is pushed
  farther right than the plain note.

- **AC4 — Whole-note opening stays left of center.** Given a measure containing a
  single whole note, when the layout is built, then the note's measure-relative X
  is still less than half the measure width (left-aligned, not centered). This
  preserves the second assertion at `layout.test.js:2121`.

- **AC5 — Lead-in is invariant under justification.** Given the same measure
  rendered once in a narrow (heavily justified/stretched) system and once in a
  wide system, when both layouts are built, then the first note's measure-relative
  X equals `MEASURE_START_PAD` in both — the lead-in does not scale with
  justification.

- **AC6 — Empty measure is safe.** Given a measure with no events, when the
  layout is built, then no error or NaN is produced, the measure's width grows by
  the opening clearance, and no notes are placed. Existing empty-measure and
  one-hand-measure tests continue to pass.

- **AC7 — No unrelated regressions.** The full existing `layout.test.js` and
  `svg.test.js` suites pass with only the targeted assertion and test-name/comment
  updates described in AC1–AC3 (the affected names/comments at `layout.test.js`
  ~`:2092`, `:2118-2119`, and `:2138` should no longer describe the note as
  "hugging" the start). No unrelated test regresses.
