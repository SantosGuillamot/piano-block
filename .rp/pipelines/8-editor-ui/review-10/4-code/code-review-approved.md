# Code review — Review 10 (batch T1–T10): APPROVED

_Adversarial batch review of the editor-UI code phase. Base `7b2fc36` → HEAD `5b16f26`. Scope reviewed: `src/`, `test/`, `specs/` (pipeline `.rp/…` markdown excluded by instruction)._

## Verdict

**APPROVED.** The batch is correct, complete, faithful to the plan/design/spec, and the jest suite + production build are green. No out-of-scope work was pulled in; no rejects, preserved prior-review wins, or deferred follow-ups were implemented.

## Gates (run in the worktree)

- **`npm run test:unit` (jest):** 22 suites passed, **699 tests passed**, 0 failed. (The repo's jest script is `test:unit`, not `test`.)
- **`npm run build`:** compiled successfully, **clean** — no warnings or errors.
- **e2e (`specs/editor.spec.js`):** not executed here (wp-env not started; default ports occupied by the main repo — an environment limitation the orchestrator is handling, not a code defect). The new R-FOCUS tests were reviewed for static correctness and against the implementation; they are sound (see T3).

## Per-task findings

**T1 — R-TREE (symmetric label toggle).** `RowLabelCell` `Button` `onClick` now calls `onSelect?.()` then `onToggleExpanded?.(rowKey)` unconditionally — the `if (!isExpanded)` guard is gone (`StructureTree.js:156-159`). The hand-group label is untouched. JSDoc refreshed to describe the symmetric toggle. Exactly one jest test flipped (`"selects and collapses when an already-expanded section label is clicked"`, `toggle: ["s0"]`); sibling tree tests stay green. PASS.

**T2 — R-DEL (drop section confirm dialogs).** Both byte-identical `ConfirmDialog`s removed (SectionPanel + StructureTree root) plus their gating state (`confirmOpen`, `pendingRemoveSection`). No `ConfirmDialog`/`confirmOpen`/`pendingRemoveSection` reference remains anywhere in source. SectionPanel's now-unused `__experimentalConfirmDialog` and the whole `useState`/`@wordpress/element` import line are dropped. Section "Remove" fires immediately via the lifted handler, matching measure/note. Class docstring rewritten (no pending-remove, immediate removal, undo-not-confirm rationale). Two cancel-path tests deleted; the remaining remove tests drop their "OK" confirm step. PASS.

**T3 — R-FOCUS (post-mutation focus) — the riskiest, scrutinized hardest.**
- `edit.js`: exactly one `useState(null)`, the **10 bumps** (7 `"row"` + 3 `"anchor"`), and one `focusRequest={focusRequest}` prop pass. No refs, no `.focus()` — stays declarative. The 3 `"anchor"` bumps (`onRemoveSection`/`onRemoveMeasure`/`onRemoveNote`) sit **outside** the conditional `setSelection(null)` guard, at handler end (unconditional), while selection-clear stays conditional — the load-bearing subtlety is correct. The 7 `"row"` bumps land right after `setSelection` in `onAddNote`, the three duplicate mutators, and the three insert helpers (covering the six before/after wrappers). The bare appenders `onAddSection`/`onAddMeasure` correctly get **no** bump; plain `onSelect` is `setSelection` passed directly (no focus steal on plain click).
- `StructureTree.js`: single `useEffect` keyed on `[focusRequest]`, `null`-guard makes mount a no-op; `"row"` targets `[aria-current="true"].wp-block-piano-block-piano__tree-label`, `"anchor"` focuses `treeRef.current`. `ref={treeRef}` + `tabIndex={-1}` are on the `…__tree` host `<div>`, **not** `<TreeGrid>` (TreeGrid carries only `aria-label`/`onExpandRow`/`onCollapseRow`). `aria-current` and the label class sit on the **same** `<Button>`, so the selector hits exactly the selected row; the hand-group label has the class but never `aria-current`, so it is correctly never matched. Class docstring extended with the focus-management paragraph.
- e2e (static review): the 5 new `toBeFocused` assertions use existing helpers — `structureTree()` resolves to the anchored `…__tree` div (remove → tree-region focus) and `treeRow()`/the `aria-current` label selector resolve to the focused row (add/duplicate). Labels and selectors match the implementation; the suite previously had zero focus assertions, so these are net-new and correct. No jest test asserts DOM focus (which would false-green against the `TreeGridCell` mock). PASS.

**T4 — R-LR1/2/3 (inspector list-row Stage 1).** R-LR1: `alignment="flex-start"` → `"center"` on the three `__list-row` `HStack`s (PitchList, HandConfigEditor, AnnotationList) — **not** unit-asserted (mock swallows `alignment`). R-LR2: `style={{ minWidth: "4em" }}` added to exactly the three collapsing `NumberControl`s (PitchEditor Octave + Alteration; HandConfigEditor Alteration) — **jest-asserted** at all three sites (`pitches.test.js` ×2, `contextControls.test.js` ×1). The octave-shift `NumberControl` (HandConfigEditor:142) is correctly left without min-width. R-LR3: visible label `"Alteration note"` → `"Note"`; the scoped aria-label is unchanged, so the two `contextControls` tests that key off it stay green. PASS.

**T5 — R-JSON (Notice shows every error).** The single `{errors[0]}` child replaced with a mapped `<ul>`/keyed `<li>` mirroring `InvalidState`'s idiom (comment + `key={index}`). `Edit.test.js` now uses a multi-error fixture (`MULTI_ERROR_SONG`, asserted `errors.length > 1`) and checks one `<li>` per error with matching text. Ran the test in isolation: passes. PASS.

**T6 — R-NOOP (drop redundant coalesce).** Both sites (`NotePanel.js:235`, `MeasurePanel.js:136`) changed `annotations ?? undefined` → `annotations`; no occurrence remains. `AnnotationList.emit` already collapses empty → `undefined`, so behavior is unchanged; annotation tests stay green. PASS.

**T7 — R-INVALID (VStack + drop redundant `<p>`).** Mock extended first with `__experimentalVStack` (byte-identical to `HStack`, exported only as the experimental key — **no** bare `VStack`, **no** `FlexItem`/`FlexBlock`). `InvalidState` imports `__experimentalVStack as VStack`, wraps `Notice` + `Button` in `<VStack>`, drops the redundant `<p>`, and keeps the `<ul>` error list verbatim (comment + `key={index}`). Tests locating messages by `<li>` text and the button by role stay green. PASS.

**T8 — R-DOCS (comment corrections, no behavior change).** The three canvas-"interactive" framings (`edit.js:48-49`, `editor.scss:6-7`, `editor.scss:106`) reframed to "display + highlight only". `edit.js` workspace comment names `editor.scss` (was `style.scss`). `songModel.js` `setSectionAt` CRITICAL block trimmed to ~one line preserving the caution; the two reference-back comments at `setMeasureAt`/`setEventAt` are unchanged; all three depth-splice helpers remain distinct (no `setAt(song, coords, depth)` merge — the rejected, hazardous consolidation was correctly avoided). Docs-only; suite green. PASS.

**T9 — R-NUM (leave the prop omitted).** No `NumberControl` gained `__nextHasNoMarginBottom`; the change is a single one-line rationale comment at one representative site (`PitchEditor.js:69`). Verified every `__nextHasNoMarginBottom` in source sits on a `SelectControl`/`TextControl`/textarea — never a `NumberControl`. T4's `style` min-width on PitchEditor/HandConfig is intact and independent. No test asserts the prop on a `NumberControl`. PASS.

**T10 — R-FOLLOWUP (file 3 issues + relabel #35; implement none).** `gh issue list --label follow-up` shows **exactly four**: #35 (relabelled canvas-highlight), #36 (edit.js 13-mutator descriptor-table refactor), #37 (List-row Stage 2 — Flex/FlexBlock/FlexItem), #38 (precise nearest-surviving-sibling/parent focus after remove). No source commit; none of the deferred work is implemented (confirmed: no FlexItem/FlexBlock, no descriptor-table refactor, the focus fix is the stable-anchor version not the index-math one). PASS.

## Cross-cutting guardrails (all hold)

- **Verification discipline:** no jest test asserts `alignment` (R-LR1), DOM focus (R-FOCUS), or `__nextHasNoMarginBottom` on a `NumberControl` (R-NUM). The jest-assertable parts ARE asserted (R-LR2 min-width ×3; R-JSON multi-error list; R-DEL two cancel tests deleted; R-TREE one flipped test).
- **Editor-side only:** no `src/song/*`, `render.php`, front-end SVG (`src/notation/*`), `view.js`, or `block.json` change — a published song renders byte-identically. The only `songModel.js` change is the doc-comment trim.
- **No new outside dependency; no `@wordpress/compose`** (`useMergeRefs`/`useRefEffect` absent). The mock gained only `__experimentalVStack` (no `FlexItem`/`FlexBlock`).
