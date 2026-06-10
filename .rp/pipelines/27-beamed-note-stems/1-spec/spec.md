# Spec — Attach beamed-note stems to the side of the notehead

Issue: https://github.com/SantosGuillamot/piano-block/issues/27

## Overview

In the rendered sheet music, standalone quarter and eighth notes draw their
stem at the edge of the notehead (left or right side, depending on stem
direction), as standard music engraving requires. Notes joined by a beam,
however, draw their stem through the horizontal center of the notehead. This
is visually inconsistent and incorrect.

This change makes beamed notes attach their stems to the side of the notehead,
using the same edge rule that standalone notes already use, so beamed and
standalone notes render consistently.

### Background terminology and constants

- **sp** — the staff-space unit used throughout `src/notation`.
- **`NOTEHEAD_RX = 0.6`** — the notehead's horizontal radius, defined in
  `src/notation/constants.js`. The stem-attach offset is `±NOTEHEAD_RX`.
- **Side convention (already consistent across the codebase):** a stem-up note
  attaches its stem on the RIGHT edge of the notehead; a stem-down note
  attaches on the LEFT edge.
- **`note.x`** — the column center, which is also the notehead center. All
  positioning is relative to this value.

### Where the inconsistency lives

- **Standalone notes** already apply the edge offset. In
  `src/notation/svg.js`, `renderStem` computes
  `stemX = note.x + (note.direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX)`.
  The flag uses the same offset, so stem and flag stay attached to the
  notehead edge.
- **Beamed notes** do not apply the offset. In `src/notation/layout.js`,
  `beamGeometry` builds stem records from the raw member X (`x: m.x`, the
  notehead center) with no `±NOTEHEAD_RX` adjustment, and the emit layer
  (`renderBeam` in `src/notation/svg.js`) draws those X values verbatim. The
  beam segments are anchored on the same raw member X values.

The root cause is that the edge offset exists only in the standalone emit
path; the beamed path never applies it, so beamed stems run through the
notehead center.

### Key facts that shape the fix

- **Stem direction is uniform within a beam group.** `beamGeometry` computes a
  single direction for the whole group (the extreme rule), and that direction
  drives every stem. There is no mixed-direction case in this codebase.
  Consequently, applying the offset is a rigid horizontal translation of the
  whole beam assembly by `+NOTEHEAD_RX` (up-group) or `−NOTEHEAD_RX`
  (down-group); beam Y, flatness, and length are unchanged.
- **Chords (including flipped/displaced noteheads) need no special handling.**
  Beam membership is duration-only, so beamed groups can contain chords.
  Displaced heads are centered at `note.x ± 2·NOTEHEAD_RX`; non-displaced heads
  at `note.x`. Both share the vertical tangent at `note.x ± NOTEHEAD_RX` —
  exactly the standalone stem-attach point — so shifting the stem to the edge
  keeps every notehead in the chord touching the stem.
- **Beam X values have exactly one consumer.** `beamGeometry`'s `stems[].x` and
  `beams[].x1/x2` are read only by `renderBeam`. Spacing, justification, and
  system breaking are computed before and independently of beams; nothing
  re-derives width from beam X. Ties, slurs, hairpins, ledger lines,
  augmentation dots, and accidentals all anchor on `note.x`, not on stem/beam
  X. The offset therefore has no layout side effects.
- **One rendering pipeline.** The front end (`src/view.js` →
  `src/notation/layout.js` → `src/notation/svg.js`) is the only surface that
  draws notation. The editor (`src/edit.js`) renders only a textarea and
  validation notice; PHP (`src/render.php`) emits only a wrapper div and inert
  JSON. A single fix in the shared pipeline covers everything.

## Requirements

### R1 — Beamed stems attach at the notehead edge

Every stem in a beamed group MUST be drawn at the notehead edge on the side
given by the group's stem direction, using the same rule as standalone notes:

- stem-up group: stem X = `note.x + NOTEHEAD_RX` (right edge)
- stem-down group: stem X = `note.x − NOTEHEAD_RX` (left edge)

This matches the standalone rule in `renderStem` (`src/notation/svg.js`). The
offset MUST be applied inside `beamGeometry` in `src/notation/layout.js`, where
the stems are built from raw `m.x` and the group direction is already known.
Applying it at this single point keeps stems, primary beams, secondary beams,
and partial-beam stubs shifting together, and makes `beamGeometry`'s output
itself reflect the edge offset (which the test changes in R6 assert against).
The emit layer (`renderBeam` in `src/notation/svg.js`) MUST continue to draw
the X values it receives verbatim, with no offset applied there.

### R2 — Beam segments move with the stems

