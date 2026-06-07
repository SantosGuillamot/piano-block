# Design doc — Issue #14: more horizontal space at the start of each measure

Phase 2 (Design doc) artifact. Owner: design-doc-analyst. Driven by an iterative
Q&A with the design-doc-researcher teammate. This file records the design
rationale and the decisions (mechanism, constant, composition, scope, and the
exact test contract) so the plan/code phases have an unambiguous spec.

Inputs read first: `1-spec/spec.md` (approved spec), `1-spec/spec-research.md`
(phase-1 root-cause research with the file:line map), `0-prompt/prompt.md`.

All geometry is in staff-spaces (sp); `SP_PX = 8`, a staff is 4 sp tall.

## What is already firm from phase 1 (carried in, not re-litigated)

The spec + spec-research settled the user-visible contract; the design phase
confirms HOW to build it against the current code and pins the edit points.
Firm inputs:

- The first content column of every measure (onset-0 note OR rest, shared by
  both hands via one per-measure `columnX` map) must be inset from the measure's
  left edge by an "opening clearance" of at least `MEASURE_START_PAD = 1.0` sp.
- The clearance is a FIXED engraving offset (not justify-scaled) and must be
  budgeted into each measure's intrinsic packing width.
- Composition with an opening accidental is `max`, not additive.
- Applies uniformly to all measure types; empty measures just widen.
- No downstream regression (notes/rests/beams/ties/slurs/hairpins/point
  dynamics/ottava brackets/standalone annotations/barlines).

## Code grounding verified by the analyst (current trunk)

Re-read against the live code; all phase-1 anchors check out:

- `measureLayout` (`layout.js:794-844`) accepts `{ leadingPad = 0, trailingPad = 0,
  columnExtra = {} }`. It starts the first column at `x = leadingPad`
  (`:825`), accumulates `contentWidth` from ADVANCES ONLY (`:826-833` — the loop
  adds `advance`, never `leadingPad`), and returns `width = leadingPad +
  contentWidth + trailingPad` (`:841`; empty-grid branch `:817`).
- Packing pass (`layout.js:1740-1769`): `trailingPad` is the only option passed to
  `measureLayout` (`:1742-1744`). Two leading insets are computed and BOTH folded
  into the packing width: `sectionReserve` (`:1750-1751`) and `noteAccidentalLead`
  (`:1752-1754`), via `m.contentWidth = ml.width + sectionReserve +
  noteAccidentalLead` (`:1767`). `m.contentWidth` is the packing currency consumed
  by `packSystems` (`:1345,1348,1802`) and `systemScale`.
- Measure walk (`layout.js:1967-1991`): per measure, `leadInset = (localIdx > 0 ?
  sectionReserve : 0) + noteAccidentalLead` (`:1974-1976`); the justify-scaled grid
  is `scaledGrid = (ml.contentWidth || EMPTY_MEASURE_WIDTH) * advanceScale`
  (`:1980-1981`); `scaledContent = leadInset + scaledGrid` (`:1982`, the inset is
  UNSCALED); columns are REBUILT from `let cx = leadInset; ... cx += col.advance *
  advanceScale` (`:1987-1991`) — using `col.onset` and `col.advance` only.
- `measureRightX = x + scaledContent` (`:2018`) drives the end barline; a
  `repeat-start` left barline is drawn at `x` (the measure's left edge, before the
  inset) (`:2020-2026`); next measure starts at `x += scaledContent + trailingPad`
  (`:2082`).
- Constants (`constants.js`): `MIN_ADV = 2.2`, `NOTEHEAD_RX = 0.6`,
  `EMPTY_MEASURE_WIDTH = 3.3`, `BARLINE_POST_PAD = 0.7`, `BARLINE_THIN = 0.13`,
  `ACCIDENTAL_LEAD_EXTRA = 1`, `ACCIDENTAL_GAP = 1.2`, `RESERVE_PAD = 1`.

## Q&A log

### Q1 — Mechanism: additive `leadInset` term vs. wiring `measureLayout`'s `leadingPad`

Two clean injection points exist at different layers: (A) the `leadInset` rail in
`buildLayoutModel`'s system walk + the matching `m.contentWidth` packing term, the
exact idiom `noteAccidentalLead`/`sectionReserve` already use; (B) the dormant
`leadingPad` option of `measureLayout` (accepted, defaulted to 0, currently never
passed for a generic lead-in).

