# Code-plan review (review 7) — APPROVED

_Adversarial review of `3-plan/code-plan.md` (5 tasks, T1–T5) for review 7 of the Piano block editor-UI feature (issue #8, PR #22), by **code-plan-reviewer-r7**. Reviewed against `1-spec/spec.md`, `2-design-doc/design-doc.md` (+ `design-doc-research.md` and the design-doc approval's three implementation notes), and the on-branch source: `src/editor/StructureTree.js`, `src/edit.js`, `src/editor/inspector/SectionPanel.js`, `src/style.scss`, `src/editor/selection.js`, `src/editor/songModel.js`, `test/mocks/wordpress-components.js`, `test/mocks/wordpress-icons.js`, `jest.config.js`, `src/editor/__tests__/{StructureTree,Edit,SectionPanel}.test.js`, `specs/editor.spec.js`, and the installed `node_modules` React tree. Every line-number reference and green-boundary claim was checked against real source, not taken on faith; the baseline suite was run; the React-split prerequisite was verified live._

## Verdict

**APPROVED.** The plan is complete, feasible, correctly sequenced, and faithful to the spec and design doc. Every design decision lands in exactly one task, all spec requirements and ACs trace, and the three design-doc approval notes are folded in verbatim. Crucially — applying the review-6 lesson the lens flags — each task's commit boundary is genuinely green: I traced the test fallout of T1's mock-hardening and T2's menu reshape against the actual existing tests, and the plan's Files lists and Changes scope all the affected suites. No blocker, no must-fix issue.

## Baseline verified (in this environment)

- `git log --oneline -1` → `1d19ef5 Add review-7 code plan (code-plan-writer-r7)` (the plan's own commit; tree clean).
- `npm run test:unit` → **21 suites, 669 tests, all green** — matches the plan's stated baseline. (The plan cites the baseline commit as `ae3db86`; the count is identical at the current HEAD, so the figure is sound.)
- All six React entrypoints (`react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`, `scheduler`) `require.resolve` at top level; `@wordpress/icons@10.32.0` nests its own React **18.3.1** while top-level is **19.2.7** — the T4 dedup-mapper prerequisite is real and feasible exactly as described.

## What I checked, by the review lens

### Green-boundary integrity at every commit (the review-6 lesson)

- **T1's mock hardening does not break existing menu-dependent tests.** The hardened `DropdownMenu` mock renders `null` only when `typeof children !== "function" && !controls?.length`. T1 converts all three per-row menus to function children **in the same commit**, so the mock's guard never fires for the tree. I traced the three at-risk traversals against real source:
  - `StructureTree.test.js`'s `buttonByLabel(...).closest("div")` → `selectButtonByText(menuDiv, "…")` (`:401–443`, `:466–481`): the function child renders into the same wrapping `<div>` as the toggle, so `.closest("div")` still resolves and the items are found. Item names are unchanged in T1, so every existing assertion (Duplicate/Remove/Add measure) still matches.
  - `Edit.test.js`'s `clickRowAction` → `fieldByName(container, menuLabel).closest("td")` (`:151–157`): the TreeGridCell mock wraps the whole DropdownMenu in a `<td role="gridcell">`, so the items render inside that `<td>` and `.closest("td")` resolves. The `:596–639` duplicate tests survive verbatim.
  - The mock's `onClose` is a real no-op, so T1's wrapped `() => { handler?.(coords); onClose(); }` does not throw. Confirmed.
  - I independently re-verified the design-doc claim that **`StructureTree.js` is the only `DropdownMenu`/`MenuGroup`/`MenuItem` consumer in `src`** (`grep` returns only the component + its two test files), so hardening the mock cannot break any other suite. Correctly scoped.
  - Existing coverage is even stronger than the plan claims: `StructureTree.test.js:401` already asserts `buttonByLabel("Actions for Section 1")).toBeTruthy()` and the measure/note tests already locate toggles by their `"Actions for …"` label, so under the hardened mock those existing assertions already go red on a plain-element regression. The plan's new toggle-presence assertion (T1 step 5) is therefore genuinely belt-and-suspenders, exactly as it states — not a load-bearing omission.

- **T2's reshape ships all its fallout in one commit.** The menu item set changes (item renames + two `MenuGroup`s + six new handlers + the SectionPanel button), and **every** affected test file is in T2's Files list: `StructureTree.test.js` (item names, drop the "Add measure" test `:417–426`, add positional-insert assertions), `Edit.test.js` (retarget the "Add measure" click `:490–502`), and `SectionPanel.test.js` (new button test). I confirmed `"Add measure"` text appears in exactly four places (StructureTree.js menu, StructureTree.test.js `:423`, Edit.test.js `:497`, specs `:592–595`) and the plan accounts for every one — after the move to SectionPanel there is no text collision (the panel button is the only "Add measure" left). The Edit.test.js retarget correctly notes SectionPanel renders only when `resolvedSelection` is truthy, so the test must select a section row first; I verified `edit.js:511` gates `<SectionPanel>` on `resolvedSelection` (any kind), so selecting "Section 1" reveals it.

- **T4's dedup mapper does not disturb other suites.** The mapper remaps React entrypoints globally (changing module identity for everything), but I confirmed **no** existing test in `src/`/`test/` uses `isValidElement`/`cloneElement`/`$$typeof` or otherwise depends on React element identity — they all already render on top-level React via `react-dom/client` `createRoot`, which the mapper only reinforces. The base `@wordpress/scripts` jest config contributes an empty `moduleNameMapper`, so the project `jest.config.js` is indeed the only place to add the dedup. The plan's mandatory smoke-check (re-run the whole suite after adding the mapper) is the right guard. The un-mapping recipe choice (note 2) is correctly scoped to the new file only, leaving the main suite's string-sentinel icons mock untouched.

- **T3 (CSS-only) and T5 (e2e, discovery-only) ship no unit-test fallout** — no test asserts computed styles, and the e2e cannot run here. Both keep the suite green by construction.

### Sequencing soundness

- **T1-before-T2 is a real split, not a relabel.** T1 keeps the item sets verbatim and only converts children to render functions + hardens the mock + fixes the `plus` glyph; T2 then edits the render functions T1 created. No T1 assertion depends on T2's reshaped items. The `Depends on` edges are all correct: T2→T1 (edits T1's render functions; relies on the hardened mock), T3→T2 (CSS pinned to the final two-cell markup — no functional coupling, ordering-only), T4→T1+T2 (canary green needs the `plus` fix; tree final needs the reshape), T5→T2 (spec describes the final menu + SectionPanel button).

### Coverage (every decision in exactly one task; ACs traced)

- Regression fix → T1 (R-REG1 render-fn children, R-REG2 `icon={plus}`, R-REG3a hardened mock + toggle assertion). Menu model + six positional handlers + explicit `kind` + re-home → T2 (R-MENU1/2/3, R-KEEP5/6). Recipe A + separation → T3 (R-POLISH1/2, logical props, `1.5em` kept). Real-icon canary + six-module dedup mapper → T4 (R-REG3b, R-KEEP2). e2e consistency → T5 (R-REG3c). The requirements-coverage map at the plan's end is accurate; I cross-checked each row against the design's §-decisions and the source.
- The **three design-doc approval implementation notes** are folded in verbatim and correctly: (1) the real-icon test uses the suite's own `createRoot`+`act` harness with no stray `console.log` (T4); (2) pick ONE un-mapping recipe and smoke-check `isValidElement(plus)` (T4); (3) the six positional handlers pass an explicit `kind` to `setSelection` (T2). I verified `resolveSelection` (`selection.js:139–162`) defaults the kind for a complete tuple, so the explicit form is the more-robust choice, matching note 3.
- Building blocks confirmed present: `insertAt` (`songModel.js:262`), `newSection` (`:220`), `newMeasure` (`:210`), `newNote` (`:191`) all exported; `onDuplicateMeasure` (`edit.js:354–371`) is genuinely the closest template for the new handlers. No `songModel.js` change needed — correct.

### Acceptance quality

- Each task's Acceptance is objectively checkable (test counts, `validateSong(...) === []`, source-inspection of named props/handlers, the manual revert-to-confirm-the-guard step that does NOT get committed). T5 correctly respects the no-Docker constraint: `playwright test --list` (discovery) + by-construction inspection only, never execution — and the **ordinal-shift gotcha is flagged prominently** (T5 change 4), which is real: the existing e2e navigates to "Actions for Measure 3 of section 1" / "Actions for Section 3" after inserts (`specs/editor.spec.js:638–660`), so post-insert ordinal lookups must be re-derived. The plan calls this the only non-mechanical change and tells the writer to re-walk the affected test rather than find-replace.

## Minor observations (non-blocking, for the code phase — not conditions of approval)

1. **T1 test-count note.** T1 adds at least one new `it` (the toggle-presence assertion), so the suite total rises from 669 by the number of new blocks; the plan already tells the writer to record the new total. No action needed — just confirming the "still 669" phrasing in T1's first acceptance bullet is correctly qualified by its own parenthetical.
2. **T2 optional Edit-level positional assertion.** The plan marks the end-to-end `clickRowAction(..., "Add after")` Edit-level check as OPTIONAL/recommended, with the load-bearing structural assertions living in `StructureTree.test.js` (props fired) + the commit-path coverage. That division is sound; adding the optional one is a nice-to-have, not a gap.

## Verdict line

**APPROVED** — five strictly-sequential tasks, each green at its commit boundary (T1's mock-hardening and T2's reshape both ship their full unit-test fallout in-commit, the exact review-6 failure mode this lens targets); sequencing edges correct; every spec requirement, AC, and design decision traced to exactly one task; the three design-doc approval notes folded in faithfully; the React-dedup prerequisite verified live; the e2e task honors the no-Docker constraint with the ordinal-shift gotcha flagged. No spec/design contradiction; the two observations above are implementation notes, not conditions.
