# Spec review — Issue #21: Space notes horizontally according to their duration

**Verdict: APPROVED.**

The spec is complete, testable, internally consistent, accurately grounded in the
codebase, and correctly scoped. All blocking criteria are met. The few items below
are non-blocking nits.

## Method

I read `spec.md`, `spec-research.md`, and `0-prompt/prompt.md`, then independently
verified the spec's load-bearing claims against the worktree source:

- **Formula** `advance(Δ) = MIN_ADV + ADV_K·sqrt(max(Δ,0)) + extra` —
  `src/notation/layout.js:778-780`. Matches the spec exactly.
- **Constants** `MIN_ADV = 2.2`, `ADV_K = 3.0`, `EMPTY_MEASURE_WIDTH = 3.3`,
  `MEASURE_START_PAD = 1.0`, `MAX_STRETCH = 1.6` —
  `src/notation/constants.js:64,67,70,79,84`. All match.
- **Duration table** `BASE_DUR` (whole 4 … thirty-second 0.125) and
  `DOT_MUL` (1 dot ×1.5, 2 dots ×1.75) — `constants.js:262-275`. Confirms
  dotted-quarter = 1×1.5 = 1.5 qb, strictly between quarter (1) and half (2).
- **A note owns the gap to the next onset** — the per-column advance is
  `advanceFor(grid[i+1] − onset)` and the last column gaps to
  `measureEnd = max(handEnds, 0)` — `layout.js:842-848,818`. Confirms R2 and the
  "left note's duration governs its column" mechanism.
- **Time-signature-blind** — `measureLayout` never reads `timeSignature`;
  `measureEnd` derives from `handEnd`, not the metre — `layout.js:809-859`.
  Confirms R9 / AC9.
- **NaN-safety** — `sqrt(max(Δ,0))`, empty-grid short-circuit, `max(handEnds,0)`
  — `layout.js:778,826-835,818`. Confirms the robustness edge cases.
- **Rests are full grid citizens** — `handOnsets` advances on every event's
  `eventDuration`, rest or note — `layout.js:715-722`. Confirms R4 / AC4.
- **Chord = one onset / one column** — a chord is a single event with a `pitches`
  array mapped to one `columnX.get(onset)`; `stackChord` is Y/side only —
  `layout.js:1453,1467,1478`. Confirms R5 / AC5 (head count does not widen the
  column).
- **Emit layer adds no spacing math** — `svg.js:346-347` comment; noteheads draw
  at `note.x` (`svg.js:629,730`). Confirms end-to-end wiring.
- **Coverage gap is real** — existing `layout.test.js` covers `advanceFor`
  (formula, ~2.5:1 ratio, NaN-safety, per-column `extra`) and `measureLayout`
  (union grid, monotonic X, alignment, time-sig-blindness), but NOT the
  mixed-duration ordering scenarios. `specs/render.spec.js` covers display states,
  injection safety, responsive reflow, and annotations — no spacing assertion.
  The deliverable (test coverage of duration ordering) is correctly identified.

## Why this passes the bar

- **Requirements (R1–R9)** are each a clear, verifiable WHAT, with no HOW leakage,
  and each maps to one or more ACs.
- **Acceptance criteria (AC1–AC10)** are ordinal (ordering / equality), concrete,
  and individually testable. They deliberately avoid inventing pixel ratios — the
  correct posture given (a) the unavailable reference image and (b) the standing,
  sourced compressive-model design contract. The only numbers cited (~1.2:1,
  ~2.5:1) describe *current measured* behavior and are explicitly labeled
  accepted-as-is, never as targets. No invented numeric ratio anywhere.
- **Internal consistency** holds on the tricky cross-references I spot-checked:
  - AC9 ("20 eighths in 4/4, all gaps equal to the eighth advance"): the final
    column gaps to `measureEnd = 10.0` from the last onset at 9.5 → 0.5 qb = an
    eighth, so the "all gaps equal" claim holds including the last column.
  - AC6 ("N equal-duration notes → N−1 equal consecutive gaps"): correctly scoped
    to between-note gaps; matches the per-column walk.
  - AC5 / edge case E (chord footprint): consistent with the single-event /
    single-onset data model.
- **Scope / out-of-scope** is coherent and matches the design contract: strict
  proportionality, constant tuning, beaming logic, vertical clearances, leading
  pad, wrapping policy, audio, and the `beat`-anchored annotation feature are all
  correctly excluded; justify/wrapping is correctly framed as a *constraint the
  ordering holds under*, not a deliverable.
- **"Already implemented → verify/lock" framing** is accurate against the code, as
  verified above.

## Non-blocking nits (do not block approval)

1. **AC9 final-column note (optional clarity).** AC9 asserts "all gaps equal to
   the eighth advance." This is true including the final column (last onset 9.5 →
   `measureEnd` 10.0 = 0.5 qb). The plan/test author may want to assert the final
   gap explicitly so the "all gaps" claim is unambiguous; the criterion as written
   is already correct.

2. **Overview provenance density (stylistic).** The Overview restates the
   "~3–4 days before this issue was filed" timeline and the design-contract
   rationale at some length. This is justification rather than spec; it is harmless
   and arguably useful context, but a future trim could move it under a "Rationale"
   aside. Stylistic only.

3. **AC10 status (already handled well).** AC10 (render-level confirmation) is
   appropriately marked "recommended" rather than mandatory, which is the right
   call given the Playwright harness. No change needed — noted only to confirm the
   reviewer agrees with the soft framing.

## Conclusion

No blocking defects. The spec correctly specifies the accepted ordinal
duration-ordering behavior, scopes the deliverable to provable test protection,
respects the sourced compressive-model design decision, and avoids inventing
numbers it cannot source. Approved to proceed to the design-doc phase.
