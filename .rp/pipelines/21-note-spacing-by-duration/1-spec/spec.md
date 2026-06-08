# Spec — Issue #21: Space notes horizontally according to their duration

## Overview

Notes in the piano-block notation should be spaced horizontally according to
their duration: a shorter note occupies less horizontal space than a longer one
(thirty-second < sixteenth < eighth < quarter < half < whole). Beamed eighth
notes should sit close together, while quarter and longer notes get visibly more
room — the way standard engraved sheet music distributes notes across a measure.

This behavior is **already implemented and wired end-to-end**. The pure layout
layer derives a per-measure onset grid from durations alone and assigns each note
a horizontal advance via the rule:

```
advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ, 0))
```

where Δ is the gap (in quarter-beats) from a note's onset to the next onset —
i.e. the note's own duration. The resulting X positions flow through to the
rendered SVG; the emit layer adds no spacing math of its own.

This model is **compressive (sub-proportional), by deliberate design** — not
strictly proportional. Real music engraving spaces durations roughly
logarithmically (≈1.5× space per doubling of duration), not linearly. A strictly
proportional model would make a whole note 32× the width of a thirty-second,
which is absurd; under the compressive model a whole note is only ~2.5× a
thirty-second. This was a sourced, intentional design decision made when the
spacing engine was built (~3–4 days before this issue was filed), and it is a
hard constraint: the spec must NOT demand strict linear proportionality. The
issue's own wording — "proportional to (or at least ordered by) duration, the way
standard music notation does" — explicitly accepts the ordinal (ordered-by)
reading, which the compressive model satisfies.

Issue #21 is therefore a **verify / lock task**, not new feature work. It follows
the project's established pattern of filing one issue per incremental engraving
refinement on already-shipped code. The substance of the behavior already exists;
what is missing is **provable protection**. No automated test currently asserts
duration-ordered spacing at the measure / integration / SVG level — existing
tests cover only the advance formula and that X positions are monotonic, not the
mixed-duration scenarios this issue describes.

**Deliverable:** specify the accepted duration-ordering behavior and lock it with
automated tests covering the full edge-case matrix. The likely implementation is a
**test-only change** (plus an optional, additive docs note); no behavioral source
change is required, and none is intended. If tests pass against the current code
with zero source changes, #21 is satisfied.

## Requirements

All requirements describe WHAT the system must guarantee. They are satisfied by
the current implementation; the work is to confirm and lock them.

**R1 — Duration ordering within a measure.** Within a measure, horizontal space
is ordered by note duration: a shorter note occupies strictly less horizontal
space than a longer one. The full ordering must hold and be strictly monotonic —
thirty-second < sixteenth < eighth < quarter < half < whole — with no two distinct
durations receiving equal space.

**R2 — A note's space is governed by its own duration.** The space a note
occupies is the gap from its onset to the next onset, governed by its OWN
duration. It does not depend on the number or duration of following notes, nor on
how many pitches are stacked in a chord.

**R3 — Dotted notes.** A dotted note occupies more space than its undotted base
value and less than the next-longer value (e.g. a dotted quarter is strictly
between a quarter and a half). Dots widen spacing monotonically.

**R4 — Rests.** Rests are spaced by duration on the same rule as notes (e.g. a
half rest occupies more space than an eighth rest). Rests are full participants in
the onset grid.

**R5 — Chords.** A chord occupies a single horizontal column governed by its
single duration. Stacking multiple pitches at one onset does not widen the column;
head count does not change the footprint.

**R6 — Beamed short notes vs. longer notes.** Beamed eighth (and shorter) notes
sit close together with tight, equal spacing, while quarter and longer notes have
visibly more space around them — matching the reference image's described effect.
This uses the existing beaming logic unchanged.

**R7 — Uniform single-duration measures.** A measure whose notes all share one
duration is spaced uniformly (equal consecutive gaps). This common case must look
right.

**R8 — Ordering preserved under justification.** Duration-ordering must survive
system justification. Stretching a system scales every inter-onset advance
uniformly, so the eighth-vs-quarter ordering — and the advance ratio between them
— is preserved. Because spacing is computed independently per measure, a note's
intrinsic advance (pre-justify) depends only on its own duration: equal durations
get equal intrinsic advances everywhere.

**R9 — Time-signature-blind and robust.** The spacing rule never consults the time
signature. Each note is spaced by its own duration with no clamp distorting the
ordering, including in over-full or under-full measures. The layout stays finite
under all conformant input (no NaN, no Infinity, no throw); negative gaps are
guarded.

## Acceptance Criteria

Criteria are **ordinal** (based on ordering and equality), not numeric. They
deliberately do not assert invented pixel ratios — the compressive model's exact
constants are accepted as-is and any specific target ratio would be invented
without the (unavailable) reference image.

**AC1 — Canonical mixed-duration fixture.** In a single measure of
`[eighth, eighth, eighth, eighth, quarter, quarter]`, the consecutive
eighth→eighth column gaps are equal to one another and strictly smaller than the
quarter→quarter gap. (Layout level; this is the canonical fixture.)

**AC2 — Strict monotonicity across the duration range.**
`advance(32nd) < advance(16th) < advance(eighth) < advance(quarter) <
advance(half) < advance(whole)`, with no two distinct durations equal.

**AC3 — Dotted note placement.** `advance(dotted-quarter)` is strictly between
`advance(quarter)` and `advance(half)`.

**AC4 — Rests in the grid.** `advance(half rest) > advance(eighth rest)`; rests
participate in the onset grid.

**AC5 — Chord footprint equals single-note footprint.** A chord event and a
single-note event of the same duration produce the same column advance (head count
does not change the footprint).

