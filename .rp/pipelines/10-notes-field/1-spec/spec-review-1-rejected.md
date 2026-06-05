# Spec Review

## Verdict: rejected

## Summary

This is a strong, mostly-complete spec. It faithfully captures the two-mode notes model (per-event with implicit staff; standalone with required `staff` and optional `beat`), specifies the `chordSymbol` clean break exactly as the research resolved it (silent-ignore of legacy keys, no migration, no validator rejection, no token left in `src/`/`specs/`/`docs/`, one doc line), lists the validation rules as discrete testable rows, and correctly expresses rendering as capability + observable band + horizontal anchoring while keeping pixel/sp geometry, fonts, lane structure, and collision math in the design phase. I verified every load-bearing claim against the codebase: the band Y anchors (`rightStaffTopY/BottomY`, `leftStaffTopY/BottomY`), the `$defs`/`$ref` schema subset, the walker's `applySpecialCases` precedent (`bpm > 0`, keyed by `$defs` name), and the observable DOM attributes (`data-text`, `data-hand`, `data-measure`, `data-event-index`) all exist as described, so the spec is feasible. No HOW/design detail leaked into the requirements (the XSS requirement, item 19, correctly states the observable guarantee without naming `textContent`/`innerHTML`). I am rejecting only because the Acceptance Criteria under-test the rendering requirements relative to what the Requirements section promises: the mode × position matrix is exercised only on a partial diagonal, one explicit spec-level rendering requirement (over-content `beat` still renders) has no AC, and a couple of criteria are slightly looser than the requirement they back. These are concrete, low-effort fixes.

## Issues

### Issue 1: Rendering ACs do not cover the full mode × position matrix that Requirement 14 promises

**What's wrong:** Requirement 14 states that **all four positions render for both per-event and standalone notes** (8 cells: {above-RH, below-RH, above-LH, below-LH} × {per-event, standalone}). The rendering ACs (lines 94–97) only test four cells, and they form a diagonal that mixes modes: per-event above-RH, per-event below-RH, standalone above-LH, standalone below-LH. Nothing verifies that a **standalone** note renders in an RH position (above-RH or below-RH), nor that a **per-event** note renders in an LH position (above-LH or below-LH, i.e. an event in the `leftHand` array). An implementer could satisfy the literal ACs while leaving "standalone on the right-hand staff" or "per-event note on a left-hand event" broken, even though both are required behavior.

**Where in spec:** Acceptance Criteria → "Rendering — position and anchoring" (lines 94–97), backing Requirement 14 (lines 35–39).

**Suggestion:** Add ACs that close the matrix. At minimum: (a) a standalone note with `staff: "rightHand"` + `placement: "above"` renders above the RH staff top line; (b) a per-event note on a **left-hand** event with `placement: "below"` renders below the LH staff bottom line (or `placement: "above"` lands in the inter-staff gap). Together with the existing four, this exercises each band from both attachment modes.

**Why it matters:** The spec is the testable contract for downstream phases. If the ACs only cover a diagonal, the design/plan/code phases can legitimately build and "pass" a partial implementation, and the gap (e.g. standalone-RH or per-event-LH) won't surface until much later. The requirement explicitly says "for both per-event and standalone notes," so the ACs must demonstrate both modes reaching the staff positions.

### Issue 2: No acceptance criterion for the spec-level requirement that an over-content `beat` still renders

**What's wrong:** The spec makes two distinct claims about a large/over-content `beat`: (1) it is **valid** (validation AC line 89: `beat: 99` is valid), and (2) at render time it "still renders within the system, best-effort" (Out of Scope note, lines 61–62, which is the research's A5(e) spec-level requirement — clamp *math* is design, but "still renders" is spec). Claim (2) has no acceptance criterion. There is no rendering AC asserting that a standalone note with a `beat` exceeding the measure's content produces a visible node within the system.

**Where in spec:** Acceptance Criteria → "Rendering — position and anchoring" (no AC present); requirement is stated only in the Out of Scope note (lines 61–62).

**Suggestion:** Add an AC such as: "Given a standalone note with a `beat` larger than the measure's musical content, when rendered, then a text node still appears within the system's horizontal bounds (its exact clamped X is design-defined)." This makes the "best-effort still renders" guarantee testable while keeping the clamp math in design.

