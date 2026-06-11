# Spec research — 27-beamed-note-stems

Iterative Q&A between spec-analyst and spec-researcher to turn the intent
(beamed notes should attach stems to the side of the notehead, not the middle)
into clear, testable requirements.

Intent: `.rp/pipelines/27-beamed-note-stems/0-intent/intent.md`

## Q&A log

### Q1 — Where is the stem x-position computed for standalone vs beamed notes?

**Asked:** Where exactly is the stem x-position computed for (a) standalone
(flagged/quarter) notes and (b) beamed notes, with file paths, line numbers,
and the relevant expressions? Why do beamed stems currently end up centered on
the notehead while standalone stems sit at the edge?

**Answer:**

- **Standalone notes** — stem X is offset to the notehead edge in
  `src/notation/svg.js`, `renderStem` (lines 774-789), line 785:
  `const stemX = note.x + (note.direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX);`
  Stem-up → right edge (`note.x + NOTEHEAD_RX`), stem-down → left edge.
  The flag uses the same offset (`appendFlag`, svg.js line 801), so flag and
  stem stay attached together. `note.x` is the column-center (notehead center).
- **Beamed notes** — geometry computed in `src/notation/layout.js`,
  `beamGeometry` (lines 505-575). Stem records built at lines 529-533 with
  `x: m.x` — the raw member X (notehead center), no ±NOTEHEAD_RX offset.
  Call site passes `x: note.x` (layout.js lines 1544-1556). The emit layer
  (`renderBeam`, svg.js line 818) draws `stem.x` verbatim. Beam segments are
  likewise anchored on raw member X's (layout.js lines 538-546; svg.js
  lines 824-833).
- **Root cause:** the edge offset lives only in the standalone emit path;
  the beamed path never applies it, so beamed stems run through the notehead
  center.
- **Constants** (`src/notation/constants.js`): `NOTEHEAD_RX = 0.6`,
  `STEM_LENGTH = 3.5`, `STEM_THICKNESS = 0.13`.
- **Side convention** (consistent in both paths, reusable for the fix):
  stem-up attaches on the RIGHT, stem-down on the LEFT. In the beam code the
  direction comes from `stemDirectionForChord` (layout.js line 512), and
  `stackChord` (layout.js lines 324-325) already encodes this as `normalSide`.
- **Existing test surface pinning current behavior:**
  `src/notation/__tests__/layout.test.js` lines 512-547
  (`describe("beamGeometry")`) asserts the primary beam spans the raw member
  X's (e.g. line 524: `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0, x2: 4 })`).
  If stems shift by ±NOTEHEAD_RX, beam segments shift with them, so these
  expectations must be updated. Standard engraving: the beam connects the stem
  tops, not the notehead centers — so yes, the beam should move with the stems.

### Q2 — Chords and stem directions within beam groups

**Asked:** (a) Can beamed groups contain chords with flipped noteheads
(seconds/clusters via `stackChord`), and would a ±NOTEHEAD_RX stem offset
still leave every notehead touching the stem? (b) Is stem direction uniform
within a beam group, or can members differ (which determines whether the beam
merely translates horizontally)?

**Answer:**

(a) **Yes, beamed groups can contain chords, including flipped noteheads —
and the ±NOTEHEAD_RX offset is the correct attach point for all of them.**

- Beam membership is duration-only: `isBeamable` (layout.js lines 226-230)
  accepts any eighth-or-shorter note regardless of pitch count; `beamGroups`
  (layout.js 424-482) imposes no pitch-count restriction; beamed events carry
  full `stackChord` heads (layout.js line 1477).
- Notehead X positions are relative to the column center `note.x`
  (`renderNote`, svg.js lines 727-729): non-displaced heads are centered at
  `note.x`; displaced (flipped) heads are centered at `note.x ± 2·NOTEHEAD_RX`.
  Both therefore share a common vertical tangent at `note.x ± NOTEHEAD_RX` —
  exactly where the standalone stem attaches (svg.js line 785).
- So shifting the beamed stem from `note.x` to `note.x ± NOTEHEAD_RX` keeps
  every notehead in the chord correctly connected; no special flipped-head
  handling is needed (displacement math references `note.x`, not the stem X).
  A flipped head's stem-side edge coincides with the stem line — standard
  engraving, same as standalone chords already behave.

(b) **Stem direction is uniform per beam group.** `beamGeometry` computes one
direction for the whole group via the extreme rule — layout.js lines 506-512
gather all members' top/bottom steps and call `stemDirectionForChord(allSteps)`
once; that single direction drives every stem (lines 516, 523-527, 529-533).
Per-event directions computed upstream (layout.js line 1476) are ignored by
the beam path. Consequence: every stem in a group shifts by the same signed
offset (+NOTEHEAD_RX for an up-group, −NOTEHEAD_RX for a down-group), and the
primary/secondary beam segments (layout.js lines 538-546) shift identically —
the whole beam assembly translates horizontally as a rigid unit, keeping the
same length and flatness. No mixed-direction case exists in this codebase.

