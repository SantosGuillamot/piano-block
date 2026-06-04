# Design Doc Review

## Verdict: approved

## Summary

The design is sound, complete against the spec, and — unusually — every
load-bearing code claim it makes is accurate against the real `src/song/` and
`src/notation/` source. It correctly models the feature as a near-exact clone of
the existing tie/slur span pipeline diverging in three named places (flat
below-staff lane Y, two-line wedge renderer, layout-layer cross-system clip),
resolves all four spec open questions, and maps every acceptance criterion to a
concrete buildable element with an explicit coverage table. It stays at
architecture altitude (decisions, contracts, data flow) without sliding into a
step-by-step implementation plan or production code, and it is faithful to the
prompt's binding constraint: notation/rendering only, audio explicitly out of
scope. The one decision that touches existing behavior (the generic vs.
hairpin-scoped cross-system clip) is surfaced honestly as an owner-overridable
judgment call with both alternatives, trade-offs, and traces stated — not buried.
The few imprecisions I found are descriptive-level details in illustrative code
blocks, not architectural defects, and are noted below for the build phase rather
than as grounds for rejection.

## Verified Code Claims

Every claim the reviewer was asked to check, and several more, were verified
against the real code:

- **Schema enum location.** `tie`/`slur` are at `schema.js` lines 146–147 inside
  `$defs.event.properties`; the design's "add two optional fields alongside" is
  exact. The proposed `crescendo`/`decrescendo` `{ enum: ["start","stop"] }` is
  byte-for-byte symmetric.
- **No new validator logic.** The generic enum check (`validate.js` 120–128)
  produces exactly the message shape the test regex expects
  (`<path>: <value> is not one of the allowed values [...]`), and `validateObject`
  (191–198) only inspects declared properties, so a misspelled field is silently
  ignored. No pairing check exists. The design's "zero validator change" is
  correct.
- **`recordSpanMarkers` does not carry the lane Y.** Lines 2110–2134 push only
  `{ tie, slur, anchor, systemIndex }`; `anchor.y = staffBottomY +
  staffStepToY(anchorStep)` is the notehead Y, and neither `staffBottomY` nor
  `anchorStep` is stored — so the below-staff lane Y is genuinely unrecoverable
  from the entry, confirming the design's "one required change to the recording
  layer." `staffBottomY` is already a function parameter (line 2111) and is
  passed per-hand (`band.rightStaffBottomY` / `band.leftStaffBottomY` at call
  sites 1827/1834), so it differs by hand exactly as the design states.
- **No cross-system span clip exists; cross-system tie/slur is a garbage stroke.**
  `crossSystem` is computed at `buildSpanSpec` (layout.js:2211) and is the only
  occurrence in `src/` — nothing reads it (verified by grep). `renderSpan`
  (svg.js:823) unconditionally draws a single `M x1 y1 Q cx cy x2 y2`, and the
  `renderSystem` span loop (svg.js:311–313) dispatches every span to it. For a
  cross-system span the end coordinates are the foreign system's local frame
  drawn into the start system's `<g>` — a wrong stroke, but the path string is
  valid numbers so it does not throw. There are zero cross-system tie/slur tests.
  The design's "this is a must-do, not an inherited capability" is exactly right,
  as is its claim that today's behavior fails AC9's "within-system portion is
  drawn" while passing "never throws."
- **Two-enum-field shape can express the messa-di-voce hinge.** `resolveAllSpans`
  (2149) runs `matchSpans` once per kind over an independently projected stream
  (`stream.map(e => ({ marker: e[kind] }))`), and `matchSpans` (1102) holds all
  state in a local `pendingStart`. A hinge note carrying `crescendo: "stop"` and
  `decrescendo: "start"` is therefore a stop in the crescendo pass and a start in
  the decrescendo pass with no shared state and no conflict — the hinge is
  genuinely expressible, and the shared anchor guard (2161) protects a
  rest/unplaceable endpoint before any builder runs.
