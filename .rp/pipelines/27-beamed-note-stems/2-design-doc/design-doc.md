# Design doc — Attach beamed-note stems to the side of the notehead

Issue: https://github.com/SantosGuillamot/piano-block/issues/27
Pipeline: `27-beamed-note-stems` (phase 2 — Design doc)
Spec: `.rp/pipelines/27-beamed-note-stems/1-spec/spec.md`

## Problem

In the rendered sheet music, standalone quarter and eighth notes draw their
stem at the edge of the notehead (right edge for a stem-up note, left edge for
a stem-down note), as standard engraving requires. Notes joined by a beam draw
their stem through the horizontal center of the notehead instead. The result is
visually inconsistent: identical pitches at the same column render with stems in
two different places depending only on whether they happen to be beamed.

The root cause is a single missing offset. The standalone render path applies
the edge offset, but the beamed path never does. This doc specifies a one-point
fix that makes the beamed path apply the same offset, so beamed and standalone
stems land at the same place.

## Background

A few facts about the codebase shape the design. They are stated here so the
rest of the doc reads without external references.

- **sp** is the staff-space unit used throughout `src/notation`. All geometry is
  expressed in sp.
- **`NOTEHEAD_RX = 0.6`** (`src/notation/constants.js`) is the notehead's
  horizontal radius. The distance from the notehead center to either vertical
  edge is exactly `NOTEHEAD_RX`, so the stem-attach offset is `±NOTEHEAD_RX`.
- **Side convention**, already consistent across the codebase: a stem-up note
  attaches its stem on the **right** edge (`+NOTEHEAD_RX`); a stem-down note on
  the **left** edge (`−NOTEHEAD_RX`).
- **`note.x`** is the column center, which is also the notehead center.
  Everything in the layout — noteheads, ledger lines, augmentation dots,
  accidentals, and tie/slur/hairpin anchors — positions itself relative to
  `note.x`.
- **One rendering pipeline.** The front end
  (`src/view.js` → `src/notation/layout.js` → `src/notation/svg.js`) is the only
  surface that draws notation geometry. The editor (`src/edit.js`) renders only
  a textarea and validation notice; PHP (`src/render.php`) emits only a wrapper
  div and inert JSON. A single fix in the shared pipeline therefore covers every
  rendering surface.

### Where the two paths diverge

- **Standalone notes** apply the offset in the emit layer. `renderStem` in
  `src/notation/svg.js` computes
  `stemX = note.x + (note.direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX)`, and
  the flag uses the same offset, so stem and flag stay pinned to the notehead
  edge.
- **Beamed notes** never apply it. `beamGeometry` in `src/notation/layout.js`
  builds its stem records and beam segments from the raw member X (`m.x`, the
  notehead center). The emit layer (`renderBeam` in `src/notation/svg.js`) draws
  those X values verbatim. So beamed stems run through the notehead center.

## Goals

- Every beamed stem attaches at the notehead edge on the side given by the
  group's stem direction, using the same rule standalone notes already use.
- Primary beams, secondary beams, and partial-beam stubs move with the stems,
  so the beam connects stem tops rather than notehead centers.
- For the same pitch, column X, and stem direction, a beamed stem's X equals the
  standalone stem's X.
- Nothing else moves: noteheads (including displaced chord heads), ledger lines,
  augmentation dots, accidentals, and span anchors keep their current positions.

## Non-goals

- **Mixed-direction beam handling.** The codebase computes exactly one stem
  direction per beam group (the extreme rule), and there is no mixed-direction
  case. The fix relies on this uniformity.
- **Flag changes.** Beamed notes never draw flags, and standalone flags already
  sit at the notehead edge.
- **Spacing, width, or packing changes.** Beam X has no layout consumers
  (see "Why this is safe" below), so no spacing recomputation is needed.
- **Editor, PHP, or view-bootstrap changes.** None render notation geometry.
- **A system-edge / barline overflow clamp.** Existing spacing slack comfortably
  exceeds the 0.6 sp shift (quantified below), so no clamp is required.

## Design

### Key insight: the shift is a rigid translation

Because stem direction is uniform within a beam group, applying the edge offset
to a beamed group is a single rigid horizontal translation of the whole assembly
by `+NOTEHEAD_RX` (stem-up group) or `−NOTEHEAD_RX` (stem-down group). Every stem
moves by the same amount in the same direction, so:

- **Beam Y is unchanged** — it derives from notehead steps and `STEM_LENGTH`
  only, never from X.
- **Beam flatness is unchanged** — all stems shift equally, so their tops stay
  collinear.
- **Beam length is unchanged** — each segment's width is `|x2 − x1|`, and a
  common translation cancels in the difference.

The fix is therefore not a per-element recomputation; it is one offset applied to
the X coordinate that every stem and beam segment is built from.

### The single insertion point

`beamGeometry` (`src/notation/layout.js`, lines 505-575) is where the group's
stem direction is already known and where all stem/beam X values originate. Its
structure:

