# Design Doc: More horizontal space at the start of each measure

## Overview

In the Piano block's grand-staff engraving, the first event of every measure
(note or rest, onset 0) currently sits flush against the measure's left edge —
right up against the barline on interior measures (≈ 0.1 sp of visible
whitespace) or the clef/key/time block on a system head. The opening looks
crowded. This feature introduces a fixed horizontal **lead-in** (an "opening
clearance") of `MEASURE_START_PAD = 1.0` sp at the start of every measure, on
both staves, so the first event has roughly a notehead's width of breathing
room before it.

The chosen approach adds the clearance as an additive `leadInset` term in the
layout's system walk, mirroring the exact two-site idiom the codebase already
uses for the opening-accidental lead (`noteAccidentalLead`) and the mid-system
section reserve (`sectionReserve`). The clearance is folded into the same
two coordinated coordinates — the measure's intrinsic **packing width** (so
line-breaking and justification stay correct) and the measure's **placement
inset** (so the notes actually move) — keeping packing and placement in sync by
construction. It is added *outside* the justify scale so it never stretches, and
it composes with the opening accidental's lead by `max()` (they share the same
pre-column slot) rather than by stacking.

All geometry is in staff-spaces (sp); a staff is 4 sp tall and `SP_PX = 8`.

## Approach

### The two coordinated coordinates

`buildLayoutModel` (in `src/notation/layout.js`) lays out a score in two stages
that must agree on each measure's width:

1. **Packing pass** (`layout.js:1740-1769`). For every measure in the flat list
   it calls `measureLayout` to get the inter-note grid, then computes the
   measure's **intrinsic width** `m.contentWidth`. This is the currency that
   `packSystems` (`layout.js:1345,1348,1773`) consumes to decide line breaks and
   that the justify reduce (`layout.js:1802`) consumes to compute the per-system
   stretch. Today:

   ```
   m.contentWidth = ml.width + sectionReserve + noteAccidentalLead;   // :1767
   ```

2. **System/measure walk** (`layout.js:1784-…`, per-measure body at
   `:1967-1991`). For each measure it computes a `leadInset`, then rebuilds the
   per-column X positions from scratch starting at that inset:

   ```
   const leadInset =                                                  // :1974
       (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) + (m.noteAccidentalLead ?? 0);
   const scaledGrid = (ml.contentWidth || EMPTY_MEASURE_WIDTH) * advanceScale; // :1980
   const scaledContent = leadInset + scaledGrid;                      // :1982  (inset UNSCALED)
   let cx = leadInset;                                                // :1987
   ml.columns.forEach((col) => { columnX.set(col.onset, cx); cx += col.advance * advanceScale; });
   ```

   `columnX` is the single source of truth for note/rest X (`layout.js:1438`),
   from which every downstream element derives. The end barline sits at
   `measureRightX = x + scaledContent` (`:2018`), and the next measure starts at
   `x += scaledContent + trailingPad` (`:2082`).

The lead-in is added to **both** `m.contentWidth` (`:1767`) and `leadInset`
(`:1974`). Omitting either desyncs packing from placement.

### Mechanism: the additive `leadInset` term

The lead-in becomes an `openingClearance` term that is:

- added to the packing sum at `:1767` (so the measure is budgeted wider on its
  left), and
- added unconditionally into `leadInset` at `:1974` (so columns are seeded a
  full clearance in from the left edge, moving the notes).

This is exactly how `noteAccidentalLead`/`sectionReserve` already flow. Because
`leadInset` is added *outside* the `* advanceScale` factor (`:1982`), the
clearance is a fixed engraving offset and does not stretch under justification.

#### Why not `measureLayout`'s dormant `leadingPad` option

`measureLayout` (`layout.js:794-844`) accepts an unused `leadingPad` option,
which looks like a one-line injection point. It was rejected:

- `leadingPad` enters only `ml.width` (`:817`/`:841`), **not** `ml.contentWidth`
  (the column loop accumulates advances only, `:826,833`). The justify-scaled
  grid reads `ml.contentWidth` (`:1981`), so a `leadingPad` would be excluded
  from the scaled grid as desired — but it would still flow into the packing
  budget via `m.contentWidth = ml.width + …` (`:1767`).
