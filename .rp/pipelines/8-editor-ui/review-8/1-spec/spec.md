# Review 8 — Spec

## Overview

The Piano Block "editor UI" feature (issue #8, PR #22) is already fully implemented on
this branch. This review run, **review-8**, layers a fixed set of changes driven by a
unified code-review comment posted on PR #22. The review synthesized four independent
reviews (simplification, Gutenberg component usage, styles, editor reusability) into
twenty numbered findings — five **Must-fix** accessibility/CSS/component-prop bugs and
fifteen **Should-do** reuse/simplification cleanups — plus a set of **Optional** polish
items. The owner's decision is to address **everything that triages IN** (Must-fix +
Should-do + the IN Optional items) while respecting the review's "Explicitly fine as-is"
decisions and two explicitly deferred Optional items.

The architecture the review examined is sound and is not being reworked: pure controlled
components, a single `commitSong` path, kind-tagged selection, and pure reusable
primitives (`songModel.js`, `selection.js`, `noteNames.js`). Review-8 corrects two
incomplete adoptions (TreeGrid accessibility, the CSS enqueue split), brings every
component control up to the current WordPress component contract, and removes roughly
400–600 lines of duplicated or dead code with no change to behavior or rendered output.

Three hard boundaries govern every change:

1. **A published song renders byte-identically before and after this review.** The song
   format/schema, `render.php`, and the front-end SVG render (`view.js` and
   `src/notation/`) stay output-identical. Items that touch `src/notation/` or `view.js`
   do so only to remove dead code or de-duplicate shared helpers; the rendered output is
   pinned by tests and must not move.
2. **Dependencies stay within the `@wordpress/*` packages already available to blocks.**
   No new outside dependency. `@wordpress/icons` is already a bundled dependency on this
   branch and is correct to keep.
3. **The wins from prior reviews are preserved**: select-only row labels, a single
   expansion `Set`, coordinate keys, `[aria-level]` indentation, recolor-only selection
   highlight, the TreeGrid keyboard/accessibility model, and the untouched raw-JSON mode.

A cross-cutting verification meta-rule applies to the three findings whose fix depends on
a real `@wordpress/components` / `@wordpress/icons` runtime contract (items 1, 2, 16):
**"tests green" must remain incompatible with "real component broken."** The jest mocks
previously masked bugs 1 and 2 by being more "helpful" than the real components; the fixes
must close that gap so a regression cannot pass the suite.

This spec.md may reference the findings as R1–R20; **shipped code, comments, tests, and
docs must not** reference pipeline internals, finding numbers, or task identifiers.

## Requirements

### Must-fix

**R1 — Keyboard and screen-reader users can expand and collapse rows.**
The song-structure `TreeGrid` must support keyboard expand/collapse through the component's
real contract. `StructureTree` must pass `onExpandRow` and `onCollapseRow` handlers (the
real TreeGrid fires expansion only through these callbacks; their default is a silent
no-op). Each handler receives the active row's DOM `<tr>` element as its sole argument
(`onExpandRow(activeRow)` / `onCollapseRow(activeRow)`), reads a stable expansion key from a
`data-*` attribute on that row (the core List View `data-block` pattern), and routes to the
**existing** `onToggleExpanded(key)` against the **single** `expanded` `Set` — no parallel
state and no second Set. Every expandable `TreeGridRow` (section, measure, hand) must carry
that `data-*` expansion key, derived from the same `expansionKey()` used everywhere else, so
keyboard and pointer share one expansion path. Leaf (note) rows are not expandable and carry
no expansion affordance. The `aria-expanded` already emitted on expandable rows stays.

**R2 — The tree has an accessible name in production.**
`StructureTree` must give the tree a real accessible name. Because `TreeGrid` has no `label`
prop (its named props are `onExpandRow`/`onCollapseRow`/`onFocusRow`/`applicationAriaLabel`,
and everything else spreads onto the `<table role="treegrid">`), the current `label` prop is
a meaningless DOM attribute. Pass `aria-label={__("Song structure", …)}` and drop the dead
`label` prop. The jest components mock must **stop** mapping `label` → `aria-label`, so the
unit test surface matches the real prop surface; any test relying on the old translation
must break (correctly) and be updated.

