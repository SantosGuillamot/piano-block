# Code-plan review 1 — REJECTED

**Verdict:** Rejected (one gap, focused and fixable).
**Reviewer:** code-plan-reviewer (review-4).
**Plan under review:** `3-plan/code-plan.md`.
**Tasks to fix:** **T1** and **T4** (add the e2e spec to their file/scope and update the
contradicted e2e assertions); the cross-cutting acceptance section should also note the
e2e suite.

## Summary

The plan is accurate and almost complete. I verified every cited line number against the
live source (`edit.js`, `StructureTree.js`, `SongCanvas.js`, `selection.js`, `style.scss`,
and the three unit test suites) and they are all correct. The baseline is confirmed at
**629 tests / 20 suites passing**; the gates (`npm run test:unit`, `npm run lint` / biome)
are correct and there is no `npm test`. Every spec Req 1–9 / AC 1–9 traces to a task,
KD1–KD8 are honored, the editor-only boundary holds (no `src/song/*`, `src/notation/*`,
`src/view.js`, `src/render.php`; no new dependency), and the T7 collapse fix is specified
exactly as Option B (`ancestor ? !collapsedOverride.has(path) : expandedPaths.has(path)`,
bare `|| isSelectionAncestor` dropped, `isSelectionAncestor` kept live, no `useEffect`, no
Set seeded from selection) with the AC7 pinning test and the un-overridden-reveal test (R1)
both pinned. I traced the AC7 scenario and the unit drill-down (`selectLoneNote`) under the
combined T1+T7 routing and both are correct.

**The one blocker:** the plan (and the design doc's R2 list) omits the **end-to-end spec
`specs/editor.spec.js`**, which demonstrably encodes behavior that **T1** and **T4** change
and will therefore fail after implementation. R2's charter is "tests encoding changed
behavior are updated in the same task" — the e2e spec is exactly such a test of the editor
files in scope, so leaving it stale ships a contradicted, failing suite. This is the sole
reason for rejection.

## Required fixes

### T1 — open-by-default breaks the e2e `openStructureTree` helper (5 call sites)

`specs/editor.spec.js` has a helper whose entire premise is that the tree starts **closed**:

- `openStructureTree(editor)` (`specs/editor.spec.js:261-263`) clicks the block toolbar
  "Structure" button, and its doc-comment (`:255-259`) states the tree "is **hidden by
  default** and revealed by this toggle."
- After T1 flips `showTree` to `useState(true)`, the tree is **already open** on block
  insert. The very next line in the first such test, `await expect(structureTree(editor))
  .toBeVisible()` (`:409`), would then be asserted *after* `openStructureTree` has
  **toggled the open tree closed** — so the tree is gone and the assertion (and every
  subsequent `treeRow(...).click()`) fails.
- Affected call sites: `:408`, `:468`, `:512`, `:574`, `:611` (tests: "seeded empty
  measure adds its first note", "Note panel adds a sibling note", "structure tree adds,
  removes and duplicates", "selecting structure-tree rows reveals the right panels",
  "renaming a section relabels its row").

**Fix in T1:** add `specs/editor.spec.js` to T1's **Files**. Remove the now-wrong
`openStructureTree(editor)` calls (the tree is open by default), or repurpose
`openStructureTree` to be a no-op / assert-already-open, and update its `:255-259`
doc-comment so "hidden by default" reads as "open by default." Optionally add/adjust an
e2e assertion that the tree is present immediately on insert without the toggle, and that
the toggle now **closes** then **reopens** it (the AC1 cycle). Either approach is fine; the
plan must name the file and the call sites so the writer does not leave the suite broken.

### T4 — highlight removal breaks the e2e `is-active-*` assertions

The e2e test "selecting structure-tree rows reveals the right panels and highlights the
canvas" asserts the now-removed canvas decoration:

- `await expect(editor.canvas.locator('[data-measure].is-active-section'))…` (`:585`)
- `await expect(editor.canvas.locator('[data-measure].is-active-measure'))…` (`:596`)

After T4 removes the section/measure branches and the `.is-active-*` CSS, these classes are
never applied, so both assertions fail. The surrounding comments (`:576-590`) also describe
the section/measure highlight that no longer exists.

**Fix in T4:** add `specs/editor.spec.js` to T4's **Files**. Drop (or re-target) the
`is-active-section`/`is-active-measure` assertions at `:585` and `:596` and the stale
highlight comments, mirroring the unit-side `SongCanvas.test.js` treatment (section/measure
selection now decorates nothing; the panel-reveal half of the test stays). Keep any
`is-selected` event-highlight assertion if present.

## Non-blocking notes (no action required to approve)

- The e2e panel-presence assertions use `toBeVisible`/`toHaveCount` (presence by kind), not
  DOM order, so **T6** (panel reorder) does **not** break e2e — correctly left untouched.
- The e2e suite is not part of the per-task unit gate (`npm run test:unit`) and needs
  `wp-env`, so it will not turn a per-task gate red; but it is still a contradicted,
  to-be-failing test of the in-scope editor files and must be updated under R2.
- Cross-cutting acceptance currently reasons only about the unit suite (629 → ±). Once T1/T4
  name the e2e spec, add a line acknowledging the e2e suite is updated in lock-step (no new
  e2e behavior is required beyond reflecting open-by-default and the removed highlight).

## What was verified as correct (for the re-plan, do not regress)

- All cited line numbers in `code-plan.md` match live source across the four source files,
  `selection.js`, and `Edit.test.js` / `StructureTree.test.js` / `SongCanvas.test.js` /
  `selection.test.js`.
- T1's removal of the leading `click("Structure")` from `selectLoneNote`/the selection
  tests/`onAddMeasure`/`seeds a note` is correct and necessary (with open-by-default that
  click would otherwise close the tree). The combined T1+T7 drill-down still works: during
  fresh drill-down each row is not yet a selection-ancestor at click time, so it routes to
  `onToggleExpanded` and expands, then becomes an ancestor and the veto keeps it open.
- T4 fully accounts for the dead `measureNumbersForSection` (OQ1) and the now-callerless
  `scrollGroupIntoView`; a repo-wide grep confirms those symbols appear only in the files
  T4 names. Biome `recommended` includes the unused-import/var rules, so a missed prune
  would be lint-caught as the plan claims.
- T7 honors KD7 exactly (Option B veto, live `isSelectionAncestor`, no effect, no seeding)
  and pins AC7 (R1) plus the un-overridden-reveal guard; the controlled-component test
  shape is sound.
