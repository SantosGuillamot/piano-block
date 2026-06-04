# Spec Review

## Verdict: rejected

## Summary

This is a strong, well-disciplined spec. It faithfully carries the research's
consolidated requirements (R0–R5) into testable requirements 1–18, keeps the
audio-out-of-scope boundary binding and explicit, and — importantly — does NOT
bake in design/implementation decisions: the new field name(s), the span data
shape and direction encoding (OQ-2), the placement lane (OQ-4), the cross-system
rendering (OQ-3), and the text-form opt-in (OQ-1) are all left open for Design
rather than pre-resolved. I verified the load-bearing codebase claims and they
hold: `matchSpans` is a depth-1, dangling-safe, never-throwing matcher
(layout.js:1102-1120); `renderSpan` draws a plain `M…Q…` path with no clip logic
(svg.js:823-833) and there are zero cross-wrapped-system span tests, confirming
OQ-3's stated code risk is real; the schema enums and permissive
`additionalProperties` (schema.js:144-147), the structural/enum-only validator
(validate.js:263-271), the below-staff point-dynamic text (svg.js:845-859), the
additive-growth rules (song-format.md:259-266), and the total absence of any
audio/playback/velocity/MIDI code are all exactly as the spec describes. I am
rejecting on two specific, actionable gaps in the edge-case / acceptance-criteria
coverage — both fixable without restructuring the spec. Addressing them will make
the spec airtight; the rejection is to tighten coverage, not to redirect.

## Issues

### Issue 1: The highest-risk behavior (cross-system wrapping span) has a stated MUST-minimum but no acceptance criterion

**What's wrong:** OQ-3 (and the underlying research finding Q2#7) flags the
cross-wrapped-system case as the one area with verified code risk — `renderSpan`
draws a plain path with no visible clipping and there is no test exercising a span
whose endpoints land on different systems. The spec correctly states a
MUST-minimum for it: "rendering the within-system portion correctly and never
crashing is the minimum" (Section: Open Questions, OQ-3, lines ~191–192). But the
Acceptance Criteria do not pin this minimum anywhere. AC4 covers only "different
measures of the *same* rendered system." AC6 enumerates the never-throws inputs —
dangling start, dangling stop, double start, rest endpoint, two overlapping
same-kind spans — but omits a span that wraps across two systems. So the single
behavior most likely to regress or throw has a requirement but no test hook.

**Where in spec:** Acceptance Criteria (AC4, AC6) vs. Open Questions OQ-3.

**Suggestion:** Add an acceptance criterion (or extend AC6) asserting, in
Given-When-Then form, that a span whose start and end fall on two different
rendered systems renders without throwing and without corrupting other markings,
with the within-system portion drawn — i.e., pin the OQ-3 MUST-minimum as a test.
Keep the full split-with-open-mouth rendering as the SHOULD/MAY that OQ-3 already
leaves to Design; only the non-crash minimum needs an AC.

**Why it matters:** A MUST with no acceptance criterion is not testable and is
the easiest thing for downstream Code to under-deliver on — especially here,
where the inherited machinery is verified to lack the needed clipping. Without an
AC, "never crashes on a wrapping span" can silently slip through, which is the
exact failure mode the research warned about.

### Issue 2: One of the two edge-case gaps the research explicitly told the spec to call out — the degenerate near-zero-width span — was dropped

**What's wrong:** Research Q2 closes with an explicit instruction: "Two gaps the
spec must call out as edge cases / open design risks: (a) cross-WRAPPED-SYSTEM
clipping (case 7 caveat); (b) degenerate single-/zero-width span (case 6)." Gap
(a) was carried in as OQ-3. Gap (b) was not. Requirement 17 only declares the
*single-note* span out of scope (conceptually degenerate, and per Q2#6 "not
expressible per kind" anyway). It does not address the distinct, real render risk
from Q2#6: a span whose start and end land on two *different but near-identical-X*
notes produces a near-zero-width wedge, and the existing machinery has "no
min-length guard" and "no test pins the degenerate-width case." That is a
notation/rendering behavior with no defined, testable outcome in the spec, even
though Section "Edge cases" opens with "each must have a defined, testable
outcome."

**Where in spec:** Edge cases (Requirement 17 covers only single-note;
Requirements 12–16 do not cover near-zero-width). Compare spec-research.md Q2#6
and the closing "two gaps" instruction.

**Suggestion:** Either (a) add an edge-case requirement giving a defined, testable
outcome for a near-zero-width span (e.g., "MUST NOT throw; output for a
degenerate-width span is unspecified beyond not crashing," mirroring the
overlapping-spans treatment in Req 14), or (b) record it as an explicit open
design question alongside OQ-3, since it shares the same "inherited machinery is
untested here" character. A one-line addition suffices; no restructuring needed.

**Why it matters:** The research deliberately surfaced exactly two render-risk
gaps and instructed the spec to carry both. Carrying only one leaves a known,
codebase-verified rough edge with no requirement and no AC, which undercuts the
spec's own "each edge case must have a defined, testable outcome — never a crash"
promise.
