# Spec — Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._

## Overview

The Piano block renders melodies as sheet music on a grand staff. When several
eighth notes (or shorter notes) are chained together, they should be joined under
a single beam spanning the group they belong to — as standard music notation does
— instead of being split into separate pairs of two with an occasional leftover
note shown with an individual flag.

Today the renderer beams a run of eighth notes only two-by-two: every beam
connects at most two eighth notes, longer runs break into several disconnected
two-note beams, and a leftover odd note renders with its own flag. The net effect
is many short, fragmented beams where standard engraving would show one continuous
beam.

The fix is to widen the unit by which consecutive notes are grouped into a beam,
so a chained run joins under one beam per **metric group** rather than per single
beat. This is a global correction to match standard engraving (consistent with the
defaults of Finale, MuseScore, and LilyPond) — not a new "beginner mode", not a
toggle, and not a configuration option.

This is purely a change to **which notes share a beam group**. The beam-drawing
geometry, stem direction, secondary/sixteenth beams, stubs, horizontal spacing,
and the flag-vs-beam decision all stay as they are.

### Key term

A **metric group** is the span of musical time over which consecutive beamable
notes are joined under one beam. The size of that span depends on the time
signature (the "grouping unit" below). It is wider than a single beat in simple
metres, which is the whole point of this change.

A **beamable note** is an eighth note or shorter. Quarter notes and longer notes,
and rests, are not beamable and break a run.

## Requirements

### Goal

1. Beam consecutive beamable notes (eighths or shorter) by their metric group, not
   by every single beat. In simple duple/quadruple metres the grouping unit is
   widened so a chained run of eighth notes joins under one beam — one primary beam
   spanning the metric group — instead of splitting into pairs of two with a
   leftover flagged note. This is a global correction applied to all renderings; it
   is not a new mode, toggle, or config option.

### Observable grouping behaviour (the contract)

2. For a measure of uninterrupted eighth notes, for one hand, the beam groups MUST
   be exactly as follows:

   | Metre        | Eighths | Required groups                                   |
   |--------------|---------|---------------------------------------------------|
   | 4/4          | 8       | `4 + 4` (two groups of four; break at the half-bar) |
   | 2/4          | 4       | `4` (one group, whole bar)                        |
   | 3/4          | 6       | `6` (one group, whole bar)                        |
   | 2/2 (cut)    | 8       | `4 + 4` (beat = half note)                        |
   | 6/8          | 6       | `3 + 3` (unchanged — already correct today)       |
   | 9/8          | 9       | `3 + 3 + 3` (unchanged)                           |
   | 12/8         | 12      | `3 + 3 + 3 + 3` (unchanged)                       |
   | 3/8          | 3       | `3` (one group; unchanged)                        |

3. **General grouping rule** (grouping unit measured in quarter-beats; this is a
   single rule, not a per-metre lookup):
   - **Compound metres** (`beatType` is 8 or 16 _and_ `beats` is a multiple of 3):
     the grouping unit is the dotted beat = `3 × (4 / beatType)` quarter-beats.
     **Unchanged from today.**
   - **Simple metres:** the grouping unit is the larger metric unit — the
     **half-bar** for duple/quadruple metres (so 4/4 → groups of four, 2/2 → 4+4),
     and the **whole bar** for the small simple metres (2/4, 3/4, and 2/8). The
     grouping unit MUST NOT be finer than a single beat. A naive "always half-bar"
     rule is incorrect because it under-merges 2/4 and 3/4 (their half-bar is only
     two eighths, which would re-introduce pairs); those small metres must use the
     whole bar. Only the SIZE of the grouping unit changes versus today.

4. **3/4 resolves to one group of six (the whole bar), not three pairs.** This is a
   deliberate choice to serve the issue's intent and matches LilyPond and Gardner
   Read; the competing "three pairs per beat" teaching convention is explicitly NOT
   used.

