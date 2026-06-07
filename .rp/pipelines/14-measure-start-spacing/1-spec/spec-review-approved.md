# Spec Review

## Verdict: approved

## Summary

The spec faithfully solves the owner's stated problem — more horizontal lead-in
space before the first note of every measure, on both staves — without scope
drift. Every claim it makes about the current layout layer was verified against
the code (`leadInset` placement at `layout.js:1974-1991`, the `contentWidth`
packing rail at `:1767`, `firstColumnHasAccidental` at `:2214`, ottava bracket X
derivation at `:2936`, `barlineTrailingPad` at `:1272`, and the constant values
`NOTEHEAD_RX=0.6`, `BARLINE_POST_PAD=0.7`, `MIN_ADV=2.2`,
`ACCIDENTAL_LEAD_EXTRA=1`). The referenced test assertions exist exactly where
cited, and the current suite passes (216/216 in `layout.test.js`), so the
"replace assertion X at line N" instructions are coherent. The acceptance
criteria are concrete and verifiable; edge cases (system-first, interior,
section-first, empty, leading rest, accidental-opening, justify invariance, and
no-regression for beams/ties/slurs/hairpins/dynamics/ottava/annotations/barlines)
are all covered and grounded in real code paths. The three flagged autonomous
decisions hold up under scrutiny (detail below). Requirements stay at the right
altitude: the mechanism (whether to thread the lead-in through `leadInset` or the
unused `leadingPad` option) is correctly deferred to phase 2, and the system-first
vs interior balance is left as explicit design latitude while the testable
outcome (boundary→notehead gap) is pinned.

## Checks performed and why they pass

### Flagged decision 1 — `MEASURE_START_PAD = 1.0 sp` magnitude (autonomous)

Well-reasoned and testable. 1.0 sp aligns with the peer constants `RESERVE_PAD=1`
and `ACCIDENTAL_LEAD_EXTRA=1`, sits below `MIN_ADV=2.2` so the opening gap never
exceeds the smallest note-to-note advance, and yields a visible barline→notehead
gap of ~1.1 sp (about one notehead width) versus ~0.1 sp today. The spec pins it
as a `toBeCloseTo(MEASURE_START_PAD)` assertion (AC1, AC5), so it is exactly
verifiable. The Out-of-Scope note correctly preserves design latitude (1.2 for a
roomier look) without weakening the default contract.

### Flagged decision 2 — `max()` composition with the accidental lead (autonomous)

Justified and non-regressive. Both terms occupy the same pre-first-column slot;
the accidental lead is space a glyph fills, the start pad is empty air, so taking
the larger of the two (not stacking) keeps every measure's first note at a
uniform X. Verified against code: the accidental glyph X is `noteX − (ACCIDENTAL_GAP
+ column·step)` (`layout.js:671`), independent of the lead-in, so it always draws
left of the notehead. With `max(1.0, 1.0)=1.0` the accidental note lands at the
same relX as a plain note and the glyph sits ~0.2 sp left of the boundary —
identical to today's `noteAccidentalLead=1.0` behavior, i.e. no clearance
regression. AC3 captures exactly this (same relX in both cases + glyph X <
notehead X).

### Flagged decision 3 — system-first vs interior balance, and AC2's threshold

Correctly handled. The spec makes the uniform-additive lead-in the default but
explicitly relegates "equalize system-first against interior" to Out of Scope as
a viable phase-2 alternative, while pinning the required outcome (the
boundary→notehead gap). AC2 is a clean `≥` guarantee, not over-fitted: I traced
`first-note-center-X − barlineX = MEASURE_START_PAD + barlineWidth + BARLINE_POST_PAD
≈ 1.83 sp` against the asserted floor `MEASURE_START_PAD + BARLINE_POST_PAD −
NOTEHEAD_RX = 1.1 sp`, so it holds with margin. Crucially it holds with margin
for every interior measure in `COMPREHENSIVE_SONG`, including measure 2 (whose
left hand opens on an accidental `F2#`, so clearance = max-rule = 1.0) and the
mid-system section-first measure 3 (whose cautionary glyphs push the first note
even farther right). The `≥` form is robust to all these, which is exactly why it
is not over-fitted to one arithmetic value.

### Completeness / edge cases

- System-first / score-first: R6 + Out-of-Scope; verified the head reserve
  (`RESERVE_PAD`) genuinely precedes the note and the lead-in stacks on it.
- Interior: R1/R2, shared `columnX` confirmed (`layout.js:1986-1991`).
- Section-first: R6 states the lead-in adds to `sectionReserve`; matches the
  separate-and-additive `sectionReserve` term at `layout.js:1975`.
- Empty measure: AC6; the empty-grid short-circuit returns `columns: []` and
  `EMPTY_MEASURE_WIDTH`, so widening by the clearance cannot NaN/throw.
- No regressions: R7 enumerates beams/ties/slurs/hairpins/point-dynamics/ottava/
  annotations/barlines; I confirmed ottava brackets (`layout.js:2936`) and spans
  derive from `measureX + note.x` and therefore track the shift automatically; a
  `repeat-start` left bar is drawn at the measure's left edge `x` (before the
  lead-in), so it stays flush.

### Testability / internal consistency / altitude

- Every AC is a concrete Jest assertion against named coordinates with explicit
  line-number targets; the suite passes today, so the swap instructions are
  coherent.
- R4/R5 phrase the packing-width fold as a correctness invariant (wrapping and
  justify must stay correct, lead-in unscaled by justify) — behavior, not
  mechanism.
- The spec names the constant and references test lines but does not lock how the
  lead-in is wired (leadInset vs the unused `leadingPad` option), leaving the
  mechanism to phase 2. For a pure-geometry change where the behavior *is* the
  geometry, referencing the test contract is appropriate and keeps the ACs
  verifiable rather than vague.

No contradictions found between Requirements, Acceptance Criteria, and Out of
Scope.