**AC6 — Uniform single-duration measure.** A measure of N equal-duration notes
yields N−1 equal consecutive gaps.

**AC7 — Ordering survives justification.** In a non-last, stretched system, eighth
gaps remain smaller than quarter gaps and their ratio is preserved (the scale is
uniform). The score's last system is left ragged (scale 1). The opening lead-in is
not stretched.

**AC8 — Equal intrinsic advance across measures.** Two equal-duration notes in
different measures have the same intrinsic (pre-justify) advance. (Do NOT assert
equal absolute on-screen gaps across systems — see Out of Scope.)

**AC9 — Over-full, time-signature-blind layout.** An over-full measure (e.g. 20
eighths in 4/4) lays out with strictly monotonic X, all gaps equal to the eighth
advance, and no NaN — and produces an identical layout regardless of the time
signature passed.

**AC10 — Render-level confirmation (recommended).** In the rendered SVG for the
AC1 fixture, the eighth noteheads' X positions are closer together than the
quarter noteheads' — proving the duration→X behavior reaches the screen, not just
the pure layer. Recommended to include at least this one render-/integration-level
assertion in addition to the layout-level criteria above.

### Edge cases (explicit for the test matrix)

These are all current, correct behavior to lock; they are covered by the criteria
above and called out here so the test matrix is exhaustive.

- **A. Justification / stretch.** Ordering and ratios are preserved; stretch
  multiplies every grid advance uniformly. The stretch scale is clamped to a
  maximum, the last system is left ragged, and the opening lead-in / leading
  reserve (clef, key signature, time signature) is excluded from the stretch
  budget. [AC7]
- **B. Cross-measure / cross-system.** A note's intrinsic advance depends only on
  its own duration, so equal durations get equal intrinsic advances across
  measures and systems. Note: because each system justifies independently, two
  equal-duration notes in differently-stretched systems may render at different
  absolute gaps — only the intrinsic advance and within-system ordering are
  guaranteed. [AC8]
- **C. Dotted notes.** Strictly between base and next-longer value. [AC3]
- **D. Rests.** Full grid citizens, duration-proportional on the same rule as
  notes. [AC4]
- **E. Chords.** One onset, one column; footprint by duration, not head count.
  [AC5]
- **F. Minimum-advance floor on short notes.** The shortest notes (where the
  minimum-advance floor dominates the formula) still keep distinct, ordered
  advances — the floor is a constant added to a strictly-increasing term, so it can
  never tie two distinct durations (e.g. sixteenth vs thirty-second still differ).
  [AC2]
- **G. Single-duration measure.** Perfectly uniform spacing — the common case.
  [AC6]
- **Empty measure.** Lays out to a finite floor width with both staves drawn and
  no NaN. [robustness, R9]
- **Malformed / unknown duration.** Gated upstream by the song validator (a closed
  duration enum) and by render-or-nothing behavior, so it never reaches the layout
  layer in practice. The layer is additionally NaN-safe as defense-in-depth. The
  guarantee is phrased around **conformant input**; the spec does not promise
  sensible layout for invalid durations, since validation excludes them. [R9]

## Out of Scope / Non-Goals (v1)

- **Strict linear / 2:1 proportionality.** Deliberately designed against;
  engraving spacing is compressive/logarithmic. The compressive model is the
  accepted behavior.
- **Any change to the compressive spacing model or its constants** (the minimum
  advance and the compressive coefficient). Contrast / ratio tuning is deferred to
  a follow-up gated on the owner supplying the reference image. The current
  eighth:quarter contrast (~1.2:1) is the accepted v1 behavior.
- **Beaming / grouping logic** (which notes share a beam) — unchanged. Beamed
  eighths may be USED as a fixture but the beam logic is not changed.
- **Vertical concerns** — chord head displacement (seconds rule), and
  stem/flag/accidental clearance widening (per-column extra). These are vertical/
  clearance matters, not duration spacing.
- **Leading reserve / opening breathing room** (the per-measure start padding) —
  a separate, already-shipped concern.
- **Barline / measure-width math** beyond the duration advances themselves.
- **Cross-system absolute-gap equality.** Lines justify independently; only
  intrinsic advances and within-system ordering are guaranteed. Do NOT write a
  criterion asserting a given duration is always N pixels wide.
- **Justify / wrapping policy changes** (stretch cap, system packing,
  downscale-on-overflow). This is a constraint the ordering must hold under, not a
  deliverable to change.
- **Audio / playback timing.** Notation only — durations affect horizontal space,
  not sound.
- **Beat-anchored standalone-annotation X interpolation** — a separate annotation
  feature, unrelated to note spacing.
- **Documentation of the duration→spacing contract** is optional/additive. No
  user-facing spacing contract exists today to preserve; a later docs phase may add
  a short note, but it is not required for #21.

## Open Questions (deferred — non-blocking)

These do not block the spec or its acceptance criteria. They are recorded for a
possible follow-up and are intentionally NOT requirements; resolving them is not
part of #21.

- **OQ1 — Contrast strength.** Is the current eighth-vs-quarter contrast (~1.2:1)
  strong enough relative to the owner's reference image? This is unresolvable
  without the image (which was not committed alongside the issue). The spec stays
  ordinal and does not invent a target ratio. Deferred to a follow-up, conditioned
  on the owner supplying the reference image — at which point it would be a clean
  tune of the spacing constants.
- **OQ2 — Short-end separation.** Should more separation be added among the
  shortest notes, where the minimum-advance floor dominates the formula? Same
  validate-don't-invent posture (lowering the floor also risks glyph collisions on
  dense columns, since it doubles as the per-column clearance floor). Deferred.