### Q3 — Rendering surfaces and full test surface

**Asked:** (a) Do the editor and front end share the same layout.js + svg.js
pipeline (so one fix covers both), or is there a second rendering
implementation? (b) Beyond layout.test.js lines 512-547, which automated tests
(other unit tests, Playwright specs) observe or pin beamed-stem/beam X
positions?

**Answer:**

(a) **One notation pipeline; a single fix covers everything.**

- Front end is the only surface that draws notation: `src/view.js` imports
  `buildLayoutModel` (line 25) and `renderInto` (line 26), calls them at
  lines 133-134. The whole draw path is view.js → layout.js (`beamGeometry`)
  → svg.js (`renderBeam`).
- The editor does not render notation: `src/edit.js` (53 lines) renders only
  a `TextareaControl` for raw song JSON plus a validation `Notice`; it never
  imports layout.js or svg.js.
- PHP does not draw: `src/render.php` emits only a wrapper div with an inert
  JSON script tag (line 41); its docblock states view.js draws the sheet
  music and PHP performs no parsing/validation/re-serialization (lines 5-9).

(b) **Full test surface:**

- **Must update (only one existing expectation):**
  `src/notation/__tests__/layout.test.js` line 524 —
  `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0, x2: 4 })` pins the
  primary beam to raw member X's; after the fix x1/x2 shift by the offset.
- **Unaffected within that block:** flat-beam Y assertions (lines 520-522),
  secondary-beam test (527-535) and stub test (537-546) assert levels/stub
  presence, not absolute X.
- **No assertion exists today on `geo.stems[i].x`** — new assertions should
  pin `stems[i].x === members[i].x ± NOTEHEAD_RX` (sign by direction) and
  that beam segment X's match the shifted stems.
- **No change needed:** other layout.test.js beam/stem tests (stem direction
  238-254, isBeamable/beamCountFor 222-234, beamGroups 356-507, decodeDuration
  184-216, stackChord 283-313 — the latter corroborates the side convention);
  svg.test.js (no stem/beam geometry assertions; its `line` queries at 1022,
  1047, 1298, 1320 are hairpins); constants.test.js; both Playwright specs
  (render.spec.js asserts structure/containment only; editor.spec.js is
  persistence/validation only).
- **No screenshot/snapshot tests exist** anywhere in the repo — nothing to
  re-bless.
- Optional new emit-level coverage: svg.test.js check that `[data-beam] line`
  stems sit at the notehead edge, and/or a consistency check that a beamed
  stem's X equals what a standalone stem of the same note/direction uses.

### Q4 — Other consumers of beamGeometry's X values

**Asked:** Are `stems[].x` / `beams[].x1/x2` consumed anywhere other than
`renderBeam` (spacing, system breaking, collision, tie/slur/hairpin/tuplet
anchoring, horizontal-extent measurement)? Could the ±NOTEHEAD_RX shift make
a beam protrude past the last column at a system edge, or misalign anything
anchored to stems/beams?

**Answer:** **Exactly one consumer — `renderBeam` — and no side effects.**

- **Flow:** `beamGeometry` returns `{ direction, beamY, stems, beams }`
  (layout.js line 574), called once at layout.js line 1558 inside
  `layoutHand`; output lands in the hand's `beams` array (line 1562). The
  only reader is svg.js `renderHand` (lines 670-671) → `renderBeam` (line
  818, segments 824-833). Grep of both files confirms no other reads of
  `.beams`/`.stems`/`beamY`/beam X.
- **Ordering:** spacing is computed before and independently of beams.
  `measureLayout` (layout.js 808-858) builds advances purely from onset gaps;
  justify scales `columnX` (layout.js 2035-2040) before `layoutHand` runs, so
  `note.x` is final when `beamGeometry` reads it. The ±NOTEHEAD_RX offset is
  a fixed post-scale add-on; nothing re-derives width or re-scales after.
- **(a) System-edge overflow:** not a real risk in practice. The last column
  always carries a trailing advance to `measureEnd` (layout.js 843-844) plus
  `trailingPad` (barline pad), and the staff is inset by `STAFF_MARGIN_X`
  (layout.js 2144); the 0.6 sp shift is far smaller than that slack. Same
  symmetrically on the left for stem-down groups. **Caveat:** there is no
  explicit clamp guarding this — safety comes from spacing slack, not a
  guard. (`NOTE_CLAMP_INSET`, layout.js 1686-1690, clamps annotation text
  only.) An optional belt-and-suspenders AC: max beamed stem/beam X stays
  within the measure's barline and the system staff-end.