**Evidence (analyst trace, fully corroborated by the researcher):**

1. `ml.contentWidth` EXCLUDES `leadingPad`. In `measureLayout` the column loop does
   `contentWidth += advance` only (`layout.js:826,833` — advances, never the pad);
   `leadingPad` enters ONLY `ml.width` (`:817` empty branch, `:841` `width =
   leadingPad + contentWidth + trailingPad`). So the justify-scaled grid at `:1981`
   (`scaledGrid = (ml.contentWidth || EMPTY_MEASURE_WIDTH) * advanceScale`) would NOT
   scale a `leadingPad` (it reads `contentWidth`, not `width`). (This refines the
   first-pass worry that `leadingPad` would be justify-scaled — it would not be.)

2. `col.x` is DEAD for placement — the decisive fact. `measureLayout` seeds per-column
   `col.x` from `x = leadingPad` (`:825,831`), but the measure walk THROWS THOSE AWAY
   and rebuilds X from scratch: `let cx = leadInset; ml.columns.forEach((col) => {
   columnX.set(col.onset, cx); cx += col.advance * advanceScale; })` (`:1986-1991`).
   A grep of the whole notation source finds exactly TWO readers of `ml.columns` —
   `:1988` (uses `col.onset` + `col.advance`) and `:2046` `ml.columns.map((col) =>
   col.onset)` (onset only). `col.x` has ZERO consumers anywhere. So a `leadingPad`
   passed to `measureLayout` would silently widen `ml.width` → `m.contentWidth`
   (`:1767`, packing budget) while moving NO note/rest/beam/annotation/barline —
   placement and packing would DESYNC. To make it move notes you'd ALSO have to seed
   `cx = leadingPad` at `:1987`, i.e. edit the walk anyway, so the "one edit"
   advantage of (B) evaporates and you add a double-count hazard (`ml.width` already
   carries `trailingPad`).

3. The `leadInset` rail (A) is a confirmed TWO-SITE idiom with no third consumer.
   `noteAccidentalLead`/`sectionReserve` flow through exactly: PACKING — one site,
   `m.contentWidth = ml.width + sectionReserve + noteAccidentalLead` (`:1767`), whose
   only readers are `:1768` return, `packSystems` (`:1345,1348`), and the justify
   `contentSp` reduce (`:1802`), all consuming the single value; PLACEMENT — one site,
   `leadInset = (localIdx>0 ? sectionReserve : 0) + noteAccidentalLead` (`:1974-1976`),
   feeding `scaledContent = leadInset + scaledGrid` (`:1982`, UNSCALED → satisfies
   R4/AC5) and `cx = leadInset` (`:1987`), and flowing into standalone annotations via
   `:2048`. No hidden third reader of either name.

**DECISION D1 — mechanism: additive `leadInset` term (path A). REJECT `leadingPad`.**
Rationale: (A) keeps placement and packing in sync BY CONSTRUCTION (the lead-in is
added to the same two coordinated sites `noteAccidentalLead` uses), is UNSCALED by
justify (rides outside `* advanceScale` at `:1982`), and is the established codebase
idiom. (B) is strictly worse: a placement no-op unless you ALSO edit the same walk
(`:1987`) plus pass the option at `:1742`, with a double-count risk against the
`ml.width`-based `:1767` sum — more sites, more desync risk, zero upside. Alternative
(B) considered and rejected on the `col.x`-has-no-consumers + extra-blast-radius
evidence above.

### Q2 — The constant + the `max()` composition (exact code shape)

**Constant.** New `MEASURE_START_PAD = 1.0` (sp) in `constants.js`, in the
"Horizontal spacing" section right after `EMPTY_MEASURE_WIDTH` (`constants.js:70`).
Rationale: that section already groups the per-measure horizontal-advance budget
(`MIN_ADV`, `ADV_K`, `EMPTY_MEASURE_WIDTH`), which is exactly what an opening lead-in
is — a horizontal slot budgeted into measure width; the spec also ties its magnitude
to `MIN_ADV` ("below `MIN_ADV` so the opening gap never exceeds the smallest
note-to-note advance"). NOT the "Barlines" section (that holds stroke thicknesses +
`BARLINE_POST_PAD`, and the spec scopes OUT touching barline/trailing geometry — co-
locating there would wrongly imply a barline-side change). `constants.js` (not a
layout.js-local `const` like `RESERVE_PAD`) is required because the ACs import
`MEASURE_START_PAD` into `layout.test.js`. `svg.js` does NOT need it (it consumes
laid-out positions `note.x`/`measure.x`/`acc.dx`, never the pad).

