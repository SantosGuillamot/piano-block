# Design doc — Review 10: Tree-collapse fix, inspector list-row styling, and Gutenberg/simplification polish

_Piano block editor UI, [Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22. This document is standalone: the planning and code phases work from this design plus the live code on branch `worktree-8-editor-ui`, not from the spec, the research, or prior-review artifacts._

## 1. Architecture and approach

This run is the second unified code review of an already-sound editor. There is no structural redesign: every change is a layered, idiomatic edit at a known site, plus one new focus-management mechanism that threads cleanly through the existing purely-controlled tree. The design principle throughout is to match the surrounding code — the same import surface, the same component idioms, no new dependencies.

The editor's shape that matters for this design:

- **`src/edit.js`** is the single owner of the working song, selection, and expansion state. It builds a `working` copy of the `song` attribute, mutates it through handlers, and `commit()`s back via `commitSong(working, onChangeSong)` → `setAttributes({ song })`. All 13 mutators live here; the inspector panels and the structure tree are passed lifted handlers.
- **`src/editor/StructureTree.js`** is purely controlled: `edit.js` owns selection and expansion, and `StructureTree` owns the DOM. It exposes **no refs upward** and today holds exactly one piece of local UI state (`pendingRemoveSection`, removed by this run). It renders rows into a real `@wordpress/components` `__experimentalTreeGrid`.
- The leaf inspector editors (`PitchEditor`, `HandConfigEditor`, `AnnotationEditor`) return bare fragments dropped into a single list-row `HStack` per row, styled by positional selectors in `src/editor.scss`.

Three cross-cutting constraints bound the whole run:

1. **Editor-side only.** The song format/schema, `render.php`, and the front-end SVG are untouched. A published song renders byte-identically before and after. No mutator, no serialization, no `songModel` *behavior* changes — the only `songModel.js` edit is a doc-comment trim.
2. **No new outside dependencies.** Only `@wordpress/*` packages already externalized to the WordPress runtime may be used. Critically, **`@wordpress/compose` is not available** (zero usage in `src/`, no `wp-compose` build-asset entry, absent from `package-lock.json`), so `useMergeRefs`/`useRefEffect` are out of scope — this governs the R-FOCUS mechanism below.
3. **"Tests green" must not mask "real component broken."** Where a fix depends on a real `@wordpress/components` contract or on real DOM focus, acceptance is **e2e-verified** (Playwright, `specs/editor.spec.js`), not asserted through jest stubs. Jest may only assert structural preconditions the mock can faithfully represent. Where a fix needs a primitive the mock does not export (`VStack`), the mock is extended as part of the fix.

The work splits into one interaction bug (R-TREE), one new focus mechanism (R-FOCUS), a destructive-delete simplification (R-DEL), a list-row CSS cluster (R-LR1/2/3), and a batch of small Gutenberg-adoption / simplification / documentation polish items (R-JSON, R-NOOP, R-INVALID, R-DOCS), one deliberate no-op (R-NUM), and the follow-up filing (R-FOLLOWUP).

### Live-tree coordinates (confirmed at design time)

All file/line references in this document were confirmed against the branch tip. The planning and code phases should still re-confirm against the live tree, since earlier edits in the run will shift later line numbers. The non-obvious corrections to carry forward:

- **`edit.js` lives at `src/edit.js`** (not `src/editor/edit.js`). It currently imports `{ useMemo, useState }` from `@wordpress/element`.
- **R-DOCS canvas-framing has no second `edit.js` site.** The spec cites `edit.js:58-59` as a second "selects notes on" location; `:58-59` is actually the JSON-mode bullet. The canvas-framing edits are: `src/edit.js:48-49` (the visual-mode docstring) + `src/editor.scss:6-7` + `src/editor.scss:106` — three spots, not a second `edit.js` location.
- **`src/editor.scss`** list-row positional rule is at `:27-30`; canvas framing at `:6-7` (+ `:106`); workspace flex rule at `:35-44`.
- **`src/editor/StructureTree.js`**: `RowLabelCell` `onClick` guard at `:151-154`; `pendingRemoveSection` state at `:301`; section row's `onRemove` wiring at `:369`; root `ConfirmDialog` at `:628-640`; the `…__tree` host `<div>` at `:620`; the orphaned class docstring at `:21-33`; `RowLabelCell` JSDoc at `:112-119`. It imports only `useState` from `@wordpress/element` and has zero `useRef`/`useEffect`/`.focus()` today.
- **`src/editor/songModel.js`** CRITICAL doc-block: the full paragraph is on `setSectionAt` at `:328-339`; `setMeasureAt` (`:354-355`) and `setEventAt` (`:382-383`) already reference back.
- **`src/editor/SectionPanel.js`**: `confirmOpen` state at `:85`; `ConfirmDialog` at `:160-172`; "Remove section" button `onClick={() => setConfirmOpen(true)}` at `:153`. `useState` is imported and used **only** by `confirmOpen`.
- **`src/editor/InvalidState.js`**: hand-rolled `<p>/<ul>/<li>` in a `Notice` at `:30-49`; imports `{ Button, Notice }` at `:17`.
- **Inspector list-row sites:** `PitchList.js:43` (`alignment="flex-start"`), className `:44`; `PitchEditor.js:69,80` (collapsing `NumberControl`s); `HandConfigEditor.js:164` (`alignment="flex-start"`), `:168` (visible label "Alteration note"), `:169` (scoped aria-label), `:178` (collapsing `NumberControl`); the third list-row `HStack` is `AnnotationList.js:57` (className `:58`).
- **Mock** (`test/mocks/wordpress-components.js`): exports `Flex` (no `FlexItem`/`FlexBlock`), `HStack` at `:203-209` (swallows `alignment`), `NumberControl` (spreads `...rest` incl. `style` onto the `<input>`), `ConfirmDialog`, `TreeGridCell` (calls its render-prop child with `{}` at `:539-544`). **No `VStack`.**

### Test-file paths

The spec's bare filenames map to these live paths (line ranges match):

- `Edit.test.js` → `src/editor/__tests__/Edit.test.js`. R-JSON `:309`; R-DEL `onRemoveSection` test `:457-474` (drops `click(...,"OK")` at `:463`, updates the comment at `:461`).
- `StructureTree.test.js` → `src/editor/__tests__/StructureTree.test.js`. R-TREE flip `:388-397`; R-DEL section remove/duplicate test `:456-480` (drops `click(container, "OK")` at `:477`), cancel test `:482-494` (deleted).
- `SectionPanel.test.js` → `src/editor/__tests__/SectionPanel.test.js`. R-DEL: two remove tests `:254-264` and `:267-277` drop their `click(...,"OK")`; cancel test `:280-287` (deleted).
- `contextControls.test.js` (R-LR3 green-check; locates the alters select by its unchanged aria-label "Right hand alteration note") and the three `__list-row` hook tests (`pitches.test.js`, `annotations.test.js`, `contextControls.test.js`) are under `src/editor/__tests__/`.

---

## 2. Per-change technical design

### R-FOCUS — post-mutation focus management (the only non-trivial design problem)

**Problem.** The editor has no post-mutation focus management — no `useEffect`/`useRef`/`.focus()` in `edit.js` or `StructureTree.js`. Two harms result:

- **Remove:** the focused row's label `Button` unmounts, the DOM default sends focus to `<body>`, and a keyboard user is stranded. `edit.js` also clears selection on a matching remove, so there is no fallback "selected row."
- **Add/duplicate:** `edit.js` calls `setSelection(newCoords)`, so the new row renders with `aria-current="true"` (`StructureTree.js:150`, note-row `:547`), but selection is not DOM focus — nothing calls `.focus()`, so the keyboard user is not moved to the new row.

**Constraint.** The tree is purely controlled — `StructureTree` exposes no refs upward — so any focus machinery must live **inside `StructureTree`**, keyed on a signal from the parent. And because `@wordpress/compose` is unavailable, `useMergeRefs` is out: a ref-merge onto the roving label `Button` is not an option.

**Mechanism: a monotonic `focusRequest` signal + one `useEffect` keyed on it.** `edit.js` owns a new `focusRequest` state and bumps it from the mutators that move the user; `StructureTree` consumes it in a single effect that branches on `kind`. There are no per-row refs and no `cellProps` changes.

#### The signal (in `src/edit.js`)

```js
// edit.js already imports { useMemo, useState } — no new import.
const [focusRequest, setFocusRequest] = useState(null);
// …in each "row" mutator, right after its setSelection({...}):
setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "row" }));
// …in each remove mutator, right after its (conditional) setSelection(null):
setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, kind: "anchor" }));
// …pass it down: <StructureTree … focusRequest={focusRequest} … />
```

Design points:

- **`null` initial.** The effect's `if (!focusRequest) return` guard makes the mount a no-op — no focus steal on first render.
- **Functional updater.** `setFocusRequest((r) => ({ id: (r?.id ?? 0) + 1, … }))` keeps the monotonic `id` correct under React batching. A fresh object each mutation gives a unique identity, so the effect (deps `[focusRequest]`) fires exactly once per mutation and never on an unrelated re-render.
- **Plain `onSelect` never bumps.** `edit.js` passes `setSelection` directly as `onSelect`. Because only the mutators bump `focusRequest`, a plain user click selects without ever moving focus (this is the must-not-break case: it preserves the roving tabindex and does not steal focus).
- **`edit.js` stays declarative.** It gains one `useState`, the bumps, and the prop pass — no refs, no `.focus()`. All focus machinery lives in `StructureTree`.

#### The effect (in `src/editor/StructureTree.js`)

```js
// import { useEffect, useRef } from "@wordpress/element";  (mirrors SongCanvas.js:30)
// New `focusRequest` prop in the signature.
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
// host div: <div ref={treeRef} tabIndex={-1} className="…__tree"> … <TreeGrid…/> … </div>
```

Design points:

- **Add/dup target — querySelector, not a ref merge.** The `"row"` branch queries the `aria-current` row's label Button inside `treeRef`. That element carries BOTH `aria-current="true"` and `className="wp-block-piano-block-piano__tree-label"` on the same node (section/measure at `:148,:150`, note-row at `:545,:547`), so one selector hits exactly it across all three row kinds. The hand-group label has the class but **never** `aria-current` (it is non-selecting), so it is correctly never matched. This avoids touching `cellProps`: the real `RovingTabIndexItem` passes `ref` as a ref **object** whose `.current` the roving logic reads to set `tabIndex`; adding a second ref there would risk the roving model, and `useMergeRefs` is unavailable to do it safely.
- **Remove anchor — the `…__tree` wrapper `<div>`, not the TreeGrid.** The `"anchor"` branch focuses `treeRef.current` directly. The ref + `tabIndex={-1}` go on the existing `wp-block-piano-block-piano__tree` host div (`StructureTree.js:620`), making the tree region programmatically focusable (not a tab stop). It is **not** placed on `<TreeGrid>` because the jest mock `TreeGrid` is a plain function component (not `forwardRef`) that hardcodes its own internal ref callback to stash `__onExpandRow`/`__onCollapseRow` (mock `:478-483`); a ref/`tabIndex` there would clobber that stash (which the keyboard-wiring tests depend on) and warn. A plain DOM div behaves identically in real and mock. One `treeRef` serves both halves.
- **Timing.** Each mutator batches `setAttributes({ song })` + `setSelection(...)` + the `focusRequest` bump into one re-render; the effect runs after that commit, so the new `aria-current` row is already in the DOM and its ancestors are already expanded (`revealAncestors` runs in the same commit). One effect, branching on `focusRequest.kind`, deps `[focusRequest]`.

#### Exact bump map (in `src/edit.js`)

There are **10 public handlers routed through 7 `"row"` bump sites + 3 `"anchor"` bump sites**. The three `insert*` helpers each back two before/after handlers, so the bump goes in the helper once, not in the thin wrappers:

- **`kind: "row"`** (bump right after the existing `setSelection(newCoords)`):
  - `onAddNote` (selects ~`:195`) — focuses the new note label.
  - `onDuplicateSection` (~`:330`), `onDuplicateMeasure` (~`:349`), `onDuplicateNote` (~`:375`).
  - `insertSectionAt` (~`:407`) — covers `onAddSectionBefore` + `onAddSectionAfter`.
  - `insertMeasureAt` (~`:431`) — covers `onAddMeasureBefore` + `onAddMeasureAfter`.
  - `insertNoteAt` (~`:466`) — covers `onAddNoteBefore` + `onAddNoteAfter`.
- **`kind: "anchor"`** (bump **unconditionally, at the end of the handler**, NOT inside the selection-match guard):
  - `onRemoveSection` — after the handler ends (after ~`:235`), outside the `if (selection?.sectionIndex === …)` guard whose `setSelection(null)` is at ~`:233`.
  - `onRemoveMeasure` — after the handler ends (after ~`:284`), outside the section+measure-match guard (`setSelection(null)` at ~`:282`).
  - `onRemoveNote` — after the handler ends (after ~`:314`), outside the full-coord-match guard (`setSelection(null)` at ~`:312`).
- **No bump:** `onAddSection`, `onAddMeasure`, and plain `onSelect`.

**Subtle correctness point (load-bearing).** The remove handlers' `setSelection(null)` is **conditional** — it fires only when the removed node *was* the selected one. The **focus** bump must be **unconditional**: a keyboard user invoking "Remove" from *any* row's menu loses the unmounting button's focus to `<body>` whether or not that row was selected. So selection-clear stays conditional (inside the guard) and the `"anchor"` focus bump goes unconditionally after it. This is conflict-free: the `"anchor"` branch ignores `aria-current` (it just focuses `treeRef`), so a non-selected-row remove that leaves the old `aria-current` row mounted causes no issue. The `"row"` branch is the only one that reads `aria-current`, and its mutators *always* `setSelection`, so its target is always fresh.

**Bare-appender ruling.** The two bare appenders — `onAddSection` (SongPanel "Add section", wired only to `SongPanel.js:80`) and `onAddMeasure` (SectionPanel "Add measure", wired only to `SectionPanel.js:144`) — **stay no-focus**. They deliberately do not `setSelection` (their documented design leaves the current selection as-is, reachable via the Structure list), so there is no `aria-current` row to focus; adding focus would force adding selection, contradicting their no-select design and constituting scope creep. No tree-row add path is left unfocused: those bare strings appear nowhere in `StructureTree.js`; they are panel affordances only.

**Net new surface.** `edit.js`: +1 `useState` + 10 one-line bumps + 1 prop pass (no new import). `StructureTree`: +2 imports (`useEffect`, `useRef`) + 1 prop + 1 `useRef` + 1 `useEffect` + `tabIndex`/`ref` on the existing `…__tree` div. **Zero new dependencies.**

### R-DEL — drop all section-removal confirm dialogs (rely on native undo)

**Problem.** Section removal is double-confirmed by two byte-identical `ConfirmDialog`s — `SectionPanel.js:160-172` (gated by its own `confirmOpen`) and the `StructureTree` root dialog (`:628-640`, gated by `pendingRemoveSection`) — while measure, note, and pitch removals fire immediately. The least-destructive action (pitch) is unguarded and the most-destructive (section) is double-guarded.

**Decision: drop all confirm dialogs; section removal becomes immediate like the other three.** Justification: the `song` attribute is a plain `{ type: "string", default: "" }` block attribute with no custom `source`, so every mutator routes through `commit()` → `setAttributes({ song })`, landing in WordPress's native undo/redo history. Every delete — including a section's whole subtree — is one Ctrl+Z from restoration. Gutenberg's editor convention is undo-not-confirm (List View block delete, Navigation/Social Links link removal). Dropping the dialogs also eliminates the byte-identical double-confirm and dissolves any "extract a shared dialog/message constant" sub-task, yielding less code and uniform behavior.

**Edits:**

- **`src/editor/SectionPanel.js`:** delete the `confirmOpen` state (`:85`) and the `ConfirmDialog` (`:160-172`); the "Remove section" button `onClick` becomes `() => onRemoveSection?.(sectionIndex)` (was `setConfirmOpen(true)` at `:153`). Drop the now-unused imports: `__experimentalConfirmDialog as ConfirmDialog`, and the entire `import { useState } from "@wordpress/element"` line (`useState` is used only by `confirmOpen`).
- **`src/editor/StructureTree.js`:** delete the `pendingRemoveSection` state + setter (`:301`) and the root `ConfirmDialog` (`:628-640`); the section row's `onRemove` becomes `() => onRemoveSection?.(sectionIndex)` (was `setPendingRemoveSection(sectionIndex)` at `:369`), matching the measure/note rows. Drop the `__experimentalConfirmDialog as ConfirmDialog` import. The `@wordpress/element` import line becomes `import { useEffect, useRef } from "@wordpress/element"` — `useState` is gone (no other use remains), and `useEffect`/`useRef` are added by R-FOCUS.
- Leave the immediate measure/note/pitch removes untouched.

**Class docstring refresh (`StructureTree.js:21-33`).** The current block documents the now-removed `pendingRemoveSection` / root-`ConfirmDialog` flow ("It holds one piece of UI state — `pendingRemoveSection` … survives the `DropdownMenu` unmount … a single `ConfirmDialog` at the tree root gates the actual removal. Measure and note removes remain immediate."). Replace it so it documents (1) no `pendingRemoveSection` / no `ConfirmDialog`, (2) section Remove now fires immediately like measure/note, (3) the undo-not-confirm rationale, and (4) the NEW `focusRequest` + `treeRef` focus machinery (the "one piece of local state" is now the focus effect, not pending-remove). The facts are load-bearing; the doc phase may polish wording:

> It holds no song state — song, selection and expansion are all controlled from the outside. The one piece of local state it owns is post-mutation **focus management**: the parent (`edit.js`) passes a monotonic `focusRequest` (`{ id, kind }`) bumped on every structural mutation, and a `useEffect` keyed on it moves DOM focus through a ref on the tree container — after an add/duplicate it focuses the newly-selected row's label (the `aria-current` `.…__tree-label`), and after a remove it focuses the container itself (a `tabIndex=-1` anchor) so a keyboard user lands back in the tree region instead of falling to `<body>`. A plain selection click carries no `focusRequest`, so it never steals focus. Selecting a section/measure/note row signals a kind-tagged `selection` through `onSelect` (… unchanged resolve/highlight/panel wiring …), and the per-row `DropdownMenu` items signal add / remove / duplicate intent through the lifted `edit.js` handlers. Every "Remove" item — section, measure and note alike — calls its lifted remove handler immediately; removals are recoverable through WordPress's native undo, so there is no confirm dialog.

The existing "Hand-group rows are organizational, not selectable…" sentence (`:34-36`) continues unchanged.

### R-TREE — symmetric label toggle

**Problem.** The section/measure label `Button`'s `onClick` is `() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }` (`StructureTree.js:151-154`). The `if (!isExpanded)` guard means an already-expanded row only re-selects on label click — collapse is reachable only via the chevron or ArrowLeft. This diverges from core List View, where a parent row label toggles both directions.

**Edit.** In `RowLabelCell` (`:151-154`), drop the guard:

```js
onClick={() => { onSelect?.(); onToggleExpanded?.(rowKey); }}
```

A collapsed click selects + expands (review 9's select-and-reveal is preserved); an expanded click selects + collapses (the new behavior). One file, one function, shared by section and measure rows.

**Scope (do not over-reach).** The hand-group label (`:490-497`) is a separate inline `Button` that already toggles only (no guard) — untouched. The chevron (`TreeExpander`), ArrowLeft/Right (`TreeGrid` `onExpandRow`/`onCollapseRow`), and the add/dup auto-reveal seeding are independent of this guard — untouched.

**Docstring.** `RowLabelCell`'s JSDoc (`:112-119`) currently says "select-and-reveal … when the row is currently collapsed it also calls `onToggleExpanded` … Collapsing stays on the chevron and keyboard callbacks only." Refresh it to "the label always toggles expansion (symmetric): a click selects and flips expansion in either direction."

### R-LR1 / R-LR2 / R-LR3 — inspector list-row Stage 1 (no new components)

**Root cause.** Leaf editors return bare fragments into a single `HStack`, and `editor.scss:27-30` floors only the **first** child (`> :first-child { min-width: 8em }`) and pins the trailing trash (`> button:last-child { flex: 0 0 auto }`). So in multi-field rows the middle/later `NumberControl`s get no floor and collapse (labels collide — "OCTAVE"+"ALTERATION"); the 8em floor forces the two-word "Alteration note" select label to wrap; and `alignment="flex-start"` top-pins the icon-only 40px trash against the taller labeled fields.

- **R-LR1 (alignment).** Change `alignment="flex-start"` → `alignment="center"` on the three `__list-row` `HStack`s: `PitchList.js:43`, `HandConfigEditor.js:164`, and `AnnotationList.js:57` (applied to the annotation row too for consistency, though only the two `NumberControl` rows have the collapse). Real controls render the label above the input; the icon-only trash is shorter, so `flex-start` top-pins it. `center` vertically centers the trash against the field block and is robust if a field ever shows help/error text below. **Not unit-assertable** — the `HStack` mock swallows `alignment`. Do NOT add a unit test asserting it; e2e / real-render only.
- **R-LR2 (min-width).** Add inline `style={{ minWidth: "4em" }}` to the collapsing `NumberControl`s at `PitchEditor.js:69` (Octave), `PitchEditor.js:80` (Alteration), `HandConfigEditor.js:178` (Alteration). Value **4em** (not 8em): these hold a signed 2–3-digit number (octave 0–8, alter −2..2, small signed octave shift), so 4em fits "−10" plus spinners without re-crowding the row. The leading selects keep the existing 8em first-child floor. **Unit-assertable** — the mock `NumberControl` spreads `...rest` (incl. `style`) onto the `<input>`, so the inline `min-width` reaches the DOM; the `__list-row` hook tests can assert `input.style.minWidth === "4em"` at the three sites.
- **R-LR3 (label).** Change the visible label "Alteration note" → "Note" at `HandConfigEditor.js:168`. Leave the scoped aria-label at `:169` unchanged (`fieldLabel("alteration note")` → e.g. "Right hand alteration note"). Safe: the visible string appears only at that one site and no test asserts it; the two `contextControls.test.js` tests locate this select off the **aria-label**, not the visible label. No accessible-name collision with `PitchEditor.js:62`'s visible "Note" (distinct panel/row, distinct aria-labels). One word no longer wraps under the 8em floor.

**Out of scope (Stage 2 follow-up).** Replacing the `editor.scss:27-30` positional selectors with `Flex`/`FlexItem`/`FlexBlock` is deferred — it would require extending the mock with `FlexItem`/`FlexBlock` and updating the three hook tests. Stage 1 ships the visible-symptom fix only; **no `FlexItem`/`FlexBlock` is added or relied on this run.**

### R-JSON — JSON-mode Notice maps all errors

**Problem.** `edit.js:520-524` renders `errors[0]` only (at `:522`), while `InvalidState.js:38-44` lists all errors.

**Edit.** At `src/edit.js:520-524`, replace `{errors[0]}` with a mapped list mirroring `InvalidState`'s `<ul>` / keyed `<li>` (`key={index}`), so the `Notice` shows every validator message. `Notice` is already imported.

### R-NOOP — drop redundant `?? undefined` (2 sites)

**Edit.** `NotePanel.js:235` and `MeasurePanel.js:136`: `annotations ?? undefined` → `annotations`. `AnnotationList` already collapses empty → `undefined`, so the coalesce was a no-op stating the rule twice. Behavior unchanged; no test change needed.

### R-INVALID — drop the redundant `<p>`, wrap in `VStack` (extend the mock)

**Mock prerequisite (required).** `VStack` is not exported by `test/mocks/wordpress-components.js` and is unused in `src`. Add a `VStack` stand-in **byte-identical to the `HStack` mock** (`:203-209`): a `<div>` swallowing `alignment`/`spacing` and spreading `...rest` (jest asserts text/role/children, never flex direction, so identical is correct). Export it as **`__experimentalVStack` only** — one new line in `module.exports` next to `__experimentalHStack`, mirroring `HStack`'s experimental-only export. Do NOT add a bare `VStack` export key (nothing imports it). Without this, the new import fails under jest.

**Source.** In `InvalidState.js` (`:30-49`), the `VStack` **replaces the outer `<div>`** (`:30`/`:49`), grouping the `Notice` and the "Edit as JSON" `Button` vertically. The redundant `<p>` (`:32-37`) is dropped; the `<ul>` error list (`:38-44`, incl. its inline comment and `key={index}`) stays inside the `Notice` verbatim. The import line `:17` becomes:

```js
import { Button, Notice, __experimentalVStack as VStack } from "@wordpress/components";
```

Wrapping the container (the box holding `[Notice, Button]`) is the meaningful change; wrapping a lone `<ul>` inside the `Notice` would be pointless.

### R-DOCS — documentation corrections (docs-only, no behavior change)

- **Canvas framing → "display + highlight only."** `SongCanvas` is display + highlight only (no hit-test); its own docstring is already correct. Fix the misleading framing at three spots: `src/edit.js:48-49` (visual-mode docstring "an interactive sheet-music SongCanvas the author both reads and edits on") + `src/editor.scss:6-7` ("the surface the author both reads and selects notes on") + `src/editor.scss:106` ("interactive canvas wrapper"). **There is no second `edit.js` site** (the spec's `:58-59` is the JSON-mode bullet). **Reject** wiring click-to-select — that is a net-new feature the canvas comment itself defers.
- **Stylesheet name.** `src/edit.js:533` says "`style.scss` lays them out as a flex row" — wrong; the flex rule is in `editor.scss:35-44` (`style.scss` is `@font-face` only). Name `editor.scss`. One-word fix.
- **CRITICAL doc-block trim.** `songModel.js` `setSectionAt`'s full cautionary paragraph (`:328-339`) → ~one line. `setMeasureAt` (`:354-355`) and `setEventAt` (`:382-383`) already reference back — leave them. **Keep all three depth-splice helpers distinct** — merging into `setAt(song, coords, depth)` is rejected (it reintroduces the depth-as-data hazard the doc warns about; each panel needs a fixed depth).
- **Verify before changing.** No test *asserts* the old wording. The changed source strings appear in no test assertion. Incidental test-author *comments* using "interactive"/"reads and edits" (in `Edit.test.js:222`, `specs/editor.spec.js:189,191,440,1116`, `specs/render.spec.js:527`) are not assertions and do not gate the change; refreshing them is optional polish, not required.

### R-NUM — design nothing (leave `__nextHasNoMarginBottom` omitted ×7)

**No code change.** All 7 `NumberControl` sites (`PitchEditor.js:69,80`; `ContextEditor.js`'s bpm + beats; `HandConfigEditor.js:142,178`; `NotePanel.js:179`) stay unchanged. The prop is a **no-op** on the experimental `NumberControl`: it does not destructure `__nextHasNoMarginBottom`; it renders `InputControl`, whose `<BaseControl>` hardcodes `__nextHasNoMarginBottom={true}`, so `NumberControl` is margin-free by construction with no deprecated default margin to suppress. Gutenberg issue #73848 deliberately excludes `NumberControl`/`InputControl` from the bottom-margin deprecation, so the control asymmetry (siblings set it, `NumberControl` does not) is correct by design. The only artifact is a one-line code/PR note pointing back to this rationale so a later review does not re-raise it. The "collapsing middle fields" symptom the review attributed here is fixed independently by R-LR2's inline `min-width` — the two findings are unrelated.

### R-FOLLOWUP — file 3 new issues + relabel 1 existing (4 total, NOT 4 new)

The repo has **no `follow-up` label** (labels today are `bug`/`duplicate`/`wontfix`/`running…`, the pipeline-stage labels, `PR Opened`, and `v1`…`v7`). The implementing phase must `gh label create follow-up` first.

A dedup scan found **issue #35 already covers the canvas section/measure highlight follow-up** ("Editor: highlight the selected section/measure on the sheet-music canvas", OPEN, currently unlabelled — confirmed exact match: deferred-from-review-9, recolor-only, the `data-measure`/`globalMeasureNumber` feasibility notes). The other three have no existing issue.

**Ruling — do NOT re-file #35:**

1. `gh issue edit 35 --add-label follow-up` (relabel the existing canvas-highlight issue into the set).
2. `gh issue create --label follow-up` for the **3 missing** items:
   - **`edit.js` 13-mutator descriptor-table refactor** (`edit.js:179-479`; ~120–150 lines saveable but risky — touches the mutation core; gate behind "only if levels/reveal rules change").
   - **List-row Stage 2** (`Flex`/`FlexBlock`/`FlexItem` replacing the `editor.scss:27-30` positional selectors + extend the mock with `FlexItem`/`FlexBlock` + update the three `__list-row` hook tests, which assert only the `.__list-row` className on the outer container — they survive a `Flex` swap provided that className stays on the outer container).
   - **Precise nearest-surviving-sibling/parent focus after remove** (real index math with edge cases: last row, parent removal, empty tree — the R-FOCUS stable-anchor cures the actual P1 harm; survivor precision is genuine polish, riskier, e2e-only).

So R-FOLLOWUP acceptance "four issues exist (labelled `follow-up`)" = **3 newly created + #35 relabelled = 4 total.** The plan/code phase must NOT blindly create a 4th issue duplicating #35.

---

## 3. Key technical decisions and trade-offs

- **`focusRequest` signal over a ref-merge (R-FOCUS).** A ref-merge onto the roving label `Button` is the obvious shape, but `@wordpress/compose`/`useMergeRefs` is not available and the real `RovingTabIndexItem` passes `ref` as an object whose `.current` the roving logic reads — a hand-rolled second ref there risks breaking the roving tabindex model. The `focusRequest` + querySelector approach never touches `cellProps`, adds zero new dependencies, and mirrors the in-repo `SongCanvas.js:30` `useEffect`/`useRef` idiom. Trade-off: a querySelector is slightly less "React-idiomatic" than a ref, but it is scoped by `treeRef`, hits a uniquely-identified node (`aria-current` + label class on one element), and is the only approach that stays within the dependency budget while respecting the roving model.
- **Anchor on the `…__tree` wrapper div, not the `TreeGrid` (R-FOCUS).** The real `TreeGrid` is a `forwardRef` that would accept `ref`/`tabIndex`, but the jest mock is a plain function component that hardcodes its own ref to stash `__onExpandRow`/`__onCollapseRow`; anchoring there would clobber that stash and warn. A plain DOM div behaves identically in real and mock, so the wrapper div is the safe anchor. Trade-off: the focusable region is the whole tree container rather than the grid element — acceptable, since the goal is only "land back in the tree region, not `<body>`."
- **Unconditional focus bump vs. conditional selection-clear on remove (R-FOCUS).** Selection-clear stays conditional (only when the removed node was selected) but the focus bump is unconditional (any row's "Remove" loses focus to `<body>`). The two do not conflict because the `"anchor"` branch ignores `aria-current`. This is the one place where focus and selection deliberately diverge, and it is documented in the design and the refreshed class docstring.
- **Split the focus scope: stable anchor now, survivor-math later (R-FOCUS).** Computing the nearest surviving sibling/parent after a remove (with last-row / parent-removal / empty-tree edge cases) is riskier and e2e-only to verify. The stable-anchor fix cures the actual P1 harm (the `<body>` dump) with far less risk; precise survivor focus is a filed follow-up.
- **Drop dialogs (Policy a) vs. confirm uniformly (Policy b) (R-DEL).** Confirming uniformly would mean ONE shared `ConfirmDialog` + message constant across all four delete sites. It is rejected because recoverability (native undo restores any delete, including a subtree, in one keystroke) removes the safety argument, Gutenberg's convention is undo-not-confirm, and dropping the dialogs yields less code and uniform behavior without adding friction to three currently-clean sites. If the owner insists on guarding the subtree case, Policy (b) is the recorded fallback; this run implements (a) unless directed otherwise.
- **List-row Stage 1 (inline min-width + alignment value) vs. Stage 2 (`Flex`/`FlexItem`/`FlexBlock`) (R-LR).** Stage 1 is purely additive — an alignment value, three inline `min-width`s, one label string — and fixes the visible symptoms without a new component or mock extension. The structural Stage 2 refactor (replacing positional CSS selectors with semantic flex components) is deferred to a follow-up because it requires extending the mock and touching three hook tests. This keeps the run's risk low.
- **4em, not 8em, for the collapsing number fields (R-LR2).** The leading selects keep the 8em first-child floor; the middle `NumberControl`s hold short signed numbers, so 4em fits "−10" plus spinners without re-crowding the row. A larger floor would reintroduce crowding.
- **`__experimentalVStack`-only mock export (R-INVALID).** Mirrors the `HStack` precedent (experimental-only). A bare `VStack` export key would be dead — nothing imports it.
- **Keep the three depth-splice helpers distinct (R-DOCS).** Merging `setSectionAt`/`setMeasureAt`/`setEventAt` into one `setAt(song, coords, depth)` reintroduces the depth-as-data hazard the doc warns against; each panel needs a fixed depth. Only the cautionary prose is trimmed, not the structure.

---

## 4. Test strategy

The governing principle: **a passing jest test must not hide a broken real component.** Each change is classified as jest-assertable (the mock faithfully represents the contract) or e2e-only (real `@wordpress/components` contract or real DOM focus, where jest would false-green).

### Jest-asserted (the mock can faithfully represent it)

- **R-TREE** — exactly one test flips: `StructureTree.test.js:388-397` ("selects but does NOT collapse when an already-expanded section label is clicked"). The `calls.toggle` assertion changes `[]` → `["s0"]` (the assert line `:395`); update the stale inline comment (`:393`) and the `it(...)` title (`:388` — it now *does* collapse). The `select` assertion is unchanged. The collapsed-section, collapsed-measure, and hand-group tests stay green (none asserted the old expanded-no-collapse behavior); there is no measure-equivalent expanded-no-collapse test.
- **R-LR2** — the inline `min-width: 4em` reaches the DOM (the mock `NumberControl` spreads `style` onto its `<input>`), so the `__list-row` hook tests can assert `input.style.minWidth === "4em"` at the three sites.
- **R-LR3** — `contextControls.test.js` stays green: its two tests key off the unchanged aria-label "Right hand alteration note", not the visible label.
- **R-DEL** — `SectionPanel.test.js:254-264` and `:267-277` drop their `click(...,"OK")`; the cancel test `:280-287` is **deleted**. `StructureTree.test.js:456-480` drops `click(container, "OK")` (`:477`); the cancel test `:482-494` is **deleted**. `Edit.test.js:457-474` drops the "OK" click (`:463`) and updates the "opens a ConfirmDialog" comment (`:461`).
- **R-JSON** — `Edit.test.js:309` changes from `expect(notice.textContent).toBe(errors[0])` to asserting every error renders (notice text contains each message, or one `<li>` per error). Use a multi-error invalid song so `errors.length > 1` is meaningful.
- **R-INVALID** — the `VStack` mock is added (else the import fails under jest); the `Edit.test.js`-driven invalid-state tests stay green (they locate error messages by `<li>` text and the button by role/name; the `<ul>` and `Button` are kept).
- **R-FOCUS structural precondition only** — the new row carries `aria-current` after add/dup (already covered by the existing `StructureTree.test.js` aria-current block; no new jest assertion needed for the precondition itself).
- **R-NOOP** — existing annotation tests stay green; no test change.

### e2e-only (real contract / real DOM focus — jest would false-green)

- **R-FOCUS DOM focus** — add **new** `toBeFocused` assertions in `specs/editor.spec.js`: focus on the new row's label after add/duplicate, and focus in the tree region (not `<body>`) after remove. The suite currently has zero focus assertions — only `.focus()` driver calls (`:1317/:1352/:1384`) — so these are net-new. The `TreeGridCell` mock passes `{}`, so any focus assertion under jest is inert; **do NOT add a jest test asserting DOM focus** — it would false-green.
- **R-LR1 alignment (`center`)** — the `HStack` mock swallows `alignment`, so it is invisible to jest. Verify in e2e / real render; add **no** unit test asserting it (a unit test would falsely "prove" it).

### Mock additions (so a green test never masks a missing primitive)

- Add **`__experimentalVStack`** to `test/mocks/wordpress-components.js` (R-INVALID) — byte-identical to the `HStack` mock.
- **No** `FlexItem`/`FlexBlock` is added or relied on this run — that is Stage 2 (filed follow-up). The mock gains only `VStack`.

### Constraints held across the suite

No new dependency is introduced (`@wordpress/compose` is deliberately avoided; R-FOCUS uses the in-repo `useEffect`/`useRef` idiom + a querySelector). Only `@wordpress/*` packages already externalized are used. `render.php`, the song schema, and the front-end SVG are untouched — a published song renders byte-identically. The full jest suite and the e2e spec must pass.

---

## 5. Open items / blockers

**None.** Every in-scope requirement has a settled, buildable design grounded in the live tree. The one genuine design problem (post-mutation focus in a purely-controlled tree without `@wordpress/compose`) is resolved with a zero-new-dependency `focusRequest` + querySelector mechanism. The remaining changes are direct, spec-complete edits at confirmed sites. Two spec-coordinate corrections were folded in without changing scope: `edit.js` lives at `src/edit.js`, and R-DOCS's canvas-framing has no second `edit.js` site (it is `editor.scss:6-7` + `:106`).
