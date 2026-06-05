# Spec review — APPROVED

_Spec under review: `1-spec/spec.md` (commit `2915865`)._
_Reviewer: spec-reviewer. Verdict: **APPROVED**._

## Summary

`spec.md` is standalone, complete, internally consistent, testable, faithful to
the requirements and the original prompt, and correctly scoped at the WHAT level.
It accurately captures the consolidated **Option A (metric grouping)** decision and
the single non-blocking open question (#21) without leaking HOW decisions into the
contract. No blocking issues found.

## What I checked

### Standalone
The spec defines its load-bearing terms up front — **metric group** (the span over
which beamable notes join under one beam) and **beamable note** (eighth-or-shorter;
quarter-or-longer notes and rests break a run). The Overview states the current
behaviour, the fix, and an explicit "this is only about which notes share a beam
group" boundary. A reader who has never seen the requirements doc could implement
and test against this spec. PASS.

### Complete
The spec covers: the goal (#1), the observable contract table (#2), the general
grouping rule (#3), the 3/4 decision (#4), the full-bar default (#5), the four
break boundaries that are unchanged (#6–#9), the flagged-singleton rule (#10),
mixed-duration / primary-beam-only scoping (#11), the non-regression invariants
(#12–#14), robustness to over-full measures (#15), the out-of-scope list, the
acceptance criteria, and the single open question (#21).

Requirement #21 (full/over-full bar of eighths in a 4/4-family metre: 4+4 vs one
beam of 8) is intentionally preserved as a non-blocking open question with a
recorded engraving-correct default (4+4). Per the review brief this is acceptable
and is NOT treated as an omission — the default is decided and unblocks design and
implementation. PASS.

### Internally consistent
I verified arithmetically that every entry in the contract table (#2) is
reproducible from the single general rule (#3):

- 4/4 → half-bar = 2 quarter-beats → 4 eighths/group → `4 + 4`.
- 2/4 → whole-bar = 2 quarter-beats → 4 eighths → `4`.
- 3/4 → whole-bar = 3 quarter-beats → 6 eighths → `6`.
- 2/2 → half-bar = 2 quarter-beats → 4 eighths → `4 + 4` (the "beat = half note"
  framing and the "half-bar" framing yield the identical `4 + 4`; not a
  contradiction, just two explanations of one result).
- 6/8, 9/8, 12/8, 3/8 → compound branch, dotted beat = 1.5 quarter-beats → 3
  eighths/group → unchanged.

The "grouping unit MUST NOT be finer than a single beat" constraint (#3) holds for
every listed simple metre (4/4, 2/4, 3/4, 2/2, 2/8 — grouping unit ≥ beat unit in
all). The 2/8 whole-bar case yields 2 eighths/group, which equals a "pair" only
because 2/8's whole bar IS two eighths — that is one group spanning the maximal
possible span, not the fragmentation the issue targets. Consistent. PASS.

### Testable
The contract is expressed as concrete observable groupings per metre (the #2
table), and each acceptance criterion maps to an observable outcome. AC #9 names
the precise test blast radius (the old "pairs" assertions to update plus the new
per-metre, leftover-flag, and over-full-measure cases). PASS.

### Faithful to requirements + prompt
Cross-checked against the actual code, the requirements Q&A, and the prompt:

- The described current behaviour (beat-boundary breaking via `beatGroupLength`,
  pairs in 4/4, flagged length-1 singleton) matches `beamGroups` / `beatGroupLength`
  in `src/notation/layout.js` and the existing assertions in `layout.test.js`.
- The Option A decision, the 3/4 whole-bar choice, the compound-unchanged
  invariant, and the time-signature-blind horizontal-layout invariant all match the
  consolidated requirements (and the verified consumer trace in Q4).
- The prompt's intent ("stop over-fragmenting; one beam over the run that belongs
  together") is honoured; the spec neither under-delivers (it widens grouping) nor
  over-reaches (it does not force one-beam-per-bar against the engraving rule).

PASS.

### Correctly scoped (WHAT not HOW)
The spec fixes the observable contract table as the requirement and explicitly
defers the exact grouping predicate and the `beatGroupLength`-vs-new-function choice
to the design phase. It constrains the implementation only where behaviour-bearing
(touch only the simple-metre branch; keep geometry/stems/secondary beams/stubs
untouched) without dictating the code shape. Appropriate altitude. PASS.

## Verdict

**APPROVED.** Proceed to the design phase. The recorded default for #21 (half-bar
4 + 4) is sufficient to unblock design and implementation; the open question is for
the requester's confirmation only and does not gate progress.
