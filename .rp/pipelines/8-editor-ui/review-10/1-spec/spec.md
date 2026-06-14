# Spec — Review 10: Tree-collapse interaction fix, inspector list-row styling, and Gutenberg/simplification polish

_Piano block editor UI, [Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22. This spec is standalone: implementing phases work from this document and the live code on the branch, not from the intent, the research, or prior-review artifact folders._

## Overview

This run acts on the second unified code review of PR #22 (the Piano block editor UI). The architecture is sound; the actionable findings are interaction- and CSS-level, not structural. The work splits into one confirmed interaction bug, one cluster of inspector list-row CSS problems, an inconsistent destructive-delete UX, a focus-management gap, and a batch of small Gutenberg-adoption / simplification / documentation polish items.

Two findings were flagged in the intent as needing resolution before implementation, and both are now settled (see Requirements):

- The review's "add `__nextHasNoMarginBottom` to every `NumberControl`" finding was resolved **against the real `@wordpress/components` contract** and **rejected** — the prop is a no-op on `NumberControl`. All 7 sites stay omitted. This decision and its rationale are recorded here so a later review does not flip it a third time.
- The `edit.js` 13-mutator descriptor-table refactor stays a **follow-up** (large, touches the mutation core). It is filed as a tracking issue, not implemented.

The change is strictly **editor-side**. The song format/schema, `render.php`, and the front-end SVG rendering are unchanged — a published song renders byte-identically before and after this run. Only `@wordpress/*` packages already available to blocks may be used; no new outside dependencies.

A cross-cutting testing constraint governs the whole run: **"tests green" must not mask "real component broken."** Where a fix depends on a real `@wordpress/components` contract or on real DOM focus, acceptance is **e2e-verified** (Playwright, `specs/editor.spec.js`), not asserted via jest stubs alone. Jest may only assert structural preconditions that the mock can faithfully represent. Where a fix needs a component that the test mock does not currently export, the mock must be extended as part of the fix rather than letting a green test mask a missing primitive.

All file/line references below are **starting points confirmed at run start**, not frozen coordinates — they will shift as fixes land, so implementing phases must re-confirm against the live tree.

## Requirements

### R-NUM — Leave `__nextHasNoMarginBottom` OMITTED on all 7 `NumberControl` sites (reject the review's P0)

The review's "Top priority #3" / Gutenberg-adoption P0 claims every `NumberControl` omits `__nextHasNoMarginBottom` and should set it for vertical-rhythm consistency with the ~19 sibling controls that do set it. Review 9 had recorded the opposite as a validated decision. The disagreement was resolved against the real `@wordpress/components` `NumberControl` contract.

**Decision: do NOT add the prop. Leave all 7 sites unchanged.** The affected sites are `PitchEditor.js:69,80`; the two `NumberControl`s in `ContextEditor.js` (bpm + beats); `HandConfigEditor.js:142,178`; `NotePanel.js:179`.

**Rationale (real-contract evidence, recorded so this is not re-raised):**

- The plugin requires WP 6.9+ (`piano-block.php` "Requires at least: 6.9"); `.wp-env.json` pins `core: null` (latest stable). `@wordpress/components` is **externalized** as the global `wp-components` (it is in `build/index.asset.php`'s dependency list and has zero entries in `package-lock.json`), so the governing contract is the WordPress-runtime component, read at Gutenberg tag **v21.9.0** (the bundle in WP 6.9 "Gene").
- Every site imports the **experimental** control (`__experimentalNumberControl as NumberControl`), so that component's contract governs.
- `__nextHasNoMarginBottom` is a **`BaseControl`** deprecation flag that suppresses `BaseControl`'s legacy default bottom margin. `NumberControl/index.tsx` does not destructure it; it renders `InputControl` directly with no `BaseControl` of its own, so a passed prop only lands in `...restProps` and is forwarded to the inner input where it has no margin effect.
- **Decisive detail:** `InputControl/index.tsx` renders its `<BaseControl>` with `__nextHasNoMarginBottom` **hardcoded `true`** — it does not read the flag from props. So `NumberControl` is margin-free by construction; there is no deprecated default bottom margin for the prop to suppress.
- Cross-check: Gutenberg issue #73848 ("BaseControl: Hard deprecate bottom margins", WP 7.0 target) lists the affected components — including `SelectControl`, `TextControl`, `TextareaControl` (which correctly DO set the prop) — and deliberately **excludes** `NumberControl` and `InputControl`. The control asymmetry (siblings set it, `NumberControl` does not) is correct by design.

The review's premise ("keeping the deprecated default bottom margin / breaking vertical rhythm") is factually wrong. Note that the actual visible list-row symptoms the review attributed to this (collapsing middle number fields, label collision) are a **layout** issue fixed independently by R-LR1/R-LR2/R-LR3 — the two findings do not depend on each other.

**Acceptance:**
- The 7 `NumberControl` sites are unchanged; no test asserts `__nextHasNoMarginBottom` on a `NumberControl`.
- The decision and its real-contract rationale are documented. The implementing phase leaves a one-line code/PR note pointing back to this rationale so the next review does not re-raise it.

### R-TREE — Expanded tree rows collapse on label click (symmetric toggle)

Currently the section/measure label `Button`'s `onClick` is `() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }` (`StructureTree.js:151-154`). The `if (!isExpanded)` guard means an already-expanded row only re-selects on label click — collapse is reachable only via the `aria-hidden` chevron or the ArrowLeft key. This diverges from core List View, where a parent row label toggles both directions. (The guard was added by review 9's "select-and-reveal" change; this run deliberately revisits that tradeoff.)

**Decision: drop the `if (!isExpanded)` guard** so the label always toggles: `onClick = () => { onSelect?.(); onToggleExpanded?.(rowKey); }`. A collapsed click selects + expands (review 9's select-and-reveal is preserved); an expanded click selects + collapses (the new behavior, matching core).

**Scope (do not over-reach):**
- The fix touches only `RowLabelCell` (`StructureTree.js:131-160`), shared by section and measure rows.
- The **hand-group** label (`StructureTree.js:490-497`) is a separate inline `Button` that already calls `onToggleExpanded(handKey)` only (no `onSelect`, no guard) — it is already symmetric and is **not** touched.
- The chevron pointer path (`TreeExpander`), the ArrowLeft/Right keyboard path (`TreeGrid` `onExpandRow`/`onCollapseRow`), and the add/duplicate auto-reveal seeding (in `edit.js`) are independent of this guard and unchanged.

**Tests (exactly one flips):**
- **Update** `StructureTree.test.js:388-397` ("selects but does NOT collapse when an already-expanded section label is clicked"): the `calls.toggle` assertion changes from `[]` to `["s0"]`; update the now-stale inline comment and the `it(...)` title (it now *does* collapse). The `select` assertion is unchanged.
- Stay green: the collapsed-section test (select+expand), the collapsed-measure test (select+expand), and the hand-group test. There is no measure-equivalent expanded-no-collapse test.

**Acceptance:** clicking an expanded section/measure label selects and collapses it; clicking a collapsed one selects and expands it; the chevron and ArrowLeft/Right paths still work; the one flipped test passes and all sibling tree tests stay green.

### R-LR1 / R-LR2 / R-LR3 — Inspector list-row layout cluster (Stage 1, no new components)

One root cause: leaf editors return bare fragments dropped into a single `HStack`, and `editor.scss:28-31` floors only the **first** child (`> :first-child { min-width: 8em }`) plus pins the trailing trash (`> button:last-child { flex: 0 0 auto }`). So in multi-field rows the middle/later `NumberControl`s get no floor and collapse — labels collide ("OCTAVE"+"ALTERATION"); the 8em floor forces the two-word "Alteration note" select label to wrap; and `alignment="flex-start"` top-pins the icon-only 40px trash against the taller labeled fields.

Affected rows (live coordinates):
- `PitchList.js:41-60` — `HStack alignment="flex-start"` class `__list-row` → `PitchEditor` (Note `SelectControl` `:61`; Octave `NumberControl` `:69`; Alteration `NumberControl` `:80`) + trash `Button` `PitchList.js:51`.
- `HandConfigEditor.js:161-202` — alters `HStack alignment="flex-start"` class `__list-row` → Alteration-note `SelectControl` `:167` (visible label "Alteration note" `:168`, scoped aria-label `:169`) + Alteration `NumberControl` `:178` + trash `Button` `:195`.
- `AnnotationEditor` is the third `__list-row` user (`SelectControl` + `TextareaControl`, **no `NumberControl`**) — the collapse/collision affects only the two rows above, but the alignment improvement applies to it for consistency.

**R-LR1 (alignment).** Change `alignment="flex-start"` → `alignment="center"` on the list-row `HStack`s (`PitchList.js:41`, `HandConfigEditor.js:164`; apply to the `AnnotationEditor` row too for consistency). Real controls render the label above the input; the icon-only trash has no label and is shorter, so `flex-start` top-pins it. `center` vertically centers the trash against the field block and is robust if a field ever shows help/error text below.

- **Not unit-assertable:** the `HStack` mock swallows `alignment`, so this is invisible to jest. Do not add a unit test that would falsely "prove" it; cover it (if at all) in the e2e spec or manual verification.

**R-LR2 (min-width on the collapsing number fields).** Give each collapsing `NumberControl` an inline `style={{ minWidth: "4em" }}` at `PitchEditor.js:69` (Octave), `PitchEditor.js:80` (Alteration), and `HandConfigEditor.js:178` (Alteration). Value **4em** (not 8em): these hold a signed 2–3 digit number (octave 0–8, alter −2..2, small signed octave shift), so 4em fits "−10" plus spinners without re-crowding the row. The leading selects keep the existing 8em first-child floor.

- This **is** unit-assertable: the real `NumberControl` forwards `style` through `...restProps` onto a width-bearing node, and the mock spreads `...rest` onto the `<input>`, so the inline `min-width` reaches the DOM.

**R-LR3 (shorten the visible label).** Change the visible label "Alteration note" → "Note" at `HandConfigEditor.js:168`. Leave the scoped aria-label at `:169` unchanged (it stays `fieldLabel("alteration note")`, e.g. "Right hand alteration note"). Safe: the visible string "Alteration note" appears only at that one site and no test asserts it; the two tests that locate this select key off the aria-label (`contextControls.test.js:381` and `:398`). No accessible-name collision with `PitchEditor.js:62`'s visible "Note" (different panel/row, distinct aria-labels). Once the label is one word it no longer wraps under the 8em floor.

**Acceptance:**
- The two multi-field rows render their middle `NumberControl`s at a usable width (no collapsed inputs, no "OCTAVEALTERATION" label collision) — assertable in unit tests via the inline `min-width` reaching the DOM.
- The "Alteration note" select label no longer wraps; its aria-label is unchanged; the `contextControls` tests stay green.
- The trash icon centers against the field block rather than floating to the top (real-render / e2e verification; not unit-assertable due to the `alignment` mock).
- No new component is introduced (Stage 1 stays additive: alignment value, inline min-width, one label string). The `editor.scss:28-31` positional-selector replacement is Stage 2, a filed follow-up (see Out of Scope).

### R-DEL — Drop all destructive-delete confirm dialogs; rely on WordPress native undo (Policy (a))

Section removal is currently confirmed in **two** independent `ConfirmDialog`s with byte-identical copy ("Remove this section and all its measures and notes?"): `SectionPanel.js:160-172` (its own `confirmOpen` state) and the `StructureTree` root dialog (`StructureTree.js:628-640`, gated by `pendingRemoveSection` at `:301`). Measure (`MeasurePanel.js:143-150`), note (`NotePanel.js:254-263`), and pitch (`PitchList.js:51-59`) removals fire immediately with no confirm. So the least-destructive action (pitch) is unguarded while the most-destructive (section) is double-guarded — inconsistent and redundant.

**Recoverability (basis for the decision).** The `song` attribute is a plain `{ type: "string", default: "" }` block attribute (no custom `source`). Every mutator routes through `edit.js` `commit()` → `commitSong(working, onChangeSong)` → `setAttributes({ song })`, which updates core editor block state and therefore lands in WordPress's native undo/redo history. Every delete is one Ctrl+Z from being restored, including a section's whole subtree in a single keystroke.

**Decision: Policy (a) — drop all confirm dialogs and make section removal immediate like the other three.** Rationale: Gutenberg's block-editor convention is undo-not-confirm (List View / block delete, Navigation / Social Links link removals); recoverability removes the safety argument; dropping the dialogs also eliminates the byte-identical double-confirm and dissolves the "extract a shared dialog/message constant" sub-task; it yields less code and uniform behavior.

**Owner fallback (recorded, not chosen): Policy (b) — confirm uniformly.** If the owner insists on guarding the subtree case, the consistent alternative is ONE shared `ConfirmDialog` + message constant applied to ALL four delete sites (not the current asymmetric mix), reusing the existing `ConfirmDialog` mock. The primary recommendation remains (a) because (b) adds friction to three currently-clean sites for a recoverable action. This run implements (a) unless the owner directs otherwise.

**Implementation:**
- Remove the `ConfirmDialog` and `confirmOpen` state from `SectionPanel.js` (the "Remove section" button calls `onRemoveSection(sectionIndex)` directly).
- Remove the `pendingRemoveSection` state, its setter, and the root `ConfirmDialog` from `StructureTree.js` (the section row's "Remove" menu item calls `onRemoveSection` directly, like the measure/note "Remove" items already do).
- Leave the immediate measure/note/pitch removes as-is.

**Tests to update:**
- `SectionPanel.test.js:254-285`: the two "remove section" edit tests drop their `click(...,"OK")` confirm step; the "does not call onRemoveSection when confirm cancelled" test (`:279-285`) is **deleted**.
- `StructureTree.test.js:456-490`: the section remove/duplicate test drops its "OK" confirm step; the "does not remove a section when the confirm dialog is cancelled" test is **deleted**.
- `Edit.test.js:457-474`: the `onRemoveSection` test drops its "OK" click and updates the "opens a ConfirmDialog" comment.

**Acceptance:** all four delete sites fire immediately; no `ConfirmDialog` remains for section removal; the listed tests are updated/removed and the suite is green; a removed node is restorable via the editor's native undo.

### R-FOCUS — Move focus after tree mutation (split scope: add/dup focuses new row; remove focuses a stable anchor)

The editor has **no** post-mutation focus management (no `useEffect`/`useRef`/`.focus()` in `edit.js` or `StructureTree.js`). Consequences:
- **Remove:** the focused row's label `Button` unmounts and DOM default sends focus to `<body>`, stranding a keyboard user. `edit.js` also clears selection (`setSelection(null)` at `:233/:282/:312`), so there is no fallback "selected row."
- **Add/duplicate:** `edit.js` calls `setSelection(newCoords)`, so the new row renders with `aria-current="true"` (`StructureTree.js:150`), but selection is not DOM focus — nothing calls `.focus()`, so the keyboard user is not moved to the new row.

**Architecture.** The tree is purely controlled (`edit.js` owns selection/expansion; `StructureTree` owns the DOM and exposes no refs upward), so any focus machinery must live **inside `StructureTree`**, keyed on selection. The label `Button` already receives roving `cellProps` from `TreeGridCell`; a focus ref must be merged onto that Button in the real component.

**Decision: split the scope. Fix the high-harm half cleanly now; defer the precise survivor-math.**

1. **Add/duplicate → focus the new row's label Button.** After the mutator sets the selection, `StructureTree` focuses the `aria-current` row's label `Button` (via a ref captured in `RowLabelCell`, or by querying the `[aria-current] .…__tree-label` node), so the keyboard user lands on the newly-added/duplicated row.
2. **Remove → focus a stable tree anchor (no `<body>` dump).** Make the tree container programmatically focusable (`tabIndex={-1}` on the `…__tree` / `role="treegrid"` host) and `.focus()` it after a remove, so the keyboard user lands back in the tree region and can arrow to a row — instead of falling to `<body>`. Do **not** compute a nearest-survivor row this run.

**Testability (false-green risk).** DOM focus after mutation is **not unit-assertable** here: the `TreeGridCell` mock calls its render-prop child with `{}` (`test/mocks/wordpress-components.js:539-544`), so `cellProps.ref` is `undefined` under jest and any ref-based `.focus()` is inert. All real focus assertions live in `specs/editor.spec.js` (Playwright). So this fix is **e2e-verified**, not jest-asserted. Jest may only assert the **structural precondition** (the new row carries `aria-current` after add/duplicate).

**Acceptance:**
- In e2e (`specs/editor.spec.js`, extended): after add/duplicate, focus is on the new row's label; after remove, focus is in the tree region (not `<body>`).
- In jest: the structural precondition holds (the new row carries `aria-current` after add/duplicate). No unit test falsely asserts DOM focus.
- The focus machinery lives only inside `StructureTree`; `edit.js` stays declarative.
- Precise nearest-survivor focus after remove is a filed follow-up (see Out of Scope).

### R-JSON — JSON-mode validation Notice shows every error

`edit.js:520-524` renders `errors[0]` only, while `InvalidState.js:38-44` lists all errors. Map over `errors` in the JSON-mode `Notice`, mirroring `InvalidState`'s `<ul>` / keyed `<li>` list, so all validator messages show.

**Acceptance:** with multiple validator errors, JSON mode shows every message. **Update `Edit.test.js:309`** (currently `expect(notice.textContent).toBe(errors[0])`) to assert every error renders (e.g. the notice text contains each message / the list has one `<li>` per error).

### R-NOOP — Drop redundant `?? undefined` on annotation emit (2 sites)

`NotePanel.js:235` and `MeasurePanel.js:136` pass `annotations ?? undefined` to `omitFalsy`, but `AnnotationList` already collapses empty → `undefined`, so the coalesce is a no-op that states the rule twice. Drop the `?? undefined` (pass `annotations`).

**Acceptance:** behavior unchanged (empty annotations still drop the key); existing annotation tests stay green.

### R-INVALID — `InvalidState`: drop the redundant `<p>`, wrap in `VStack` (extend the mock)

`InvalidState.js:30-49` hand-rolls `<p>/<ul>/<li>` in a `Notice`. Drop the redundant `<p>` and wrap the container in a `VStack` (`__experimentalVStack`); **keep** the `<ul>` error list.

**Mock prerequisite (required).** `VStack` is **not** currently exported by `test/mocks/wordpress-components.js` and is unused in `src`. The implementing task must **add a `VStack`/`__experimentalVStack` stand-in to the mock** (a simple `<div>` wrapper like the existing `HStack`/`Flex` mocks) before/with this change, or the import fails under jest.

**Acceptance:** the error messages and the "Edit as JSON" button still render; the mock exports `VStack`; tests that locate the messages/button by text/role stay green.

### R-DOCS — Documentation corrections (docs-only, no behavior change)

- **Canvas framing → "display + highlight only."** Fix the misleading comments in `edit.js` (the visual-mode docstring `:48-51` and `:58-59`/related, which call the canvas "interactive" / "the surface the author both reads and selects notes on") and `editor.scss:5-9` ("the surface the author both reads and selects notes on", "interactive canvas wrapper"). `SongCanvas` is display + highlight only (no hit-test); its own docstring is already correct. **Reject** wiring click-to-select (net-new feature the canvas comment itself defers). The optional coarse measure/section highlight is a filed follow-up, not this run.
- **Stylesheet name.** `edit.js:533` says "`style.scss` lays them out as a flex row" — wrong; the flex rule is in `editor.scss:38-43` (`style.scss` is `@font-face` only). One-word fix.
- **Trim the thrice-restated CRITICAL doc-block prose.** `songModel.js:328-335` carries the full cautionary paragraph; trim it to ~one line. (`setMeasureAt:354-355` and `setEventAt:382-383` already reference back — leave them.) **Keep all three depth-splice helpers distinct** — merging into `setAt(song, coords, depth)` is on the reject list (do not).

**Acceptance:** no behavior change; comments accurately describe the code; no test asserts the old wording (verify before changing).

### R-FOLLOWUP — File four tracking issues; implement none

The repo uses GitHub issues as its tracking convention. File a tracking issue (labelled follow-up) for each of the following; do **not** implement any of them this run:

1. **`edit.js` 13-mutator descriptor-table refactor** (`edit.js:179-479`). ~120-150 lines saveable but risky (touches the mutation core; each explicit mutator is individually testable). Gate it behind "only if levels/reveal rules change."
2. **Canvas section/measure highlight.** The `data-measure` attribute and `globalMeasureNumber` already exist, so it is reachable, but it is net-new highlight behavior already deferred in-code (`SongCanvas.js:16,43`). This run does only the doc correction (R-DOCS).
3. **List-row Stage 2.** Replace the `editor.scss:28-31` positional `> :first-child` / `> button:last-child` selectors with `Flex` + `FlexBlock` (fields) + `FlexItem` (trash). Requires extending the components mock with `FlexItem`/`FlexBlock` (only `Flex` is exported today) and updating the three `__list-row` hook tests (`pitches.test.js:347`, `annotations.test.js:328`, `contextControls.test.js:408`) — which currently only assert the `.__list-row` className on the row container, so they survive a `Flex` swap provided that className stays on the outer container. Stage 1 (R-LR1/2/3) ships the visible-symptom fix this run.
4. **Precise nearest-surviving-sibling/parent focus after remove** (real index math with edge cases: last row, parent removal, empty tree). The R-FOCUS stable-anchor fix already cures the actual P1 harm; survivor precision is genuine polish, riskier, and only e2e-guardable.

**Acceptance:** four issues exist (labelled follow-up), each describing the deferred work; no corresponding code change lands this run.

## Out of Scope

The following are deliberately excluded this run. Implementing phases must not "fix" them.

**Deferred to the filed follow-up issues (R-FOLLOWUP):** the `edit.js` 13-mutator descriptor-table refactor; the canvas section/measure highlight feature; list-row Stage 2 (`Flex`/`FlexItem`/`FlexBlock` + mock extension + the three hook-test updates); and precise nearest-survivor focus after remove. This run files them and does only the in-scope subset (Stage 1 list-row, doc correction, stable-anchor focus).

**Optional / partial v1 product choices — not acceptance gates this run** (may be picked up only if trivially safe, but none gates this run):
- Toolbar toggles lacking explicit `label`/`showTooltip` (`edit.js:488-503`) — downgraded to polish; visible text already names them.
- Scattered "add for empty parent" affordances (`SongPanel.js:80`, `SectionPanel.js:144`, `StructureTree.js`) — a v1 product choice; handlers already lifted.
- Hand-group rows that look selectable but only toggle (`StructureTree.js:490-497`) — mild; they have a distinct +Add-note cell and no row menu and already toggle correctly.
- Curried `mapMeasure`/`mapEvent` (`noteNames.js:184-240`) — low leverage; inlining is cosmetic.
- `globalMeasureNumber` rebuilding the coord array (`selection.js:114-146`) — negligible (songs are small).
- `ContextEditor` `resetAll` duplicating per-item deselects (`ContextEditor.js:196-209`) — a real DRY/drift risk, but a clean fix must batch into one emission; low priority, a candidate for a future cleanup.

**Rejected suggestions — validated decisions; do NOT undo:**
- Converting the tree/canvas workspace to `Flex`/`HStack` (`edit.js:534`, `editor.scss:38-60`) — the `flex:0 1 auto` / `max-width:24em` / `min-width:0` rules are load-bearing and documented.
- Dropping the `accessibleName` / `system` `useMemo`s (`edit.js:144-157`) — harmless, explicit.
- Changing `TreeExpander` to a `Button` / adding a role (`StructureTree.js:88-110`) — it mirrors core's `ListViewExpander`; a `Button` adds a wrong second tab stop per row.
- Merging the three depth-splice helpers into one `setAt(song, coords, depth)` (`songModel.js`) — reintroduces the depth-as-data hazard the doc warns about; the three panels each need a fixed depth (trim docs only).
- Wiring full click-to-select on the canvas (`SongCanvas.js`) — net-new feature explicitly deferred in-code; fix the framing instead (R-DOCS).

**Preserved prior-review wins — do NOT touch:** the real-`TreeGrid` keyboard model and accessibility parity; the single expansion `Set` + coordinate keys; `[aria-level]` indent; recolor-only canvas highlight; the depth-fixed `setSectionAt`/`setMeasureAt`/`setEventAt` helpers (kept distinct); `omitEmpty` vs `omitFalsy`; raw-JSON mode untouched. The only two prior-review decisions this run deliberately revisits are review 9's select-only/expand-on-collapsed label behavior (now R-TREE: symmetric toggle) and the `NumberControl` margin decision (R-NUM: confirmed review 9 — leave omitted).

**Carried-over constraints:** editor-side only — song format/schema, `render.php`, and the front-end SVG are unchanged (a published song renders byte-identically). Only `@wordpress/*` packages; no new outside dependencies.

## Acceptance Criteria

A reviewer can confirm this run is complete when **all** of the following hold:

1. **R-NUM.** All 7 `NumberControl` sites still omit `__nextHasNoMarginBottom`; no test asserts the prop on a `NumberControl`; a code/PR note records the real-contract rationale (it is a no-op; `InputControl` hardcodes the margin-free `BaseControl`).
2. **R-TREE.** Clicking an expanded section/measure label selects and collapses it; clicking a collapsed one selects and expands it; the chevron and ArrowLeft/Right paths still work. Exactly one test flips (`StructureTree.test.js:388-397`: `calls.toggle` `[]` → `["s0"]`, with title/comment updated); the hand-group label is untouched; all sibling tree tests stay green.
3. **R-LR1/2/3.** The two multi-field list-rows render their middle `NumberControl`s at a usable width with no collapsed inputs and no "OCTAVEALTERATION" collision (unit-assertable via the inline `min-width: 4em` reaching the DOM); the "Alteration note" visible label is now "Note" and no longer wraps, its aria-label unchanged, the `contextControls` tests green; the list-row `HStack`s use `alignment="center"` and the trash icon centers against the field block (e2e / real-render verified — not unit-asserted); no new component introduced.
4. **R-DEL.** All four delete sites (section, measure, note, pitch) fire immediately; no `ConfirmDialog` remains for section removal; `SectionPanel`'s `confirmOpen` and `StructureTree`'s `pendingRemoveSection` state are gone; the listed tests are updated and the two cancel-path tests deleted; the suite is green; a removed node is restorable via native undo.
5. **R-FOCUS.** In e2e: after add/duplicate, focus is on the new row's label Button; after remove, focus is in the tree region (the `treegrid` host is `tabIndex={-1}` and `.focus()`ed), never `<body>`. In jest: the new row carries `aria-current` after add/duplicate (structural precondition only — no false DOM-focus assertion). Focus machinery lives only in `StructureTree`; `edit.js` stays declarative.
6. **R-JSON.** With multiple validator errors, JSON mode renders every message (mirroring `InvalidState`); `Edit.test.js:309` is updated to assert all errors render, not just `errors[0]`.
7. **R-NOOP.** `NotePanel.js` and `MeasurePanel.js` pass `annotations` (no `?? undefined`) to `omitFalsy`; empty annotations still drop the key; annotation tests green.
8. **R-INVALID.** `InvalidState` drops the redundant `<p>` and wraps its container in `VStack`, keeping the `<ul>`; the test mock now exports `VStack`/`__experimentalVStack`; the error messages and "Edit as JSON" button still render; tests green.
9. **R-DOCS.** The canvas "interactive" framing comments in `edit.js` and `editor.scss` now read "display + highlight only"; `edit.js:533` names `editor.scss` (not `style.scss`); the `songModel.js` CRITICAL doc-block prose is trimmed to ~one line per helper while keeping all three helpers distinct; no behavior change; no test asserts the old wording.
10. **R-FOLLOWUP.** Four follow-up tracking issues are filed (labelled follow-up): 13-mutator refactor, canvas section/measure highlight, list-row Stage 2 (`Flex`/`FlexItem`/`FlexBlock` + mock extension), and nearest-survivor focus. None of them is implemented this run.
11. **Cross-cutting.** The song format/schema, `render.php`, and front-end SVG are unchanged (a published song renders byte-identically); only `@wordpress/*` packages are used; the full jest suite and the e2e spec pass; no green jest test masks a real broken component (alignment and focus are e2e-verified, the `VStack` mock is added, no `FlexItem`/`FlexBlock` is relied upon this run).