- The per-column `col.x` that `measureLayout` seeds from `leadingPad` (`:825`)
  is **dead for placement**: the walk throws it away and rebuilds X from
  `cx = leadInset` (`:1987-1991`). A grep of the notation source finds zero
  readers of `col.x`; the only readers of `ml.columns` use `col.onset`/
  `col.advance`. So a `leadingPad` would widen the packing budget while moving
  **no** note — packing and placement would desync (the same failure mode that
  also disqualifies the "equalize system-first" alternative below).
- To make `leadingPad` actually move notes you would *also* have to seed
  `cx = leadingPad` at `:1987` — i.e. edit the walk anyway — plus pass the
  option at `:1742`, adding a double-count hazard against the `ml.width`-based
  sum. The "one edit" advantage evaporates and the blast radius grows.

The additive `leadInset` term is the established idiom, keeps the two
coordinates in sync by construction, and is unscaled by justify. (Serves R1, R4,
R5; AC5.)

## Components

All changes live in `src/notation/`. No new files or components are introduced.

- **`constants.js` (modified).** Adds the new `MEASURE_START_PAD = 1.0` constant
  in the "Horizontal spacing" section, and softens a now-stale doc-comment on
  `BARLINE_POST_PAD`. (See "Interfaces and Data Flow".)

- **`layout.js` → `buildLayoutModel` (modified).** The single component that
  realizes the feature. Two coordinated edit sites (`:1752`/`:1767` packing,
  `:1974` placement) plus comment refreshes. No change to `measureLayout`, the
  `leadingPad` plumbing, or any trailing/barline geometry.

- **`layout.js` → `measureLayout` (untouched but relevant).** Continues to
  return the inter-note grid (`contentWidth` = advances only) plus `ml.width` =
  `leadingPad + contentWidth + trailingPad`. The feature deliberately does not
  route through it.

- **`svg.js` (untouched).** Consumes laid-out positions (`note.x`,
  `measure.x`, `acc.dx`) and never reads the pad. The accidental glyph is drawn
  at `note.x − acc.dx` (`svg.js:751`), so it rides along with the shifted note.

- **Downstream layout consumers (untouched).** Notes, rests, beams, ties,
  slurs, hairpins, point dynamics, ottava brackets, standalone annotations, and
  barlines all derive from the shifted `columnX`/`leadInset` frame. See
  "Failure Modes and Observability" → downstream consistency, and
  "Key Decisions" → D4 for the per-consumer rationale.

## Interfaces and Data Flow

### New constant (`constants.js`)

Added in the "Horizontal spacing" section immediately after
`EMPTY_MEASURE_WIDTH` (`constants.js:70`). That section groups the per-measure
horizontal-advance budget (`MIN_ADV`, `ADV_K`, `EMPTY_MEASURE_WIDTH`), which is
exactly what an opening lead-in is — a horizontal slot budgeted into measure
width. It is deliberately **not** placed in the "Barlines" section
(`:109-122`), because the spec scopes out touching barline/trailing geometry and
co-locating there would wrongly imply a barline-side change.

```
/**
 * Opening clearance, in sp, reserved at the start of EVERY measure before its first
 * note column, so the opening note has room to breathe instead of hugging the
 * barline / measure boundary. Applied uniformly on both staves and unscaled by
 * justify. Composes with the opening accidental's lead by max() (they share the
 * same pre-column slot), not by stacking.
 */
export const MEASURE_START_PAD = 1.0;
```

`MEASURE_START_PAD` must be an exported `constants.js` value (not a
`layout.js`-local `const` like `RESERVE_PAD`) because the acceptance-criteria
tests import it into `layout.test.js`.

### Modified data flow in `buildLayoutModel`

**Packing pass (`~:1752`, `:1767`).** Compute the `max()` composition and fold
it into the budget; drop the now-dead `m.noteAccidentalLead` store:

```
const noteAccidentalLead = firstColumnHasAccidental(m) ? ACCIDENTAL_LEAD_EXTRA : 0;
const openingClearance = Math.max(MEASURE_START_PAD, noteAccidentalLead);   // NEW
...
m.sectionReserve = sectionReserve;
m.openingClearance = openingClearance;            // replaces the m.noteAccidentalLead store (:1763)
m.contentWidth = ml.width + sectionReserve + openingClearance;   // was + noteAccidentalLead (:1767)
```

