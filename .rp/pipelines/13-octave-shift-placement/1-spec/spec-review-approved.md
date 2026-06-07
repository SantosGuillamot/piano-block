# Spec review — APPROVED (#13 Fix octaveShift ottava placement)

Reviewer: `spec-reviewer` (adversarial pass). Verdict: **APPROVED**.

## What was reviewed

- `0-prompt/prompt.md` (the issue)
- `1-spec/spec-research.md` (decided requirements + evidence)
- `1-spec/spec.md` (document under review)

I also re-read every cited code anchor in `src/notation/` to validate the spec's
technical claims rather than trust the research summary.

## Claim verification against code (all confirmed)

- **Bug 1 root cause.** `buildSystemTexts` (`layout.js:2859`) emits the ottava in
  `flush` (`2899-2922`). The "above" branch hardcodes `band.ottavaAboveLaneY`
  (`2916-2917`) regardless of hand; the "below" branch is per-hand via
  `staffBottomY` = `rightStaffBottomY`/`leftStaffBottomY` (`2905-2906`, `2918`).
  Matches R1.1/R1.2/R1.4 exactly.
- **Bug 2 root cause.** `run.xs` is populated only from `laid.notes`
  (`2935-2937`); `flush` early-returns when `run.xs.length === 0` (`2904`); the
  span is `min(xs) − NOTEHEAD_RX` … `max(xs) + NOTEHEAD_RX` (`2911-2912`). So a
  rest-only system portion drops the bracket, and a sparse run under-spans —
  both as R2.1/R2.2 describe.
- **Top-margin over-reservation.** `systemHasOttavaAbove` (`2649-2652`) returns
  true when EITHER hand has `octaveShift > 0`; `topMarginLayout` (`2821-2825`)
  reserves `ottavaAboveLaneY` and deepens the top margin on that trigger.
  Matches R1.5.
- **Inter-staff gap flex.** `effectiveInterStaffGap` (`1859-1862`) flexes only on
  `belowRHStack`/`aboveLHStack`; it accounts for no ottava and no raw LH ledger
  extent. Matches R1.3's "must grow to include this lane."
- **Band Y refs** (`1875-1881`) and `aboveLH.baseY = lhTopY − NOTE_GAP_STAFF`
  (`1905`) exist as stated.
- **`ottavaFor`** (`1077-1086`) mapping is exactly as Out of Scope states.
- **Constants / measure model.** `NOTEHEAD_RX = 0.6` (`constants.js:30`),
  `EMPTY_MEASURE_WIDTH = 3.3` (`constants.js:70`), and `measureModels[i]` carries
  `x` and `width` (`layout.js:2069-2079`). All referenced quantities are real.

## Adversarial assessment

- **Standalone completeness — PASS.** The "Key facts about the current layout"
  section gives a reader the band Y-references, the inter-staff gap,
  `systemHasOttavaAbove`, and measure-edge semantics without needing the research
  file or the source.
- **Faithfulness — PASS.** R1/R2 map 1:1 to the research's DECIDED REQUIREMENTS.
  Both bugs are captured, including the correct re-attribution of Bug 2 (not
  RH-specific, not first-line-specific; it is rest-only/sparse run-portions).
- **Scope — PASS.** Focused bug fix covering both the placement bug (LH-above)
  and the rest-only-span/consistency bug. Below-staff behavior is explicitly left
  unchanged (R1.4). No feature creep.
- **Out of Scope — CORRECT.** Excludes `ottavaFor` sign→label/placement mapping,
  the song schema / field semantics, and the SVG `renderOttava` draw layer. No
  schema or `renderOttava` change is smuggled in.
- **Edge cases — COVERED.** Multi-system spans (R2.3, test #5), both-hands-above
  coexistence (R1.6, test #3), and the LH-only top-margin reservation (R1.5,
  test #2) are all present.
- **Testability — PASS.** Acceptance criteria reference real quantities
  (`band.ottavaAboveLaneY`, `band.leftStaffTopY`, `NOTEHEAD_RX`, measure extent).
  The LH-above `y` is asserted relationally (in the gap, above the notes, no
  overlap) rather than as a magic number, which is correct for the spec phase —
  it is verifiable against `band` Ys and note Y-extents while leaving the exact
  offset to design.
- **No design smuggling.** R1.3 explicitly defers exact geometry to design/plan
  ("the requirement is no-overlap + bracket sits ABOVE the annotated LH notes").
  R2.2's span rule is a behavioral/observable requirement (where the bracket
  visually spans), not an arbitrary implementation choice, and was an explicit
  research decision; it belongs in the spec.

## Non-blocking observations (no action required)

- The spec omits the research's explicit "Key code anchors" list. This is
  appropriate: anchors are an implementation aid for design/plan, and keeping
  them out of the requirements doc avoids constraining the design. Not a defect.
- R2.2's left-start refinement ("first note's X − NOTEHEAD_RX when present") is
  fairly concrete, but it preserves an existing observable behavior and is the
  decided rule; acceptable at spec altitude.

## Verdict

No substantive problems found. The spec is complete, faithful, correctly scoped,
and testable, with every load-bearing technical claim validated against the code.

**APPROVED.**
