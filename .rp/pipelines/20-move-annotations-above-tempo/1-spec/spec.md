# Spec — Move annotations above the tempo marking (issue #20)

## Overview

The sheet-music renderer draws a vertical stack of markings above the top staff. Three kinds of marking can appear in that stack: **annotations** (free text attached to notes or measures), the **tempo** marking (the metronome mark, e.g. "♩ = 120"), and the **octaveShift** marking (the "ottava" bracket, e.g. 8va/15ma above the staff).

Today these stack, from top to bottom, as **tempo → octaveShift → annotations**: annotations sit nearest the staff, the octaveShift above them, and the tempo at the very top.

The owner wants the stack reordered so it reads, from top to bottom, **annotations → tempo → octaveShift**. In other words, the annotations move from the bottom of the stack (hugging the staff) to the top, while the tempo and octaveShift keep their existing relative order. This is a purely vertical reorder of the markings; horizontal spacing and layout must not change.

### Terminology

- **annotations** — free text attached per-note or per-measure and placed above the staff. Only the above-the-top-staff annotations participate in this stack; annotations placed elsewhere (below the top staff, in the gap between the two staves, or below the bottom staff) are not part of it.
- **tempo** — the single metronome mark drawn above the top staff for the whole grand staff. There is exactly one tempo per system; it is not per-hand.
- **octaveShift** — the rendered "ottava" bracket. The bracket that participates in this above-the-top-staff stack is the right-hand "above" (positive) octaveShift. Other octaveShift brackets (the left-hand "above" bracket, which renders in the gap between the staves, and any "below" bracket from a negative shift, which renders below its own staff) are not part of this stack.

## Requirements

### R1 — New vertical order
In the column of markings above the top staff, the markings must render, from top to bottom, as **annotations → tempo → octaveShift**. The annotation lane moves from nearest the staff (its current position) to the topmost position.

### R2 — Tempo and octaveShift keep their relative order
The tempo must remain directly above the octaveShift. Only the annotations move; the tempo-to-octaveShift relationship is unchanged. After the change the octaveShift becomes the lane nearest the staff, solely because the annotations vacated that position.

### R3 — Applies to both hands (correctly scoped)
The new order must benefit both hands. Because there is a single grand-staff-level tempo above the top staff, moving the annotations above that tempo serves both hands at once. The left-hand annotations and the left-hand "above" octaveShift bracket render in the gap between the two staves, and any "below" octaveShift renders below its own staff; these are structurally separate from the tempo's column and are **not** relocated by this change. No per-hand tempo is introduced.

### R4 — Subset behavior preserved
When only some of the three markings are present, the present marking(s) stack with no empty gap left for an absent marking:
- annotations only, or tempo only, or octaveShift only → the single present marking hugs the staff, exactly as today.
- annotations + tempo (no octaveShift) → annotations above, tempo hugging the staff.
- tempo + octaveShift (no annotations) → unchanged: tempo above octaveShift.

### R5 — Deep annotation stacks clear the tempo
A multi-line above-the-top-staff annotation stack (several annotation lines sharing the same note column) must reserve its full height as the topmost lane, so the entire stack sits above the tempo. The system's top margin grows as needed to fit the deepest stack. No annotation line may overlap the tempo or the octaveShift.

### R6 — No horizontal change
Horizontal spacing and layout must not change. This is a vertical reorder only. The horizontal positions of measures, the tempo, the annotations, and every other marking must be identical to before for the same input.

### R7 — No regression in unaffected regions
Everything outside the above-the-top-staff stack must be unchanged for the same input, including: annotations placed below the top staff, in the gap between the staves, or below the bottom staff; the left-hand "above" octaveShift bracket in the inter-staff gap; and any "below" octaveShift bracket. Dynamics, hairpins, ties/slurs, beams, and measure numbers are likewise unaffected.

### R8 — Top margin stays tight
When nothing sits above the staff, the top margin still collapses to its base value, exactly as today. The reorder must not introduce extra vertical padding for absent markings.

## Out of Scope

- Moving, restyling, or reordering annotations that are not in the above-the-top-staff stack (i.e. annotations below the top staff, in the inter-staff gap, or below the bottom staff).
- Any change to the left-hand "above" octaveShift bracket (inter-staff gap) or to any "below" octaveShift bracket.
- Introducing per-hand tempo marks; there is one system-level tempo by design.
- Any horizontal-spacing change, font/glyph change, or change to the song format or its validation.
- Changes to dynamics, hairpins, ties/slurs, beams, measure numbers, or any marking other than the annotations / tempo / octaveShift in the above-the-top-staff stack.

## Acceptance Criteria

- **AC1 — New order.** For a system carrying an above-the-top-staff annotation, a tempo, and a right-hand positive octaveShift, the vertical positions satisfy (higher on the page first): annotations above the tempo, the tempo above the octaveShift, and the octaveShift above the staff.
- **AC2 — Tempo/octaveShift unchanged relative to each other.** The tempo still sits directly above the octaveShift, and both still render at their existing lane positions; only the inter-lane ordering relative to the annotations changes.
- **AC3 — Annotation stack direction.** The above-the-top-staff annotation lane still grows upward (additional same-column annotation lines stack toward the top of the page), now anchored at the topmost position.
- **AC4 — Subset cases (R4).**
  - With only annotations + tempo present, the annotations sit above the tempo and the tempo hugs the staff.
  - With only tempo + octaveShift present, the tempo sits above the octaveShift (unchanged from today).
  - With only one of the three present, that marking hugs the staff.
- **AC5 — Deep stack (R5).** With two or more same-column above-the-top-staff annotations plus a tempo, the lowest annotation line is strictly above the tempo (the whole stack clears the tempo), and the system top margin grows to accommodate the stack.
- **AC6 — Unaffected lanes (R7).** For the same input, the left-hand "above" octaveShift bracket (inter-staff gap) and the annotation bands below the top staff, in the inter-staff gap, and below the bottom staff are unchanged. The existing relationship in which the right-hand "above" octaveShift sits above the left-hand "above" octaveShift remains intact.
- **AC7 — No horizontal change (R6).** For the same input, all horizontal positions (measure positions, the tempo's horizontal position, and annotation horizontal positions) are unchanged.
- **AC8 — Top margin tight (R8).** When nothing sits above the staff, the top margin collapses to its base value, as today.
- **AC9 — Test suite green.** The existing test suite passes after updating the single test that asserts the old top-to-bottom order to the new order. No other existing test requires changes; in particular the presence/content, horizontal-position, and above-vs-below checks remain valid.
