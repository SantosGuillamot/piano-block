# Spec Review

## Verdict: approved

## Summary

The revised spec fully resolves both findings from the first rejection and holds
up under a fresh adversarial pass. It remains a well-disciplined, WHAT-only spec:
it faithfully carries the research's consolidated requirements into testable
requirements 1–20, keeps the audio-out-of-scope boundary binding and explicit,
and leaves every design/implementation decision open (data shape and direction
encoding OQ-2, placement lane OQ-4, cross-system rendering mechanics OQ-3,
text-form opt-in OQ-1) rather than pre-resolving them. I re-verified the
load-bearing codebase claims and they continue to hold: `matchSpans` is a
depth-1, dangling-safe, never-throwing matcher (layout.js:1102–1120);
`resolveAllSpans` skips a pair when either anchor is null (layout.js:2161–2163);
`buildSpanSpec` sets a `crossSystem` flag whose comment promises the emit layer
"clips to system edges" (layout.js:2210–2211) while `renderSpan` actually draws a
plain `M…Q…` path with no clip logic (svg.js:823–833) — confirming OQ-3's stated
code risk is real and unverified; point dynamics sit at a fixed below-staff
`y: 3.5` (svg.js:845–859); the `tie`/`slur` enums and permissive
`additionalProperties` are as described (schema.js:144–147); and a grep confirms
there are zero existing tests for cross-system or degenerate-width spans,
matching the research's two flagged gaps. Both gaps are now carried into the spec
with defined, testable, non-crash outcomes. I found no genuine new blocking
issue and am approving.

## Resolution of the prior rejection

**Prior Issue 1 — cross-system wrap had a MUST-minimum but no acceptance
criterion: RESOLVED.** The revised spec adds Requirement 19 (a span whose
endpoints fall on two different rendered systems MUST NOT throw, MUST NOT corrupt
any other marking, and at minimum draws the within-system portion; full split
rendering left to Design per OQ-3) and AC9 (the same minimum in Given-When-Then
form, explicitly disclaiming the full split). The cross-system case is also added
to the AC6 never-throws enumeration. OQ-3 is updated to point at Requirement 19
and AC9 and to state that only the non-crash minimum is pinned. The highest-risk
behavior now has a test hook.

**Prior Issue 2 — degenerate near-zero-width two-note span was dropped:
RESOLVED.** The revised spec adds Requirement 18 (a two-note span whose endpoints
land at near-identical X MUST NOT throw; visual output unspecified beyond not
crashing) and AC10 (the same in Given-When-Then form). Requirement 18 explicitly
distinguishes itself from the single-note out-of-scope case in Requirement 17,
and the case is added to the AC6 enumeration. The second of the two render-risk
gaps the research instructed the spec to carry is now present with a defined,
testable outcome.

## Full re-review notes (non-blocking)

- **Renumbering is internally consistent.** Appending Requirements 18 and 19 and
  renumbering the old validation requirement to 20 did not break any
  back-reference. Every AC's parenthetical requirement citation checks out: AC1→1,
  2, 20; AC2→3, 11; AC3→6, 7; AC4→9; AC5→3, 20; AC6→12, 13, 14, 18, 19; AC7→4;
  AC8→11; AC9→19; AC10→18.
- **AC6 / AC9 / AC10 overlap is intentional reinforcement, not contradiction.**
  AC6 is the consolidated never-throws sweep; AC9 and AC10 are dedicated
  single-case criteria that add specificity (AC9 additionally asserts the
  within-system portion is drawn; AC10 explicitly asserts no particular shape).
  They agree with AC6 and strengthen it.
- **SHOULD/MAY items and documented simplifications lack dedicated ACs, which is
  appropriate.** Requirements 5, 8, 10, 15, and 16 are SHOULD/MAY, design-deferred
  (OQ-1/OQ-4), or hard-to-automate legibility properties; the spec is honest that
  the placement lane and text form are Design/owner decisions, so the absence of
  ACs for them is correct rather than a gap.
- **Scope discipline holds.** The spec stays at the WHAT altitude throughout. The
  `<`/`>` hairpin wedge is pinned as the visible notation outcome (correct to
  require), while data shape, field names, rendering primitives, placement lane,
  and cross-system mechanics are all explicitly deferred to Design.
- **Audio-out-of-scope is preserved faithfully** in the Overview, the requirement
  framing, and as the first Out of Scope bullet, matching the binding phase-0
  constraint.
- **Standalone-ness holds.** Terminology (gradual-dynamic span, point dynamic,
  hairpin) is defined up front; the spec is comprehensible without the research.