- The group direction is computed once, up front:
  `const direction = stemDirectionForChord(allSteps);` (line 512).
- There are **four independent readers of the raw member X**, none of which
  chains off another:
  1. the stems map — `x: m.x` (lines 529-533);
  2. the primary beam — `x1: members[0].x`, `x2: members[last].x` (lines 540-541);
  3. the secondary-beam loop — `x1: members[i].x`, `x2: members[i+1].x` (line 546);
  4. the partial-beam stub loop — `x1`/`x2` = `members[i].x ± stubLen`, where
     `stubLen = NOTEHEAD_RX * 1.5` (lines 565-568).
- `beamGeometry` returns `{ direction, beamY, stems, beams }`, with
  `stems: {x, y1, y2}[]` and `beams: {level, x1, x2, stub?}[]`.
- `NOTEHEAD_RX` is already imported in `layout.js` and already used inside
  `beamGeometry` (the stub length), so no new import is needed.

Because there are four independent X readers, offsetting only the stems map would
detach the beams from the stems. The offset must reach all four.

### Approach: shift the input once

Immediately after the direction is computed (after line 512), introduce the
signed offset and a shifted copy of the members, then have the rest of the
function body consume the shifted copy:

```js
const stemDx = direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX;
const shiftedMembers = members.map((m) => ({ ...m, x: m.x + stemDx }));
```

The stems map, primary beam, secondary-beam loop, and stub loop all read
`shiftedMembers` instead of `members`. The `beamY` computation also reads
`shiftedMembers` for single-variable consistency; this is purely cosmetic since
`beamY` derives from steps only and ignores X.

`renderBeam` in `src/notation/svg.js` is unchanged: it already draws the received
X verbatim (it has no `note.x` reads and no X arithmetic — all of its math is
vertical, `beamY + offset ± inset`).

### Why "shift the input" over four scattered edits

The alternative is to add `± stemDx` at each of the four X sites. The
shift-the-input approach is preferred because:

- It is **one definition plus one map** versus four scattered edits that must
  stay in agreement.
- Any **future X reader** added to `beamGeometry` inherits the offset
  automatically, rather than silently reintroducing the center-anchored bug.
- It satisfies the spec's "single point" requirement (R1) literally, and the
  beam-follows-stems requirement (R2) falls out for free as a rigid translation.

The trade-off — constructing one extra short-lived array per beam group — is
negligible: a beam group has a handful of members, and the array is local to one
function call.

### Data flow (end to end)

```
note.x / steps / beamCount
        │  (members built fresh in layoutHand, layout.js:1544-1556)
        ▼
beamGeometry(members)
        │  direction = stemDirectionForChord(...)            (line 512)
        │  stemDx = direction === "up" ? +RX : -RX           (NEW)
        │  shiftedMembers = members.map(shift x by stemDx)   (NEW)
        │  stems[].x, beams[].x1/x2  ← shiftedMembers        (4 readers)
        ▼
{ direction, beamY, stems, beams }
        │  flows verbatim through layoutHand → measure models
        ▼
renderBeam(beam)  (svg.js:813)  — draws stem.x / segment.x1/x2 verbatim
```

## Why this is safe (R3, R4)

### Beamed equals standalone (R3)

The beamed offset uses the identical rule and constant as the standalone path:
`+NOTEHEAD_RX` for stem-up, `−NOTEHEAD_RX` for stem-down, against the same
`note.x` notehead center. For the same pitch, column X, and stem direction, the
two paths now compute the same stem X.

### Chords need no special handling (R4, AC5)

Beam membership is duration-only, so beamed groups can contain chords with
displaced/flipped noteheads. A displaced head is centered at
`note.x ± 2·NOTEHEAD_RX`; a non-displaced head at `note.x`. Both share a vertical
tangent at `note.x ± NOTEHEAD_RX` — exactly the standalone stem-attach point.
Shifting the stem to that edge therefore keeps every notehead in the chord
touching the stem, with no per-chord branch.

### The shift has no layout side effects (R4)

`beamGeometry`'s X output has **exactly one consumer**. The record is produced at
one call site (`layoutHand`, layout.js:1558), flows verbatim through the measure
models, and is read only by the emit loop's `renderBeam` (svg.js:670). Spacing,
justification, packing, and system breaking are all computed before and
independently of beams; nothing re-derives width from beam X. Noteheads, ledger
lines, accidentals, augmentation dots, and tie/slur/hairpin anchors all position
from `note.x`, which does not change.

The shift is also non-mutating: `beamGeometry` receives a freshly built members
array, and `shiftedMembers` is a second fresh copy via `map` + spread. Neither
the `notes` objects nor the original `members` array is mutated, and the only
values that escape the function are the returned `stems`/`beams`, consumed solely
by `renderBeam`.

### No overflow at barlines or system edges