Doc-comment (mirrors `ACCIDENTAL_LEAD_EXTRA`/`BARLINE_POST_PAD` voice):
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

**DECISION D2 — magnitude `MEASURE_START_PAD = 1.0` sp.** Visible barline →
notehead-left-edge whitespace becomes ≈ 0.1 + 1.0 ≈ 1.1 sp (vs ≈ 0.1 today) — about
one notehead-width (`2·NOTEHEAD_RX = 1.18`), matches peer constants `RESERVE_PAD = 1`
and `ACCIDENTAL_LEAD_EXTRA = 1`, and stays below `MIN_ADV = 2.2` so the opening gap
never exceeds the smallest note-to-note advance. Alternative considered: 1.2 (a full
notehead-width) for a slightly roomier look — defensible but `1.0` is the spec's
acceptance-criteria value and the tasteful default; do not exceed ~1.5.

**DECISION D3 — composition: `openingClearance = max(MEASURE_START_PAD,
noteAccidentalLead)`, accidental term FOLDED IN (not additive).** Today
`noteAccidentalLead = firstColumnHasAccidental(m) ? ACCIDENTAL_LEAD_EXTRA : 0`
(`:1752-1754`), a fixed 1.0 when present. Both terms occupy the SAME pre-column slot
(empty breathing room vs. the slot the accidental glyph then fills), so they compose
by `max`, not by stacking — an accidental measure is not pushed in twice. With both =
1.0 today the note position is identical to the plain case (uniform note lead-in);
`max` is future-proof if the pad is later bumped.

Concrete code shape (the established `noteAccidentalLead` idiom, two coordinated sites):
```
// packing pass (~:1752):
const noteAccidentalLead = firstColumnHasAccidental(m) ? ACCIDENTAL_LEAD_EXTRA : 0;
const openingClearance = Math.max(MEASURE_START_PAD, noteAccidentalLead);  // NEW
...
m.openingClearance = openingClearance;                       // replaces m.noteAccidentalLead store
m.contentWidth = ml.width + sectionReserve + openingClearance;   // was + noteAccidentalLead  (:1767)
...
// measure walk (:1974):
const leadInset =
    (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) + (m.openingClearance ?? 0);
```
Refinements (researcher-confirmed):
- `noteAccidentalLead` has exactly THREE touch points (grep, src/ minus tests):
  assigned `:1752`, stored `:1763`, read at `:1767` and `:1976` (via `m.noteAccidentalLead`).
  Once `:1767`/`:1976` switch to `openingClearance`, the `m.noteAccidentalLead = …`
  store is DEAD — drop it; keep only the local `const noteAccidentalLead` as the
  `max()` input. Minimal surface, removes a now-dead field.
- `sectionReserve` STAYS a separate additive term in BOTH `:1767` and `:1974`
  (cautionary clef/key/time glyphs genuinely precede the lead-in), gated on
  `localIdx > 0` as today; `openingClearance` is added UNCONDITIONALLY (every measure,
  including the system head). So a mid-system section-change measure gets
  `sectionReserve + openingClearance`.
- DOC-TOUCH (list in the edit set): `BARLINE_POST_PAD`'s comment (`constants.js:118-120`)
  says "Kept small so the opening note sits close to the bar" — misleading after this
  change (the lead-in pushes the note ~1 sp further). Soften, e.g. "so the head clears
  the line; the measure's own lead-in (`MEASURE_START_PAD`) adds the breathing room."

