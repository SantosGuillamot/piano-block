# Design Doc Review — APPROVED

_Issue: [#15](https://github.com/SantosGuillamot/piano-block/issues/15) — Beam chained eighth notes as a single group instead of in pairs._
_Phase: Design doc (phase 2). Reviews `2-design-doc/design-doc.md` (commit `5e5db4a`) against `1-spec/spec.md`._

## Verdict

**APPROVED.** The design faithfully realizes the spec's Option-A metric-grouping
contract for every metre, confines the change to the one function the spec
permits, and resolves the single non-blocking open question with substantive
justification. The non-regression invariants are mechanically preserved, and the
one true correctness landmine (the NaN path on absent time signatures) is
identified, motivated, and guarded.

## What I verified (against the real source, not just the prose)

I read the actual `src/notation/layout.js` and `src/notation/__tests__/layout.test.js`,
re-ran the full-repo grep, and executed the proposed predicate end-to-end through
a faithful replica of the real `beamGroups` walk. Findings:

- **Confinement is real.** `grep` confirms `beatGroupLength` has exactly one
  runtime consumer — `beamGroups` at `layout.js:411` — and otherwise appears only
  in `layout.test.js` (import + assertions). No barrel re-export, no docs/README
  reference. Repurposing the function (Option i) is fully contained, as the
  design claims. The compound arm (`unit * 3`, `:385`) is untouched by the design,
  so invariant #13 (compound byte-identical) holds structurally.

- **The walk and geometry are byte-identical and size-agnostic.** I read the
  break branches (`:434-438`, `:443-445`, `:454-461`, `:465`) and the
  `beamGeometry` guard. The only size-dependent branches in the pipeline are
  `isBeam = indices.length > 1` (`:421`) and the `members.length >= 2` geometry
  guard — both "≥2" thresholds a group of 4 or 8 satisfies identically. The
  primary beam spans `members[0].x → members[members.length-1].x` for any length.
  Horizontal layout is genuinely time-sig-blind (X from `columnX.get(onsets[idx])`,
  `:1438`); the beaming change cannot move a note.

- **The Option-A contract holds for every metre** (ran the predicate through the
  real walk): 4/4 → 4+4, 2/4 → 4, 3/4 → 6, 2/2 → 4+4, 6/8 → 3+3, 9/8 → 3+3+3,
  12/8 → 3+3+3+3, 3/8 → 3. Leftover-flag fix: 3 eighths in 4/4 → one group
  `[[0,1,2]]`, `isBeam: true`. Straddle trace reproduces `[[0,1,2,3],[4,5]]`
  exactly. All match the spec table (#2) and §5.1.

- **The NaN guard is correct and necessary.** `resolveSectionContexts`
  (`layout.js:898`) does resolve absent ts to `null`, which flows into the
  predicate as `null?.beats === undefined`. I confirmed the *un*guarded simple
  branch returns `NaN`, that `beamGroups`' `beatLen > 0 ?` guard then treats
  `NaN > 0` as false and collapses the whole run into one group (a silent wrong
  default, not a crash), and that the `typeof beats === "number" ? beats : 4`
  fallback yields `beatGroupLength(null) === beatGroupLength(undefined) === 2` →
  groups of four. The "absent ts ⇒ 4/4" framing is the faithful extension
  (today's `beatGroupLength(undefined) = 1` already *is* the 4/4 value), and the
  design's direct `beatGroupLength(null|undefined) → 2` regression test plus the
  `beamGroups(8 eighths, undefined) → [[0,1,2,3],[4,5,6,7]]` test pin it against
  re-introduction. This is the strongest part of the design.

- **The `max(unit, beat)` floor is load-bearing.** It binds in exactly one metre,
  1/1 (beat = 4, half-bar = 2; the `halfBar >= 2` arm would give 2, finer than the
  beat; the floor lifts it to 4 → one group of 8). Confirmed by running 1/1
  through the walk, and by a sweep over `beatType {1,2,4,8,16,32} × beats 1..64`:
  zero throws, never finer than a beat. The design's instruction to keep it with a
  comment naming the 1/1 case correctly prevents its deletion as dead code.

- **Robustness holds.** Over-full 2/8 (8 eighths) tiles as 2+2+2+2 without
  throwing; out-of-scope irregular metres get predictable non-crashing defaults
  (5/4 → 5+5, 7/8 → 7), matching §5.5 and the non-goals.

- **Open question #21 is resolved, not dangling.** The design keeps the half-bar
  split (4+4) with engraving-default justification (Finale/MuseScore/LilyPond) and
  documents Option B as a single-expression future lever scoped to the
  `halfBar >= 2` arm (so it stays surgical to the 4/4 family and does not pull
  irregular metres to whole-bar). The reasoning that nothing downstream
  distinguishes 4+4 from 8 (a group of 8 differs only by one primary-beam segment)
  is sound — I confirmed the geometry has no fixed-size assumptions.

## Spec traceability

Every spec acceptance criterion (#1–#9) and non-regression invariant (#12–#15)
maps to a concrete mechanism in the design and is covered by the test plan
(Section 6): the per-metre table, the leftover-flag fix, the 2/4/3/4 whole-bar
cases, the over-full no-throw case, and the absent-ts/NaN regression guards are
all explicitly enumerated.

## Minor, non-blocking observations (for the implementer, not gating)

1. **One off-by-one citation.** §5.4 cites the `beamGeometry` primary-beam guard
   at `layout.js:523`; in the worktree it is at `:522`. Cosmetic; the guard exists
   and behaves as described. Worth correcting if the implementer touches that
   reference, but it does not affect the design.

2. **Variable-name drift between artifacts.** The design's §4.3 snippet uses
   `const b = typeof beats === "number" ? beats : 4;` while the research Topic 2
   snippet inlines the same guard as `(typeof beats === "number" ? beats : 4) * beat`.
   The design itself flags that exact variable names are implementation-phase
   polish, so this is expected latitude, not a contradiction. The locked logic and
   the inline-comment house style are identical across both.

Neither observation changes behavior or blocks implementation.