**R3 — Editor-only CSS is not shipped to the front end.**
The editor-only style rules must be enqueued only in the editor. Today `block.json` wires
only `"style"` and `index.js` imports a single `style.scss`, so editor-only rules (workspace,
tree, canvas, `.is-selected`) ship to site visitors. After the change:
- A new `src/editor.scss` holds the editor-only rules — everything nested under
  `.wp-block-piano-block-piano` from `&__workspace` onward (`__workspace`, `__tree` and its
  `[role="gridcell"]` flex / `@for` aria-level indent / `-expander` / `-label`, `__canvas`,
  `__canvas-svg` and `.is-selected`), re-parented under their own
  `.wp-block-piano-block-piano { … }` block in the new file.
- `style.scss` retains the front-end / shared rules: the `@font-face` "PB Music" declaration
  and the pre-existing wrapper rules (`border`, `padding`, `color`) on
  `.wp-block-piano-block-piano`.
- `index.js` imports the new editor stylesheet beside the existing `style.scss` import
  (wp-scripts emits the editor-only build artifact `build/index.css`).
- `block.json` **keeps** `"style": "file:./style-index.css"` and **adds**
  `"editorStyle": "file:./index.css"`.
The result must work inside the iframed editor canvas (apiVersion 3) exactly as today, and
the front-end render must be unchanged (the moved classes never appear on the front end).

**R4 — Component controls match the current WordPress contract.**
Every interactive control must opt into the 40px default size, and the bogus margin-bottom
prop on numeric controls must be removed:
- Add `__next40pxDefaultSize` to every `Button`, `SelectControl`, `TextControl`,
  `NumberControl`, `TextareaControl`, and `Button`-family control across the editor UI
  (the inspector panels, the context/hand/pitch/metadata/annotation editors, the list
  controls, the invalid-state view, and `edit.js`).
- Add `__nextHasNoMarginBottom` to the `TextareaControl` in `edit.js` that currently lacks
  it.
- **Remove** `__nextHasNoMarginBottom` from every `NumberControl` (it has no such prop and
  forwards unknown props to the underlying `<input>`, producing React unknown-prop dev
  warnings).
No deprecation warnings for missing `__next40pxDefaultSize` and no unknown-prop warnings for
`NumberControl` may remain.

