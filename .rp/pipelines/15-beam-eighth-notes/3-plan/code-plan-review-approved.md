# Code Plan Review — APPROVED

_Issue: [#15](https://github.com/SantosGuillamot/piano-block/issues/15) — Beam chained eighth notes as a single group instead of in pairs._
_Phase: Plan (phase 3). Reviews `3-plan/code-plan.md` (commit `f02eac7`, 7 tasks) against `1-spec/spec.md` and `2-design-doc/design-doc.md` (approved `5e5db4a`)._

## Verdict

**APPROVED.** The plan correctly decomposes the design into seven small,
dependency-ordered, TDD-sound tasks. It encodes the new grouping contract in
tests first (RED, Tasks 1–3), makes the single one-function production change
(GREEN, Task 4), then runs layered verification gates (Tasks 5–7) that prove the
non-regression invariants. Every cited file/line is accurate in this worktree,
every described test edit matches the real current code, and every acceptance
value I independently computed matches the plan. The mandatory NaN guard, the
load-bearing `max(unit, beat)` floor, the per-metre contract, and the
non-regression invariants are all covered with traceability.

One minor accuracy issue (the test command name) is noted below for the
implementer; it does not gate approval because the plan explicitly instructs the
implementer to confirm the runner from `package.json`.

## What I verified (against the real source, not just the prose)

I read the actual `src/notation/layout.js` and
`src/notation/__tests__/layout.test.js`, ran the existing suite, and executed
both the locked predicate and a faithful replica of the real `beamGroups` walk
end-to-end. Findings:

- **All line citations are accurate in this worktree.** `beatGroupLength` JSDoc
  `:366-375`, body `:376-386`; `beamGroups` `:410-467` with the `beatLen > 0 ?`
  floor guards at `:431-432`; the `beamGeometry` primary-beam guard at
  `:523` (`if (members.length >= 2)`); `layoutHand` at `:1421`, its `beamGroups`
  call at `:1424`, the `beamed` flag at `:1499`/`:1511`, the second
  `members.length >= 2` guard at `:1543`, and `columnX.get(onsets[idx])` at
  `:1438`. The plan's Orientation correctly resolves the design-review's
  `:522`/`:523` confusion to the real worktree line `:523` — a good catch that
  is itself correct (I confirmed `:523` by grep).

- **The existing test edits (Tasks 1–2) match the real current assertions
  byte-for-byte.** The simple `it("derives a simple beat length (one beatType
  unit)")` block asserts `{4,4}→1` and `{3,4}→1` (`:320-323`); the 2/8 assertion
  is `0.5` (`:337`); the 4/4 test is titled "in twos" with indices
  `[[0,1],[2,3],[4,5],[6,7]]` and `every(g => g.isBeam)` (`:342-355`); the
  over-full test asserts `toHaveLength(10)` and `indices.length === 2` with
  `not.toThrow()` (`:400-412`). Every "from" value the plan re-points is the
  real current value.

- **Every Task 4 acceptance value is correct.** Running the locked simple branch
  yields: `{4,4}→2`, `{2,4}→2`, `{3,4}→3`, `{2,2}→2`, `{2,8}→1`,
  `{6,8}/{9,8}/{12,8}/{3,8}→1.5`, `null/undefined→2`, `{1,1}→4`. The NaN guard
  (`null`/`undefined`→2) and the load-bearing floor (`{1,1}`: half-bar 2 lifted
  to beat 4) both behave exactly as the plan and design state.

- **Every Tasks 2–3 walk outcome reproduces through the real walk logic.** 4/4
  x8 → `[[0,1,2,3],[4,5,6,7]]`; 4/4 x20 → 5 groups of four; 2/4 x4 →
  `[[0,1,2,3]]`; 3/4 x6 → `[[0,1,2,3,4,5]]`; 2/2 x8 → `[[0,1,2,3],[4,5,6,7]]`;
  4/4 x3 → `[[0,1,2]]` (`isBeam: true`, leftover-flag fix); absent
  `undefined`/`null` x8 → `[[0,1,2,3],[4,5,6,7]]` (NaN landmine guarded — not one
  collapsed group of 8); over-full 2/8 x8 → tiles 2+2+2+2 (length 4, no throw);
  6/8 x6 → `[[0,1,2],[3,4,5]]` (compound unchanged).

- **TDD ordering and dependencies are sound.** Tasks 1–3 are RED and mutually
  independent (correctly marked `Depends on: —`); Task 4 is the single GREEN
  production change that flips them; Tasks 5–7 are layered verification gates
  (unit file → full suite + lint → behavioral). The plan correctly notes Task 4
  is technically independent of the test tasks but is logically the GREEN step
  run after them. No task is out of order, duplicated, or out of scope.

- **Spec and design coverage is complete.** Each task carries Goal/Files/Changes/
  Depends on/Traces to/Acceptance. The "Traces to" lines map to spec
  requirements #1–#15 and ACs #1–#9, and to design §4.3 (predicate), §4.4 (NaN
  guard), §4.5 (floor), §4.7 (4+4 split), §5.1–§5.5, and §6 (test plan). The
  compound-byte-identical invariant (#13) is pinned by leaving the compound
  assertions untouched (Task 1) and confining the edit to the simple branch
  (Task 4). The horizontal-layout invariant (#12 / AC #7) is routed through the
  existing `measureLayout` time-sig-blind test at `:779` (which I confirmed
  exists and already asserts X/width equality across time signatures). Mixed
  durations (#11) and the unchanged break/straddle/singleton behaviour (#6) are
  covered by Task 5's enumerated "unchanged cases" check.

- **Baseline is green.** The current `layout.test.js` passes (216 tests, 0
  snapshots). The repo has **no** snapshot files or `toMatchSnapshot` usage
  anywhere, which confirms Task 6's "expect zero snapshot churn" expectation; the
  snapshot-acceptance prose there is harmless over-specification.

## Minor, non-blocking issue (for the implementer)

1. **Test command name in Tasks 5 and 6.** The plan shows literal commands
   `npm test -- src/notation/__tests__/layout.test.js` (Task 5) and `npm test`
   (Task 6). There is **no `test` script** in `package.json`; `npm test` will
   fail. The unit runner is `test:unit` → `wp-scripts test-unit-js` (Jest). The
   implementer should run `npm run test:unit -- src/notation/__tests__/layout.test.js`
   (or `npx wp-scripts test-unit-js src/notation/__tests__/layout.test.js`) for
   Task 5 and `npm run test:unit` for Task 6. The `npm run lint`
   (`biome lint .`) command in Task 6 is correct as written. This does not gate
   approval because both tasks already instruct the implementer to "Use the
   repo's configured runner if different; confirm from `package.json` scripts" —
   the plan anticipates exactly this substitution.

## Traceability check

Every spec acceptance criterion (#1–#9) and non-regression invariant (#12–#15)
maps to a concrete task with a passing/feasible acceptance gate. The per-metre
table, the leftover-flag fix, the 2/4 and 3/4 whole-bar cases, the over-full
no-throw cases (4/4 and 2/8), the direct and through-the-walk NaN-guard
regression tests, the compound byte-identical pin, the horizontal-layout
invariance, and the visual 4+4 behavioral check are all explicitly enumerated
and ordered. Nothing is missing, duplicated, or out of scope.