**Placement walk (`:1974`).** Add the clearance unconditionally; keep
`sectionReserve` as the only position-gated term:

```
const leadInset =
    (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) + (m.openingClearance ?? 0);
```

`scaledContent = leadInset + scaledGrid` and `cx = leadInset` (`:1982`,
`:1987`) are unchanged in shape — they now carry the larger inset.

The local `const noteAccidentalLead` stays as the `max()` input; only the
`m.noteAccidentalLead = …` field store (`:1763`) is removed (it has no other
reader once `:1767` and `:1976` switch to `openingClearance`).

### Doc-comment touch-up (`constants.js:117-122`)

`BARLINE_POST_PAD`'s current comment says it is "Kept small so the opening note
sits close to the bar" — misleading after this change, since the lead-in now
pushes the note ~1 sp further. Soften it, e.g. "Kept small … but more than the
notehead radius so the head still clears the line; the measure's own lead-in
(`MEASURE_START_PAD`) supplies the breathing room." `BARLINE_POST_PAD`'s value
(0.7) is unchanged.

### Net positional effect (data flow summary)

- **Interior measure**, plain opening note: `notes[0].x` (measure-relative) goes
  from ≈ 0 to `MEASURE_START_PAD = 1.0`. The visible barline-stroke →
  notehead-left-edge whitespace goes from ≈ 0.1 sp to ≈ 1.1 sp.
- **System-first measure**: the head note ends up at `clef-block +
  RESERVE_PAD(1) + MEASURE_START_PAD(1)` ≈ 2 sp past the clef block (the
  RESERVE_PAD indent folds into the absolute measure X via `reserve`, not into
  `notes[0].x`; the relative `notes[0].x` is still `1.0`).
- **Section-first measure** (mid-system clef/key/time change): gets
  `sectionReserve + openingClearance` — both additive, the cautionary glyphs
  genuinely precede the lead-in.
- **Empty measure**: width grows by `openingClearance` (3.3 → 4.3 sp); no notes
  placed; `cx = leadInset` set but the forEach over zero columns is a no-op.

## Key Decisions

### Decision D1: Additive `leadInset` term, not `measureLayout`'s `leadingPad`

- **Choice:** Realize the lead-in as an `openingClearance` term added to both
  `m.contentWidth` (`:1767`) and `leadInset` (`:1974`), the same two-site idiom
  `noteAccidentalLead`/`sectionReserve` use.
- **Alternatives:** Wire `measureLayout`'s dormant `leadingPad` option.
- **Trade-offs:** `leadingPad` is a placement no-op (its `col.x` has zero
  readers; the walk rebuilds X) so it would widen the packing budget without
  moving notes — a packing/placement desync — unless you *also* edit the walk
  and pass the option, which adds sites and a double-count hazard. The
  `leadInset` term keeps the two coordinates in sync by construction and is
  unscaled by justify (rides outside `* advanceScale` at `:1982`).
- **Traces to:** Requirement 1, Requirement 4, Requirement 5; AC5.

### Decision D2: Magnitude `MEASURE_START_PAD = 1.0` sp

- **Choice:** `1.0` sp.
- **Alternatives:** `1.2` (a full notehead width, `2·NOTEHEAD_RX = 1.18`) for a
  slightly roomier opening.
