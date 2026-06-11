# Spec review — approved

Reviewer: spec-reviewer
Verdict: **APPROVED** (iteration 2, after revision commit 936936f)

## Resolution of rejection 1

- **B1 (blocking) — resolved.** R1 no longer offers the emit-time alternative.
  It now mandates applying the `±NOTEHEAD_RX` offset inside `beamGeometry`
  (`src/notation/layout.js`) and requires `renderBeam`
  (`src/notation/svg.js`) to draw the received X values verbatim. This is
  internally consistent with R6 items 1-2 and AC7, which assert the shifted
  values on `beamGeometry`'s output.
- **N1 (non-blocking) — resolved.** R6.2 scopes the first/last-stem endpoint
  equality to the level-1 primary beam and states the correct per-kind
  expectations for secondary beams (adjacent shifted stem X's) and
  partial-beam stubs (one endpoint at a shifted stem X, stub length
  unchanged).

## Verification summary

All factual claims were verified against the code in iteration 1 and hold:

- Standalone edge offset in `renderStem` (`src/notation/svg.js:785`); flag
  uses the same offset (svg.js:801).
- Beamed stems built from raw `m.x` in `beamGeometry`
  (`src/notation/layout.js:529-533`); beam segments and stubs likewise derive
  from `members[i].x` (layout.js:538-569).
- Single group direction per beam via `stemDirectionForChord`
  (layout.js:506-512) — the shift is a rigid translation.
- Exactly one consumer of beam geometry: `renderHand` → `renderBeam`
  (svg.js:670, 817-833); the `indices` field is never read; no spacing,
  anchoring, or packing code reads stem/beam X.
- `NOTEHEAD_RX = 0.6` (`src/notation/constants.js:30`); call-site guard
  `members.length >= 2` (layout.js:1557-1558).
- The lone pinned expectation `{ level: 1, x1: 0, x2: 4 }` in an asserted
  stem-up group (`src/notation/__tests__/layout.test.js:524`) — shifted
  endpoints become 0.6 / 4.6, exactly as R6.1 requires.

The spec covers the intent (beamed stems attach at the notehead edge like
standalone notes), the requirements are testable and mutually consistent, the
out-of-scope list matches the research findings, and the acceptance criteria
are verifiable against the stated test surface.