The shift is `NOTEHEAD_RX = 0.6 sp`. The trailing pad per measure is ≈ 0.83 sp
(`BARLINE_THIN = 0.13` + `BARLINE_POST_PAD = 0.7`), and the system-edge inset is
`STAFF_MARGIN_X = 1.5 sp`. Both comfortably exceed 0.6 sp, so a shifted stem or
beam cannot cross a barline or run past the staff end. No clamp is needed.

## Test plan (R6)

All test changes are confined to
`src/notation/__tests__/layout.test.js`. Its `beamGeometry` describe block
currently has three tests, **all stem-up** under the extreme rule (steps below
`MIDDLE_LINE = 4`):

1. A stem-up flat-beam test with members at x 0 and 4 (steps 1 and 3,
   beamCount 1). It asserts `direction === "up"`, flat-beam Y equality, and the
   primary-beam expectation `{ level: 1, x1: 0, x2: 4 }`.
2. A secondary-beam test asserting beam **levels only** (`[1, 2]`), no X.
3. A stub test asserting stub **existence and level only**, no X.

There is **no stem-down fixture anywhere**, so down-group coverage is purely
additive. `NOTEHEAD_RX` and `beamGeometry` are already imported in the test file.
House style uses constant expressions for derived geometry and literals only for
raw inputs.

Changes:

1. **Update** the primary-beam expectation in the stem-up test to the shifted
   constant expressions:
   `{ level: 1, x1: 0 + NOTEHEAD_RX, x2: 4 + NOTEHEAD_RX }`. This is the one
   existing assertion that breaks under the shift. **Extend** the same test with:
   - the stem-X assertion
     `stems.map((s) => s.x) === [0 + NOTEHEAD_RX, 4 + NOTEHEAD_RX]`;
   - the level-1 first/last-stem equality: `beams[0].x1 === stems[0].x` and
     `beams[0].x2 === stems.at(-1).x`.
2. **Add** a stem-down test in the same block (inline fixture style, e.g.
   members at x 0 and 4 with `topStep: 6, bottomStep: 6, beamCount: 1`, which
   yields `direction === "down"`). Assert `direction === "down"`, stems at
   `[0 − NOTEHEAD_RX, 4 − NOTEHEAD_RX]`, and the level-1 beam matching the
   first/last shifted stem X. This is the negative-offset coverage R6.2 requires.
3. **Extend** the secondary-beam and stub tests with per-kind X assertions
   (these directly cover acceptance criterion 3, and the stub is the subtlest
   part of the shift):
   - secondary beam: the level-2 segment spans the shifted X's of the adjacent
     stems it connects (`0 + NOTEHEAD_RX` to `4 + NOTEHEAD_RX` for that fixture);
   - stub: one endpoint stays at the shifted stem X (`x2 = 4 + NOTEHEAD_RX`) and
     the stub length is unchanged (`x2 − x1 === NOTEHEAD_RX * 1.5`).

   These use per-kind expectations, never the first/last-stem rule (which applies
   only to the level-1 beam).
4. **No other tests change.** The rest of `layout.test.js`, plus `svg.test.js`,
   `constants.test.js`, and both Playwright specs are unaffected: `svg.test.js`
   has no beam/stem geometry references; the Playwright specs assert system/reserve
   counts, re-wrapping, and one standalone X-ordering/bounds case, none sensitive
   to a 0.6 sp beam shift; and the repo has no screenshot or snapshot baselines to
   re-bless.

### Optional items, both declined

- **Overflow assertion.** Skipped. The slack margins (≈ 0.83 sp trailing, 1.5 sp
  system edge) exceed the 0.6 sp shift, the spec marks it not required, and it can
  be added later as a regression guard if ever wanted.
- **`svg.test.js` `renderBeam` DOM test.** Skipped. The layout.test.js unit
  assertions are the primary coverage, and the emit layer is a verified verbatim
  passthrough with no X math, so a DOM test would add integration redundancy
  without covering new logic. Declining it keeps the change inside the spec's
  required scope (R6: only layout.test.js changes).

## Summary of changes

| File | Change |
| --- | --- |
| `src/notation/layout.js` | In `beamGeometry` (lines 505-575), after the direction is computed (line 512), add `stemDx` and `shiftedMembers`; switch the `beamY` computation, stems map, primary beam, secondary-beam loop, and stub loop to read `shiftedMembers`. No import changes. |
| `src/notation/svg.js` | None. `renderBeam` already draws the received X verbatim. |
| `src/notation/__tests__/layout.test.js` | Update the primary-beam expectation to the shifted values; extend the stem-up test with stem-X and first/last-stem assertions; add a stem-down test; extend the secondary-beam and stub tests with per-kind X assertions. |
| Everything else | Unchanged — no edits to `svg.test.js`, `constants.test.js`, Playwright specs, editor, PHP, or view bootstrap, and no optional overflow or DOM tests. |

This satisfies spec requirements R1-R6 and all eight acceptance criteria.