- **Trade-offs:** `1.0` makes the barline → notehead whitespace ≈ 1.1 sp
  (clearly roomier than today's ≈ 0.1), matches peer constants `RESERVE_PAD = 1`
  and `ACCIDENTAL_LEAD_EXTRA = 1`, and stays below `MIN_ADV = 2.2` so the
  opening gap never exceeds the smallest note-to-note advance. `1.2` is
  defensible but `1.0` is the spec's acceptance-criteria value and the tasteful
  default; do not exceed ~1.5.
- **Traces to:** Requirement 2; AC1, AC2, AC4.

### Decision D3: Compose with the accidental lead by `max()`, not additively

- **Choice:** `openingClearance = max(MEASURE_START_PAD, noteAccidentalLead)`,
  with the accidental term folded in (the `m.noteAccidentalLead` store dropped).
- **Alternatives:** Stack the two (`MEASURE_START_PAD + noteAccidentalLead`),
  i.e. push an accidental measure in twice.
- **Trade-offs:** Both terms occupy the **same** pre-column slot — empty
  breathing room vs. the slot the accidental glyph then fills — so `max()` is
  correct: an accidental-opening note lands at the same measure-relative
  position as a plain one (today both resolve to `max(1.0, 1.0) = 1.0`), and
  `max()` is future-proof if the pad is later raised. The accidental **glyph**
  remains correct because its X is purely relative to the notehead:
  `stackAccidentals` gives a fixed left offset `dx = ACCIDENTAL_GAP +
  column·ACCIDENTAL_COL_STEP` (= 1.2 for column 0, `layout.js:671`), drawn at
  `note.x − dx` (`svg.js:751`). So the glyph always draws left of the head
  (`note.x − 1.2 < note.x`), and at lead-in 1.0 the glyph center sits at
  `1.0 − 1.2 = −0.2` sp — 0.2 sp left of the boundary, identical to today's
  `ACCIDENTAL_LEAD_EXTRA = 1` behavior, so there is no clearance regression.
- **Traces to:** Requirement 3; AC1, AC3.

### Decision D4: Uniform-additive on every measure, not equalize system-first

- **Choice:** Add `openingClearance` unconditionally to every measure (packing
  `:1767` and placement `:1974`), head and interior alike. `sectionReserve`
  remains the only position-gated term (`localIdx > 0`).
- **Alternatives:** Equalize the system-first gap to the interior gap by folding
  the lead-in into the leading reserve (`max(RESERVE_PAD, MEASURE_START_PAD)`) or
  subtracting `RESERVE_PAD` at the head.
- **Trade-offs:** Equalize is strictly harder because of pre-packing ordering:
  `m.contentWidth` is committed for every measure in the flat list (`:1740`,
  `:1767`) **before** `packSystems` (`:1773`) decides system boundaries, so head
  identity (`localIdx === 0`) is an *output* of packing while a head's reduced
  clearance would be an *input* — a chicken-and-egg that needs a two-pass/
  fixpoint packing rework, or a placement-only hack that reintroduces the exact
  packing/placement desync that killed `leadingPad` in D1. A measure can also be
  a head in one wrap and interior in another; uniform-additive is immune.
  Engraving convention favors uniform-additive too: extra air at a line opening
  is standard practice (the post-clef/key/time space is a distinct reserved
  indent — exactly what `RESERVE_PAD` already encodes), so the ~1 sp extra
  indent at a head is a feature. The spec adopts uniform-additive as the default
  and the ACs are written against it.
- **Traces to:** Requirement 6; the spec's Out-of-Scope bullet 3 (open latitude
  resolved in favor of the default); AC1–AC6.

## Dependencies

- **Internal:** `src/notation/layout.js` depends on the new
  `MEASURE_START_PAD` export from `src/notation/constants.js`, alongside the
  existing `ACCIDENTAL_LEAD_EXTRA`, `EMPTY_MEASURE_WIDTH`, etc.
- **Tests:** `src/notation/__tests__/layout.test.js` imports
  `MEASURE_START_PAD` and `BARLINE_POST_PAD` from `../constants.js`
  (`NOTEHEAD_RX`, `EMPTY_MEASURE_WIDTH`, `STAFF_MARGIN_X`, `ACCIDENTAL_GAP`,
  `MIN_ADV` are already imported).
- **No new external libraries, services, or systems.** No `svg.js` dependency
  change.

## Failure Modes and Observability

This is a pure layout-geometry change with deterministic output and no runtime
I/O, so "observability" here means the static invariants the tests pin.

- **Packing/placement desync (primary failure mode).** If the clearance is added
  to placement (`:1974`) but not packing (`:1767`), or vice versa, the measure
  is budgeted at one width and drawn at another. The greedy fill (`:1345-1348`)
  and justify scale (`:1802`) would be perturbed by ~1 sp per measure, shifting
  barlines and wrap points. Detected by the full `layout.test.js`/`svg.test.js`
  suites (wrap-count and barline-position assertions) plus AC2/AC5. Mitigation:
  the chosen mechanism adds the clearance to both coordinates at once.