**Why it matters:** Without an AC, the only enforced behavior for `beat: 99` is that validation accepts it. An implementation that silently drops or off-screens an over-content note would pass every current AC yet violate the stated spec-level rendering guarantee. The spec deliberately admits these `beat` values; it must also pin down that they remain observable.

### Issue 3: The "below the right-hand staff" / "above the left-hand staff" coexistence in the inter-staff gap is required but never tested

**What's wrong:** Requirement 14 defines below-RH and above-LH as occupying the **same** inter-staff band, and Requirement 15 requires that the two remain distinguishable via observable staff. The "any rendered note exposes placement and staff" AC (line 98) tests observability generically, but no AC places a below-RH note and an above-LH note in the same band at once and asserts both render distinctly. This is the one band where two different (mode-or-staff) notes collide, and it is exactly the case Requirement 15 was written to protect.

**Where in spec:** Acceptance Criteria (lines 94–98), backing Requirements 14–15 (lines 35–40).

**Suggestion:** Add an AC: "Given a below-right-hand note and an above-left-hand note in the same measure, when rendered, then both render and each node's staff is observable, so the two are distinguishable even though they share the inter-staff band." (This can be folded into the coexistence AC group.)

**Why it matters:** The shared-band design is the single most fragile rendering case (two annotations competing for the same vertical region). Requirement 15 exists precisely to keep them distinguishable; leaving it without a dedicated AC means the hardest case is the least specified for testing.

### Issue 4: The horizontal-anchoring AC for a no-`beat` standalone note is weaker than its requirement

**What's wrong:** Requirement 17 says a standalone note with no `beat` "renders near the measure's left edge." The backing AC (line 101) relaxes this to "positioned near the measure's left edge (within the measure's horizontal bounds)." "Within the measure's horizontal bounds" is satisfied by *any* X in the measure, including the right edge — which would contradict "near the left edge." The parenthetical effectively guts the requirement it is meant to make testable.

**Where in spec:** Acceptance Criteria line 101, backing Requirement 17 (line 42).

**Suggestion:** Tie the no-`beat` position to a `beat: 0` reference instead of an absolute offset (which is correctly design-owned). For example: "Given a standalone note with no `beat` and another with `beat: 0` in the same measure, when rendered, then the no-`beat` note renders at (or near) the same horizontal position as the `beat: 0` note, and both render in the left portion of the measure (left of a `beat: 2` note)." This keeps the exact offset in design while giving the AC a concrete, falsifiable relation.

**Why it matters:** A spec-level AC must be falsifiable. As written, an implementation that renders a no-`beat` note at the measure's right edge would pass, even though that plainly violates Requirement 17. The relative-invariant framing (used well elsewhere for `beat: 0` vs `beat: 2`) should be applied here too.

### Issue 5: No AC pins the rest/note coverage of `notes` — events of `type: "rest"` are not addressed

**What's wrong:** Requirement 1 states a `notes` array may be carried by "an `event` (a note/rest in a measure's `rightHand` or `leftHand` array)," explicitly including rests. But every data-model and rendering AC uses note events; none confirms that a `notes` array on a **rest** event is valid and renders. Because the schema's `event` def covers both `type: "note"` and `type: "rest"`, and `notes` is a property of `event`, the intent is clearly that rests can carry notes too — but the spec never makes this testable, leaving it ambiguous whether per-event annotations on rests are in scope for v1.

**Where in spec:** Requirement 1 (line 13) says "note/rest"; Acceptance Criteria contain no rest-bearing case.

**Suggestion:** Either add an AC ("Given a `rest` event with `notes: [{ "text": "pedal", "placement": "below" }]`, when validated, then valid; when rendered, then the note renders anchored to the rest's column") or, if v1 intentionally restricts per-event notes to `type: "note"`, state that restriction explicitly in Requirements and Out of Scope. Right now the prose implies rests are included but nothing confirms it.

**Why it matters:** "pedal below a rest" is a realistic engraving case and the prompt's own pedal example is mode-agnostic. Leaving rest coverage implied-but-untested means two implementers could reasonably disagree on whether a `notes` array on a rest is supported — exactly the kind of ambiguity the spec exists to remove.