**R5 — Documentation does not claim "no new runtime dependency."**
`README.md` must stop asserting the project has no runtime dependency. Reword the
"no new runtime dependency" statement and the "ajv would be the first runtime dependency"
framing to acknowledge `@wordpress/icons` as a bundled `@wordpress/*` runtime dependency,
while keeping the validator's zero-dependency / schema-as-data narrative intact. The
dependency itself is correct and stays; only the docs change. (The full README cleanup tied
to item 8's removed feature is covered under R8.)

### Should-do (behavior-preserving reuse & simplification)

**R6 — `edit.js` mutators reuse the `set*At` helpers this PR added.**
`edit.js` must import and use `setSectionAt` / `setMeasureAt` / `setEventAt` from
`songModel.js` instead of hand-rolling two-level `sections.map(...)` rebuilds (eight inline
sites today). For the note-level mutators, introduce one helper
`updateHandEvents(song, coords, fn)` that encodes the empty-hand rule **once**: `fn` operates
on the hand's event array; when `fn` returns an empty array (or `null`), the hand key is
**deleted** from the measure (the hand becomes `undefined`, never `[]`); grow callers' `fn`
always returns a non-empty array. Behavior is unchanged.

**R7 — The triplicated row-actions menu is extracted.**
The Duplicate / Add-before / Add-after / destructive-Remove `DropdownMenu`, copy-pasted three
times in `StructureTree.js` and differing only in label and bound coordinates, must become one
component, e.g. `RowActionsMenu({ cellProps, label, onDuplicate, onAddBefore, onAddAfter,
onRemove })`. The extraction must preserve: the `toggleProps={{ ref, tabIndex, onFocus }}`
roving-tabindex forwarding from the TreeGridCell render prop to the DropdownMenu toggle; the
select-only label cell (label `Button` drives selection; the chevron is the `aria-hidden`
pointer-only expander); and render-function `children` for the `DropdownMenu` (the mock returns
`null` otherwise). The repeated chevron+label cell may fold into the same extraction if it
remains cheap.

**R8 — The dead `interactive` hit-rect feature is removed from the notation core.**
The `interactive` flag — threaded through `renderSvg`/`renderInto` and the render functions to
the two guarded `hitRect` leaves — has no production caller (`SongCanvas` and `view.js` both
render without it; only tests use it). Remove the flag, the two guarded `hitRect` branches,
`hitRect`, `HIT_RECT_WIDTH_SP`, and `HIT_RECT_VERTICAL_MARGIN_SP`, plus the feature's tests.
Because the flag is purely additive and dead, non-interactive output is unaffected. Also update
`README.md`: drop the file-layout `interactive` hit-rect clause, delete the "now-dormant
`interactive` hit-rect" section entirely, and drop the interactive-hit-rect test clause; keep
the "byte-identical front end" point (now unconditional).

**R9 — Mirrored editor/front-end helpers are extracted, not duplicated.**
The verbatim duplication between the editor and the front end must be removed by moving the
shared code **down** into the already-shared trees (not by importing `view.js`):
- Move `accessibleNameFor` (and its `trimmedString` helper) to `src/song/accessibleName.js`;
  both the editor and `view.js` import it. It is byte-identical today.
- Move `availableWidthInSp` and `drawWhenFontReady` to a new `src/notation/dom.js`; both
  surfaces import them. This module must be **React-free** (must not import
  `@wordpress/element`) so it does not pull React into the front-end bundle. Use the defensive
  optional-chaining form `container?.clientWidth ?? 0` (a safe superset that does not change
  front-end behavior).
The per-surface `ResizeObserver` wiring stays per-surface and is **not** unified — the editor's
callback drives React state and returns an unmount cleanup, while `view.js`'s callback draws
imperatively and lives for the document's lifetime; their consumption and lifecycle genuinely
differ. The front-end render stays byte-identical.

**R10 — `kind` is stamped at the last untagged producer; the compat branch is deleted.**
Add `kind: "event"` to the one remaining untagged `setSelection` call in `edit.js`
(`onAddNote`). Then delete the now-dead `resolveSelection` defaulting/compat block in
`selection.js`, its accompanying docs, and the compat unit test that exercised it.

**R11 — `edit.js` parses the song once.**
The `accessibleName` memo must not re-parse `song`; reuse the already-parsed `working` memo
(e.g. `song.trim() === "" ? "" : accessibleNameFor(working?.metadata)`) and reduce `isInvalid`
accordingly (e.g. `song.trim() !== "" && errors.length > 0`). `validateSong` already treats
unparseable JSON as a conformance error, so no behavior is lost.

**R12 — The omit helpers are unified and `emit.js` is re-homed.**
`MetadataEditor`'s local `withField` must be replaced with the shared `omitFalsy` so that a
whitespace-only Title is dropped consistently with a whitespace-only Section name (one rule,
one behavior). Inline the trivial wrappers `emitBlock` and `emitMember` as direct
`onChange(omitEmpty(...))` calls. Move `emit.js` to `src/editor/emit.js` so a non-inspector
component no longer imports across the `inspector/` boundary; update both importers (the
production importer and the emit unit test).

**R13 — The duplicated annotations drop-key wrappers are collapsed.**
The duplicated annotations drop-key wrappers in `NotePanel` and `MeasurePanel` must collapse to
one-liners via the existing omit helpers, and the two surfaces must use a single consistent
`onDeselect` idiom (rather than the current `changeOptional`-vs-inline-destructure split).

**R14 — `HandConfigEditor` uses the shared array helpers.**
`HandConfigEditor` must use the shared `replaceAt` / `removeAt` / `insertAt` from `songModel.js`
in place of its local `replaceRow`, the inline `filter((_, i) => i !== index)`, and the
spread-append. It already imports from `songModel.js`; it adds three more names.

**R15 — One `NONE_OPTION` and one source of note-name options.**
Export a single `NONE_OPTION` from `songModel.js` and use it everywhere a "none" select option
is needed, replacing the two duplicate `NONE_OPTION` declarations and the third
`{ label: "—", value: "" }` idiom (the empty-value option text becomes consistent). Also,
`ALTER_KEY_OPTIONS` in `HandConfigEditor` must reuse `noteNameOptions("english")` from
`noteNames.js` rather than rebuilding it.

**R16 — All icon-bearing components use `@wordpress/icons` element icons.**
Every icon-bearing component must pass a `@wordpress/icons` **element** (e.g. `plus`, `trash`),
not a Dashicon slug string — Dashicon slug strings render as an empty square in the canvas
iframe (no dashicons stylesheet there). Import `plus` and `trash` where slug strings are used
today (the add-button list control and the three trash/remove buttons); `StructureTree`'s
existing element icons stay. In the add-button control, drop the now-redundant `label`; add
`isDestructive` to the remove buttons. A **project-wide** string-icon guard must remain that is
RED-on-regression and covers **all** icon-bearing components — not just `StructureTree` (the
four live slug strings are in leaf editors the existing realIcons test never mounts). See the
Optional real-icons item for how this guard may be lightened.

**R17 — Selection color follows the admin theme; CSS is trimmed.**
While the editor rules move to `editor.scss` (R3):
- Replace the three `#007cba` occurrences with `var(--wp-admin-theme-color, #007cba)` so the
  selection highlight follows the admin color scheme. `.is-selected` must remain **recolor-only**
  (fill/stroke color value only — no layout, size, or transform change) so the front-end SVG
  stays byte-identical.
- Trim `__canvas` to its load-bearing `flex: 1 1 auto; min-width: 0` (its `flex-direction`/`gap`
  are no-ops because `SongCanvas` renders a single child).
- Delete the unused `__song-input` class hook (no CSS or test targets it) and the stale comments.
- The `@for` `[aria-level]` indent rule must survive the move **verbatim** (only its file
  changes).

**R18 — Comments reference real code; provenance tags are stripped.**
Fix the stale comments that name code that no longer exists (the `EventRow`,
`MeasureEditor`/`BarlineControl`, `SectionEditor`, `repairPath`, and `SongPreview` references,
and the `StructureTree` docblock's false "Left/Right works for free" keyboard claims — corrected
to describe the real `onExpandRow`/`onCollapseRow` path from R1). Strip pipeline-provenance tags
(e.g. `KD 14`, `T6`, `AC3`) from comments while editing.

**R19 — The duplicated `<h3>` heading is removed.**
Remove the `heading` prop and the two raw `<h3>` elements in `ContextEditor`. The only caller
passing `heading` duplicates the wrapping `ToolsPanelItem`'s "Section overrides" label.

**R20 — The reveal-ancestors trio is extracted.**
Extract the identical three-key ancestor-reveal logic (used three times in `edit.js`) into one
`ancestorKeys(coords)` helper in `selection.js` (which already owns `expansionKey`); it may also
own the inline event-key construction currently in `StructureTree.js`. The extracted helpers
must produce **byte-identical** key strings (`s0`, `s0m1`, `s0m1rightHand`, `s0m1rightHande0`) so
`Set` membership, React keys, and `edit.js` reveal seeds still agree (Guardrail A).

### Optional — IN

**O1 — Lighten the real-icons jest infrastructure (conditional on R16's guard).**
The two-project jest config (unit + real-icons) with the React-dedup mapper and the 264-line
`StructureTree.realIcons.test.js` may be removed **only if** the project-wide string-icon
guarantee from R16 is preserved: make `test/mocks/wordpress-icons.js` export non-string
sentinels and add one assertion in the regular suite that **no icon-bearing component received a
string `icon`**, covering all icon-bearing components. That guard must fail RED on a reintroduced
string `icon` and pass once icons are element imports. If this RED-on-regression guarantee cannot
be cheaply preserved, keep the realIcons test instead. Either form is acceptable provided the
guarantee holds and the icons-mock change does not let a string-icon regression silently pass.

**O2 — Unify the hand vocabulary into one `HANDS` export.**
The restated rightHand/leftHand keys and labels (in `songModel.js`'s `STAVES`, `StructureTree`,
and `ContextEditor`) must consolidate into one exported `HANDS` (ordered keys with
translator-wrapped labels) from `songModel.js`. The export must serve the three shapes its
consumers need — an iteration-order key array, `{ label, value }` select options, and key+label
pairs (e.g. an ordered `[{ key, label }]` from which a select derives `{ label, value }`).
Internal only; no behavior change.

**O3 — `HandConfigEditor` label composition uses sprintf templates.**
Replace the raw `` `${label} ${field}` `` concatenation (lowercase fragments, not reorderable
for translators) with sprintf templates, matching the rest of the PR. If controls are located in
tests by aria-label, update those locators to match the new composed string.

**O4 — Remove unused / test-only exports (per-symbol).**
- **Delete** `newRest` from `songModel.js` and its test (production-dead).
- **Delete** `BPM_MIN_EXCLUSIVE` from `songModel.js` and its test. It is an exclusive bound (`0`)
  that does not map to `NumberControl`'s inclusive `min`; the control's `min={1}` plus the
  bounded-int clamp already enforces the bound. Do **not** wire `min={BPM_MIN_EXCLUSIVE}`.
- Drop only the `export` keyword (keep the function) on `toNumber`, the test-only `serializeSong`
  export, and the `measureCoords` export — each function is still used internally.
- Delete the dead `ToggleControl` and `__experimentalTreeGridItem`/`TreeGridItem` mocks (and
  their `module.exports` entries) — no production component and no test use them.
- Per-symbol rule: "remove the export" means either delete the test that imports it **or** keep
  the export; do not blanket-delete an export a test still imports without updating the test.

**O5 — Spacing for bare-div rows and adjacent buttons (lowest-priority polish).**
Use `Flex`/`HStack` for the bare-`div` rows (`PitchList`, `AnnotationList`, `HandConfigEditor`)
and the adjacent button pairs (`NotePanel`, `SectionPanel`, `SongPanel`, `InvalidState`). Pure
cosmetic; no behavior or test risk. Safe to defer if scope tightens, but in scope for this review.

## Out of Scope

**Deferred Optional items:**
- **ToolsPanel nested inside PanelBody** (Note/Measure/Section panels). The review marks this
  "Works as-is — design judgment." Restructuring the inspector into a ToolsPanel-as-its-own-group
  layout is a real UX change that risks the panel-location assertions and the most-specific-first
  panel gating; deferred unless the owner specifically asks for the inspector restructured.
- **The wrapper's dashed placeholder border** (`style.scss`) now framing real sheet music on the
  front end. The review scopes this out as pre-existing ("note it but do not necessarily fix it
  here"); the R3 CSS split neither creates nor worsens it, and touching front-end wrapper CSS
  would risk the byte-identical front-end guarantee. Deferred to a follow-up issue.

**Explicitly fine as-is — do not change** (the review validated these as correct decisions):
- The custom tree CSS (custom indentation, truncation, `#ddd` hairline) — reusing core
  `.block-editor-list-view-*` classes would couple to private markup.
- The `aria-hidden` pointer-only chevron — it mirrors core's `ListViewExpander` and is correct
  once R1 restores the keyboard path.
- `DropdownMenu` `toggleProps` roving-tabindex forwarding — the correct List View pattern.
- The three distinct `set*At` faces — a depth-inferring splice would corrupt the song.
- `ContextEditor`'s draft/projection model — genuinely needed for multi-field required
  sub-objects.
- No generic `EditableList` over PitchList/AnnotationList/HandConfigEditor — they have different
  invariants; revisit only if a fourth list appears.
- Notation ink hard-coding and the shared render path — deliberate; `.is-selected` is safely
  scoped.
- Workspace flex via SCSS rather than a `Flex` component — matches how core styles List View.
- Component placement (panels in InspectorControls, toggles in BlockControls, in-canvas tree) —
  List View has no per-block slot for intra-block data.

**Hard boundaries:**
- The **song format/schema**, **`render.php`**, and the **front-end SVG render** stay
  byte-identical. `render.php` has no JS/SVG surface; the byte-identity guarantee concerns the
  client-side `view.js` draw.
- **No new outside dependencies** — only `@wordpress/*` packages already available to blocks.
- **Prior-review wins are preserved**: select-only labels, single expansion `Set`, coordinate
  keys, `[aria-level]` indent, recolor-only highlight, the TreeGrid keyboard/accessibility model,
  and the untouched raw-JSON mode.

## Acceptance Criteria

Each criterion is traceable to a requirement above. Criteria marked **(e2e)** exercise the real
WordPress / real-component contract (Playwright against wp-env); criteria marked **(unit)** run
in the always-run jsdom suite.

**A1 (R1) — keyboard expand/collapse.**
- (e2e) A new test focuses a section, measure, and hand row, presses ArrowRight to expand and
  ArrowLeft to collapse, and asserts the child rows appear and disappear — driving the **real**
  keyboard path, not clicking the chevron.
- (unit) `StructureTree` passes `onExpandRow` and `onCollapseRow`; each expandable row carries the
  `data-*` expansion key; a pure mapping test confirms that, given a synthetic `<tr>` carrying a
  `data-*` key, the handler routes to `onToggleExpanded(key)` with the correct key.
- The keyboard path uses the **same** `onToggleExpanded`, the **same** single `expanded` `Set`,
  and the **same** `expansionKey()` strings as the pointer path; leaf rows trigger no expansion.

**A2 (R2) — accessible name.**
- (e2e) `getByRole("treegrid", { name: "Song structure" })` resolves the tree (it does not
  resolve today, because `label` is a dead attribute).
- (unit) `StructureTree` passes `aria-label` and no `label`; the components mock no longer maps
  `label` → `aria-label`, and any unit test that relied on that translation has been updated to
  the real prop surface.

**A3 (R3) — editor-only CSS.**
- `src/editor.scss` exists and contains the workspace/tree/canvas/`.is-selected` rules re-parented
  under `.wp-block-piano-block-piano`; `style.scss` retains only `@font-face` and the wrapper
  `border`/`padding`/`color`.
- `index.js` imports the editor stylesheet; `block.json` keeps `"style": "file:./style-index.css"`
  and adds `"editorStyle": "file:./index.css"`.
- The build emits an editor-only `build/index.css` (and its RTL variant). In the iframed editor
  the tree indents and the selection recolor still apply.
- **Front-end parity:** the `render.spec.js` front-end assertions for accessible name and
  structure stay green; the moved classes do not appear in the front-end output.

**A4 (R4) — control props.**
- No `__next40pxDefaultSize` deprecation warning is emitted by any editor control; every
  Button/SelectControl/TextControl/NumberControl/TextareaControl opts in.
- The `edit.js` `TextareaControl` has `__nextHasNoMarginBottom`.
- No `NumberControl` is passed `__nextHasNoMarginBottom`, and no React unknown-prop warning for it
  remains.

**A5 (R5) — README dependency claim.**
- `README.md` no longer claims "no new runtime dependency" and no longer calls ajv the "first"
  runtime dependency; it acknowledges `@wordpress/icons` as a bundled `@wordpress/*` runtime
  dependency, with the validator's zero-dependency narrative intact. No dependency is added or
  removed.

**A6 (R6) — `edit.js` mutators.**
- `edit.js` imports and uses `setSectionAt`/`setMeasureAt`/`setEventAt`; the eight inline
  two-level rebuilds are gone.
- A single `updateHandEvents(song, coords, fn)` encodes the empty-hand rule. **Behavioral pin:**
  removing the last event in a hand yields that hand key **absent** (`undefined`), never `[]`;
  removing a non-last event yields the trimmed array. The existing `Edit.test.js` assertion that
  the emptied hand key is `undefined` stays green unchanged.

**A7 (R7) — RowActionsMenu.**
- One `RowActionsMenu` component replaces the three copies. Unit tests confirm: each row still
  renders Duplicate / Add-before / Add-after / Remove with the correct bound coordinates; the
  toggle still receives forwarded `toggleProps` (roving tabindex); the label cell is select-only;
  and the `DropdownMenu` children remain a render function (the toggle does not vanish).

**A8 (R8) — dead `interactive` removed; render parity.**
- `interactive`, `hitRect`, `HIT_RECT_WIDTH_SP`, and `HIT_RECT_VERTICAL_MARGIN_SP` no longer exist
  in `src/notation/`; the feature's tests are removed.
- The non-interactive structural blocks in `svg.test.js` stay green unchanged.
- At least one "a flagless render emits no `data-hit`" assertion remains (re-pointed at the now
  flag-free API).
- **Front-end byte-identity:** the `render.spec.js` guard asserting zero `[data-hit]` elements
  stays green; the front-end SVG output is unchanged.
- `README.md`'s interactive/hit-rect file-layout clause, the "now-dormant `interactive` hit-rect"
  section, and the hit-rect test clause are removed.

**A9 (R9) — extracted shared helpers; render parity.**
- `accessibleNameFor` lives in `src/song/accessibleName.js`; `availableWidthInSp` and
  `drawWhenFontReady` live in `src/notation/dom.js`; both the editor and `view.js` import them and
  no longer duplicate them.
- `src/notation/dom.js` does not import `@wordpress/element` (stays React-free).
- The per-surface `ResizeObserver` wiring is not unified into a single shared function.
- **Front-end byte-identity:** the `render.spec.js` front-end accessible-name and structure
  assertions stay green; the rendered output is identical before and after.

**A10 (R10) — `kind` stamped; compat removed.**
- The `onAddNote` selection carries `kind: "event"`; the `resolveSelection` defaulting block, its
  docs, and the compat test are deleted. The remaining selection tests stay green.

**A11 (R11) — single parse.**
- `edit.js` parses `song` once (the `accessibleName` memo reuses `working`); `isInvalid` is
  reduced accordingly. Behavior for empty, valid, and invalid JSON is unchanged.

**A12 (R12) — omit helpers unified; `emit.js` re-homed.**
- `MetadataEditor` uses `omitFalsy`; a whitespace-only Title is now dropped consistently with a
  whitespace-only Section name. `emitBlock`/`emitMember` are inlined. `emit.js` lives at
  `src/editor/emit.js`; both importers (production + test) are updated; no component imports across
  the `inspector/` boundary for it.

**A13 (R13) — annotations wrappers collapsed.**
- The `NotePanel` and `MeasurePanel` annotations drop-key wrappers are one-liners via the omit
  helpers and share one `onDeselect` idiom; their behavior is unchanged.

**A14 (R14) — HandConfigEditor array helpers.**
- `HandConfigEditor` uses `replaceAt`/`removeAt`/`insertAt`; the local `replaceRow`, inline
  filter, and spread-append are gone; row add/remove/replace behavior is unchanged.

**A15 (R15) — one NONE_OPTION, one note-name source.**
- `songModel.js` exports a single `NONE_OPTION` used by all "none" selects; the duplicate
  declarations and the `{ label: "—", value: "" }` idiom are gone. `ALTER_KEY_OPTIONS` is derived
  from `noteNameOptions("english")`.

**A16 (R16) — element icons + guard.**
- No icon-bearing component passes a string `icon`; the add-button and the three remove buttons
  pass `plus`/`trash` elements; the add-button's redundant `label` is dropped; remove buttons are
  `isDestructive`.
- (unit) A **project-wide** string-icon guard covers all icon-bearing components and is
  RED-on-regression: it fails if any icon-bearing component is given a string `icon` and passes
  once all icons are element imports.

**A17 (R17) — admin color + trimmed CSS.**
- The three `#007cba` values are `var(--wp-admin-theme-color, #007cba)`; `.is-selected` remains
  recolor-only (no layout/size/transform change), so the SVG selection test and front-end
  byte-identity stay green. `__canvas` is trimmed to `flex: 1 1 auto; min-width: 0`; the
  `__song-input` hook and stale comments are deleted; the `[aria-level]` indent rule is preserved
  verbatim in its new file.

**A18 (R18) — comments fixed.**
- The named stale comments are corrected (including the `StructureTree` docblock describing the
  real keyboard path), and pipeline-provenance tags are removed from edited comments. No shipped
  comment references nonexistent code or pipeline internals.

**A19 (R19) — heading removed.**
- `ContextEditor` no longer accepts a `heading` prop or renders the two raw `<h3>`s; the Section
  overrides label is no longer duplicated.

**A20 (R20) — ancestorKeys extracted.**
- `selection.js` exports `ancestorKeys(coords)` (and, optionally, the event-key construction),
  used by `edit.js` (and `StructureTree`). The produced key strings are byte-identical
  (`s0`, `s0m1`, `s0m1rightHand`, `s0m1rightHande0`); `expansionKey` unit tests and the
  tree-expansion path stay green.

**AO1 (O1) — lightened real-icons guard.**
- The string-icon guarantee from A16 holds via either the retained realIcons test or the
  lightened non-string-sentinel mock plus a project-wide assertion. If lightened, the
  `wordpress-icons.js` mock exports non-string sentinels, the two-project/React-dedup jest config
  and the realIcons test are removed, and the project-wide assertion still fails RED on a
  reintroduced string `icon`.

**AO2 (O2) — HANDS export.**
- One `HANDS` export from `songModel.js` backs the hand keys/labels in `StructureTree` and
  `ContextEditor` and the staff options; rightHand/leftHand keys and labels are no longer
  restated. Behavior and rendered labels are unchanged.

**AO3 (O3) — sprintf labels.**
- `HandConfigEditor` composes its control labels via sprintf templates (no raw `${label} ${field}`
  concatenation); any test/e2e locators relying on the composed label are updated.

**AO4 (O4) — export cleanup.**
- `newRest` and `BPM_MIN_EXCLUSIVE` (and their tests) are deleted; `min={1}` on the BPM control is
  unchanged. `toNumber`, `serializeSong`, and `measureCoords` keep their functions but drop the
  `export` keyword. The dead `ToggleControl` and `__experimentalTreeGridItem`/`TreeGridItem` mocks
  are removed. No test references a removed export, and the suite stays green.

**AO5 (O5) — spacing polish.**
- The bare-`div` rows and adjacent button pairs use `Flex`/`HStack`; no behavior changes and no
  tests break.

**Global parity gate.** Across all of the above, a published song renders byte-identically: the
song format/schema, `render.php`, and the front-end SVG (`view.js`, `src/notation/`) produce
identical output, pinned by the existing `render.spec.js` and non-interactive `svg.test.js`
assertions; the full unit and e2e suites pass, and no prior-review win regresses (Guardrails A–D:
single expansion Set + coordinate keys, RowActionsMenu roving-tabindex + select-only + render-fn
children, recolor-only `.is-selected` survives the CSS move, raw-JSON mode untouched).
