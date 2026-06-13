# Design doc review — Review 10 — APPROVED

The design doc (`2-design-doc/design-doc.md`, with `design-doc-research.md`) is sound, complete, faithful to the spec, and buildable against the live tree on branch `worktree-8-editor-ui`. Every in-scope requirement (R-NUM, R-TREE, R-LR1/2/3, R-DEL, R-FOCUS, R-JSON, R-NOOP, R-INVALID, R-DOCS, R-FOLLOWUP) has a concrete, verified design; nothing out-of-scope is silently pulled in. One low-severity, self-correcting coordinate error was found (recorded below) — it does not gate approval.

## What was verified against live code

### R-FOCUS — the one non-trivial design — sound and buildable

- **`@wordpress/compose`/`useMergeRefs` genuinely unavailable**, so querySelector-over-ref-merge is justified: zero `@wordpress/compose`/`useMergeRefs`/`useRefEffect` usage in `src/` (grep), zero matches in `package-lock.json`, and the build asset (`build/index.asset.php`) lists only `react-jsx-runtime, wp-block-editor, wp-blocks, wp-components, wp-element, wp-i18n, wp-primitives` — **no `wp-compose`**.
- **The `"row"` selector hits exactly the right node.** The label `Button` carries BOTH `aria-current="true"` AND `className="wp-block-piano-block-piano__tree-label"` on the same element for sections/measures (`StructureTree.js:147-150`) and notes (`:544-547`); `aria-current` renders as the literal string attribute when selected and is absent (`undefined`) otherwise, so `[aria-current="true"].…__tree-label` matches only the freshly-selected row. The hand-group label (`:490-497`) has the class but **never** `aria-current`, so it is correctly never matched.
- **Anchoring on the `…__tree` wrapper `<div>` (`StructureTree.js:620`), not `TreeGrid`, is correct.** The jest mock `TreeGrid` is a plain function component (not `forwardRef`) that hardcodes its own ref callback to stash `__onExpandRow`/`__onCollapseRow` (`test/mocks/wordpress-components.js:478-483`); a ref/`tabIndex` on `TreeGrid` would clobber that stash (which the keyboard-wiring tests depend on) and warn. A plain DOM div behaves identically in real and mock.
- **Unconditional remove bump vs. conditional selection-clear is correct and conflict-free.** The three remove handlers' `setSelection(null)` is conditional (`edit.js:232-234`, `:278-283`, `:306-313`) — it only fires when the removed node was selected. The `"anchor"` bump goes unconditionally after the handler. Because the `"anchor"` branch focuses `treeRef` and never reads `aria-current`, a non-selected-row remove that leaves a different `aria-current` row mounted causes no mis-focus. The `"row"` branch (the only one reading `aria-current`) is reached only from mutators that always `setSelection`, so its target is always fresh.
- **The 10-handler / 7-`"row"`-bump / 3-`"anchor"`-bump map is complete and matches the live handlers.** Verified each auto-select site (`onAddNote` `:195`; `onDuplicateSection` `:330`; `onDuplicateMeasure` `:349`; `onDuplicateNote` `:375`; `insertSectionAt` `:407`; `insertMeasureAt` `:431`; `insertNoteAt` `:466`) and each remove handler. The bare appenders `onAddSection` (`:214-223`) and `onAddMeasure` (`:240-259`) genuinely do **not** call `setSelection`, so the no-focus ruling is correct and consistent; the design's claim that they appear nowhere in `StructureTree.js` holds (the tree is wired only to the before/after variants).
- **Mirrors the in-repo idiom** — `SongCanvas.js:30` already does `import { useEffect, useRef, useState } from "@wordpress/element"` with `useRef(null)` + `useEffect`. Zero new dependencies.
- **e2e baseline confirmed** — `specs/editor.spec.js` has zero `toBeFocused` assertions today, only `.focus()` driver calls at `:1317/:1352/:1384`. The instruction to add net-new focus assertions is correct, and the "do NOT add a jest DOM-focus assertion" guard is right (the `TreeGridCell` mock passes `{}`, mock `:539-543`).

### R-NUM — correctly designs NOTHING

The design adds no change to the 7 `NumberControl` sites (confirmed `PitchEditor.js:69,80` and `HandConfigEditor.js:178` omit `__nextHasNoMarginBottom`). It does not "fix" the no-op prop. Correct.

