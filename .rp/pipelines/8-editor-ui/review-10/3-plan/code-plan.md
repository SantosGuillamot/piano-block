# Code plan — Review 10: Tree-collapse fix, inspector list-row styling, and Gutenberg/simplification polish

_Piano block editor UI, [Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22. Branch `worktree-8-editor-ui`. This plan implements the approved [spec](../1-spec/spec.md) per the approved [design doc](../2-design-doc/design-doc.md)._

## How to use this plan

The code phase runs **one fresh `code-writer` per task**, in the order below. Each task is independently actionable once its listed dependencies have landed. Every task follows TDD: write/adjust the jest test first where the change is jest-assertable, watch it fail, implement, watch it pass, then run the full jest suite and the production build. Behaviors that are **not** jest-assertable (real `@wordpress/components` contract or real DOM focus) are **e2e-verified in `specs/editor.spec.js`** and must **not** be unit-asserted — a unit test that "proves" them would false-green against the mock.

**Coordinates are starting points, not frozen.** Every line number below was confirmed against the branch tip at plan time, but earlier tasks shift later line numbers. **On first touch of a file, each task must re-confirm the cited coordinates against the live tree** (grep for the cited code, not the line number). The line numbers are navigation aids; the code excerpts are the source of truth.

**Confirmed coordinate corrections carried into this plan** (the design has two stale paths; this plan uses the live ones):
- `edit.js` is at **`src/edit.js`** (NOT `src/editor/edit.js`).
- `SectionPanel.js` is at **`src/editor/inspector/SectionPanel.js`** (the design's "confirmed coordinates" line at design-doc.md:32 and the R-DEL edit at :137 wrongly write `src/editor/SectionPanel.js`; the intra-file line numbers are correct, and the filename is unique in the repo).
- Inspector leaf editors are under **`src/editor/inspector/`** (`PitchList.js`, `PitchEditor.js`, `HandConfigEditor.js`, `AnnotationList.js`, `NotePanel.js`, `MeasurePanel.js`, `ContextEditor.js`, `SectionPanel.js`).
- Test files are under **`src/editor/__tests__/`**; the components mock is at **`test/mocks/wordpress-components.js`**.

**Cross-cutting guardrails every task must hold:**
- Keep the **full jest suite green** and the **production build clean** (`npm run build`) at the end of each task. "Tests green must not mask a real broken component" — never add a jest assertion for `alignment` or DOM focus.
- **Editor-side only.** Do not touch the song schema, `render.php`, the front-end SVG, `view.js`, or any mutator/serialization *behavior*. The only `songModel.js` change in scope is a doc-comment trim (Task 9). A published song must render byte-identically.
- **No new outside dependencies.** Only `@wordpress/*` packages already externalized may be used. `@wordpress/compose` is unavailable (no `useMergeRefs`/`useRefEffect`).
- Do **not** pull in out-of-scope work (the rejects, the preserved prior-review wins, or the deferred follow-up *implementations*). When in doubt, consult the spec's "Out of Scope" section.

---

## Task ordering and dependency graph

Tasks 1–9 are code/test changes; Task 10 is project management. The dependency-critical ordering is **R-INVALID's mock extension (Task 7) and R-DEL (Task 4) and R-FOCUS (Task 3) before anything that shares their files**, but each task is scoped to disjoint or well-understood overlapping sites:

- **Task 1 (R-TREE)** — `StructureTree.js` `RowLabelCell` only. Independent.
- **Task 2 (R-DEL)** — `SectionPanel.js` + `StructureTree.js` dialog/state removal. Independent of Task 1 (different region of `StructureTree.js`), but **share the `@wordpress/element` import line of `StructureTree.js` with Task 3** — see the import-coordination note under Task 3.
- **Task 3 (R-FOCUS)** — `edit.js` + `StructureTree.js`. **Depends on Task 2** for the final `StructureTree.js` `@wordpress/element` import line (`useState` is removed by Task 2; `useEffect`/`useRef` are added here). Run Task 3 **after** Task 2.
- **Task 4 (R-LR1/2/3)** — `PitchList.js`, `PitchEditor.js`, `HandConfigEditor.js`, `AnnotationList.js`. Independent of Tasks 1–3.
- **Task 5 (R-JSON)** — `edit.js` JSON-mode `Notice` only. **Touches `edit.js` like Task 3**, but a disjoint region (the JSON-mode branch, ~`:520`, not the mutators). Run **after** Task 3 to avoid edit collisions, or accept that the regions don't overlap and re-confirm coordinates.
- **Task 6 (R-NOOP)** — `NotePanel.js` + `MeasurePanel.js`. Independent.
- **Task 7 (R-INVALID)** — mock extension (`VStack`) + `InvalidState.js`. The mock extension is a **shared prerequisite**: do it first within this task. Independent of other tasks' files.
- **Task 8 (R-DOCS)** — `edit.js` + `editor.scss` + `songModel.js` doc comments. **Touches `edit.js` like Tasks 3 & 5** (disjoint regions: the visual-mode docstring `:48-49`, the workspace comment `:533`). Run **after** Tasks 3 & 5.
- **Task 9 (R-NUM)** — no code change; leaves a one-line rationale note. Independent; can run any time.
- **Task 10 (R-FOLLOWUP)** — `gh` CLI only, no source change. Independent; run last.

**Recommended execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Tasks 4, 6, 7, 9, 10 may run earlier if the runner prefers, since they touch files no other task touches (or, for Task 9, no file at all); only the `StructureTree.js`/`edit.js` chains (2→3, 3→5→8) are hard-ordered.

---

## Task 1 — R-TREE: symmetric label toggle (drop the `if (!isExpanded)` guard)

**Goal.** Make the section/measure row label `Button` toggle expansion in both directions, matching core List View. A collapsed click selects + expands (preserved); an expanded click selects + collapses (new).

**Scope (exact site).** `src/editor/StructureTree.js`, `RowLabelCell` only (currently `:131-160`; the `onClick` is at `:151-154`). Re-confirm by grepping for `if (!isExpanded) onToggleExpanded`.

Change the label `Button`'s `onClick` from:
```js
onClick={() => {
    onSelect?.();
    if (!isExpanded) onToggleExpanded?.(rowKey);
}}
```
to:
```js
onClick={() => {
    onSelect?.();
    onToggleExpanded?.(rowKey);
}}
```

**Also refresh `RowLabelCell`'s JSDoc** (currently `:112-119`): it states "select-and-reveal … when the row is currently collapsed it also calls `onToggleExpanded` … Collapsing stays on the chevron and keyboard callbacks only." Replace that with wording that says the label **always toggles expansion (symmetric)** — a click selects and flips expansion in either direction. (Doc-only; the doc phase may later polish, but update it now so it does not lie about the new behavior.)

**Do NOT touch:**
- The hand-group label `Button` (`:490-497`) — it already calls `onToggleExpanded(handKey)` only (no `onSelect`, no guard) and is already symmetric.
- `TreeExpander` (chevron pointer path), the `TreeGrid` `onExpandRow`/`onCollapseRow` keyboard path, and the add/duplicate auto-reveal seeding in `edit.js`.

**TDD / tests (exactly one flips).**
- **Update** `src/editor/__tests__/StructureTree.test.js` — the test titled "selects but does NOT collapse when an already-expanded section label is clicked" (title at `:388`, inline comment `:393`, `calls.toggle` assertion `:395`). Three edits, all in this one test:
  - The `it(...)` title: it now **does** collapse (e.g. "selects and collapses when an already-expanded section label is clicked").
  - The inline comment at `:393` describing the old expanded-no-collapse behavior — rewrite to describe the symmetric toggle.
  - The `calls.toggle` assertion at `:395`: `[]` → `["s0"]`. The `select` assertion is **unchanged**.
- **Must stay green (do not edit):** the collapsed-section test (select+expand), the collapsed-measure test (select+expand), and the hand-group test. There is no measure-equivalent expanded-no-collapse test, so nothing else flips.

**Acceptance criteria.**
- Clicking an expanded section/measure label selects and collapses it; clicking a collapsed one selects and expands it.
- The chevron and ArrowLeft/Right paths still work (unchanged code).
- Exactly the one flipped test passes; all sibling tree tests stay green; full jest suite green; build clean.

**Dependencies.** None.

---

## Task 2 — R-DEL: drop all section-removal confirm dialogs (rely on native undo)

**Goal.** Make section removal immediate like measure/note/pitch removal. Remove **both** byte-identical `ConfirmDialog`s (the `SectionPanel` one and the `StructureTree` root one) and their gating state.

**Scope (exact sites).**

**A. `src/editor/inspector/SectionPanel.js`** (re-confirm by grepping `confirmOpen` and `ConfirmDialog`):
- Delete the `confirmOpen` state (`:85`, `const [confirmOpen, setConfirmOpen] = useState(false);`).
- Change the "Remove section" `Button` `onClick` (`:153`, currently `() => setConfirmOpen(true)`) to `() => onRemoveSection?.(sectionIndex)`.
- Delete the entire `<ConfirmDialog …>…</ConfirmDialog>` block (`:160-172`).
- Drop the now-unused imports: `__experimentalConfirmDialog as ConfirmDialog` (`:32`) and the entire `import { useState } from "@wordpress/element";` line (`:39`) — `useState` is used **only** by `confirmOpen`, so the whole import goes.

**B. `src/editor/StructureTree.js`** (re-confirm by grepping `pendingRemoveSection`):
- Delete the `pendingRemoveSection` state + setter (`:301`).
- Change the section row's `onRemove` (`:369`, currently `() => setPendingRemoveSection(sectionIndex)`) to `() => onRemoveSection?.(sectionIndex)`, matching the measure/note rows.
- Delete the root `<ConfirmDialog …>…</ConfirmDialog>` block (`:628-640`) at the end of the returned tree.
- Drop the `__experimentalConfirmDialog as ConfirmDialog` import (`:50`).
- **`@wordpress/element` import line (`:59`):** this currently reads `import { useState } from "@wordpress/element";`. After this task removes the only `useState` use, the import is unused. **Coordinate with Task 3:** Task 3 adds `useEffect` and `useRef` here. To keep the suite green between tasks, **this task (Task 2) changes the line to remove `useState`**. If Task 3 has not yet run, leave the import line as `import { useEffect, useRef } from "@wordpress/element";` only if you also add the R-FOCUS code in the same change — otherwise an unused/missing import breaks the build. **Because Task 3 runs immediately after Task 2 in the recommended order, the clean handoff is: Task 2 deletes the whole `import { useState } …` line (no `@wordpress/element` import remains after Task 2), and Task 3 re-adds `import { useEffect, useRef } from "@wordpress/element";`.** Either way, end each task with a building file: verify no `useState` reference remains in `StructureTree.js` after Task 2.

**Class docstring refresh (`StructureTree.js:21-33`).** The current block documents the now-removed `pendingRemoveSection` / root-`ConfirmDialog` flow ("It holds one piece of UI state — `pendingRemoveSection` … a single `ConfirmDialog` at the tree root gates the actual removal. Measure and note removes remain immediate."). Replace it so it documents (1) no `pendingRemoveSection` / no `ConfirmDialog`, (2) section Remove now fires immediately like measure/note, and (3) the undo-not-confirm rationale. **Note:** the design also folds the NEW `focusRequest`/`treeRef` focus machinery into this same docstring. To avoid a docstring that describes code not yet present, **this task (Task 2) writes the R-DEL half of the docstring** (no pending-remove, immediate removal, undo-not-confirm) and **Task 3 extends it** with the focus-management paragraph. Use the design-doc.md:143 model paragraph as the source for the wording, splitting it: the "Every Remove item … removals are recoverable through WordPress's native undo, so there is no confirm dialog" sentence lands in Task 2; the "`focusRequest` (`{ id, kind }`) … `tabIndex=-1` anchor … plain selection click carries no `focusRequest`" sentences land in Task 3. The existing "Hand-group rows are organizational…" sentence (`:34-36`) stays unchanged. (The doc phase may polish wording later; the **facts** are load-bearing.)

**Leave untouched:** the immediate measure/note/pitch removes (no change).

**TDD / tests to update.** All under `src/editor/__tests__/`:
- **`SectionPanel.test.js`** — the two "remove section" tests (`:255-265` and `:267-277`) each drop their `click(…, "OK")` confirm step (the button now removes directly). **Delete** the cancel test "does not call onRemoveSection when confirm cancelled" (`:279-285`).
- **`StructureTree.test.js`** — the section remove/duplicate test (`:457-479`) drops its `click(container, "OK")` step (`:477`). **Delete** the cancel test "does not remove a section when the confirm dialog is cancelled" (`:481-493`).
- **`Edit.test.js`** — the `onRemoveSection` test (`:457-474`) drops its "OK" click (`:463`) and updates the "opens a ConfirmDialog" comment (`:461`) to reflect immediate removal.
- Update the TDD order: change/delete these tests first, watch them fail against the old code, then implement the source removal, then watch them pass.

**Acceptance criteria.**
- All four delete sites (section, measure, note, pitch) fire immediately; no `ConfirmDialog` remains for section removal anywhere.
- `SectionPanel`'s `confirmOpen` and `StructureTree`'s `pendingRemoveSection` state are gone; the unused `ConfirmDialog`/`useState` imports are removed (in `SectionPanel.js`; in `StructureTree.js` the `@wordpress/element` import is left consistent with the Task 2/3 handoff above).
- The listed tests are updated and the two cancel-path tests deleted; full jest suite green; build clean.
- A removed node is restorable via the editor's native undo (recoverability rationale; not separately asserted).

**Dependencies.** None (run before Task 3). **Hard-orders before Task 3** via the shared `StructureTree.js` import line.

---

## Task 3 — R-FOCUS: post-mutation focus management (`focusRequest` signal + one effect)

**Goal.** After a structural mutation, move DOM focus so a keyboard user is never stranded:
- **Add/duplicate** → focus the newly-selected row's label `Button` (the `aria-current` `.…__tree-label`).
- **Remove** → focus the tree container (`tabIndex={-1}` anchor) so focus lands back in the tree region instead of `<body>`.

This is the **largest task**. Plan it carefully. The mechanism is a monotonic `focusRequest {id, kind}` state in `src/edit.js`, consumed by a single `useEffect` in `StructureTree`. **No `cellProps` changes, no per-row refs, no `@wordpress/compose`.**

**Scope A — the signal (`src/edit.js`).**
- Add one state: `const [focusRequest, setFocusRequest] = useState(null);` (no new import — `useState` is already imported at `:12`).
- Pass it down: add `focusRequest={focusRequest}` to the `<StructureTree … />` element (currently `:536-556`).
- **Bump map** — insert a one-line bump right after the existing `setSelection(...)` in each listed handler. There are **7 `"row"` bump sites** and **3 `"anchor"` bump sites** (10 public handlers; the three `insert*` helpers each back two before/after wrappers, so the bump goes in the helper once):
  - `kind: "row"` — `setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "row" }));` immediately after the `setSelection({...})` in:
    - `onAddNote` (after the `setSelection({ kind: "event", … })` at ~`:195-201`; place it after the `revealAncestors(...)` call too is fine, but right after `setSelection` matches the design — put it after `setSelection`, before or after `revealAncestors`; order does not matter since both run in the same commit).
    - `onDuplicateSection` (after `setSelection({ kind: "section", sectionIndex: sectionIndex + 1 })` at ~`:330`).
    - `onDuplicateMeasure` (after `setSelection({ kind: "measure", … })` at ~`:349-353`).
    - `onDuplicateNote` (after `setSelection({ kind: "event", … })` at ~`:375-381`).
    - `insertSectionAt` (after `setSelection({ kind: "section", sectionIndex: target })` at ~`:407`) — covers `onAddSectionBefore` + `onAddSectionAfter`.
    - `insertMeasureAt` (after `setSelection({ kind: "measure", … })` at ~`:431`) — covers `onAddMeasureBefore` + `onAddMeasureAfter`.
    - `insertNoteAt` (after `setSelection({ kind: "event", … })` at ~`:466-472`) — covers `onAddNoteBefore` + `onAddNoteAfter`.
  - `kind: "anchor"` — `setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "anchor" }));` **unconditionally, at the END of the handler, OUTSIDE the selection-match `if` guard**:
    - `onRemoveSection` — after the whole handler body ends (after the `if (selection?.sectionIndex === …) setSelection(null)` block at ~`:232-234`); the bump is at handler end, not inside the `if`.
    - `onRemoveMeasure` — after the handler ends (after the section+measure-match guard whose `setSelection(null)` is at ~`:282`).
    - `onRemoveNote` — after the handler ends (after the full-coord-match guard whose `setSelection(null)` is at ~`:312`).
- **No bump** (do NOT add): `onAddSection` and `onAddMeasure` (the two bare appenders — they deliberately do not `setSelection`, so there is no `aria-current` row to focus; adding focus would force adding selection, contradicting their no-select design), and plain `onSelect` (`edit.js` passes `setSelection` directly as `onSelect`; a plain click must never steal focus or it would break the roving tabindex).

**Subtle correctness (load-bearing).** The remove handlers' `setSelection(null)` is **conditional** (only when the removed node was selected). The focus bump must be **unconditional** — any "Remove" from any row loses the unmounting button's focus to `<body>`. So selection-clear stays inside the guard; the `"anchor"` bump goes unconditionally after it. This is conflict-free: the `"anchor"` branch ignores `aria-current` (it just focuses `treeRef`), and the `"row"` branch's mutators always `setSelection`, so its target is always fresh.

**Scope B — the effect (`src/editor/StructureTree.js`).**
- Add `import { useEffect, useRef } from "@wordpress/element";` (re-adding the `@wordpress/element` import that Task 2 removed; mirrors the in-repo idiom at `SongCanvas.js:30`).
- Add `focusRequest` to the component's prop signature (the `StructureTree({ … })` destructure at `:277-297`) and to its JSDoc `@param` block (`:252-275`).
- Add `const treeRef = useRef(null);` near the top of the component body (where `pendingRemoveSection` used to be).
- Add the single effect:
  ```js
  useEffect(() => {
      if (!focusRequest) return; // null = mount, no fire
      if (focusRequest.kind === "row") {
          treeRef.current
              ?.querySelector(
                  '[aria-current="true"].wp-block-piano-block-piano__tree-label',
              )
              ?.focus();
      } else if (focusRequest.kind === "anchor") {
          treeRef.current?.focus();
      }
  }, [focusRequest]);
  ```
- Put `ref={treeRef}` and `tabIndex={-1}` on the existing `…__tree` host `<div>` (`:620`, `<div className="wp-block-piano-block-piano__tree">`). **Do NOT** place the ref/`tabIndex` on `<TreeGrid>` — the jest mock `TreeGrid` is a plain function component that hardcodes its own ref to stash `__onExpandRow`/`__onCollapseRow`, and a ref/`tabIndex` there would clobber that stash and warn; a plain DOM div behaves identically in real and mock.
- **Extend the class docstring** (begun in Task 2) with the focus-management paragraph: the parent passes a monotonic `focusRequest` (`{ id, kind }`) bumped on every structural mutation; a `useEffect` keyed on it moves DOM focus through `treeRef` — after add/duplicate it focuses the newly-selected row's label (`aria-current` `.…__tree-label`), after a remove it focuses the container itself (a `tabIndex=-1` anchor); a plain selection click carries no `focusRequest`, so it never steals focus. Use design-doc.md:143 as the wording source.

**Design rationale to preserve (do not "improve"):**
- The querySelector (not a ref-merge) is deliberate — `@wordpress/compose`/`useMergeRefs` is unavailable and a hand-rolled second ref on the roving label `Button` would risk the roving tabindex model. The selector hits a uniquely-identified node (`aria-current="true"` + the label class on the same element across section/measure/note rows; the hand-group label has the class but never `aria-current`, so it is correctly never matched).
- `null` initial + the `if (!focusRequest) return` guard makes mount a no-op (no focus steal on first render).
- The functional updater keeps the monotonic `id` correct under React batching; a fresh object each mutation gives unique identity so the effect fires exactly once per mutation.

**TDD / tests — split by what the mock can faithfully represent.**

- **e2e-only (real DOM focus — jest would false-green):** extend `specs/editor.spec.js` with **new** `toBeFocused` assertions:
  - After an add/duplicate, focus is on the new row's label `Button`.
  - After a remove, focus is in the tree region (the `treegrid` host / `…__tree` div), **not** `<body>`.
  - The suite currently has zero focus assertions (only `.focus()` driver calls at `:1317/:1352/:1384`), so these are net-new. Locate or add the structural drill-down needed to add/duplicate/remove a row and assert focus.
  - **DO NOT** add a jest test asserting DOM focus: the `TreeGridCell` mock passes `{}` to its render-prop child (`test/mocks/wordpress-components.js:543`), so any ref-based `.focus()` is inert under jest and a focus assertion would false-green.
- **jest — structural precondition only:** the new row carries `aria-current` after add/duplicate. This is **already covered** by the existing `StructureTree.test.js` aria-current block; **no new jest assertion is required** for the precondition, and **no** jest test may assert that focus actually moved. If the runner wants an explicit guard, it may assert `aria-current` presence — but never `toHaveFocus`/`document.activeElement` against the mock.

**Acceptance criteria.**
- In e2e: after add/duplicate, focus is on the new row's label; after remove, focus is in the tree region, never `<body>`.
- In jest: the new row carries `aria-current` after add/duplicate (structural precondition); no jest test asserts DOM focus.
- The focus machinery lives only inside `StructureTree`; `edit.js` gains exactly one `useState`, the 10 bumps, and the one prop pass — no refs, no `.focus()`, stays declarative.
- The `…__tree` div is `tabIndex={-1}` with `ref={treeRef}`; `<TreeGrid>` is untouched.
- Full jest suite green; e2e spec green; build clean.

**Dependencies.** **Task 2** (shared `StructureTree.js` `@wordpress/element` import; Task 3 re-adds `useEffect`/`useRef`). Run immediately after Task 2.

---

## Task 4 — R-LR1/2/3: inspector list-row Stage 1 (alignment value, inline min-width, label string)

**Goal.** Fix the visible list-row symptoms with **no new component**: center the trash against the field block, floor the collapsing middle `NumberControl`s, and shorten one wrapping label.

**Scope (exact sites).** Re-confirm each by grep.

**R-LR1 (alignment) — change `alignment="flex-start"` → `alignment="center"` on the three `__list-row` `HStack`s:**
- `src/editor/inspector/PitchList.js:43`.
- `src/editor/inspector/HandConfigEditor.js:164`.
- `src/editor/inspector/AnnotationList.js:57` (applied for consistency even though only the two `NumberControl` rows have the collapse).

**R-LR2 (inline min-width) — add `style={{ minWidth: "4em" }}` to the three collapsing `NumberControl`s:**
- `src/editor/inspector/PitchEditor.js:69` (Octave) and `:80` (Alteration).
- `src/editor/inspector/HandConfigEditor.js:178` (Alteration). **Do NOT** add it to `HandConfigEditor.js:142` (that is the octave-shift `NumberControl`, a different control in a different row — leave it; it is one of the 7 R-NUM sites and is not a collapsing list-row middle field).
- Value is **4em**, not 8em (holds a signed 2–3-digit number; the leading selects keep the existing 8em first-child floor in `editor.scss`).
- None of these currently has a `style=` prop, so this is a clean add.

**R-LR3 (label) — change the visible label "Alteration note" → "Note":**
- `src/editor/inspector/HandConfigEditor.js:168` (the visible `label=` string only).
- **Leave the scoped aria-label at `:169` unchanged** (`fieldLabel("alteration note")` → e.g. "Right hand alteration note"). The two `contextControls.test.js` tests locate this select off the **aria-label**, not the visible label.

**TDD / tests.**
- **jest-assertable (R-LR2):** the mock `NumberControl` spreads `...rest` (incl. `style`) onto its `<input>`, so the inline `min-width` reaches the DOM. Add assertions that `input.style.minWidth === "4em"` at the three sites, in the relevant `__list-row` hook tests (`pitches.test.js` for the two PitchEditor sites; `contextControls.test.js` for the HandConfigEditor Alteration site — locate the inputs the way the existing tests locate controls). Write the assertion first, watch it fail, then add the inline style.
- **NOT unit-assertable (R-LR1):** the `HStack` mock swallows `alignment` (it destructures and discards it), so `center` is invisible to jest. **Do NOT add a unit test for alignment** — it would falsely "prove" it. Verify in e2e / real render (the trash icon centers against the field block). Optionally note it for e2e coverage, but it is not a unit gate.
- **R-LR3 green-check:** `contextControls.test.js`'s two tests that locate the alters select by aria-label "Right hand alteration note" (around `:377` and `:390`, with the filter at `:398`) must **stay green** — they key off the unchanged aria-label, not the visible label. No test asserts the visible "Alteration note" string. Confirm green; do not edit them.

**Acceptance criteria.**
- The two multi-field rows render their middle `NumberControl`s at a usable width (no collapsed inputs, no "OCTAVEALTERATION" label collision) — unit-assertable via the inline `min-width: 4em` reaching the DOM at the three sites.
- The "Alteration note" visible label is now "Note" and no longer wraps; its aria-label is unchanged; the `contextControls` tests stay green.
- The list-row `HStack`s use `alignment="center"`; the trash icon centers against the field block (e2e / real-render verified — **not** unit-asserted).
- No new component introduced; full jest suite green; build clean.

**Dependencies.** None.

---

## Task 5 — R-JSON: JSON-mode validation Notice shows every error

**Goal.** Render every validator message in the JSON-mode `Notice`, not just `errors[0]`, mirroring `InvalidState`'s `<ul>`/keyed `<li>` list.

**Scope (exact site).** `src/edit.js`, the JSON-mode `Notice` (`:520-524`; the `{errors[0]}` is at `:522`). Re-confirm by grepping `{errors[0]}`. Replace the single `{errors[0]}` child with a mapped `<ul>` of keyed `<li>` mirroring `InvalidState.js:38-44`:
```jsx
<Notice status="error" isDismissible={false}>
    <ul>
        {errors.map((message, index) => (
            // Validator messages have no stable identity beyond their
            // position; the list is short and rebuilt on every change.
            <li key={index}>{message}</li>
        ))}
    </ul>
</Notice>
```
`Notice` is already imported. (Match `InvalidState`'s comment/keying idiom for consistency; keep it minimal — a bare `<ul>` is fine since the surrounding `Notice` already frames it.)

**TDD / tests.**
- **`src/editor/__tests__/Edit.test.js:309`** — currently `expect(notice.textContent).toBe(errors[0])`. Change it to assert **every** error renders: e.g. the notice text contains each message, or there is one `<li>` per error. Use a multi-error invalid song so `errors.length > 1` is meaningful (if the existing test's fixture yields only one error, extend the fixture so multiple validator messages are produced). Write the new assertion first, watch it fail against the old single-error render, then implement.

**Acceptance criteria.**
- With multiple validator errors, JSON mode renders every message (mirroring `InvalidState`).
- `Edit.test.js:309` asserts all errors render, not just `errors[0]`; full jest suite green; build clean.

**Dependencies.** Touches `edit.js` (disjoint region from Task 3's mutators and Task 8's docstrings). Run **after Task 3** to avoid `edit.js` edit collisions; re-confirm the `{errors[0]}` coordinate on touch.

---

## Task 6 — R-NOOP: drop redundant `?? undefined` on annotation emit (2 sites)

**Goal.** Remove the no-op coalesce; `AnnotationList` already collapses empty → `undefined`.

**Scope (exact sites).** Re-confirm by grepping `annotations ?? undefined`.
- `src/editor/inspector/NotePanel.js:235` — change `annotations ?? undefined` → `annotations` in the `omitFalsy(...)` call (inside the `AnnotationList` `onChange` callback).
- `src/editor/inspector/MeasurePanel.js:136` — same change.

**TDD / tests.** No test change. Behavior is unchanged (empty annotations still drop the key, because `AnnotationList` already emits `undefined`). Run the existing annotation tests and confirm they stay green.

**Acceptance criteria.**
- Both sites pass `annotations` (no `?? undefined`) to `omitFalsy`; empty annotations still drop the key; existing annotation tests green; full jest suite green; build clean.

**Dependencies.** None.

---

## Task 7 — R-INVALID: drop the redundant `<p>`, wrap `InvalidState` in `VStack` (extend the mock first)

**Goal.** Simplify `InvalidState`'s markup and adopt `VStack`. This requires extending the components mock with `VStack` **first**, or the new import fails under jest.

**Scope.**

**A. Mock prerequisite (do this first, within this task).** `test/mocks/wordpress-components.js` — add a `VStack` stand-in **byte-identical to the `HStack` mock** (the `HStack` mock is at `:203`; it swallows `alignment`/`spacing` and spreads `...rest` onto a `<div>`). Export it as **`__experimentalVStack` only** — one new line in `module.exports` next to the existing `__experimentalHStack` export, mirroring `HStack`'s experimental-only export. **Do NOT** add a bare `VStack` export key (nothing imports it). (jest asserts text/role/children, never flex direction, so a `<div>` is faithful.)

**B. Source (`src/editor/InvalidState.js`).** Re-confirm by reading the component (`:28-50`).
- Change the import line (`:17`) to:
  ```js
  import { Button, Notice, __experimentalVStack as VStack } from "@wordpress/components";
  ```
- Replace the outer `<div>` (`:30` open, `:49` close) with `<VStack>…</VStack>`, grouping the `Notice` and the "Edit as JSON" `Button`.
- **Drop the redundant `<p>`** (`:32-37`).
- **Keep the `<ul>` error list** (`:38-44`) inside the `Notice` verbatim — including its inline comment and `key={index}`.

**TDD / tests.**
- Adding the `VStack` mock is the prerequisite that keeps the import resolvable; without it the `InvalidState`-driven tests (and anything importing it) fail to load. Add the mock, then change the source.
- The existing invalid-state tests (driven through `Edit.test.js` and any `InvalidState`-specific test) locate the error messages by `<li>` text and the button by role/name — the `<ul>` and `Button` are kept, so they must **stay green**. Confirm green; no assertion changes are required for the dropped `<p>` (verify no test asserts the `<p>`'s sentence text; if one does, it locates it as message text that still appears — re-confirm on touch and adjust only if a real assertion breaks).

**Acceptance criteria.**
- `InvalidState` drops the redundant `<p>` and wraps its container in `VStack`, keeping the `<ul>`.
- The mock exports `__experimentalVStack` (byte-identical to `HStack`); no bare `VStack` key added; **no** `FlexItem`/`FlexBlock` added (that is Stage 2, deferred).
- The error messages and "Edit as JSON" button still render; tests that locate them by text/role stay green; full jest suite green; build clean.

**Dependencies.** None (self-contained: mock + source).

---

## Task 8 — R-DOCS: documentation corrections (docs-only, no behavior change)

**Goal.** Correct three classes of misleading comments. **No behavior change; no source logic touched.**

**Scope (exact sites).** Re-confirm each by grep; **verify no test asserts the old wording before changing** (the design confirms no test *asserts* these source strings — incidental test-author *comments* using "interactive"/"reads and edits" are not assertions and do not gate the change).

**A. Canvas framing → "display + highlight only"** (three spots — there is **no second `edit.js` site**; the spec's cited `edit.js:58-59` is the JSON-mode bullet, not a canvas-framing line):
- `src/edit.js:48-49` — the visual-mode docstring (currently "an interactive sheet-music `SongCanvas` the author both reads and edits on"). Reframe to display + highlight only (the canvas shows the score and highlights the selection; it is not a click-to-select surface).
- `src/editor.scss:6-7` — currently "The interactive sheet-music canvas is the surface the author both reads and selects notes on". Reframe to display + highlight only.
- `src/editor.scss:106` — currently "The interactive canvas wrapper". Drop "interactive" / reframe to display + highlight wrapper.
- **Reject** wiring click-to-select — that is a net-new feature the canvas comment itself defers (out of scope).

**B. Stylesheet name** — `src/edit.js:533` currently says "`style.scss` lays them out as a flex row". The flex rule is actually in `editor.scss` (the `&__workspace` rule at `editor.scss:35-44`; `style.scss` is `@font-face` only). Change `style.scss` → `editor.scss`. One-word fix.

**C. CRITICAL doc-block trim** — `src/editor/songModel.js`:
- `setSectionAt`'s full cautionary paragraph (the CRITICAL block; re-confirm range by reading — plan-time coordinates are `:328-335`, design cites `:328-339`) → trim to ~one line that preserves the essential caution.
- `setMeasureAt` (`:354`) and `setEventAt` (`:382`) already reference back to `setSectionAt` — **leave those reference-back comments unchanged**.
- **Keep all three depth-splice helpers distinct** — merging into `setAt(song, coords, depth)` is on the reject list (it reintroduces the depth-as-data hazard the doc warns about; each panel needs a fixed depth). Only the prose is trimmed; **no structural change**.

**TDD / tests.** No test change; this is docs-only. **Before editing**, grep the changed source strings across the test suite to confirm none is asserted (the design lists incidental comment uses in `Edit.test.js:222`, `specs/editor.spec.js:189,191,440,1116`, `specs/render.spec.js:527` — these are test-author comments, not assertions, and do not gate the change; refreshing them is optional polish, not required). After editing, run the full suite to confirm nothing breaks.

**Acceptance criteria.**
- The canvas "interactive" framing comments in `edit.js` and `editor.scss` now read "display + highlight only".
- `edit.js:533` names `editor.scss` (not `style.scss`).
- The `songModel.js` CRITICAL doc-block prose is trimmed to ~one line on `setSectionAt`, all three helpers kept distinct, the two reference-back comments unchanged.
- No behavior change; no test asserts the old wording; full jest suite green; build clean.

**Dependencies.** Touches `edit.js` (disjoint regions from Tasks 3 & 5). Run **after Tasks 3 & 5**; re-confirm coordinates on touch.

---

## Task 9 — R-NUM: leave `__nextHasNoMarginBottom` omitted on all 7 `NumberControl` sites (change nothing; record the rationale)

**Goal.** Make **no code change** to the 7 `NumberControl` sites. Leave the prop omitted. Record a one-line note pointing to the real-contract rationale so a future review does not re-raise it.

**Scope.**
- **No source change** to: `PitchEditor.js:69,80`; the two `NumberControl`s in `ContextEditor.js` (bpm `:127` + beats `:149`); `HandConfigEditor.js:142,178`; `NotePanel.js:179`.
- **Leave a one-line code/PR note** recording the rationale: the prop is a **no-op** on the experimental `NumberControl` (it does not destructure `__nextHasNoMarginBottom`; it renders `InputControl`, whose `<BaseControl>` hardcodes `__nextHasNoMarginBottom={true}`, so `NumberControl` is margin-free by construction). Gutenberg issue #73848 deliberately excludes `NumberControl`/`InputControl` from the bottom-margin deprecation, so the sibling-vs-`NumberControl` asymmetry is correct by design. Put this note where the next reader will see it — the recommended placement is a short comment in the PR description and/or a one-line code comment at one representative `NumberControl` site (e.g. above `PitchEditor.js:69`) referencing the decision. Keep it to one line; do not over-document.

**TDD / tests.** No test change. **Confirm no test asserts `__nextHasNoMarginBottom` on a `NumberControl`** (grep the suite). Full suite stays green.

**Acceptance criteria.**
- All 7 `NumberControl` sites still omit `__nextHasNoMarginBottom`; no test asserts the prop on a `NumberControl`.
- A one-line note records the real-contract rationale.
- Full jest suite green; build clean (no change to assert beyond "nothing regressed").

**Dependencies.** None. (Caution: this task's R-LR2 sibling, Task 4, adds `style` to two of these same sites — `PitchEditor.js:69,80` and `HandConfigEditor.js:178`. That is the **min-width** add, NOT the margin prop; the two are unrelated and do not conflict. Task 9 must not remove or alter Task 4's `style` prop, and Task 4 must not add `__nextHasNoMarginBottom`.)

---

## Task 10 — R-FOLLOWUP: file 3 new tracking issues + relabel #35 (4 total; implement none)

**Goal.** Create the `follow-up` label, relabel the existing canvas-highlight issue, and file the three missing follow-ups. **Implement none of the deferred work.** Use the `gh` CLI only; no source change.

**Scope (`gh` CLI).** Confirmed at plan time: no `follow-up` label exists; issue **#35** ("Editor: highlight the selected section/measure on the sheet-music canvas") is **OPEN and unlabelled** and is an exact match for the canvas-highlight follow-up.

1. **Create the label:** `gh label create follow-up --description "Deferred follow-up work tracked for a future run" --color <hex>` (pick a sensible color; re-run-safe — if it already exists from a partial prior run, that is fine, just proceed).
2. **Relabel #35** (do NOT re-file it): `gh issue edit 35 --add-label follow-up`.
3. **Create the 3 missing follow-up issues** with `gh issue create --label follow-up`, each with a clear title and a body describing the deferred work (and noting it is deferred from review 10 of PR #22):
   - **`edit.js` 13-mutator descriptor-table refactor** (`edit.js:179-479`; ~120–150 lines saveable but risky — touches the mutation core; each explicit mutator is individually testable; gate behind "only if levels/reveal rules change").
   - **List-row Stage 2** — replace the `editor.scss` positional `> :first-child` / `> button:last-child` selectors (the `.__list-row` rule, currently `editor.scss:28-31`) with `Flex` + `FlexBlock` (fields) + `FlexItem` (trash); requires extending the components mock with `FlexItem`/`FlexBlock` (only `Flex` is exported today) and updating the three `__list-row` hook tests (`pitches.test.js`, `annotations.test.js`, `contextControls.test.js`) — which assert only the `.__list-row` className on the outer container, so they survive a `Flex` swap provided that className stays on the outer container. (Stage 1 shipped this run as Task 4.)
   - **Precise nearest-surviving-sibling/parent focus after remove** — real index math with edge cases (last row, parent removal, empty tree); the R-FOCUS stable-anchor fix (Task 3) cures the actual P1 harm, so this is genuine polish, riskier, and e2e-only to verify.

**Verification.** After filing, confirm with `gh issue list --label follow-up` that **exactly four** issues carry the label: #35 (relabelled) + the 3 new ones. Do **not** create a 4th new issue duplicating #35.

**Acceptance criteria.**
- The `follow-up` label exists; #35 is relabelled `follow-up`; three new `follow-up` issues exist for the three items above.
- `gh issue list --label follow-up` shows 4 total (3 new + #35).
- **No corresponding code change lands** — this task is project-management only.

**Dependencies.** None. Run last (after the code is in, so issue bodies can reference what shipped vs. what is deferred, if useful — but not strictly required).

---

## Final verification checklist (the code phase as a whole)

After all tasks land, a reviewer can confirm completeness against the spec's Acceptance Criteria (spec.md §"Acceptance Criteria", items 1–11). The concrete gates:

- **Build:** `npm run build` clean.
- **jest:** the full suite passes — including the one flipped R-TREE test, the updated R-DEL tests (two cancel tests deleted), the updated R-JSON multi-error test, and the new R-LR2 `min-width` assertions; the `VStack` mock is present; **no jest test asserts `alignment`, DOM focus, or `__nextHasNoMarginBottom` on a `NumberControl`**.
- **e2e:** `specs/editor.spec.js` passes — including the new R-FOCUS `toBeFocused` assertions (new-row label after add/duplicate; tree region after remove).
- **Cross-cutting:** no song-schema / `render.php` / front-end-SVG change (published song byte-identical); only `@wordpress/*` packages; no `@wordpress/compose`; no `FlexItem`/`FlexBlock` added or relied upon this run.
- **Follow-ups:** four `follow-up`-labelled issues exist; none of the deferred work is implemented.
