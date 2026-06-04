# Review 1 — gradual-dynamics rendering polish

Owner review of the shipped crescendo/decrescendo feature (issue #7, PR #11), captured
as a post-pipeline review round. Two visual-placement refinements.

## Owner feedback (verbatim)

> * When there are dynamic, I want the crescendo to be below or above it, whatever is
>   the standard.
> * I want a light space between the crescendo and decrescendo when they are together.

### The attached reference image

The owner attached an annotated grand-staff render illustrating standard engraving:

- A treble/bass grand staff. First system: a `C` chord symbol above the staff, a
  tie/slur over the opening chord, and an **`mf`** dynamic set on the dynamics line
  below the treble staff.
- Second system (key/▽meter change, with an `8va` bracket above): a **`p`** dynamic
  followed immediately, **on the same horizontal line**, by a **decrescendo hairpin
  (`>`)** — the wedge begins a small distance to the right of the `p`, not on top of
  it. This is the desired dynamic-then-hairpin relationship.

So the standard the owner is pointing at: a point dynamic and a hairpin share the same
below-staff dynamics line, and when a hairpin begins where a dynamic sits, the hairpin
starts **after** the dynamic with a small clearance — they never overlap.

## Current behaviour (before this round)

- **Point dynamics** render as a `<text>` glyph at `y: 3.5` below the hand's staff
  bottom, centered (`text-anchor: middle`) on the note's X (`renderHandText`,
  `src/notation/svg.js`).
- **Hairpins** ride a flat lane at `yCenter = staffBottomY + HAIRPIN_LANE_DY (3.0)`
  and **begin exactly at the start note's X** (`buildHairpinSpec`,
  `src/notation/layout.js`). The lane (3.0) and the dynamic baseline (3.5) are ~0.5 sp
  apart, so a hairpin that begins on a note that also carries a dynamic is drawn
  **across the dynamic glyph** — the collision the owner is seeing.
- At a **messa-di-voce hinge** (one note carrying both `crescendo: "stop"` and
  `decrescendo: "start"`), the crescendo's `x2` and the decrescendo's `x1` are the
  **same value** (the hinge note's X), so the two open mouths of the `<` and `>` meet
  at a point with **no gap**.

## Approach for this round

1. **Dynamic ↔ hairpin clearance (feedback 1).** When a hairpin's start note carries a
   point dynamic, begin the wedge a small clearance to the right of the dynamic glyph
   (same lane), so the two sit on one line without overlapping — matching the reference
   image. The dynamic's marker is carried on the recorded stream entry; the start X is
   offset by an estimate of the dynamic glyph's half-width plus a fixed gap, clamped so
   it never runs past the wedge's end (degenerate-safe). Hairpins whose start note has
   no dynamic are unchanged.
2. **Messa-di-voce hinge gap (feedback 2).** When a crescendo's closing tip and a
   decrescendo's opening edge coincide on a shared hinge note, inset both by half a
   small fixed gap so a light space shows between the `<` and the `>`. Clamped so
   neither wedge is pushed backwards.

New tuning constants (sp), all owner-tunable next round:
`HAIRPIN_HINGE_GAP`, `HAIRPIN_DYNAMIC_GAP`, and a `DYNAMIC_ADVANCE_EM` advance estimate
for the bold-italic dynamic glyphs.

Notation-only; no change to audio scope. Within-staff/no-dynamic/non-hinge hairpins,
and all tie/slur output, stay unchanged.

### Scope note

Handles the common case the owner illustrated: a dynamic at the hairpin's **start**
note. A dynamic sitting mid-span (the hairpin passing beneath an interior dynamic) is
not specially routed in this round — flag for a later round if wanted.

## Outcome

Implemented (uncommitted, pending owner review):

- **`src/notation/constants.js`** — added `HAIRPIN_HINGE_GAP` (0.6 sp), `HAIRPIN_DYNAMIC_GAP`
  (0.6 sp), and `DYNAMIC_ADVANCE_EM` (0.6) — all tunable.
- **`src/notation/layout.js`** —
  - `recordSpanMarkers` now also carries the event's point `dynamic` on each stream entry.
  - `buildHairpinSpec` shifts the wedge's start X right past a start-note dynamic glyph
    (half-width estimate + `HAIRPIN_DYNAMIC_GAP`), clamped to the end X within a system
    (degenerate-safe), unclamped across systems (the staff-end clip trims the right edge).
  - New `insetHingeGap` post-process insets a crescendo↔decrescendo hinge by half
    `HAIRPIN_HINGE_GAP` on each side, symmetric about the shared hinge X, clamped so
    neither wedge reverses.
- **`src/notation/__tests__/layout.test.js`** — updated the messa-di-voce test to expect
  the symmetric gap; added 5 tests for the dynamic clearance (shift, no-dynamic no-op,
  short-span clamp, cross-system unclamped, full-model flow-through).

Gates: `npm run test:unit` 622 passing; `npm run lint` clean.

Tuning values (`HAIRPIN_HINGE_GAP`, `HAIRPIN_DYNAMIC_GAP`, `DYNAMIC_ADVANCE_EM`) are
first-pass — adjust on the owner's visual review.
