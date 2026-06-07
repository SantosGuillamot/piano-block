# Code Review — APPROVED

_Phase: Code (phase 4). Reviews the implementation of the whole code plan
(`3-plan/code-plan.md`, Tasks 1–7) for GitHub issue #15, "Beam chained eighth
notes as a single group instead of in pairs."_

- **Batch:** code-plan Tasks 1, 2, 3, 4, 5, 6, 7 (implemented as one red→green→verify unit).
- **Diff reviewed:** `3b00cbd..HEAD` — single implementation commit `c561c1b`
  ("Beam chained eighth notes by metric group instead of in pairs (code-writer)").
- **Files touched:** `src/notation/layout.js` (+18/−7), `src/notation/__tests__/layout.test.js` (+99/−11). No other files.
- **Verdict:** APPROVED.

## Scope confinement (verified against the diff)

- The production change is a **single hunk** in `layout.js`
  (`@@ -364,25 +364,38 @@`), entirely inside `beatGroupLength` and its JSDoc.
- The compound arm is preserved: `if (isCompound) return beat * 3; // dotted beat — UNCHANGED`
  returns `1.5` for 6/8, 9/8, 12/8, 3/8 exactly as before.
- The entire `beamGroups` walk (`:423–`), its JSDoc, beam geometry, stem
  direction, secondary beams, stubs, the flag-vs-beam decision, and all
  horizontal layout are **byte-identical** — no diff lines touch them.
- No external-doc / README / `.rp/` changes (correctly deferred to the Docs phase).
- No scope creep; no new named constants (file's inline-comment idiom preserved).

## Correctness landmines (both present and correct)

- **NaN guard:** `const b = typeof beats === "number" ? beats : 4; // NaN guard (absent ts)`
  is computed before the multiply, so `null`/`undefined` ts ⇒ `b = 4` ⇒ half-bar 2
  ⇒ groups of four — never `NaN` (which would silently collapse the run via
  `beamGroups`' `beatLen > 0 ?` guard). Verified directly: `beatGroupLength(null)`
  and `beatGroupLength(undefined)` both return `2`, and a no-ts run of 8 eighths
  groups `[[0,1,2,3],[4,5,6,7]]`, not one collapsed beam.
- **`Math.max(unit, beat)` floor:** present, with the comment naming the 1/1 case
  intact ("this floor binds only in 1/1 (whole-note beat)"). Verified load-bearing:
  `{1,1}` returns `4` (floor lifts the half-bar 2 back to one beat). A sweep of
  beatType {1,2,4,8,16,32} × beats 1..64 (384 cases) showed zero unit-finer-than-
  beat or NaN/≤0 violations.

## `beatGroupLength` contract (verified through the real exported function)

| ts | want | got |
|---|---|---|
| {4,4} | 2 | 2 ✓ |
| {2,4} | 2 | 2 ✓ |
| {3,4} | 3 | 3 ✓ |
| {2,2} | 2 | 2 ✓ |
| {2,8} | 1 | 1 ✓ |
| {6,8} / {9,8} / {12,8} / {3,8} | 1.5 | 1.5 ✓ |
| null / undefined | 2 | 2 ✓ |
| {1,1} | 4 | 4 ✓ |

## `beamGroups` per-metre outcomes (verified through the real walk)

| case | expected | got |
|---|---|---|
| 4/4, 8 eighths | 4 + 4 | `[[0,1,2,3],[4,5,6,7]]` ✓ |
| 2/4, 4 eighths | one of four | `[[0,1,2,3]]` ✓ |
| 3/4, 6 eighths | one of six | `[[0,1,2,3,4,5]]` ✓ |
| 2/2, 8 eighths | 4 + 4 | `[[0,1,2,3],[4,5,6,7]]` ✓ |
| 4/4, 3 eighths | one of three, no leftover flag | `[[0,1,2]]` ✓ |
| absent-ts (undefined & null), 8 eighths | 4 + 4, not collapsed | `[[0,1,2,3],[4,5,6,7]]` ✓ |
| 6/8, 6 eighths | 3 + 3 (unchanged) | `[[0,1,2],[3,4,5]]` ✓ |
| over-full 4/4, 20 eighths | no throw, 5 groups of 4 | 5 × size-4, no throw ✓ |
| over-full 2/8, 8 eighths | no throw (tiles 2+2+2+2) | 4 × size-2, no throw ✓ |
| straddle (dotted-8th crossing half-bar, 4/4) | `[[0,1,2,3],[4,5]]` | `[[0,1,2,3],[4,5]]` ✓ |

## Test quality

- The two existing old-behaviour tests are correctly re-pointed: 4/4 "in twos"→"in
  fours" (`[[0,1,2,3],[4,5,6,7]]`), over-full "10 pairs"→"5 groups of four"
  (`toHaveLength(5)`, size `=== 4`), both retaining their assertions
  (`every(isBeam)` / `not.toThrow()`).
- The `beatGroupLength` simple assertions are reworded and updated ({4,4}→2,
  {3,4}→3, {2,8}→1) with explanatory comments; compound assertions untouched at 1.5.
- New tests added per AC #9 / design §6: 2/4, 3/4, 2/2, leftover-flag fix, the two
  absent-ts walk guards (undefined + null), over-full 2/8, and the direct
  `beatGroupLength(null|undefined)→2` NaN guard. All trace to acceptance criteria.
- The unchanged regression cases (6/8 threes `[[0,1,2],[3,4,5]]`, rest break
  `[[0],[2]]`, quarter break, length-1 flagged singleton
  `{indices:[0],isBeam:false,beamCounts:[1]}`, mixed `beamCounts:[1,2]`, and the
  `measureLayout` "NEVER consults timeSignature" test at `:861`) sit outside the
  diff hunks and pass unchanged.

## Inline docs

- JSDoc on `beatGroupLength` rewritten to the grouping-unit meaning (half-bar for
  duple/quadruple, whole bar for small simple metres, floor at one beat binding in
  1/1, absent-ts ⇒ 4/4), `@return … always > 0` retained, compound description kept.
- Self-contained per `AGENTS.md`: no references to the pipeline/plan/spec/design/
  `.rp/` in any shipped comment (grep clean).

## Checks

| Command | Result |
|---|---|
| `npm run test:unit -- src/notation/__tests__/layout.test.js` | PASS — 223/223, 0 snapshots |
| `npm run test:unit` (full) | PASS — 367/367 across 6 suites, 0 snapshots |
| `npm run lint` (biome) | PASS — 23 files checked, no fixes applied |
| `npm run build` (wp-scripts) | PASS — compiled successfully, clean working tree (no build churn) |
| Real-code-path behavioral verification (tables above) | PASS — all `beatGroupLength` + `beamGroups` outcomes, straddle, sweep, no-throw |

## e2e note

`npm run test:e2e` is Playwright and requires a wp-env/Docker stack
(`npm run env:start`), which is not feasible to run here; the repo has no e2e test
covering beaming, and the plan (Task 7) explicitly designates unit + real-code-path
behavioral coverage as the appropriate layer for this pure-geometry change. The
horizontal-invariance guarantee (AC #7) is structurally routed through the existing
`measureLayout` "NEVER consults timeSignature" test, which passes unchanged. I
concur that no new e2e/visual test is required for this change; the absence is
acceptable.

## Conclusion

Every code-plan task's Acceptance is met and the traced spec acceptance criteria
hold against the resulting code. The change is provably confined to the simple-metre
arm of `beatGroupLength`; the NaN guard and the 1/1 floor (with comment) are present
and correct; the full contract and per-metre beaming outcomes verify through the real
code path; all gates are green. **APPROVED.**