- **Clip insertion point.** `staffEndX = budgetSp - STAFF_MARGIN_X` is set at
  layout.js:1867, and the post-resolution loop (1882–1888) already holds both the
  span and `systems[sp.systemIndex]` (hence its `staffEndX`) in scope — the
  proposed clip location is reachable as described.
- **Honest decision-with-alternative.** The generic-vs-hairpin-scoped clip is
  presented with a recommended choice, a documented conservative alternative,
  trade-offs, an explicit "the plan/owner may down-scope," and traces to
  Req 11/19 and AC8/AC9. This meets the bar for a surfaced judgment call.
- **Supporting facts.** `line()` helper (svg.js:104), `renderOttava` dashed line
  `stroke-dasharray "0.6 0.4"` (954), `renderHandText` dynamic at `y: 3.5` (851),
  `INTRA_STAFF_GAP = 8` / `STAFF_HEIGHT_SP = 4` / `SYSTEM_BOTTOM_MARGIN = 5`, and
  the `buildLayoutModel(song, width)` test idiom (narrow width forces multiple
  systems) all check out and support the placement, degenerate-aperture, and
  testing-approach claims.

## Acceptance-Criteria Coverage

All ten ACs are addressed with a defined, non-throwing outcome, including the
three the reviewer was directed to scrutinize:

- **AC8 (existing markings unchanged):** tie/slur keep the byte-identical
  `buildSpanSpec` + `renderSpan` Bézier; hairpins use a separate builder +
  `renderHairpin`; the cross-system clip is a guarded strict no-op for every
  within-system span (the only case any test or example exercises), so
  within-system tie/slur output is provably unchanged. The only changed behavior
  is the previously-broken cross-system tie/slur path, and the design correctly
  flags that AC8 is satisfied either way for within-system spans.
- **AC9 (cross-system within-system portion drawn):** the explicit layout-layer
  clip to the start system's `staffEndX`, filed under the start system only, with
  the degenerate-safe `max(x1, min(x2, staffEndX))` clamp, draws the within-system
  portion and never a foreign-frame or backwards stroke — directly fixing the
  verified garbage stroke.
- **AC10 / degenerate near-zero-width span:** the constant aperture (never
  width-derived) removes any division by `(x2 − x1)`, so a two-note span at
  near-identical X draws two nearly coincident finite lines; the clip clamp
  composes safely with this without interaction. The single-note Req 17 case is
  correctly shown to be inexpressible by construction (one field holds one value),
  which cleanly distinguishes it from the in-scope two-note degenerate case.

## Notes for the build phase (non-blocking)

These are descriptive imprecisions in illustrative passages, not architectural
problems. The design explicitly defers exact code and tuning constants to the
plan/build phase, so none change the verdict.

1. **Hand-key naming in the data-flow sketch.** The data-flow diagram and the
   hairpin record sketch describe `hand` as `"right" | "left"`
   (design-doc.md lines ~161, ~187), but the real codebase uses
   `HANDS = ["rightHand", "leftHand"]` (layout.js:846). The contract is sound; the
   prose just abbreviates the key names. The build phase should use the actual
   `rightHand`/`leftHand` keys.

2. **`renderHairpin` `line()` arity.** The emit snippets call
   `line(x1, yCenter, x2, yCenter ± aperture/2)` with four arguments, but the real
   `line(x1, y1, x2, y2, width)` helper (svg.js:104) takes a fifth `width`
   argument (e.g. `STEM_THICKNESS`, as `renderOttava` and `staffLines` pass).
   Omitting it would emit an `undefined` stroke width. A trivial build-phase fix;
   the two-`<line>`s-in-a-`<g>` primitive choice itself is correct.

3. **Constant-name consistency for the test.** The schema-shape test asserts the
   two fields are `{ enum: ["start","stop"] }`; that matches the proposed delta
   and the existing `tie`/`slur` precedent — no action needed, just confirming the
   assertion is faithful to the real schema idiom.

These can be folded into the implementation plan without revisiting the design.