- **(b) Anchored elements:** nothing anchors to stem/beam X.
  Ties/slurs/hairpins anchor at `measureX + note.x` and notehead Y
  (`recordSpanMarkers`, layout.js 2427-2459, line 2443). Ledger lines center
  on `note.x` (layout.js 165-188; svg.js 713-716). Dots and accidentals key
  off `note.x` (svg.js 749-764). Flags are only drawn for un-beamed notes
  (svg.js 743) and already use the edge offset (svg.js 801). System
  packing/scaling reads `contentWidth`/`reserve` only (layout.js 1359-1362,
  1820). No tuplet logic exists. No collision logic reads beam X.

## Requirements

The intent is now fully specified. Terminology: "sp" units are the staff-space
units used throughout `src/notation`; `NOTEHEAD_RX = 0.6` is the notehead's
horizontal radius (`src/notation/constants.js`).

### R1 — Beamed stems attach at the notehead edge

Every stem in a beamed group MUST be drawn at the notehead edge on the side
given by the group's stem direction, using the same rule as standalone notes:

- stem-up group: stem X = `note.x + NOTEHEAD_RX` (right edge)
- stem-down group: stem X = `note.x − NOTEHEAD_RX` (left edge)

This matches the standalone rule in `renderStem` (`src/notation/svg.js` line
785). The natural fix point is `beamGeometry` (`src/notation/layout.js`,
stems built at lines 529-533 from raw `m.x`), since the group direction is
already known there; applying it at emit time in `renderBeam` is an
acceptable alternative as long as stems and beam segments shift together.

### R2 — Beam segments move with the stems

Primary beams, secondary beams, and partial-beam stubs MUST span the shifted
stem X positions, so the beam connects the stem tops (standard engraving) —
not the notehead centers. Because stem direction is uniform per group (Q2b),
this is a rigid horizontal translation of the whole beam assembly by
±NOTEHEAD_RX: beam Y, flatness, and length are unchanged.

### R3 — Beamed and standalone stems are visually consistent

For the same pitch, column X, and stem direction, a beamed note's stem X MUST
equal the stem X a standalone (flagged/quarter) note would get. This is the
inconsistency the issue is about; it is the property to assert in a
cross-check test if one is added.

### R4 — Nothing else moves

Noteheads (including displaced chord heads at `note.x ± 2·NOTEHEAD_RX`),
ledger lines, augmentation dots, accidentals, and tie/slur/hairpin anchors
MUST keep their current positions — they all key off `note.x`, which does not
change (Q4b). Chords inside beamed groups need no special handling: all heads
share the tangent line at `note.x ± NOTEHEAD_RX` (Q2a).

### R5 — Scope of change

The fix lives in the shared pipeline (`src/notation/layout.js` and/or
`src/notation/svg.js`). No editor (`src/edit.js`), PHP (`src/render.php`), or
view-bootstrap changes are needed — the front end is the only surface that
draws notation (Q3a).

### R6 — Test changes

1. **Update** `src/notation/__tests__/layout.test.js` line 524: the primary
   beam expectation `{ level: 1, x1: 0, x2: 4 }` must reflect the shifted
   endpoints (members at X 0 and 4, shifted by the group's signed
   NOTEHEAD_RX offset).
2. **Add** assertions in the `beamGeometry` block:
   - each `stems[i].x === members[i].x ± NOTEHEAD_RX` with the sign
     determined by the group direction — cover both an up-group and a
     down-group;
   - beam segment `x1`/`x2` equal the first/last shifted stem X.
3. **No other existing tests change**: the rest of layout.test.js,
   svg.test.js, constants.test.js, and both Playwright specs are unaffected
   (Q3b). No snapshot baselines exist.
4. **Optional (recommended)**: an emit-level check in svg.test.js that
   `[data-beam]` stem lines sit at the notehead edge, and/or the R3
   beamed-vs-standalone consistency assertion.

### R7 — Optional guard (non-blocking)

There is no explicit clamp preventing a beam edge from crossing a barline;
current spacing slack (trailing advance + barline pad + `STAFF_MARGIN_X`)
comfortably exceeds the 0.6 sp shift (Q4a). If extra certainty is wanted, an
AC/test may assert that the maximum beamed stem/beam X stays within the
measure's barline and the system staff-end. This is recommended-optional, not
required for the fix.

### Out of scope / non-requirements

- No mixed-direction beam handling: the codebase has exactly one stem
  direction per beam group (Q2b).
- No flag changes: beamed notes never draw flags (svg.js line 743), and
  standalone flags already sit at the edge.
- No spacing/width/packing changes: beam X has no layout consumers (Q4).