- **Empty measure / NaN.** The empty-grid branch of `measureLayout`
  (`:811-820`) returns `contentWidth: EMPTY_MEASURE_WIDTH`; `openingClearance`
  rides on top via `:1767`/`:1974` (width → 4.3), `cx = leadInset` is set but the
  zero-column forEach is a no-op, so no note is placed and no NaN is produced.
  Pinned by AC6.

- **Downstream consistency.** All dependent elements ride the shifted frame, so
  none needs a per-consumer edit:
  - Note/rest X: the single source is `const x = columnX.get(onsets[idx]) ?? 0`
    (`layout.js:1438`); the `?? 0` is a missing-key fallback only — a present
    onset returns its real `leadInset`-seeded value.
  - Beams/flags/ledgers/dots/accidentals hang off the note's `x` (`:1501-1518`).
  - Ties/slurs: `recordSpanMarkers(…, { measureX: x })` (`:2054,2061`); resolved
    at `measureX + note.x`.
  - Hairpins / point dynamics / ottava: anchored to the same `measureX + note.x`
    frame.
  - Standalone annotations: built in the `leadInset` frame
    (`collectStandaloneAnnotations(…, { columnX, gridOnsets, leadInset,
    scaledContent })`, `:2042-2050`); beat-0 maps to `leadInset` (`:1604,1642`).
  - Barlines: the end bar moves right with `measureRightX = x + scaledContent`
    (`:2018`); a `repeat-start` left bar is drawn at `x` (the measure's left
    edge, *before* the inset, `:2021-2026`), so it stays flush at the boundary
    with the first note `openingClearance` to its right. These paths already run
    with nonzero `leadInset` today via `noteAccidentalLead`/`sectionReserve`.

## Test Contract

Runner: Jest via `wp-scripts test-unit-js` (not vitest). Run
`npm run test:unit -- layout.test.js svg.test.js`. **Baseline today: 263 passing
across both files** (`layout.test.js` = 216, `svg.test.js` = 47 — see the
reconciliation note in "Risks and Open Questions"). All edits below are in
`src/notation/__tests__/layout.test.js`; `svg.test.js` needs no edits.

**Imports (`:11-29`).** Add `MEASURE_START_PAD` and `BARLINE_POST_PAD` to the
`from "../constants.js"` block.

**AC1 + AC4 — whole-note test (`:2117-2122`).** Fixture is the score-first
measure; `notes[0].x` is measure-relative and equals `leadInset =
openingClearance = MEASURE_START_PAD = 1.0` regardless of system position.
- `:2120` `expect(m.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` →
  `toBeCloseTo(MEASURE_START_PAD)`.
- Keep `:2121` `expect(m.right.notes[0].x).toBeLessThan(m.width / 2)` — this is
  AC4.
- Add `expect(m.left.notes[0].x).toBeCloseTo(MEASURE_START_PAD)` (the fixture has
  a LH whole note at `:2105-2111`) — free both-staves coverage for AC1.