**AC3 glyph-placement safety (key correctness fact).** The accidental GLYPH X is
purely relative to the notehead, NOT to `leadInset`. The note X is `columnX.get(onset)`
(`layout.js:1438`, carries `leadInset`); the glyph is built by `stackAccidentals`
(`:1477`) with a fixed left offset `dx = ACCIDENTAL_GAP + column · ACCIDENTAL_COL_STEP`
(`:671`); the emit layer draws it at `note.x − acc.dx` (`svg.js:751`). So folding the
accidental into `max()` shifts the NOTEHEAD to the uniform `MEASURE_START_PAD` and the
glyph rides along at the same `dx` left of the head — `glyph X = note.x − 1.2 < note.x`
always (`ACCIDENTAL_GAP = 1.2 > 0`). AC3 ("glyph draws left of head") holds by
construction; the old "accidental note pushed farther right than plain" becomes EQUAL
(both resolve to `max(1.0, 1.0) = 1.0`), exactly the AC3 rewrite. No clearance
regression: at lead-in 1.0 the glyph center sits at `1.0 − 1.2 = −0.2` sp (0.2 sp left
of the boundary), identical to today's `ACCIDENTAL_LEAD_EXTRA = 1` behavior.

### Q3 — Open design latitude: uniform-additive vs. equalizing system-first with interior

The spec leaves ONE genuine architectural choice (spec.md Out-of-Scope bullet 3):
apply the lead-in additively to every measure (system-first note ends up indented
~1 sp MORE than interior, because the head already has `RESERVE_PAD = 1` after the
clef/key/time block), vs. EQUALIZE the system-first gap to the interior gap by
folding the lead-in into the reserve (`max(RESERVE_PAD, MEASURE_START_PAD)` at the
head) or subtracting `RESERVE_PAD` from the head's clearance.

