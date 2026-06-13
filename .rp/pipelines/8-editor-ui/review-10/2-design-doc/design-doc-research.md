# Design research — Review 10 (Piano block editor UI, PR #22)

This document records the design Q&A with the design-doc-researcher and the
settled, implementation-level design decisions for review-10. The spec
(`1-spec/spec.md`) is decision-complete on *what* changes; this design fixes the
*how*: exact edit sites, how the new focus machinery threads through the
purely-controlled `StructureTree`, the test strategy (which jest tests flip vs.
which behaviors are e2e-only), and the required jest-mock additions.

It is a layered review change to an already-sound editor. The design stays
minimal and idiomatic to the existing code; nothing the spec leaves untouched is
redesigned.

## Live-tree coordinate corrections (confirmed at design start)

The spec's file/line references are run-start starting points. Confirmed against
the branch tip before designing:

- **`edit.js` lives at `src/edit.js`**, not `src/editor/edit.js`. The JSON-mode
  Notice renders `errors[0]` at `src/edit.js:522` (block `:520-524`); the
  `style.scss` doc-error is at `src/edit.js:533` (verbatim "style.scss lays them
  out them as a flex row"); the canvas "interactive" framing is in the
  visual-mode docstring at `:48-49` (`an interactive sheet-music SongCanvas the
  author both reads and edits on`).
- **R-DOCS coordinate correction (researcher-confirmed).** The spec/research cite
  `edit.js:58-59` as a *second* canvas-framing site, but `:58-59` is the JSON-mode
  bullet — there is **no** second "selects notes on" phrase in `edit.js`. The
  "the surface the author both reads and selects notes on" phrasing lives in
  `editor.scss:6-7`, and "interactive canvas wrapper" lives at `editor.scss:106`.
  So the R-DOCS canvas-framing edits are: `edit.js:48-49` (one spot) +
  `editor.scss:6-7` + `editor.scss:106` — NOT a second `edit.js` location.
- **`editor.scss`** root list-row rule is at `src/editor.scss:27-30`
  (`> button:last-child { flex: 0 0 auto }` + `> :first-child { min-width: 8em }`,
  spec said `:28-31`); the canvas framing is at `:6-7` (+ `:106`); the workspace
  flex rule is at `:35-44` (spec said `:38-43`).
- **`StructureTree.js`** matches the spec: `RowLabelCell` Button `onClick` guard
  at `:151-154`; `pendingRemoveSection` state at `:301`; root `ConfirmDialog` at
  `:628-640`; the orphaned class docstring describing the removed flow at
  `:21-33`; the `…__tree` host `<div>` at `:620`; the `<TreeGrid>` at `:621-627`.
  It imports only `useState` from `@wordpress/element` and has zero
  `useRef`/`useEffect`/`.focus()` today.
- **`songModel.js`** CRITICAL doc-block: the full paragraph is on `setSectionAt`
  at `:328-339` (spec said `:328-335`); `setMeasureAt` (`:354-355`) and
  `setEventAt` (`:382-383`) already reference back. Three helpers distinct.
- **`InvalidState.js`** matches: hand-rolled `<p>/<ul>/<li>` in a `Notice` at
  `:30-49`; imports `Button, Notice` from `@wordpress/components`.
- **`SectionPanel.js`**: `confirmOpen` state at `:85`; `ConfirmDialog` at
  `:160-172`; "Remove section" button `onClick={() => setConfirmOpen(true)}` at
  `:153`. `useState` is imported and used **only** by `confirmOpen`, so dropping
  the dialog lets the `useState` import be removed entirely.
- **Inspector list-row sites** (researcher-corrected line numbers):
  `PitchList.js:43` (`alignment="flex-start"`), className `:44`;
  `PitchEditor.js:69,80` (the two collapsing `NumberControl`s);
  `HandConfigEditor.js:164` (`alignment="flex-start"`), `:168` (visible label
  "Alteration note"), `:169` (scoped aria-label), `:178` (collapsing `NumberControl`).
- **Mock** (`test/mocks/wordpress-components.js`): exports `Flex` (no
  `FlexItem`/`FlexBlock`), `HStack` (swallows `alignment`), `NumberControl`
  (spreads `...rest` incl. `style` onto the `<input>`), `ConfirmDialog`,
  `TreeGridCell` (calls its render-prop child with `{}` — `:539-544`). No `VStack`.
- **e2e** (`specs/editor.spec.js`, 1392 lines): has a `treeRow(editor, name)`
  helper (`:301`), a `structureTree`/`__tree` locator (`:270-276`), `aria-current`
  assertions after insert (`:722-727`, `:751-752`), and the existing
  remove-drill pattern (`treeRow(...).focus()` + keyboard at `:1317/:1352/:1384`).

### Test-file path corrections (confirmed)

The spec's bare filenames map to these live paths; the line-ranges all match:

- `Edit.test.js` → `src/editor/__tests__/Edit.test.js`. R-JSON site `:309`
  (`expect(notice.textContent).toBe(errors[0])`); R-DEL `onRemoveSection` test at
  `:457-474` (drops the `click(...,"OK")` at `:463`, updates the comment at `:461`).
- `StructureTree.test.js` → `src/editor/__tests__/StructureTree.test.js`. R-TREE
  flip at `:388-397`; R-DEL section remove/duplicate test at `:456-480` (drops
  `click(container, "OK")` at `:477`), cancel test at `:482-494` (deleted).
- `SectionPanel.test.js` → `src/editor/__tests__/SectionPanel.test.js`. R-DEL: two
  remove tests at `:254-264` and `:267-277` drop their `click(...,"OK")`; cancel
  test at `:280-287` (deleted).
- `contextControls.test.js` (R-LR3 green-check, locates the alters select by its
  unchanged aria-label "Right hand alteration note") and the three `__list-row`
  hook tests are under `src/editor/__tests__/` (verified at design time).

### `@wordpress/compose` is NOT available (governs the R-FOCUS ref design)

`grep` finds zero `@wordpress/compose` usage in `src/`, zero `wp-compose` entry
in the build asset, and zero `@wordpress/compose` refs in `package-lock.json`. So
`useMergeRefs`/`useRefEffect`/`mergeRefs` are **not** in scope without adding a new
externalized dependency — which the "only `@wordpress/*` already available" /
"no new outside dependencies" constraint and the editor's current import surface
discourage. The R-FOCUS ref-merge (if a ref approach is chosen) must be either a
hand-rolled callback-ref merge or avoided entirely via the querySelector approach.

### R-FOLLOWUP: no `follow-up` label exists yet

`gh label list` shows the repo's labels are `bug`/`duplicate`/`wontfix`/`running…`,
the pipeline-stage labels (`0 - Intent` … `5 - Docs`), `PR Opened`, and `v1`…`v7`.
There is **no `follow-up` label**. The R-FOLLOWUP design must therefore have the
implementing phase create it first (`gh label create follow-up`) before filing the
four issues with `--label follow-up`, rather than assume it exists.

---

## Design Q&A

### Q1 / A1 — R-FOCUS mechanism (the only non-trivial design problem)

**Question.** `StructureTree` is purely controlled with no refs/effects/`.focus()`
today and `@wordpress/compose` (hence `useMergeRefs`) is unavailable. Settle the
exact machinery for the 3-way post-mutation focus: (a) add/dup → focus the new
row's label Button; (b) remove → focus a stable anchor (no `<body>` dump); (c)
plain user click-select → do nothing (must not steal focus / break roving
tabindex). Settle the trigger, the add/dup target (ref vs querySelector), the
anchor node, and the effect timing.

**Researcher findings (verified against Gutenberg v21.9.0 source + the jest mock
+ repo deps):**

- **In-repo precedent (decisive for idiom).** `SongCanvas.js:30` already does
  `import { useEffect, useRef, useState } from "@wordpress/element"` and uses the
  `useRef(null)` + container-`useEffect([deps])` pattern (`:97,106,131,136`). So
  mirroring that in `StructureTree` adds **zero new deps**. `@wordpress/compose`
  is NOT a declared dep, NOT in `node_modules`, and NOT in the build asset
  (asset deps: `wp-block-editor, wp-blocks, wp-components, wp-dom-ready,
  wp-element, wp-i18n, wp-primitives`) — so `useMergeRefs` is out.
- **Real roving ref shape.** v21.9.0 `RovingTabIndexItem` calls
  `children({ ref, tabIndex, onFocus, ...props })` where `ref` is a **ref
  OBJECT** (not a callback) whose `.current` the roving logic reads to set
  `tabIndex` 0/-1. So `cellProps.ref` must keep its `.current` populated — any
  approach that adds a second ref to the label Button risks the roving model.
  This is why the **querySelector** target (below) is preferred: it never touches
  `cellProps`.
- **TreeGrid anchor caveat.** The real `__experimentalTreeGrid` is a `forwardRef`
  that spreads props onto its `<table role="treegrid">`, so `tabIndex`/`ref`
  would work in production — **but the jest mock breaks it**: the mock `TreeGrid`
  is a plain function component (no `forwardRef`) that hardcodes its own internal
  ref callback to stash `__onExpandRow`/`__onCollapseRow` (mock `:478-483`) before
  spreading `...rest`. Passing a ref/tabIndex there would clobber that stash (which
  the keyboard-wiring tests depend on) and warn (ref on a non-`forwardRef` fn
  component). So the anchor must NOT be the TreeGrid.

**Settled design (A1) — final form (`focusRequest`).**

> Naming: the design uses **`focusRequest`** for the signal prop/state (the
> researcher's final form). An earlier draft called it `focusSignal`; the two names
> are interchangeable — the plan/code phase should standardize on `focusRequest`.

1. **Trigger — a monotonic `focusRequest` from `edit.js`, bumped only by the
   mutators that move the user.** `edit.js` adds
   `const [focusRequest, setFocusRequest] = useState(null)` — **`null` initial**, so
   the effect's `if (!focusRequest) return` guard makes the mount a no-op — and
   passes it to `<StructureTree focusRequest={focusRequest} />`. Each relevant
   mutator bumps it with a **functional updater** so the monotonic `id` is correct
   under React batching:
   `setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "row" | "anchor" }))`.
   **Plain `onSelect` (which `edit.js` passes as `setSelection`) does NOT bump**, so
   a user click never steals focus (case (c)). The fresh object each mutation gives a
   unique identity, so the effect fires exactly once per mutation and never on an
   unrelated re-render. **`edit.js` adds no new import** — it already imports
   `useState`; it gains only the one state + the bumps + the prop pass, staying
   declarative (no refs, no `.focus()`).
2. **Add/dup target (`kind: "row"`) — querySelector, scoped by `treeRef` (chosen
   over a ref merge).** In the effect, `"row"` →
   `treeRef.current?.querySelector('[aria-current="true"].wp-block-piano-block-piano__tree-label')?.focus()`.
   The newly-selected row's label Button carries BOTH `aria-current="true"`
   (`StructureTree.js:150`, note-row `:547`) AND the label class (`:148`, note-row
   `:545`) on the same element, so one selector hits exactly it — section, measure,
   and note rows alike. The hand-group label has the class but **never**
   `aria-current` (it's non-selecting), so it is correctly never matched. No
   `cellProps.ref` merge, no per-row ref plumbing, no `@wordpress/compose`.
3. **Remove anchor (`kind: "anchor"`) — the `…__tree` wrapper `<div>`**
   (`StructureTree.js:620`), given `ref={treeRef}` and `tabIndex={-1}`. A plain DOM
   div behaves identically in real + mock (the mock `TreeGrid` hardcodes its own ref
   and would clobber `__onExpandRow`/`__onCollapseRow` if we anchored there — so we
   do NOT anchor on `TreeGrid`). `"anchor"` → `treeRef.current?.focus()`; the
   keyboard user lands in the tree region (programmatically focusable, not a tab
   stop) instead of `<body>`. The same `treeRef` scopes the add/dup querySelector,
   so one ref serves both halves.
4. **Effect timing.** The mutator batches `setAttributes({song})` +
   `setSelection(newCoords)` + the `focusRequest` bump into one re-render; the effect
   runs after that commit, so the new `aria-current` row is already in the DOM (and
   its ancestors are expanded because `revealAncestors` runs in the same commit —
   `edit.js:203,355,383,433,474`). Deps `[focusRequest]` (object identity changes
   every mutation → fires once; unchanged on plain re-render/select → no double-fire,
   no stale closure); one effect branches on `focusRequest.kind`.

```js
// edit.js: add state (no new import — useState already imported), bump in mutators,
// pass the prop. edit.js stays declarative (no refs/focus here).
const [focusRequest, setFocusRequest] = useState(null);
// …in each "row" mutator, right after its setSelection({...}):
setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "row" }));
// …in each remove mutator, right after setSelection(null):
setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "anchor" }));
// …<StructureTree … focusRequest={focusRequest} … />

// StructureTree.js: import { useEffect, useRef, useState } from "@wordpress/element"
// (mirrors SongCanvas.js:30). New `focusRequest` prop in the signature.
const treeRef = useRef(null);
useEffect(() => {
    if (!focusRequest) return;            // null = mount, no fire
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
// return <div ref={treeRef} tabIndex={-1} className="…__tree"> … <TreeGrid…/> … </div>
```

**Net new surface:** `edit.js` +1 `useState` + 10 one-line bumps (7 `"row"` bump
sites + 3 `"anchor"` bump sites; see A2) + 1 prop pass; `StructureTree` +2 imports
+ 1 prop + 1 `useRef` + 1 `useEffect` + `tabIndex`/`ref` on the existing `…__tree`
div. **Zero new deps.** All focus machinery lives inside `StructureTree`; `edit.js`
stays declarative.

**Verification.** e2e only — the `TreeGridCell` mock passes `{}`, and although the
querySelector path needs no ref, real focus semantics (roving tabindex, real
treegrid) are e2e-only per the cross-cutting constraint. Jest asserts ONLY the
structural precondition (the new row carries `aria-current` after add/dup — already
covered by `StructureTree.test.js`'s aria-current block and the e2e `aria-current`
asserts at `editor.spec.js:726,751`). R-FOCUS must **add** new e2e `toBeFocused`
assertions (focus on the new label after add/dup; focus in the tree region / not
`<body>` after remove) — there are currently ZERO focus assertions in the e2e suite
(only `.focus()` driver calls at `:1317/:1352/:1384`). Do **NOT** add a jest test
asserting DOM focus — it would false-green via the `{}` mock.

### Q2 / A2 — bare-appender focus ruling + exact bump map

**Ruling (settled).** The two bare appenders — `onAddSection` (SongPanel "Add
section") and `onAddMeasure` (SectionPanel "Add measure") — **stay no-focus** (they
do not bump `focusRequest`). They deliberately do not `setSelection` ("reachable via
the Structure list, current selection left as-is"), so there is no `aria-current`
row to focus; adding focus would force adding selection too, which contradicts
their documented no-select design and is scope creep. Crucially, **no tree-row path
is left unfocused** (researcher-verified conclusively): `<StructureTree>` is passed
only the before/after variants (`edit.js:545-550`) and its signature accepts only
those (`StructureTree.js:286-291`); the bare `onAddSection`/`onAddMeasure` strings
appear nowhere in `StructureTree.js`. Bare `onAddSection` is wired only to
`SongPanel.js:80`'s button; bare `onAddMeasure` only to `SectionPanel.js:144`'s.
Both are panel affordances, never a tree row. So the focus story stays uniform for
every tree-row add. (And `onAddSection`'s appended row has no `aria-current` anyway,
since selection is unchanged, so even a `"row"` bump there would find no target.)

**Exact bump map (where `setFocusRequest` lands in `src/edit.js`; `kind:"row"` for
add/dup, `kind:"anchor"` for remove):**

- **`kind: "row"`** — bump alongside the existing `setSelection(newCoords)` in
  every mutator that auto-selects a new node. There are **10 public handlers**
  routed through **7 bump sites** (the 3 `insert*` helpers each back two
  before/after handlers, so the bump goes in the helper, once, not in the thin
  wrappers):
  - `onAddNote` (`:179`, selects at `:195`) — focuses the new note label.
  - `onDuplicateSection` (`:322`, selects at `:330`).
  - `onDuplicateMeasure` (`:334`, selects at `:349`).
  - `onDuplicateNote` (`:359`, selects at `:375`).
  - `insertSectionAt` (`:398`, selects at `:407`) — covers `onAddSectionBefore`
    + `onAddSectionAfter`.
  - `insertMeasureAt` (`:415`, selects at `:431`) — covers `onAddMeasureBefore`
    + `onAddMeasureAfter`.
  - `insertNoteAt` (`:443`, selects at `:466`) — covers `onAddNoteBefore`
    + `onAddNoteAfter`.
- **`kind: "anchor"`** — bump in the **3** remove mutators, **unconditionally, at
  the end of the handler** (NOT inside the `if (selection matches)` guard):
  - `onRemoveSection` (`:227`): after the handler ends (after `:235`), outside the
    `if (selection?.sectionIndex === …)` guard whose `setSelection(null)` is at `:233`.
  - `onRemoveMeasure` (`:263`): after the handler ends (after `:284`), outside the
    section+measure-match guard whose `setSelection(null)` is at `:282`.
  - `onRemoveNote` (`:290`): after the handler ends (after `:314`), outside the
    full-coord-match guard whose `setSelection(null)` is at `:312`.
- **No bump:** `onAddSection` (`:214`), `onAddMeasure` (`:240`), and plain
  `onSelect` (`edit.js` passes `setSelection` directly as `onSelect` at `:542`) — so
  a plain user click never moves focus.

**Subtle correctness point (researcher-flagged, important for the doc):** the
remove handlers' `setSelection(null)` is **conditional** — it fires only when the
removed node *was* the selected one. But the **focus** bump must be
**unconditional**: a keyboard user invoking "Remove" from *any* row's menu loses the
unmounting button's focus to `<body>` whether or not that row was the selected one.
So selection-clear stays conditional (inside the guard) and the focus bump goes
unconditionally after it. This is conflict-free: the `"anchor"` branch ignores
`aria-current` (it just focuses `treeRef`), so a non-selected-row remove that leaves
the old `aria-current` row mounted causes no issue. The `"row"` branch is the only
one that reads `aria-current`, and its mutators *always* `setSelection`, so the
`aria-current` target is always fresh there.

---

## Settled designs for the remaining requirements

These are decision-complete in the spec and confirmed against the live tree; the
design is the exact edit and its test consequence.

### R-NUM — design nothing (leave `__nextHasNoMarginBottom` omitted ×7)

**No code change.** All 7 `NumberControl` sites (`PitchEditor.js:69,80`;
`ContextEditor.js`'s bpm + beats controls; `HandConfigEditor.js:142,178`;
`NotePanel.js:179`) stay unchanged — the prop is a no-op on `NumberControl`
(`InputControl` hardcodes the margin-free `BaseControl`; the spec records the full
real-contract rationale). No test asserts the prop on a `NumberControl`. The only
artifact is a one-line code/PR note pointing back to the spec's R-NUM rationale so a
later review does not re-raise it. The design does not touch these sites; the
"collapsing middle fields" symptom the review attributed here is fixed independently
by R-LR2's inline `min-width` (the two findings are unrelated).

### R-TREE — symmetric label toggle

- **Edit:** in `RowLabelCell` (`StructureTree.js:151-154`), drop the
  `if (!isExpanded)` guard. New `onClick`:
  `() => { onSelect?.(); onToggleExpanded?.(rowKey); }`. One file, one function,
  shared by section + measure rows. The hand-group label (`:490-497`) is a separate
  inline Button that already toggles only — untouched. Chevron + ArrowLeft/Right +
  add/dup auto-reveal are independent of this guard — untouched.
- **Docstring:** `RowLabelCell`'s own JSDoc (`:112-119`) currently says
  "select-and-reveal … when the row is currently collapsed it also calls
  `onToggleExpanded` … Collapsing stays on the chevron and keyboard callbacks only."
  This is now stale and must be refreshed to "the label always toggles expansion
  (symmetric): a click selects and flips expansion in either direction."
- **Test (exactly one flips):** `StructureTree.test.js:388-397`
  ("selects but does NOT collapse …"): `calls.toggle` assertion `[]` → `["s0"]`
  (the assert line `:395`), update the stale inline comment (`:393`) and the
  `it(...)` title (`:388`, now *does* collapse). `select` assertion unchanged. The
  collapsed-section, collapsed-measure, and hand-group tests stay green (none
  asserted the old expanded-no-collapse behavior); there is no measure-equivalent
  expanded-no-collapse test.

### R-LR1 / R-LR2 / R-LR3 — list-row Stage 1

- **R-LR1 (alignment).** `alignment="flex-start"` → `alignment="center"` at the
  three `__list-row` `HStack`s: `PitchList.js:43`, `HandConfigEditor.js:164`, and
  **`AnnotationList.js:57`** (the spec/research loosely call this third site
  "AnnotationEditor"; the actual `HStack` is in `AnnotationList.js`, className at
  `:58`). **Not unit-assertable** (the `HStack` mock swallows `alignment`) — do
  NOT add a unit test asserting it; e2e / real-render only.
- **R-LR2 (min-width).** Add inline `style={{ minWidth: "4em" }}` to the collapsing
  `NumberControl`s at `PitchEditor.js:69` (Octave), `PitchEditor.js:80`
  (Alteration), `HandConfigEditor.js:178` (Alteration). **Unit-assertable:** the
  mock `NumberControl` spreads `...rest` (incl. `style`) onto the `<input>`, so the
  inline `min-width` reaches the DOM — the new/updated hook tests can assert
  `style.minWidth === "4em"` on those inputs. The leading selects keep the
  `editor.scss` 8em first-child floor.
- **R-LR3 (label).** Visible label "Alteration note" → "Note" at
  `HandConfigEditor.js:168`. Leave the scoped aria-label at `:169` unchanged
  (`fieldLabel("alteration note")` → e.g. "Right hand alteration note"). The two
  tests that locate this select key off the **aria-label** (`contextControls.test.js`)
  stay green; no test asserts the visible "Alteration note" string. No
  accessible-name collision with `PitchEditor.js:62`'s visible "Note" (distinct
  panel/row, distinct aria-labels).
- **Out of scope:** the `editor.scss:27-30` positional-selector replacement
  (`Flex`/`FlexItem`/`FlexBlock`) is Stage 2 — a filed follow-up, not this run.

### R-DEL — drop all section-removal confirm dialogs (Policy (a))

- **`SectionPanel.js`:** delete the `confirmOpen` state (`:85`) and the
  `ConfirmDialog` (`:160-172`); the "Remove section" button's `onClick` becomes
  `() => onRemoveSection?.(sectionIndex)` (was `setConfirmOpen(true)` at `:153`).
  Drop the now-unused imports: `__experimentalConfirmDialog as ConfirmDialog` and
  `useState` (the latter is used **only** by `confirmOpen`, so the whole
  `import { useState } from "@wordpress/element"` line goes).
- **`StructureTree.js`:** delete the `pendingRemoveSection` state + setter (`:301`)
  and the root `ConfirmDialog` (`:628-640`); the section row's `onRemove` becomes
  `() => onRemoveSection?.(sectionIndex)` (was `setPendingRemoveSection(sectionIndex)`
  at `:369`), matching the measure/note rows. Drop the
  `__experimentalConfirmDialog as ConfirmDialog` import. Keep `useState`? — NO
  other `useState` use remains, but `useEffect`/`useRef` from R-FOCUS are added,
  so the `@wordpress/element` import line becomes
  `import { useEffect, useRef } from "@wordpress/element"` (no `useState`).
- **Tests:** `SectionPanel.test.js:254-264` + `:267-277` drop their `click(...,"OK")`
  (lines `:259`,`:275`); `:280-287` cancel test deleted. `StructureTree.test.js:456-480`
  drops `click(container, "OK")` (`:477`); `:482-494` cancel test deleted.
  `Edit.test.js:457-474` drops `click(buttonByText(container, "OK"))` (`:463`) and
  updates the "opens a ConfirmDialog" comment (`:461`).
- The other three deletes (measure/note/pitch) are already immediate — untouched.
- **`StructureTree` class docstring refresh (`:21-33`).** The current block documents
  the now-removed `pendingRemoveSection`/root-`ConfirmDialog` flow ("It holds one
  piece of UI state — `pendingRemoveSection` … survives the `DropdownMenu` unmount …
  For section rows the 'Remove' item captures the index … a single `ConfirmDialog`
  at the tree root gates the actual removal. Measure and note removes remain
  immediate."). This must be replaced to reflect (1) no `pendingRemoveSection` / no
  ConfirmDialog, (2) section Remove now fires immediately like measure/note, (3) the
  undo-not-confirm rationale, and (4) the NEW `focusRequest`+`treeRef` focus
  machinery (so the docstring's "one piece of local state" is now the focus effect,
  not the pending-remove state). Replacement prose (facts are load-bearing; wording
  may be polished by the doc phase):

  > It holds no song state — song, selection and expansion are all controlled from
  > the outside. The one piece of local state it owns is post-mutation **focus
  > management**: the parent (`edit.js`) passes a monotonic `focusRequest`
  > (`{ id, kind }`) bumped on every structural mutation, and a `useEffect` keyed on
  > it moves DOM focus through a ref on the tree container — after an add/duplicate
  > it focuses the newly-selected row's label (the `aria-current` `.…__tree-label`),
  > and after a remove it focuses the container itself (a `tabIndex=-1` anchor) so a
  > keyboard user lands back in the tree region instead of falling to `<body>`. A
  > plain selection click carries no `focusRequest`, so it never steals focus.
  > Selecting a section/measure/note row signals a kind-tagged `selection` through
  > `onSelect` (… unchanged resolve/highlight/panel wiring …), and the per-row
  > `DropdownMenu` items signal add / remove / duplicate intent through the lifted
  > `edit.js` handlers. Every "Remove" item — section, measure and note alike — calls
  > its lifted remove handler immediately; removals are recoverable through
  > WordPress's native undo, so there is no confirm dialog.

  The existing "Hand-group rows are organizational, not selectable…" sentence
  (`:34-36`) continues unchanged. Also refresh the inline comment on the now-deleted
  state and the `RowLabelCell` JSDoc per R-TREE (see above).

### R-JSON — JSON-mode Notice maps all errors

- **Edit:** at `src/edit.js:520-524`, replace `{errors[0]}` (`:522`) with a mapped
  list mirroring `InvalidState`'s `<ul>` / keyed `<li>` (`key={index}`), so the
  `Notice` shows every validator message. `Notice` is already imported.
- **Test:** `Edit.test.js:309` — change `expect(notice.textContent).toBe(errors[0])`
  to assert every error renders (notice text contains each message, or one `<li>`
  per error). Use a multi-error invalid song so `errors.length > 1` is meaningful.

### R-NOOP — drop redundant `?? undefined` (2 sites)

- **Edit:** `NotePanel.js:235` and `MeasurePanel.js:136`: `annotations ?? undefined`
  → `annotations`. `AnnotationList` already collapses empty → `undefined`, so the
  coalesce was a no-op. Behavior unchanged; existing annotation tests stay green
  (no test change needed).

### R-DOCS — documentation corrections (docs-only)

- **Canvas framing → "display + highlight only":** `src/edit.js:48-49` (visual-mode
  docstring "an interactive sheet-music SongCanvas the author both reads and edits
  on") + `src/editor.scss:6-7` ("the surface the author both reads and selects notes
  on") + `src/editor.scss:106` ("interactive canvas wrapper"). **There is no second
  `edit.js` site** (the spec's `:58-59` is the JSON-mode bullet — corrected above).
  Reject wiring click-to-select.
- **Stylesheet name:** `src/edit.js:533` "`style.scss` lays them out as a flex row"
  → name `editor.scss` (the flex rule is at `editor.scss:35-44`; `style.scss` is
  `@font-face` only). One-word fix.
- **CRITICAL doc-block trim:** `songModel.js` `setSectionAt`'s full cautionary
  paragraph (`:328-339`) → ~one line, keeping the three depth-splice helpers
  distinct (`setMeasureAt:354-355` / `setEventAt:382-383` already reference back —
  leave them). Do NOT merge the helpers.
- **Verify-before-change:** no test *asserts* the old wording. Confirmed by grep:
  the source strings being changed ("interactive sheet-music SongCanvas…",
  "selects notes on", "interactive canvas wrapper", the `style.scss` phrase, the
  CRITICAL prose) appear in **no test assertion**. There are incidental *comments*
  in `Edit.test.js:222`, `specs/editor.spec.js:189,191,440,1116`, and
  `specs/render.spec.js:527` that use the word "interactive"/"reads and edits" to
  describe the canvas — these are test-author comments, not assertions, so they do
  not gate the change; refreshing them is optional polish the implementing phase
  may do but is not required by R-DOCS.

### R-INVALID — drop the `<p>`, wrap in `VStack` (extend the mock)

- **Mock prerequisite.** Add a `VStack` stand-in to
  `test/mocks/wordpress-components.js`, **byte-identical to the `HStack` mock**
  (`:203-209`): a `<div>` swallowing `alignment`/`spacing` and spreading `...rest`
  (jest asserts text/role/children, never flex direction, so identical is correct).
  Export it as **`__experimentalVStack` only** (one new line in `module.exports`
  next to `__experimentalHStack`), mirroring `HStack`'s experimental-only export
  precedent — do NOT add a bare `VStack` export key (nothing imports it).
- **Source.** In `InvalidState.js`, the `VStack` **replaces the outer `<div>`**
  (`:30`/`:49`), grouping the `Notice` and the "Edit as JSON" `Button` vertically;
  the redundant `<p>` (`:32-37`) is dropped; the `<ul>` error list (`:38-44`, incl.
  its inline comment and `key={index}`) stays inside the `Notice` verbatim. Import
  line `:17` becomes
  `import { Button, Notice, __experimentalVStack as VStack } from "@wordpress/components";`.
  (Wrapping a *lone `<ul>`* inside the `Notice` would be pointless — the meaningful
  "wrap the container" is the outer box that holds `[Notice, Button]`.)
- **Tests.** No standalone `InvalidState.test.js`; the invalid state is exercised
  via `Edit.test.js`, which locates the error messages by `<li>` text and the button
  by role/name — both survive (the `<ul>` and `Button` are kept). **Confirmed safe:**
  a grep for the dropped `<p>`'s intro string ("can't be edited visually" /
  "doesn't conform to the format" / "Edit as JSON to fix") finds **zero test
  assertions**, so dropping the `<p>` breaks nothing. The new `VStack` import would
  otherwise fail under jest without the mock — hence the mock is added with/before
  the source change.

### R-FOLLOWUP — file 3 new issues + relabel 1 existing (not 4 new)

The repo has **no `follow-up` label**; the implementing phase must
`gh label create follow-up` first.

A dedup scan of existing issues found **issue #35 already covers follow-up #2**
("Editor: highlight the selected section/measure on the sheet-music canvas", OPEN,
currently unlabelled — confirmed exact match: deferred-from-review-9, recolor-only,
the `data-measure`/`globalMeasureNumber` feasibility notes). The other three have
**no** existing issue.

**Ruling:** do NOT re-file #35. Instead:
1. `gh issue edit 35 --add-label follow-up` (relabel the existing canvas-highlight
   issue into the set).
2. `gh issue create --label follow-up` for the **3 missing** items:
   - **`edit.js` 13-mutator descriptor-table refactor** (`edit.js:179-479`; gate
     behind "only if levels/reveal rules change").
   - **List-row Stage 2** (`Flex`/`FlexBlock`/`FlexItem` replacing the
     `editor.scss:27-30` positional selectors + extend the mock with
     `FlexItem`/`FlexBlock` + update the three `__list-row` hook tests
     `pitches.test.js`/`annotations.test.js`/`contextControls.test.js`, which assert
     only the `.__list-row` className).
   - **Precise nearest-surviving-sibling/parent focus after remove** (the R-FOCUS
     stable-anchor cures the P1 harm; survivor math is deferred, e2e-only).

So R-FOLLOWUP acceptance "four issues exist (labelled `follow-up`)" = **3 newly
created + #35 relabelled = 4 total**. The doc-plan/code phase must NOT blindly
create a 4th issue duplicating #35.

---

## Test strategy summary (the "green must not mask broken" split)

The cross-cutting constraint is that a passing jest test must not hide a broken real
component. Per requirement:

**Jest-asserted (the mock can faithfully represent it):**
- **R-TREE:** one test flips (`StructureTree.test.js:388-397`: `calls.toggle`
  `[]` → `["s0"]`).
- **R-LR2:** the inline `min-width: 4em` reaches the DOM (the `NumberControl` mock
  spreads `style` onto its `<input>`), so the `__list-row` hook tests can assert
  `input.style.minWidth === "4em"` at the three sites.
- **R-LR3:** the `contextControls` tests stay green (they key off the unchanged
  aria-label, not the visible label).
- **R-DEL:** the listed `SectionPanel`/`StructureTree`/`Edit` tests drop their "OK"
  step; the two cancel tests are deleted.
- **R-JSON:** `Edit.test.js:309` updated to assert every error renders.
- **R-INVALID:** the `VStack` mock is added (else the import fails); message/button
  tests stay green.
- **R-FOCUS structural precondition only:** the new row carries `aria-current`
  after add/dup (already covered).

**e2e-only (real contract / real DOM focus — jest would false-green):**
- **R-FOCUS DOM focus:** add new `toBeFocused` assertions in `specs/editor.spec.js`
  (focus on the new label after add/dup; focus in the tree region / not `<body>`
  after remove). The `TreeGridCell` mock passes `{}`, so any focus assertion under
  jest is inert — do NOT add one.
- **R-LR1 alignment (`center`):** the `HStack` mock swallows `alignment`, so it is
  invisible to jest — verify in e2e / real render, add NO unit test asserting it.

**Mock additions (so a green test never masks a missing primitive):**
- Add **`__experimentalVStack`** to `test/mocks/wordpress-components.js` (R-INVALID).
- **No** `FlexItem`/`FlexBlock` is added or relied on this run — that is Stage 2
  (filed follow-up), so the mock gains only `VStack`.

**No new dependency** is introduced: `@wordpress/compose` is deliberately avoided
(R-FOCUS uses the in-repo `SongCanvas` `useEffect`/`useRef` idiom + a querySelector,
not `useMergeRefs`). Only `@wordpress/*` packages already externalized are used;
`render.php`, the song schema, and the front-end SVG are untouched.

## Open items / blockers

**None.** Every in-scope requirement has a settled, buildable design grounded in the
live tree. The one genuine design problem (R-FOCUS in a purely-controlled tree) is
resolved with a zero-new-dependency mechanism; the rest are direct, spec-complete
edits. No requirement is under-specified or contradictory in a way that belongs back
in the spec. Two spec-coordinate corrections were folded in (they do not change
scope): `edit.js` lives at `src/edit.js`, and R-DOCS's canvas-framing has no second
`edit.js` site (it is `editor.scss:6-7` + `:106`).
