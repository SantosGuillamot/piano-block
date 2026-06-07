# Design Doc Review

## Verdict: approved

## Summary

The design doc is technically sound, faithful to the spec, and pinned to the
live code with line-accurate precision. Every load-bearing claim I spot-checked
against the current trunk holds: the two coordinated coordinates (packing width
`:1767`, placement `leadInset` `:1974`/`:1987`), the justify exclusion at `:1982`
(`scaledContent = leadInset + scaledGrid`, inset unscaled), the
`max(MEASURE_START_PAD, noteAccidentalLead)` composition, the accidental-glyph-
left-of-notehead behavior (`svg.js:751`, `note.x - acc.dx`), the `leadingPad`-is-
a-no-op rejection (`col.x` has zero readers; `leadingPad` enters only `ml.width`,
not `ml.contentWidth`), and the dead-store removal of `m.noteAccidentalLead`. The
both-coordinate coupling invariant is treated as a single coupled edit and named
as the primary failure mode. The test contract (AC1–AC7 mapping, the new AC5/AC6
tests, and the 263→265 baseline) is concrete enough for the plan/code phases. The
design stays at the right altitude — decisions, trade-offs, and risks captured
without becoming a code dump — and the four decisions (D1–D4) each trace to spec
requirements and acceptance criteria. Approved.

## What I checked

### Faithfulness to the spec
- Every requirement (R1–R7) and acceptance criterion (AC1–AC7) maps to a decision
  or component. R1/R4/R5 → D1 (mechanism); R2 → D2 (magnitude); R3 → D3
  (`max()` composition); R6 + Out-of-Scope bullet 3 → D4 (uniform-additive);
  R7 → "Failure Modes → downstream consistency".
- The AC2 threshold `≥ MEASURE_START_PAD + BARLINE_POST_PAD − NOTEHEAD_RX`
  (= `1.0 + 0.7 − 0.6 = 1.1`) is carried verbatim from spec AC2. No scope drift:
  the doc explicitly excludes `measureLayout`, `leadingPad`, trailing/barline
  geometry, and `BARLINE_POST_PAD`'s value (only its stale doc-comment is
  softened), matching the spec's Out-of-Scope list.

### Technical soundness (verified against live code)
- **Placement** `:1974`–`:1991`: `leadInset = (localIdx > 0 ? sectionReserve : 0)
  + (m.noteAccidentalLead ?? 0)` and `cx = leadInset`. Confirmed.
- **Packing width** `:1767`: `m.contentWidth = ml.width + sectionReserve +
  noteAccidentalLead`. Confirmed.
- **Justify exclusion** `:1982`: `scaledContent = leadInset + scaledGrid`, with
  only `scaledGrid = ml.contentWidth * advanceScale` scaled; `leadInset` rides
  outside the scale. This is the mechanism that satisfies R4/AC5. Confirmed.
- **`max()` composition**: both `MEASURE_START_PAD` and `noteAccidentalLead`
  occupy the same pre-column slot, so `max()` is the correct combinator (not
  stacking). Today both = 1.0, so an accidental-opening note lands at the same
  measure-relative X as a plain one — exactly the AC3 rewrite.
- **Accidental glyph** `svg.js:751`: drawn at `note.x - acc.dx` with
  `dx = ACCIDENTAL_GAP + column·ACCIDENTAL_COL_STEP = 1.2` for column 0
  (`layout.js:671`). The glyph always draws left of the head (`1.0 − 1.2 = −0.2`),
  identical to today's `ACCIDENTAL_LEAD_EXTRA = 1` clearance. No regression.
- **`leadingPad` rejection**: `measureLayout` (`:794-844`) feeds `leadingPad`
  only into `ml.width` (`:817`/`:841`), never `ml.contentWidth` (`:826,833`
  accumulate advances only); and the per-column `col.x` it seeds (`:825,831`) is
  thrown away by the walk that rebuilds X from `cx = leadInset` (`:1987`). A grep
  confirms `col.x` has zero readers — the only `.columns` consumers are `:1988`
  (`col.onset`/`col.advance`) and `:2046` (`col.onset`). The doc's "placement
  no-op → packing/placement desync" reasoning is exactly right.

### Both-coordinate coupling invariant
- The doc names the packing/placement desync as the **primary failure mode**
  (Failure Modes section + Risks bullet 1) and instructs the plan/code phases to
  treat `:1767` + `:1974` as one coupled edit. Both sites are listed in the final
  edit set. This is the central correctness invariant and it is handled correctly.

### Dead-store removal
- Re-grepped `src/notation/*.js`: `m.noteAccidentalLead` field touch points are
  assigned `:1752` (local const), stored `:1763`, read `:1767` and `:1976`. Once
  `:1767`/`:1976` switch to `openingClearance`, the `:1763` store has no remaining
  reader and is correctly dropped; the local `const noteAccidentalLead` stays as
  the `max()` input. No lingering reader. Confirmed.

### Completeness
- **Measure-type coverage**: system-first (head note at `clef-block + RESERVE_PAD
  + MEASURE_START_PAD`), interior (`notes[0].x = 1.0`), section-first
  (`sectionReserve + openingClearance`, both additive), and empty (width 3.3 →
  4.3, zero-column forEach is a no-op, no NaN) are all addressed.
- **Downstream consumers**: notes/rests (`columnX.get` `:1438`), beams, ties/
  slurs (`measureX + note.x`), hairpins/point dynamics/ottava, standalone
  annotations (beat-0 → `leadInset` at `:1604,1642` — verified), and barlines
  (end bar moves with `measureRightX = x + scaledContent`; `repeat-start` left
  bar drawn at `x`, before the inset, stays flush). All ride the shifted frame.
- **Test contract**: AC1/AC4 (`:2117-2122`), AC2 (`:2030-2040`, with
  `strokes[0].x` being the leftmost stroke X = `measureRightX` for a regular bar
  — verified against `barlineSpec` `:1209-1262`), AC3 (`:2138-2161`), new AC5
  (justify invariance) and AC6 (`buildLayoutModel`-level empty measure). The
  baseline 263 (layout 216 + svg 47) is verified by running
  `npm run test:unit -- layout.test.js svg.test.js`; the expected post-change
  count 265 (263 + 2 new) is consistent. The runner caveat (Jest via
  `wp-scripts test-unit-js`, not vitest, not bare `jest`) is correctly called out.

### Right altitude
- The doc records architecture, decisions, trade-offs, and risks with concrete
  code shapes for the edit sites, but stops short of a full diff/implementation
  plan — appropriate for phase 2. Alternatives are considered for every decision
  (`leadingPad` for D1, `1.2` for D2, additive-stack for D3, equalize-system-first
  for D4), with the trade-offs explained rather than presented as the only option.

## Notes for later phases (non-blocking)
- The plan/code phases should re-grep `m.noteAccidentalLead` immediately before
  removing the `:1763` store to reconfirm no reader was added meanwhile (the doc
  already flags this).
- Comment hygiene: refresh `layout.js:1745-1749` and `:1971-1973` plus the
  `BARLINE_POST_PAD` doc-comment (`constants.js:117-122`, currently "Kept small so
  the opening note sits close to the bar") as the doc specifies.
