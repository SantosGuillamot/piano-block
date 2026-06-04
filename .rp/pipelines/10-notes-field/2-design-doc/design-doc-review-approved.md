# Design Doc Review

## Verdict: approved

## Summary

This is a strong, codebase-grounded design and the revision cleanly resolves all four points
from the prior rejection — each re-verified against the actual source, not just the prose. The
`chordSymbol` removal inventory now reads **12** files everywhere, and a fresh
`grep -rln "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/ docs/ README.md` returns
exactly those 12 files, matching the doc's enumerated list one-for-one. The inter-staff gap flex
and the dynamics dodge are now reconciled around a single `*_stack` definition that folds the
`DYNAMICS_LANE_RESERVE` baseOffset into both the per-note baseline and the flex `max(...)`; I
simulated the full occupancy space and a dynamics-dodged below-RH note provably never enters or
crosses the LH staff (worst case: the furthest glyph bottom lands tangent to `leftStaffTopY`, with
the baseline always ≥ the glyph descent above it). The dynamics row at `rightStaffBottomY + 3.5`
(`svg.js:851`), the single `lhTopY = rhBottomY + INTRA_STAFF_GAP` reorder site (`layout.js:1684`),
the declared-vs-unknown property distinction (`validate.js:191-198`), and the two-coordinate-frame
emit (measure `<g>` has no Y translate, `svg.js:471`; hand `<g>` translates to `staffBottomY` with
`chordDy = bandY − staffBottomY`, `svg.js:479-486,516`) all check out exactly as described. The
measure-walk scope variables the standalone-note interpolation needs (`columnX`, `leadInset`,
`measureRightX`, `advanceScale`, `ml.columns`, `ml.measureEnd`) are all present at the resolution
site. A fresh adversarial pass found full spec coverage (all 20 requirements traced to a decision),
correct rest-event handling, sound scope discipline (no auto-migration, no spanning/section-level
creep), credible alternatives and trade-offs throughout, and the doc held at design altitude. No
must-fix issues remain.

## Issues

None blocking.

### Optional (non-blocking) — proof-prose nuance in the PAIR A reconciliation

The collision-safety prose (Key Decisions → "Four placement bands …", final paragraph) justifies
"the furthest below-RH baseline … is strictly above `leftStaffTopY`" via
"`aboveLH_stack ≥ NOTE_GAP_STAFF + DESCENT > 0`." That justification only applies when above-LH
notes are present. When `nAboveLH = 0`, the gap reserves only `belowRH_stack`, so the strictness
comes instead from `belowRH_stack − DESCENT < belowRH_stack ≤ effectiveInterStaffGap` (the baseline
is above by exactly `DESCENT`; the glyph bottom lands tangent to `leftStaffTopY`). The conclusion —
a dodged below-RH note never enters or crosses the LH staff — holds in all cases (verified by
simulation across every occupancy combination), and two implementers reading the formula block
compute identical geometry regardless. This is a prose-completeness nit, not a design defect; it can
be tightened in passing during the plan/code phase if convenient. Approval does not depend on it.