Geometry: `leadingReserveFor` returns `… + RESERVE_PAD` (`RESERVE_PAD = 1`,
`layout.js:1291,1318`); a system-first measure's left edge `x = STAFF_MARGIN_X +
reserve` already sits 1 sp past the clef block. Uniform-additive → head note at
`clef-block + RESERVE_PAD(1) + MEASURE_START_PAD(1)` ≈ 2 sp past the block; interior
note at `MEASURE_START_PAD(1)` past its barline.

**Evidence — the pre-packing ordering makes equalize HARDER (decisive):**
`m.contentWidth` is COMMITTED before system-head identity exists. In
`buildLayoutModel`: `:1740` `const packing = flat.map((m, idx) => …)` computes
`m.contentWidth` for every measure in the FLAT list (`:1767`), with no notion of
systems (`idx` is the global index). `:1773` `packSystems(packing, …)` is what
DECIDES system boundaries, consuming the already-final `m.contentWidth`. Only at
`:1784` `systemRanges.forEach((range, sysIdx) => { members.forEach((m, localIdx) =>`
is head identity (`localIdx === 0`, `:1967`) and the head `reserve` (`:1793-1797`)
known. So head identity is an OUTPUT of packing, but a head's reduced clearance would
be an INPUT to packing — a chicken-and-egg. Equalize would therefore need either a
two-pass / fixpoint packing rework, OR a placement-only hack (adjust `:1974`, leave
`:1767` alone) that re-introduces the very placement/packing DESYNC that killed
`leadingPad` in Q1 (head measure budgeted at full clearance, placed at reduced),
perturbing the greedy fill (`:1345-1348`) and justify scale (`:1802`) by ~1 sp.

**Engraving convention (favors uniform-additive):** more air at a system opening is
conventional — standard practice (Gould "Behind Bars"; Ross) treats the post-clef/
key/time space at a line head as its own reserved indent, distinct from the interior
post-barline gap; the eye needs separation between the clef furniture and the first
note. That is exactly what `RESERVE_PAD` already encodes ("Pad after the reserve
before the first notehead", `layout.js:1291`). The ~1 sp extra indent at a head is a
FEATURE, and the spec itself endorses it. (General convention; no fresh citation
pulled, but the spec adopted it as default and `RESERVE_PAD`'s existence is the
codebase's own prior commitment to extra air at the line head.)

**DECISION D4 — UNIFORM-ADDITIVE (every measure), REJECT equalize.** `openingClearance`
is added UNCONDITIONALLY to both the packing sum (`:1767`) and the placement
`leadInset` (`:1974`), head and interior alike; `sectionReserve` remains the only
position-gated term (`localIdx > 0`). Three independent reasons: (1) it's the spec's
stated default and the ACs are written against it; (2) single-mechanism, no branch on
measure position — matches how `noteAccidentalLead` is applied by predicate today;
(3) equalize is strictly harder (needs a packing rework or reintroduces the Q1 desync)
for a purely cosmetic change the spec doesn't require, and the ~1 sp line-opening
indent it would remove is conventionally desirable anyway. Alternative (equalize)
considered and rejected on the pre-packing-ordering + convention evidence above.

**Section-first measures (mid-system clef/key/time change):** get
`sectionReserve + openingClearance` (both additive at `:1767` and `:1974`), because
the cautionary glyphs genuinely precede the lead-in (spec §6/R5). Confirmed by the
existing test `layout.test.js:2042-2053` ("a mid-system section change's notes start
after the inline time signature") — that test asserts `firstNoteX >
m3.inline.timeSignatureX`, which STAYS TRUE (the note moves further right by the
lead-in, still clearing the time sig) and needs no edit.

### Q4 — Downstream consumers ride the shift for free (no per-consumer edit)

Every downstream element derives from the shifted `columnX` → `note.x`, or from
`measureX + note.x`; none assumes column-0-at-0. File:line per consumer (researcher
re-verified by running experiments, not just reading):

- NOTE/REST X — the single source: `layout.js:1438 const x = columnX.get(onsets[idx])
  ?? 0`. The `?? 0` is a MISSING-KEY fallback only; a present onset returns its real
  `columnX` value (the `leadInset`-seeded `cx` from `:1987-1990`). Rests use the same
  `x`. Beams/flags/ledgers/dots/accidentals hang off this `x` on the note record
  (`:1501-1518`).
- BEAMS — built from laid-out `note.x` → move with the notes.
- TIES/SLURS — `recordSpanMarkers(…, { measureX: x })` (`:2054,2061`); spans resolve at
  `measureX + note.x`.
- HAIRPINS / POINT DYNAMICS / OTTAVA — anchored to the same `measureX + note.x` frame.
- STANDALONE ANNOTATIONS — built in the `leadInset` frame (`:2042-2050`,
  `collectStandaloneAnnotations(…, { columnX, gridOnsets, leadInset, scaledContent })`);
  beat-0 maps to `leadInset` (`:1604,1642`), so they track the lead automatically.
- BARLINES — end bar at `measureRightX = x + scaledContent` (`:2018`, drawn `:2028-2031`);
  since `scaledContent = leadInset + scaledGrid` (`:1982`), the measure just gets WIDER
  on the LEFT and the end bar moves right by the lead. A `repeat-start` LEFT bar is
  drawn at `x` (the measure's left edge, BEFORE the inset, `:2021-2026`) → stays FLUSH
  at the boundary, first note sits the clearance to its right. These paths already run
  with nonzero `leadInset` today (via `noteAccidentalLead`/`sectionReserve`).

**EMPTY measure (AC6) — verified by experiment.** Today: width `EMPTY_MEASURE_WIDTH =
3.3`, 0 notes, no NaN. After: `openingClearance = max(MEASURE_START_PAD, 0) = 1.0`
rides on TOP via `:1767` and `:1974`; the empty-grid branch (`:811-820`) still returns
`contentWidth: EMPTY_MEASURE_WIDTH`, so width → 4.3, still 0 notes, no NaN (`cx =
leadInset` is set but the forEach over zero columns is a no-op).

### Q5 — Exact test-edit contract (the deliverable)

Runner: JEST via `wp-scripts test-unit-js` — run `npm run test:unit -- layout.test.js
svg.test.js` (NOT vitest). Baseline today: 263 pass. Targets verified by experiment.

**IMPORTS (`layout.test.js:11-29`).** ADD `MEASURE_START_PAD` and `BARLINE_POST_PAD`
to the `from "../constants.js"` block. (`NOTEHEAD_RX`, `EMPTY_MEASURE_WIDTH`,
`STAFF_MARGIN_X`, `ACCIDENTAL_GAP`, `MIN_ADV` already imported.)

**AC1 + AC4 — whole-note test (`:2117-2122`).** Fixture is the SCORE-FIRST measure
(measure 0); `notes[0].x` is measure-RELATIVE and equals `leadInset = openingClearance
= MEASURE_START_PAD = 1.0` REGARDLESS of system position (RESERVE_PAD folds into the
absolute `m.x` via `reserve`, NOT into `notes[0].x`). Edits:
- `:2120` `expect(m.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` →
  `…toBeCloseTo(MEASURE_START_PAD)`.
- KEEP `:2121` `expect(m.right.notes[0].x).toBeLessThan(m.width / 2)` (this IS AC4).
- ADD `expect(m.left.notes[0].x).toBeCloseTo(MEASURE_START_PAD)` — the fixture has a LH
  whole note (`:2105-2111`), so this is free coverage of AC1's both-staves requirement.
- Reword comment `:2118-2119` ("hugs the measure's left edge" → "sits the opening
  lead-in past the left edge").

**AC1 + AC3 — opening-accidental test (`:2138-2161`).** Verified record shape: the note
carries `notes[0].accidentals` as an ARRAY of `{ sFromBottom, glyph, y, dx, column }`;
sharp fixture → `[{ …, dx: 1.2, column: 0 }]`, plain fixture → `[]` (empty — do NOT
index it). `dx = ACCIDENTAL_GAP + column·ACCIDENTAL_COL_STEP` (= 1.2 for column 0),
always present + positive for a drawn accidental (glyph X = `note.x − dx`, LEFT of the
head). Today `plain.notes[0].x = 0`, `sharp = 1` (so `:2160 sharp > plain` passes);
AFTER both = `max(1.0, accLead) = 1.0` → EQUAL. Edits:
- Rename the `it(…)` at `:2138` (drop "hugs").
- `:2159` `expect(plain.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` →
  `…toBeCloseTo(MEASURE_START_PAD)`.
- `:2160` `expect(sharp.right.notes[0].x).toBeGreaterThan(plain.right.notes[0].x)` →
  `expect(sharp.right.notes[0].x).toBeCloseTo(plain.right.notes[0].x)` AND add
  `expect(sharp.right.notes[0].accidentals[0].dx).toBeGreaterThan(0)` (glyph draws left
  of the head; `> NOTEHEAD_RX` is an even more legible threshold since 1.2 > 0.6).
- Reword comment `:2157-2158` ("hugs… pushed right" → "lands at the uniform lead-in;
  the accidental occupies that lead-in, drawn left of the head").

**AC2 — barline→first-note gap (`:2030-2040`).** Strengthen from barline→measure-EDGE to
barline→first-NOTE. Verified: `measures[i-1].barlines.find(b => b.side === "end")
.strokes[0].x` is the end-bar stroke's LEFT x (`{ side:"end", type:"regular", strokes:
[{ x, thickness: 0.13 }], … }`); it equals `measureRightX` = `measures[i-1].x +
measures[i-1].width`. For multi-stroke bars (`final`/`double`/`repeat-end` — present in
COMPREHENSIVE_SONG) `strokes[0]` is still the leftmost stroke. COMPREHENSIVE_SONG
interior measures all have an onset-0 RH note (`notes[0]` exists). Verified numbers on a
2-measure song: today gap `= 0.83`; after `= 1.83`; threshold `MEASURE_START_PAD +
BARLINE_POST_PAD − NOTEHEAD_RX = 1.1` → `1.83 ≥ 1.1` holds. REPLACE the body
`:2037-2038` (the old edge-gap assert is strictly weaker and subsumed):
```
const endBar = measures[i - 1].barlines.find((b) => b.side === "end");
const barStrokeX = endBar.strokes[0].x;
const firstNoteX = measures[i].x + measures[i].right.notes[0].x;
expect(firstNoteX - barStrokeX).toBeGreaterThanOrEqual(
    MEASURE_START_PAD + BARLINE_POST_PAD - NOTEHEAD_RX
);
```
Reword the `it(…)` name `:2030` + comment `:2035-2036` → "barline-to-first-note gap is
at least a notehead width".

**AC5 — justify invariance (NEW test).** No existing test asserts `notes[0].x` under
narrow-vs-wide justify (the `:1676-1759` tests cover `packSystems`/`systemScale`/wrap
counts only). ADD a test that builds the same interior measure at a wide and a narrow
(stretched, non-last system) budget and asserts `notes[0].x` `toBeCloseTo(
MEASURE_START_PAD)` in BOTH. Holds because `:1982 scaledContent = leadInset +
scaledGrid` scales only `scaledGrid` (`* advanceScale`); `leadInset` is OUTSIDE the
scale. (For a robust fixture, use a song that wraps to ≥2 systems at the narrow width
and read a measure in a NON-last system, since the last system isn't justified, `:1702`;
or simply assert the invariant on an interior measure at both widths — it's unscaled
either way.)

**AC6 — empty measure (NEW buildLayoutModel test).** The existing `:754-762` test is at
the `measureLayout` LEVEL (which does NOT receive the lead-in) and stays GREEN. ADD a
`buildLayoutModel`-level empty-measure test: `right.notes.length === 0`,
`left.notes.length === 0`, `Number.isFinite(m.width)`, and width grows vs the no-pad
baseline (3.3 → 4.3).

**svg.test.js (AC7) — no edits expected.** No assertion pins an absolute flush note X:
`:1072`/`:1104` `toBeCloseTo(0)` are RELATIVE differences (symmetry); `:707-714`
(standalone-note ordering) and `:1176-1182` (wedge `x1 < barX < x2`) are ordering/
relative invariants that survive a uniform shift; `:731` is the trailing-bar X (right
side, unaffected by a LEFT lead). Code phase should still re-run the full suite to be
certain (svg.test.js builds its own fixtures).

## Final edit set (hand-off to plan/code)

1. **`constants.js`**: add `MEASURE_START_PAD = 1.0` in the "Horizontal spacing" section
   after `EMPTY_MEASURE_WIDTH` (`:70`), with the doc-comment in Q2. Soften the
   `BARLINE_POST_PAD` doc-comment (`:118-120`) — drop "so the opening note sits close to
   the bar" (now stale; the lead-in adds the breathing room).
2. **`layout.js`**: import `MEASURE_START_PAD` from `./constants.js`; in the packing pass
   near `:1752` compute `const openingClearance = Math.max(MEASURE_START_PAD,
   noteAccidentalLead);`; store `m.openingClearance = openingClearance` and DROP the now-
   dead `m.noteAccidentalLead = …` store (`:1763`); change `:1767` to `m.contentWidth =
   ml.width + sectionReserve + openingClearance`; change the `:1974` `leadInset` to
   `(localIdx > 0 ? (m.sectionReserve ?? 0) : 0) + (m.openingClearance ?? 0)`.
   `sectionReserve` stays separate + gated; keep the local `noteAccidentalLead` var as the
   `max()` input. Update the explanatory comments at `:1745-1749` and `:1971-1973` to
   describe the opening clearance (no longer accidental-only). NO change to
   `measureLayout`, `leadingPad`, `BARLINE_POST_PAD`'s value, or any trailing geometry.
3. **`layout.test.js`**: add 2 imports; edit AC1/AC4 (`:2120` + left-staff add + comment),
   AC2 (`:2030-2040` body + name/comment), AC3 (`:2159-2160` + `dx` assert + name/comment);
   ADD an AC5 justify-invariance test and an AC6 `buildLayoutModel` empty-measure test.
4. **`svg.test.js`**: no edits expected; re-run the full suite to confirm AC7.

## Risks / notes for later phases

- The change touches the single `leadInset`/`contentWidth` rail; the chief invariant is
  that the lead-in is added to BOTH `:1767` (packing) and `:1974` (placement) — omitting
  either desyncs packing vs. placement (the exact failure mode that disqualified
  `leadingPad`). The `max()` fold-in means an opening-accidental measure's note position
  is now IDENTICAL to a plain measure's (uniform lead-in) — intended, and the AC3 rewrite
  encodes it.
- A measure can be a system head in one wrap and interior in another (head identity is an
  OUTPUT of packing). Uniform-additive is immune (same clearance regardless); this is the
  core reason equalize was rejected (D4).
- Comment hygiene: besides the `BARLINE_POST_PAD` softening, refresh the inline comments
  at `layout.js:1745-1749` (the "two independent leading insets" note) and `:1971-1973`
  (the `leadInset` doc) so they describe the opening clearance, not just the accidental.