### R-INVALID mock — correct and sufficient

`VStack`/`__experimentalVStack` is genuinely absent from the mock (`module.exports` at `test/mocks/wordpress-components.js:596-620` has `__experimentalHStack` but no VStack). Adding a `VStack` stand-in byte-identical to the `HStack` mock (`:203-209`), exported as `__experimentalVStack` only, is correct and sufficient (jest asserts text/role/children, never flex direction). The `<p>` drop is safe: the dropped intro string ("can't be edited visually…") appears in **no test** (only in `InvalidState.js:34` source and an `edit.js:57` docstring).

### R-FOLLOWUP dedup — correct

`follow-up` label genuinely does not exist (full label list: `bug`/`duplicate`/`wontfix`/`running...`, the `0 - Intent`…`5 - Docs` stage labels, `PR Opened`, `v1`–`v7`). Issue **#35** ("Editor: highlight the selected section/measure on the sheet-music canvas") is OPEN, unlabelled, and an exact match for the deferred-from-review-9 canvas-highlight follow-up (body cites `data-measure`/`globalMeasureNumber`). The other three follow-ups have no existing issue. So "3 new + relabel #35 = 4 total" is correct, and the `gh label create follow-up` prerequisite is real.

### Coordinate corrections — confirmed

`edit.js` lives at `src/edit.js` ✓. R-DOCS canvas-framing has no second `edit.js` site — `edit.js:58-59` is the JSON-mode bullet; the framing strings are at `edit.js:48-49` ("interactive sheet-music SongCanvas…"), `editor.scss:6-7` ("the surface the author both reads and selects notes on"), and `editor.scss:106` ("interactive canvas wrapper") ✓. `edit.js:533` "`style.scss` lays them out as a flex row" ✓. The `songModel.js` CRITICAL paragraph is on `setSectionAt` (`:328-339`) with `setMeasureAt:354-355` / `setEventAt:382-383` referencing back ✓.

### Test strategy — honest, no false-green path

The jest-assertable vs e2e-only split holds: alignment (`HStack` mock swallows it, mock `:203-209`) and DOM focus (mock passes `{}`) are correctly e2e-only with explicit "do not add a jest assertion" guards; `min-width: 4em` is correctly jest-assertable (the `NumberControl` mock spreads `...rest` incl. `style` onto the `<input>`, mock `:117-137`). The R-DEL test edits, R-JSON `Edit.test.js:309` (`expect(notice.textContent).toBe(errors[0])`), R-TREE flip (`StructureTree.test.js:388-397`, `calls.toggle` currently `[]`), and R-LR3 aria-label locators (`contextControls.test.js:381,398`) were all verified to exist and start from the stated state. The R-LR3 "Note" label change is safe (no test asserts the visible "Alteration note" string).

## Finding (low-severity, self-correcting — not a rejection trigger)

**Wrong directory in the "confirmed coordinates" for `SectionPanel.js`.** The design's *Live-tree coordinates* section asserts **`src/editor/SectionPanel.js`** (design-doc.md:32 and the R-DEL edit at :137), but the file actually lives at **`src/editor/inspector/SectionPanel.js`** (alongside `NotePanel.js`, `MeasurePanel.js`, `SongPanel.js`). The intra-file line numbers are all correct (`confirmOpen` `:85`, "Remove section" `onClick` `:153`, `ConfirmDialog` `:160-172`, "Add measure" `:144`); only the `src/editor/` path prefix is wrong. The research doc uses the bare filename `SectionPanel.js`, which is harmless.

This is a genuine error in a section that claims branch-tip confirmation, but it does not gate approval: the filename is unique (a `find`/grep locates it immediately), it changes neither scope nor buildability, and the design's own mandated "re-confirm against the live tree" step catches it on first touch — exactly the coordinate-drift class the design warns about. **The plan/code phase must read `SectionPanel.js` from `src/editor/inspector/SectionPanel.js`.**

## Verdict

**APPROVED.** The design realizes the spec completely, the one real design problem (R-FOCUS) is sound and buildable with zero new dependencies, and the test strategy does not let a green jest suite mask a broken real component. The single coordinate error is recorded above for the plan/code phase to carry forward.