Primary beams, secondary beams, and partial-beam stubs MUST span the shifted
stem X positions, so the beam connects the stem tops (standard engraving) — not
the notehead centers. Because stem direction is uniform per group, this is a
rigid horizontal translation of the whole beam assembly by `±NOTEHEAD_RX`; beam
Y, flatness, and length are unchanged.

### R3 — Beamed and standalone stems are visually consistent

For the same pitch, column X, and stem direction, a beamed note's stem X MUST
equal the stem X a standalone (flagged or quarter) note would receive. This
consistency is the core of the issue.

### R4 — Nothing else moves

Noteheads (including displaced chord heads at `note.x ± 2·NOTEHEAD_RX`), ledger
lines, augmentation dots, accidentals, and tie/slur/hairpin anchors MUST keep
their current positions. They all key off `note.x`, which does not change.
Chords inside beamed groups need no special handling, since all heads share the
tangent line at `note.x ± NOTEHEAD_RX`.

### R5 — Scope of change

The fix MUST live in the shared notation pipeline
(`src/notation/layout.js` and/or `src/notation/svg.js`). No changes to the
editor (`src/edit.js`), PHP (`src/render.php`), or the view bootstrap
(`src/view.js`) are needed.

### R6 — Test changes

1. **Update** the existing `beamGeometry` primary-beam expectation in
   `src/notation/__tests__/layout.test.js` (currently asserting
   `{ level: 1, x1: 0, x2: 4 }` for members at X 0 and 4) so that x1/x2
   reflect the shifted endpoints (each member X plus the group's signed
   `NOTEHEAD_RX` offset).
2. **Add** assertions in the `beamGeometry` block:
   - each `stems[i].x === members[i].x ± NOTEHEAD_RX`, with the sign
     determined by the group direction — covering both an up-group and a
     down-group;
   - the **primary** (level-1) beam's `x1`/`x2` equal the first/last shifted
     stem X. This first/last-stem equality applies only to the level-1 beam.
     Secondary (level-2) beams span the shifted X's of the adjacent stems they
     connect, and partial-beam stubs keep one endpoint at a shifted stem X with
     their stub length unchanged; if assertions cover these, they must use those
     per-kind expectations rather than the first/last-stem rule.
3. **No other existing tests change.** The rest of `layout.test.js`,
   `svg.test.js`, `constants.test.js`, and both Playwright specs are
   unaffected. No screenshot or snapshot baselines exist in the repo, so there
   is nothing to re-bless.

## Out of Scope

- **Mixed-direction beam handling.** The codebase has exactly one stem
  direction per beam group; no support for mixed directions is required.
- **Flag changes.** Beamed notes never draw flags, and standalone flags
  already sit at the notehead edge.
- **Spacing, width, or packing changes.** Beam X has no layout consumers, so
  no spacing recomputation is needed.
- **Editor, PHP, or view-bootstrap changes.** None render notation geometry.
- **A system-edge / barline overflow clamp.** Existing spacing slack
  (trailing advance + barline pad + `STAFF_MARGIN_X`) comfortably exceeds the
  0.6 sp shift, so no clamp is required. An optional test asserting that the
  maximum beamed stem/beam X stays within the measure's barline and the system
  staff-end may be added for extra certainty, but it is not required.

## Acceptance Criteria

1. **Stem-up beamed group:** every stem in the group is drawn at
   `note.x + NOTEHEAD_RX` (the right edge of its notehead), not at `note.x`.
2. **Stem-down beamed group:** every stem in the group is drawn at
   `note.x − NOTEHEAD_RX` (the left edge of its notehead), not at `note.x`.
3. **Beam follows the stems:** the primary beam, any secondary beams, and any
   partial-beam stubs span the shifted stem X positions; beam Y, flatness, and
   length are unchanged from before the fix.
4. **Beamed equals standalone:** for the same pitch, column X, and stem
   direction, a beamed note's stem X equals the standalone note's stem X.
5. **Chords stay connected:** in a beamed group containing a chord (including
   displaced/flipped noteheads), every notehead still touches the stem line at
   `note.x ± NOTEHEAD_RX`.
6. **Everything else is unchanged:** noteheads, displaced chord heads, ledger
   lines, augmentation dots, accidentals, and tie/slur/hairpin anchors keep
   their current positions.
7. **Tests:** the updated `beamGeometry` primary-beam expectation and the new
   stem-X / beam-segment-X assertions pass; all other existing unit tests and
   Playwright specs continue to pass without modification.
8. **Scope:** no changes outside `src/notation/layout.js`,
   `src/notation/svg.js`, and `src/notation/__tests__/layout.test.js` (plus
   optional new test coverage in `src/notation/__tests__/svg.test.js`).