5. **A full or over-full bar of uninterrupted eighths in a 4/4-family metre splits
   at the half-bar (4 + 4), not as one unbroken beam of 8.** See the non-blocking
   open question (#21).

### Boundaries that still break a beam group (unchanged behaviour)

6. A **rest** breaks an open group.
7. A **non-beamable note** (quarter note or longer) breaks an open group.
8. The **measure end** bounds a group: groups are computed per measure, per hand;
   a group never spans a barline.
9. A note that **straddles a grouping boundary** ends its group — the next beamable
   note starts a fresh group. The straddle test simply uses the new, larger
   grouping unit.
10. A group of length 1 is still emitted as a single **flagged** note, never a
    one-note beam. This rule itself is unchanged. The issue's "leftover flagged
    note" symptom is fixed as a side effect of the larger grouping unit producing
    fewer leftovers — e.g. three eighths on beats 1–2 of 4/4 now form one group of
    three instead of a two-note beam plus a flagged third note.

### Mixed durations

11. The change is ONLY about which notes share the **primary** (eighth-level) beam.
    Secondary beams (sixteenth/thirty-second) and stubs are drawn exactly as today
    (adjacency-based, using the minimum beam count between neighbours). Secondary-
    beam breaking at inner sub-beats is NOT introduced. A run mixing eighths and
    sixteenths within one metric group forms one primary group, as it already does.

### Non-regression invariants (MUST hold)

12. **Horizontal layout is untouched.** Column X positions and measure width are
    derived purely from event durations and remain time-signature-blind. The
    beaming change MUST NOT alter any X position or width. A wider beam group
    occupies exactly the same columns as the same notes flagged individually.
13. **Compound metres (6/8, 9/8, 12/8, 3/8) remain byte-identical.** The fix must
    touch only the simple-metre branch of the grouping rule.
14. **Beam geometry/drawing, stem direction, secondary beams, stubs, and the
    flagged-singleton rule are all unchanged.** Only group membership changes. These
    are already size-agnostic and handle a group of eight or more without
    regression.

### Robustness

15. The renderer must remain robust to events that do NOT sum to the time
    signature. Validation does not enforce that a measure's events fill the bar, and
    the running position may overflow the bar. The new grouping rule, like the old
    one, must never throw or clamp on an over-full measure.

## Out of Scope

- **A new "beginner mode", toggle, or configuration option.** The change is a
  single global correction.
- **Irregular / accent-pattern metres** (e.g. 5/4, 7/8, and `beatType` 16 or 32
  cases). These have no single canonical beam grouping and would require an
  accent/beat-structure field that the song format does not carry (the format
  records only `beats` and `beatType`). The general rule (#3) must produce a
  predictable, non-crashing default for them, but correct accent-based beaming is
  not in scope.
- **Slanted beams.** The flat beam (drawn at the most-extreme stem end) over a long
  run spanning a wide pitch range may leave inner stems long. This is a pre-existing
  cosmetic trait of the flat-beam design, not a regression introduced here, and is
  not addressed.
- **Secondary-beam breaking at inner sub-beats** (a finer engraving refinement for
  sixteenth/thirty-second runs).
- **Changing horizontal spacing or measure width** in any way.

## Acceptance Criteria

1. A chained run of eighth notes that today renders as separate two-note beams (plus
   a flagged leftover) instead renders as a single beam spanning its metric group,
   per the table in requirement #2, for the supported metres.
2. A full bar of eight eighths in 4/4 renders as two groups of four (`4 + 4`), with
   a break at the half-bar — not four pairs and not one beam of eight.
3. A bar of four eighths in 2/4, and a bar of six eighths in 3/4, each render as a
   single group spanning the whole bar.
4. Three eighth notes on beats 1–2 of 4/4 render as one beamed group of three (the
   leftover-flag symptom is gone), not a two-note beam plus a flagged single note.
5. Compound-metre output (6/8 → `3 + 3`, 9/8 → `3 + 3 + 3`, 12/8 →
   `3 + 3 + 3 + 3`, 3/8 → `3`) is unchanged from today.
6. Rests, quarter-or-longer notes, the measure end, and grouping-boundary straddles
   each still break a group as before; a length-1 group is still drawn as a flagged
   note.
7. Horizontal layout (column X positions and measure width) is identical to before
   the change, including for measures that contain newly-widened beam groups.
8. An over-full measure (events whose durations exceed the bar) renders without
   throwing or clamping.
9. The existing unit tests that encode the old "pairs" behaviour are updated to the
   new contract, and new tests cover the per-metre grouping table (#2) — including
   4/4 groups-of-four, 2/4 and 3/4 whole-bar grouping, the leftover-flag fix, and an
   over-full measure that does not throw.

## Open Question (non-blocking — for the requester)

21. For a **full or over-full bar of uninterrupted eighths in a 4/4-family metre**,
    this spec defaults to the engraving-correct **half-bar split (4 + 4)**. If the
    requester instead wants one unbroken beam across the whole bar (the most literal
    reading of "the whole run"), that is the only sub-case that would differ and the
    only thing that would warrant a configurable mode. The issue's wording neither
    demands nor depicts this case. This is flagged for confirmation only and does not
    block the design or implementation; the half-bar split is the working default.
