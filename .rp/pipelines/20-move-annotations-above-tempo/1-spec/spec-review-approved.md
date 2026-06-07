# Spec review — APPROVED

**Spec:** `.rp/pipelines/20-move-annotations-above-tempo/1-spec/spec.md`
**Reviewer:** spec-reviewer
**Iteration:** N=1
**Verdict:** APPROVED

## Summary

The spec faithfully captures the owner's intent (vertical reorder to top-to-bottom
**annotations → tempo → octaveShift**, applied to both hands, with no horizontal
change), stays cleanly at requirements altitude (no file paths, function names, line
numbers, or block-reorder mechanics leak in), and carries a complete, testable set of
acceptance criteria. Scoping and out-of-scope are explicit and correct. No material gap
found.

## Faithfulness to owner intent

- Prompt goal (top→bottom: annotations → tempo → octaveShift) → **R1**, verbatim in
  intent. ✓
- Prompt constraint "apply to both hands" → **R3**, correctly scoped: one
  grand-staff-level tempo above the top staff, so moving annotations above it serves both
  hands; LH-above and below bands are structurally separate and not relocated; no per-hand
  tempo introduced. ✓
- Prompt constraint "do not change horizontal spacing/layout" → **R6** plus Out-of-scope. ✓

## Completeness: research R1–R10 → spec R1–R9

Every material research requirement is represented:

| Research | Spec | Notes |
|----------|------|-------|
| R1 new order | R1 | ✓ |
| R2 tempo/ottava keep relative order | R2 | ✓ |
| R3 single source of truth (`topMarginLayout`, reorder 3 blocks) | — | Deliberately omitted: pure design/implementation detail. Correct at requirements altitude; the design phase reintroduces it. Acceptable. |
| R4 both hands (scoped) | R3 | ✓ |
| R5 subset behavior | R4 | ✓ |
| R6 deep stacks clear tempo | R5 | ✓ |
| R7 no horizontal change | R6 | ✓ |
| R8 no regression in unaffected regions | R7 | ✓ |
| R9 top margin tight | R8 | ✓ |
| R10 update stale doc-comment | R9 | Generalized (see below). ✓ |

The only research requirement absent from the spec is R3 (single source of truth), which
is implementation guidance, correctly excluded at requirements altitude.

## R10 — the specific concern in the review brief

Research **R10** required updating the stale `topMarginLayout` doc-comment
(`src/notation/layout.js` ~2849–2856) that describes the OLD lane order. I verified the
source: the doc-comment at lines 2848–2856 does describe the old order ("the above-RH note
lane nearest the staff, then an above-staff ottava, then the tempo at the very top") and
would become stale after the reorder.

The spec did **not** drop this. It generalized R10 into **R9 — Keep documentation in
sync** ("Any documentation that describes the above-the-top-staff marking order … must be
updated to reflect the new top-to-bottom order … No documentation may continue to describe
the old order"), with a matching, verifiable **AC10** ("No documentation describing the
above-the-top-staff marking order still references the old order").

This is the correct requirements-altitude treatment: it preserves the *requirement* (no
documentation may describe the old order) while stripping the *implementation pointer* (the
specific file/line/function/comment). The omission of the line-level pointer is acceptable
for this project — naming the exact comment would be design detail — and the requirement
itself is fully retained and testable. R10 is faithfully represented, not lost.

## Testability of acceptance criteria

- AC1–AC8 are requirements-altitude restatements of research AC1–AC8 (the research
  versions cited exact variable names / line numbers; the spec versions describe the same
  observable relationships — positional ordering, subset cases, deep-stack clearance,
  horizontal invariance, margin collapse). All are objectively checkable. ✓
- AC1 retains all three positional relationships (annotations above tempo, tempo above
  octaveShift, octaveShift above the staff). ✓
- AC9 (suite green after updating the single order-asserting test) matches the verified
  test at `layout.test.js:2059` whose assertions (2066–2068) codify the current order. ✓
- AC10 (no doc describes the old order) is verifiable. ✓

## Altitude

Stays at requirements altitude throughout — describes *what* must be true, never *how*. No
file paths, function names, line numbers, constant names, or "reorder the if-blocks"
mechanics. The research's implementation pointers were correctly removed. ✓

## Scoping / Out-of-scope

Clear and complete, matching the research: below-staff annotation bands, LH-above ottava
(inter-staff gap), below ottavas, per-hand tempo, horizontal-spacing/font/song-format
changes, and unrelated markings are all explicitly excluded. ✓

## Verdict

**APPROVED.** No material gap. The R10 doc-comment requirement is preserved at the correct
altitude as R9/AC10; the only research item not carried (research R3, single source of
truth) is implementation detail correctly left to the design phase.