- Reword the comment `:2118-2119` ("hugs the measure's left edge" → "sits the
  opening lead-in past the left edge").

**AC1 + AC3 — opening-accidental test (`:2138-2161`).** `notes[0].accidentals`
is an array of `{ sFromBottom, glyph, y, dx, column }`; the sharp fixture →
`[{ …, dx: 1.2, column: 0 }]`, the plain fixture → `[]` (empty — do not index
it). Today `plain.notes[0].x ≈ 0`, `sharp ≈ 1`; after, both = `max(1.0, accLead)
= 1.0`, i.e. equal.
- Rename the `it(…)` at `:2138` (drop "hugs").
- `:2159` `expect(plain.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` →
  `toBeCloseTo(MEASURE_START_PAD)`.
- `:2160` `expect(sharp.right.notes[0].x).toBeGreaterThan(plain.right.notes[0].x)`
  → `toBeCloseTo(plain.right.notes[0].x)`, AND add
  `expect(sharp.right.notes[0].accidentals[0].dx).toBeGreaterThan(0)` (glyph
  draws left of the head).
- Reword the comment `:2157-2158` ("hugs… pushed right" → "lands at the uniform
  lead-in; the accidental occupies that lead-in, drawn left of the head").

**AC2 — barline→first-note gap (`:2030-2040`).** Strengthen from
barline→measure-edge to barline→first-note. `measures[i-1].barlines.find(b =>
b.side === "end").strokes[0].x` is the end-bar stroke's left x (= `measureRightX`
= `measures[i-1].x + measures[i-1].width`); `strokes[0]` is the leftmost stroke
even for multi-stroke bars. Replace the body `:2037-2038`:
```
const endBar = measures[i - 1].barlines.find((b) => b.side === "end");
const barStrokeX = endBar.strokes[0].x;
const firstNoteX = measures[i].x + measures[i].right.notes[0].x;
expect(firstNoteX - barStrokeX).toBeGreaterThanOrEqual(
    MEASURE_START_PAD + BARLINE_POST_PAD - NOTEHEAD_RX
);
```
Threshold = `1.0 + 0.7 − 0.6 = 1.1`; verified gap after the change ≈ 1.83 ≥ 1.1.
Reword the `it(…)` name `:2030` + comment `:2035-2036`.

**AC5 — justify invariance (NEW test).** No existing test pins `notes[0].x`
under narrow-vs-wide justify. Add a test that builds the same interior measure at
a wide and a narrow (stretched, non-last-system) budget and asserts
`notes[0].x` `toBeCloseTo(MEASURE_START_PAD)` in both. Holds because
`scaledContent = leadInset + scaledGrid` (`:1982`) scales only `scaledGrid`;
`leadInset` is outside the scale. Use a fixture that wraps to ≥2 systems at the
narrow width and read a measure in a non-last (justified) system (the last
system isn't justified, `:1702`).

**AC6 — empty measure (NEW `buildLayoutModel`-level test).** The existing
`:754-762` test is at the `measureLayout` level (which does not receive the
lead-in) and stays green. Add a `buildLayoutModel`-level empty-measure test:
`right.notes.length === 0`, `left.notes.length === 0`,
`Number.isFinite(m.width)`, and width grows vs the no-pad baseline (3.3 → 4.3).

**AC7 — no unrelated regressions.** The section-first test
`layout.test.js:2042-2053` asserts `firstNoteX > m3.inline.timeSignatureX`,
which stays true (the note moves further right by the lead-in, still clearing the
time sig) and needs no edit. `svg.test.js` has no assertion pinning an absolute
flush note X: `:1072`/`:1104` `toBeCloseTo(0)` are relative symmetry
differences; `:707-714` and `:1176-1182` are ordering/relative invariants that
survive a uniform left shift; `:731` is a trailing-bar (right-side) X. Re-run the
full suite to confirm.

## Risks and Open Questions

- **Both-coordinate invariant (primary).** The clearance must be added to **both**
  the packing sum (`:1767`) and the placement `leadInset` (`:1974`). Omitting
  either reintroduces the packing/placement desync that disqualified `leadingPad`
  (D1). The plan/code phases should treat this as a single coupled edit.

- **Dead-store removal blast radius.** `m.noteAccidentalLead` has exactly three
  touch points in `src/` (assigned `:1752`, stored `:1763`, read at `:1767` and
  `:1976`). Once `:1767`/`:1976` switch to `openingClearance`, the `:1763` store
  is dead and should be dropped; the local `const noteAccidentalLead` stays as
  the `max()` input. The plan phase should confirm (grep) no other reader of the
  `m.noteAccidentalLead` field exists before removing the store.

- **Baseline test count — reconciled, not a contradiction.** Phase 1 cited 216
  tests; the research log cites 263. These are different scopes:
  `layout.test.js` alone = **216** test cases, `svg.test.js` = **47**, and the
  combined run `npm run test:unit -- layout.test.js svg.test.js` = **263**
  (216 + 47). Both figures were verified against the live files. The plan/code
  phases should expect **263 passing** for the combined run, then 263 + 2 new
  tests (AC5, AC6) after the change, all green.

- **Comment hygiene (low risk, do not skip).** Besides the `BARLINE_POST_PAD`
  doc-comment softening (`constants.js:117-122`), refresh the inline comments at
  `layout.js:1745-1749` ("two independent leading insets") and `:1971-1973` (the
  `leadInset` doc) so they describe the opening clearance, not just the
  accidental.

- **No open questions block implementation.** The single architectural latitude
  (uniform-additive vs. equalize) is resolved by D4 in favor of the spec's
  default. The design is fully specified for the plan/code phases.
