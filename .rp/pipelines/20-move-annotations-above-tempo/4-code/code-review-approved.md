# Code review — APPROVED

**Issue:** #20 — Move annotations above the tempo marking
**Phase:** 4 (code)
**Branch:** `worktree-20-move-annotations-above-tempo`
**Reviewed range:** `git diff 5fb4438 HEAD` (HEAD = `71afbf8`)
**Iteration:** N=1
**Verdict:** **APPROVED**

## Batch under review

| Task | Commit | Summary |
|---|---|---|
| 1 | `24bd467` | New failing deep-stack AC5 test |
| 2 | `25bac08` | Flipped order-asserting test |
| 3 | `5c60e10` | Production reorder of the three reservation `if`-blocks in `topMarginLayout` |
| 4 | `71afbf8` | Optional AC4 subset assertion |

## Scope of change (confirmed clean)

Exactly two files changed across the batch:

- `src/notation/layout.js` — production (14 lines, 2 hunks)
- `src/notation/__tests__/layout.test.js` — tests (+116/-2)

No inadvertent change outside these two files.

## Production change — verified as the intended pure permutation (Task 3)

The diff is two hunks, both inside `topMarginLayout`:

- The `aboveRHCount > 0` annotations block was moved **verbatim** (including its
  in-block comment "The lane's baseline is note #0; the stack grows UP …") from
  *before* the ottava block to *after* the tempo block.
- New source order of the three guarded blocks: **`[ottava, tempo, annotations]`**
  (`layout.js:2885-2901`).
- **Untouched:** the declarations `let annotationAboveRHD/ottavaD/tempoD = null`
  (`:2882-2884`), the `stackStep`/`innerZone`/`d`/`topExtent` setup (`:2866-2881`),
  `topMargin` (`:2902`), `at()` (`:2903`), and the return (`:2904-2909`).
- **No** horizontal value, accumulator math, guard, or other logic changed. The
  only inter-block channels are the shared accumulators `d`/`topExtent`; each `*D`
  is written once in its own block and read once in the return — confirming the
  blocks are freely permutable (design §4.1).

By the invariant *reserved later ⇒ larger `d` ⇒ smaller Y ⇒ higher on the page*,
the new source order yields the visual top→bottom order
**annotations → tempo → octaveShift** — exactly R1/R2/AC1/AC2. Verified directly
by the now-passing flipped test chain
`annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY < rightStaffTopY`.

## Tests are meaningful and non-tautological — independently verified

I reverted **only** the production change (restored source order
`[annotations, ottava, tempo]`) with the test files held at HEAD, then ran the
layout suite. Result: the three order-pinning tests FAIL under the old order, each
on the key new-order assertion `annotationAboveRHLaneY < tempoLaneY`:

- Task 2 flipped test — fails at `layout.test.js:2066`.
- Task 1 deep-stack test — fails at `layout.test.js:2132` (assertion (a), the
  order-pinning one; assertion (b) margin-growth is order-independent by design
  and acknowledged as such — not a defect).
- Task 4 AC4 subset test — fails at `layout.test.js:2179`.

All presence/null sanity guards passed in the reverted run; the failures are
genuinely on the lane-order comparison, not the fixtures. After restoring HEAD the
working tree is byte-identical (shasum `b954204…` matches; `git status` clean).
This proves the tests pin the new behavior and are not tautological.

## Spec coverage in scope for code

- **R1/AC1** new top→bottom order — flipped order chain (`:2059` block). ✓
- **R2/AC2** tempo directly above ottava + emit-tracks-lane loops preserved. ✓
- **R3** both hands / single grand-staff tempo — no LH/inter-staff band touched. ✓
- **R4/AC4** subset behavior — Task 4 "annotations + tempo, no ottava" asserts
  `ottavaAboveLaneY` and `ottavaLeftAboveLaneY` both null and the tempo hugs the
  staff; n=1 block covers tempo-above-ottava. ✓
- **R5/AC5** deep stack clears tempo + margin grows — Task 1 (now genuinely
  exercised; was untested as `COMPREHENSIVE_SONG` carries only `aboveRHCount = 1`). ✓
- **R6/AC7** no horizontal change — `topMargin` is the only geometry output and is
  order-invariant; no horizontal value in the diff. ✓
- **R7/AC6** no regression in unaffected regions — existing RH-vs-LH ottava and
  below-band checks remain green unedited. ✓
- **R8/AC8** top margin tight — top-margin-flex test (`:2081-2115`) green unedited. ✓
- **AC9** suite green after one existing-test update — confirmed; only the
  `:2059` order test was modified among existing tests. ✓
- **R9/AC10** (doc-comments M1 `:2850`, M2 `:1866`, M3 `:2947`) — intentionally
  **deferred to the doc phase** and correctly **absent** from this batch (verified:
  none of those line regions appear in the diff; they still describe the old
  order). This is **not** a defect for the code batch.

## Test runs

- **Layout suite** (`npm run test:unit -- src/notation/__tests__/layout.test.js`):
  **239 passed**.
- **Full unit suite** (`npm run test:unit`): **383 passed, 6 suites**, 0 failures.

## e2e verdict — PRE-EXISTING / ENVIRONMENTAL (not a regression)

`npm run test:e2e`: **18 failed**, all chromium timeouts waiting for the block to
register/render (e.g. `getByLabel('Song (JSON)')` and the front-end SVG never
appear). Root cause: the block's compiled assets are absent — `build/` does not
exist in this worktree, so the `piano-block/piano` block never registers in
wp-env. These failures occur entirely upstream of any layout computation.

Independently confirmed not caused by this change: with the production reorder
reverted to the base order, `npm run test:e2e -- specs/editor.spec.js` reproduces
the **identical** 5 editor failures (including the writer-flagged
`specs/editor.spec.js:120` and `:136`). The failures are independent of the lane
reorder. Per AC9's intent (no regression *from this change*), this does not block
approval.

## Working-tree hygiene

All temporary baseline-verification edits were reverted; `src/notation/layout.js`
restored to the exact HEAD content (shasum verified), working tree clean apart
from this review file under `4-code/`.

## Decision

**APPROVED.** The production change is the exact intended pure permutation and
genuinely yields top→bottom annotations → tempo → octaveShift; the tests are
meaningful and fail under the old order; the full unit suite is green; the 18 e2e
failures are pre-existing/environmental (unbuilt block assets), reproduced on the
reverted baseline, and are not a regression.
