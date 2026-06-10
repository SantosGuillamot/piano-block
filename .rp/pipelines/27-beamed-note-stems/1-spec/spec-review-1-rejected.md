# Spec review — rejection 1

Reviewer: spec-reviewer
Verdict: **REJECTED**

The spec is close. Every factual claim was verified against the code and holds:
the standalone edge offset in `renderStem` (`src/notation/svg.js:785`), the raw
`m.x` stems in `beamGeometry` (`src/notation/layout.js:529-533`), stubs derived
from `members[i].x` (layout.js:566-569), the single consumer (`renderBeam` via
`renderHand`, svg.js:670/817-833 — the `indices` field on beam records is never
read), `NOTEHEAD_RX = 0.6` (constants.js:30), the call-site guard
`members.length >= 2` (layout.js:1557-1558), and the lone pinned expectation
`{ level: 1, x1: 0, x2: 4 }` in an asserted-up group
(`src/notation/__tests__/layout.test.js:524`). Coverage of the intent, the
out-of-scope list, and the acceptance criteria are otherwise sound.

The rejection is for one internal contradiction between MUST-level
requirements.

## Blocking

### B1 — R1's emit-time alternative contradicts R6 and AC7

R1 says applying the offset at emit time in `renderBeam`
(`src/notation/svg.js`) "is an acceptable alternative." But R6 items 1-2 and
AC7 **require** layout-level test changes that only hold if the offset is
applied inside `beamGeometry`:

- R6.1 requires updating the existing `beamGeometry` expectation at
  layout.test.js:524 to the shifted endpoints (0.6 / 4.6 for the up-group).
- R6.2 requires new assertions that `stems[i].x === members[i].x ± NOTEHEAD_RX`
  on `beamGeometry`'s output.

If the implementer takes R1's blessed alternative and shifts X in `renderBeam`,
`beamGeometry`'s output is unchanged and the R6 assertions are unsatisfiable as
written. AC8's scope line (no changes outside layout.js, svg.js,
layout.test.js) doesn't disambiguate either, since it permits both files.

**Fix (pick one):**

1. (Recommended) Remove the emit-time alternative from R1 and state that the
   offset MUST be applied in `beamGeometry` (`src/notation/layout.js`), where
   the group direction is already known. This is the option the rest of the
   spec already assumes, and it keeps stems, primary/secondary beams, and stubs
   shifting together from one place.
2. Keep the alternative, but make R6 items 1-2 explicitly conditional on the
   fix location, and add an equivalent emit-level test requirement
   (svg.test.js) for the `renderBeam` variant so AC7 is satisfiable either way.

Option 1 is strongly preferred — a spec offering two implementations but
testing only one is a trap, and there is no stated benefit to the emit-time
variant.

## Non-blocking (fix in the same pass)

### N1 — R6.2 "beam segment x1/x2 equal the first/last shifted stem X" is over-broad

That equality holds for the **primary** beam only. Secondary beams span
*adjacent* stem X's (layout.js:543-545), and stubs have one free endpoint at
stem X ± `NOTEHEAD_RX * 1.5` (layout.js:565-569). As written, a coder could
assert it over all segments and write a failing or wrong test. Scope the
first/last-stem assertion to the primary beam (level 1), and either drop the
general clause or state the per-kind expectations (secondary: adjacent shifted
stem X's; stub: one endpoint at a shifted stem X, length unchanged).
