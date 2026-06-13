# Review 8 — Design doc

## Scope and framing

The Piano Block "editor UI" feature (issue #8, PR #22) already ships on this branch.
Review-8 layers a fixed set of **behavior-preserving** fixes plus reuse/simplification
cleanups onto the existing code: five Must-fix accessibility/CSS/component-prop bugs
(R1–R5), fifteen Should-do reuse/simplification items (R6–R20), and five IN Optional
polish items (O1–O5). This document explains **how** to implement the approved spec on
the live source — module boundaries, helper shapes, APIs, change ordering, and the test
strategy that keeps "tests green" incompatible with "real component broken."

The architecture is not being reworked. It stays: pure controlled components, a single
`commitSong` path, kind-tagged selection, and the pure primitives `songModel.js`,
`selection.js`, `noteNames.js`. Review-8 completes two incomplete adoptions (the TreeGrid
keyboard model and the editor/front-end CSS enqueue split), brings every component control
up to the current WordPress component contract, and removes roughly 400–600 lines of
duplicated or dead code.

Three hard boundaries govern every change in this doc:

1. **A published song renders byte-identically before and after.** The song
   format/schema, `render.php`, and the front-end SVG draw (`view.js`, `src/notation/`)
   stay output-identical. Items touching `src/notation/` or `view.js` (R8, R9) do so only
   to delete dead code or de-duplicate shared helpers; the rendered output is pinned by
   `render.spec.js` and the non-interactive `svg.test.js` assertions and must not move.
2. **Dependencies stay within `@wordpress/*`.** No new outside dependency.
   `@wordpress/icons` is already a bundled dependency on this branch and is correct to keep.
3. **Prior-review wins are preserved**: select-only row labels, a single expansion `Set`,
   coordinate keys, `[aria-level]` indentation, recolor-only selection highlight, the
   TreeGrid keyboard/accessibility model, and the untouched raw-JSON mode.

A cross-cutting verification meta-rule applies to the three findings whose fix depends on
a real `@wordpress/components` / `@wordpress/icons` runtime contract (R1, R2, R16):
**"tests green" must remain incompatible with "real component broken."** The jest mocks
previously masked R1 and R2 by being more "helpful" than the real components; the fixes
must close that gap so a regression cannot pass the always-run suite. Each of these three
gets a real-contract e2e plus an always-run jsdom guardrail (detailed per item below).

This artifact may reference the findings as R1–R20 / O1–O5 freely. **Shipped code,
comments, tests, and docs must not** reference finding numbers, task identifiers, or any
pipeline internals.

### Guardrails carried through every change

- **Guardrail A** — single expansion `Set` + byte-identical coordinate keys. All key
  producers (`expansionKey`, the new `ancestorKeys`, `eventKey`) emit the exact strings
  `s0` / `s0m1` / `s0m1rightHand` / `s0m1rightHande0`, unit-pinned, so `Set` membership,
  React keys, and `edit.js` reveal seeds agree.
- **Guardrail B** — `RowActionsMenu` keeps the `toggleProps` roving-tabindex forwarding,
  the select-only label cell, and render-function `DropdownMenu` children.
- **Guardrail C** — the `[aria-level]` indent rule moves **verbatim** and `.is-selected`
  stays **recolor-only** across the CSS split.
- **Guardrail D** — raw-JSON mode is untouched.

---

## Module / API design

### 1. `src/editor/selection.js` — the key contract (R1, R20)

`selection.js` already owns `expansionKey({ sectionIndex, measureIndex, hand })`, which
builds the coordinate key by concatenation (`s${si}`, `+m${mi}`, `+hand`). Review-8 makes
this file the single home of the whole key contract — both **writing** a key onto a row
and **reading** it back — by adding three pure, React-free, DOM-light helpers co-located
with `expansionKey`:

- **`ancestorKeys({ sectionIndex, measureIndex, hand })`** → the three-key
  section→measure→hand reveal array:
  ```
  [ expansionKey({ sectionIndex }),
    expansionKey({ sectionIndex, measureIndex }),
    expansionKey({ sectionIndex, measureIndex, hand }) ]
  ```
  It reproduces, verbatim, the identical three-key reveal trio currently inlined three
  times in `edit.js` (the post-commit reveal in the add-note, duplicate-note, and
  insert-note paths). Callers spread it:
  `revealAncestors(...ancestorKeys({ sectionIndex, measureIndex, hand }))`.

  **Scope pin:** `ancestorKeys` is the **three-key** reveal only. The single-key reveal
  sites in `edit.js` (`onDuplicateMeasure`, `insertMeasureAt`, which reveal only
  `expansionKey({ sectionIndex })`) keep calling `expansionKey` directly; they are not
  forced through `ancestorKeys`.

- **`eventKey({ sectionIndex, measureIndex, hand, eventIndex })`** =
  `expansionKey({ sectionIndex, measureIndex, hand }) + "e" + eventIndex`. It replaces the
  inline `` `${handKey}e${eventIndex}` `` template in `StructureTree.js`. It produces
  `s0m1rightHande0` byte-identically. **`eventKey` is used only as the React `key` on the
  leaf (note) row** — notes are leaves, never `expanded`-Set members, and `edit.js` has no
  event-level reveal, so moving its construction changes no `Set` membership and no other
  consumer. It is co-located for one-file key provenance, but it is lower-stakes than
  `ancestorKeys` (single consumer).

- **`expansionKeyOf(row)`** = `row?.getAttribute?.("data-expansion-key") ?? null` — the
  symmetric **inverse** of `expansionKey`. `expansionKey` writes the key string; this
  reads it back off a DOM `<tr>`. Pure, DOM-arg-only, no React.

**Why co-locate the reader in `selection.js`:** the write side (`expansionKey`) and the
read side (`expansionKeyOf`) form one contract; keeping them in one file means a change to
the attribute name or key shape touches one module and reinforces Guardrail A. The handler
that *uses* `expansionKeyOf` stays in `StructureTree.js` because it needs `onToggleExpanded`
from props (see §3); only the pure reader is extracted.

**R10 — kind stamp + compat delete (same file pass).** The `onAddNote` `setSelection` in
`edit.js` is the one remaining untagged event producer; stamp it `kind: "event"`. Then the
backward-compat defaulting block inside `resolveSelection` (which infers `kind: "event"`
from a complete-but-untagged four-field tuple), its accompanying docblock paragraph, and
the compat unit test in `selection.test.js` are all deleted. `validateSong`-driven behavior
is unchanged; every selection producer now stamps `kind` at the source.

**Tests.** Add unit coverage asserting `ancestorKeys` and `eventKey` produce the exact
strings (`s0` / `s0m1` / `s0m1rightHand` / `s0m1rightHande0`) so byte-identity is pinned,
not merely asserted in prose. Add a mount-free unit on `expansionKeyOf(syntheticTr)`
returning the right key for a `<tr>` carrying `data-expansion-key`, and `null` for a row
without it. The existing `expansionKey` tests stay green; the deleted compat test goes
away with R10.

### 2. `src/editor/songModel.js` — song-shape helpers and vocabularies (R6, R15, O2, O4)

`songModel.js` owns the immutable `set*At` faces and the song vocabularies. Review-8 adds
one mutator helper and consolidates three vocabularies.

**R6 — `updateHandEvents(song, { sectionIndex, measureIndex, hand }, fn)`.** This helper
encodes the empty-hand rule **once**, beside the `set*At` faces, composing on
`setMeasureAt`:

```
export function updateHandEvents(song, { sectionIndex, measureIndex, hand }, fn) {
  const measure = song.sections[sectionIndex].measures[measureIndex];
  const nextEvents = fn(measure[hand] ?? []);
  let nextMeasure;
  if (nextEvents == null || nextEvents.length === 0) {
    const { [hand]: _dropped, ...rest } = measure;
    nextMeasure = rest;
  } else {
    nextMeasure = { ...measure, [hand]: nextEvents };
  }
  return setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure);
}
```

- `fn` operates on the hand's event array; the helper passes `measure[hand] ?? []` so a
  grow `fn` on a missing hand receives `[]` and returns a non-empty array, **creating** the
  key (matches today's add-note behavior).
- When `fn` returns an empty array **or** `null`, the hand key is **deleted** from the
  measure — the hand becomes `undefined`, never `[]` (byte-matches today's inline
  remove-note empty-hand drop). `(!nextEvents || nextEvents.length === 0)` is an equivalent
  guard; implementer's call.
- It reuses the existing immutable rebuild (`setMeasureAt → setSectionAt → replaceAt`), so
  the empty-hand decision is the **only** new logic; the splice plumbing is the existing
  faces.
- The helper is **song-shape-only** and assumes section/measure exist (it dereferences
  `song.sections[si].measures[mi]`), exactly like `setEventAt`. All four note-level callers
  already guard existence before calling (the guards also drive selection-clearing, which
  is not the helper's job), so guards stay at the call sites; no guard inside the helper.

**R15 — single `NONE_OPTION`.** Export one `NONE_OPTION` from `songModel.js` and use it
everywhere a "none" select option is needed, replacing the two duplicate `NONE_OPTION`
declarations (in `NotePanel`/`MeasurePanel`) and the third `{ label: "—", value: "" }`
idiom (in `ContextEditor`/`HandConfigEditor`). The empty-value option text becomes
consistent across the editor. `ALTER_KEY_OPTIONS` in `HandConfigEditor` is rebuilt from
`noteNameOptions("english")` (from `noteNames.js`) rather than hand-listed.

**O2 — one `HANDS` export.** Consolidate the restated rightHand/leftHand keys and labels
into one exported ordered `{ key, label }` array:
```
export const HANDS = [
  { key: "rightHand", label: __("Right hand", "piano-block") },
  { key: "leftHand", label: __("Left hand", "piano-block") },
];
```
This single shape serves all three consumer needs:
- an iteration-order **key array** — `StructureTree` iterates `HANDS` directly
  (`handPosition` = index; `h.key`/`h.label` replace its local `["rightHand","leftHand"]`
  array and its restated hand-label literals);
- **key+label** lookups — `ContextEditor` reads labels by key;
- `{ label, value }` **select options** — `STAVES` becomes a **derived** export,
  `export const STAVES = HANDS.map((h) => ({ label: h.label, value: h.key }))`,
  byte-identical to today's literal. `STAVES` is kept as an export (its importers
  `AnnotationEditor` and `songModel.test.js` are unchanged); the de-duplication is purely
  internal — `STAVES` stops being a literal and becomes a projection of `HANDS`.

**CRITICAL boundary caveat (O2):** `src/notation/layout.js` has its **own**
`const HANDS = ["rightHand","leftHand"]` in the front-end/notation-core layer. **Do not
touch it.** O2 is editor-scoped. Importing `songModel.HANDS` into `notation/layout.js`
would cross the layered boundary (`notation/` must not import from `editor/`) and risk
front-end byte-identity. AO2's "the staff options" means `STAVES`, not `layout.js`'s array;
they stay intentionally separate (different layers).

**O4 — per-symbol export cleanup.** Apply the per-symbol rule ("remove the export" means
either delete the test that imports it **or** keep the export — never blanket-delete an
export a test still imports without updating the test):
- **DELETE** `newRest` from `songModel.js` and its test (production-dead).
- **DELETE** `BPM_MIN_EXCLUSIVE` from `songModel.js` and its test. It is an exclusive bound
  (`0`) that does not map to `NumberControl`'s **inclusive** `min`; the BPM control's
  `min={1}` plus the bounded-int clamp already enforce the bound. **Do not** wire
  `min={BPM_MIN_EXCLUSIVE}`; leave `min={1}` unchanged.
- Drop only the `export` keyword (keep the function bodies) on `toNumber`, the test-only
  `serializeSong` export, and `measureCoords` — each is still used internally.
- Delete the dead `ToggleControl` and `__experimentalTreeGridItem`/`TreeGridItem` mocks
  (and their `module.exports` entries) — no production component and no test use them.

**Tests.** Add a `songModel.test.js` unit for `updateHandEvents` covering: grow → key
present with the new array; shrink-to-empty → key **absent**; shrink-non-last → key
present, trimmed; `fn` returns `null` → key absent; plus an immutability check (input
`song` unmutated), matching the existing `set*At` test convention. The `newRest` and
`BPM_MIN_EXCLUSIVE` tests are deleted; the `STAVES` enum-mirror test stays green (STAVES is
unchanged in shape).

### 3. `src/editor/StructureTree.js` — TreeGrid wiring, RowActionsMenu, HANDS, comments (R1, R7, O2, R18)

**R1 — real keyboard expand/collapse.** Load-bearing evidence (Gutenberg's tree-grid
keydown handler): the component fires each callback **gated on the focused row's current
state** —
- ArrowRight calls `onExpandRow(activeRow)` **only when the row is collapsed**
  (`aria-expanded === "false"`); on an expanded row it moves focus to the next cell, so
  `onExpandRow` never fires on an expanded row;
- ArrowLeft calls `onCollapseRow(activeRow)` **only when the row is expanded**; on a
  collapsed row it moves focus to the parent row, so `onCollapseRow` never fires on a
  collapsed row;
- both props **default to `() => {}`** (silent no-op) — the root cause of the bug;
- the sole argument is the active DOM `<tr>` (`HTMLElement`).

**Decision: toggle-on-both, one shared in-component handler, no add-only/delete-only
guard.** Because the component only fires expand-on-collapsed and collapse-on-expanded, a
single `onToggleExpanded(key)` (add-if-absent / delete-if-present) is correct and
idempotent for **both** callbacks. The gate reads the same `aria-expanded` the component
already emits from `TreeGridRow`'s `isExpanded` (derived from `expanded.has(key)`), so the
gate and the `Set` cannot disagree. Point **both** `onExpandRow` and `onCollapseRow` at one
shared handler:

```
const onExpandCollapseRow = (row) => {
  const key = expansionKeyOf(row);
  if (key) onToggleExpanded?.(key);
};
```

This is cleaner than two near-identical guarded handlers, and safety is guaranteed by the
component contract, not by our code (worst case if the contract were violated: one wrong
toggle, never corruption). The handler stays in-component because it closes over
`onToggleExpanded` from props.

**Decision: `data-expansion-key` kebab literal, read with `getAttribute`.** `TreeGridRow`
spreads `...props` onto the `<tr role="row">` in both the real component and the jest mock,
so a `data-*` attribute lands on the row in both surfaces. **Author it as the kebab literal
`data-expansion-key={key}` in JSX** and read it with
`activeRow.getAttribute("data-expansion-key")` (via `expansionKeyOf`). **Pin:** React/JSX
does **not** auto-kebab `data-*` props — `data-expansionKey` would emit the literal
lowercased `data-expansionkey` (a silent mismatch trap). The kebab literal mirrors core
List View's `data-block` idiom. Only the three expandable rows (section / measure / hand)
carry it; the leaf note row (no `isExpanded`, no `aria-expanded`) must **not** carry it,
keeping "leaf rows have no expansion affordance" structurally true. The `data-expansion-key`
goes on the `<TreeGridRow>`, **not** the cell, so folding the label cell (R7) does not touch
expansion-key wiring. The `aria-expanded` already emitted on expandable rows stays.

`StructureTree.js:569` changes `<TreeGrid label={…}>{rows}</TreeGrid>` to pass
`onExpandRow={onExpandCollapseRow}` and `onCollapseRow={onExpandCollapseRow}` (and the
R2 `aria-label`, below). Every expandable `TreeGridRow` adds
`data-expansion-key={expansionKey(...)}`, derived from the same `expansionKey()` used for
its `expanded`-Set membership and React key. The leaf note row uses `eventKey(...)` for its
React key and carries no `data-expansion-key`.

**R7 — `RowActionsMenu` (and `RowLabelCell`).** The Duplicate / Add-before / Add-after /
destructive-Remove `DropdownMenu` is copy-pasted three times (section, measure, note rows),
differing only in label and bound coordinates. Extract one module-local component:

```
RowActionsMenu({ toggleProps, label, onDuplicate, onAddBefore, onAddAfter, onRemove })
```

- **Shape A (the `<TreeGridCell>` stays at each call site).** The roving-tabindex
  render-prop arg exists only **inside** `TreeGridCell`'s render-prop callback, so the cell
  must stay at the call site for `RowActionsMenu` to receive it. Each site becomes
  `<TreeGridCell>{(p) => <RowActionsMenu toggleProps={p} label={…} onDuplicate={…}
  onAddBefore={…} onAddAfter={…} onRemove={…} />}</TreeGridCell>` — replacing a ~54-line
  `DropdownMenu` block with ~6 lines, three times. Shape B (RowActionsMenu renders its own
  TreeGridCell) is rejected: it buries the cell and needlessly couples the component to
  being the row's second cell.
- **`toggleProps` forwarding (Guardrail B).** The real `TreeGridCell` render-prop arg is
  exactly `{ ref, tabIndex, onFocus }` (core's roving-tabindex cell contract); pass it
  straight through as `<DropdownMenu icon={moreVertical} toggleProps={toggleProps}
  label={label}>`. The prop name `toggleProps` matches the real wiring more precisely than
  the spec's illustrative `cellProps`. Under jest the arg is `{}`, so the forwarding spreads
  nothing; the key invariant is that the trio reaches `DropdownMenu.toggleProps` unchanged.
- **Render-function children are MANDATORY (regression canary).** `RowActionsMenu` renders
  `<DropdownMenu …>{({ onClose }) => (<>…</>)}</DropdownMenu>` with the two `MenuGroup`s
  (Duplicate / Add before / Add after, then destructive Remove), each
  `MenuItem.onClick = () => { onX?.(); onClose(); }`. The `DropdownMenu` mock returns
  `null` unless `children` is a render function (mirroring core's `isFunction(children)`
  guard), so element children would make the toggle **vanish** and fail the toggle-presence
  test and every row-actions test. This mock guard is the canary: a bad extraction fails the
  always-run suite.

**`RowLabelCell` — fold ONLY section + measure.** The section and measure label cells are
byte-identical in shape (`TreeExpander` + select-only label `Button` with `aria-current` +
`onSelect`), differing only in key/isExpanded/selected/payload/text. Collapse both with **no
conditionals** into `RowLabelCell({ expansionKey, isExpanded, selected, label,
onToggleExpanded, onSelect })`. **Leave hand and note label cells explicit:** the hand label
cell diverges (its label `Button` `onClick` drives `onToggleExpanded`, with **no**
`aria-current` — non-selectable) and the note label cell diverges (no chevron, leaf);
folding either needs real conditionals (`expandable?` / select-vs-toggle) that obscure more
than they save. (The spec allows folding none; "RowActionsMenu only" is compliant. Folding
the two verbatim twins is recommended because they are exact twins and cheap.)

`RowActionsMenu` and `RowLabelCell` are **module-local** components in `StructureTree.js`
(above the `StructureTree` export, like the existing `TreeExpander`). They are used only by
`StructureTree`, close over nothing global (all deps via props; icons already imported at
file top), and the net extraction removes ~140 lines. This is test-neutral:
`StructureTree.test.js` imports only `{ StructureTree }`, mounts the whole tree, and queries
rendered DOM — it never mounts an internal cell.

**O2 consumer.** `StructureTree` iterates the new `HANDS` export instead of its local
`["rightHand","leftHand"]` array and its restated hand-label literals.

**R18 — comments + provenance (within this file, written LAST).** Rewrite the
`StructureTree` docblock's false "Left/Right works for free" keyboard claims to describe the
real `onExpandRow`/`onCollapseRow` path from R1. Strip pipeline-provenance tags (e.g.
`KD 14`, `T6`, `AC3`) from edited comments. The docblock is rewritten **last** because it
documents the post-R1 code; writing it before R1 lands would describe nonexistent code.

**Within-file ordering: R1 → R7 → O2 → R18** (docblock last).

**Tests.** Always-run jsdom guard (A1): assert `StructureTree` passes non-no-op
`onExpandRow`/`onCollapseRow` and that each expandable row carries `data-expansion-key`;
plus the pure `expansionKeyOf` mapping test in `selection.test.js`. e2e (A1): focus a
section, measure, and hand row, press ArrowRight to expand and ArrowLeft to collapse, assert
child rows appear/disappear — driving the **real** keyboard path, not clicking the chevron.
A7 (R7) confirms through the whole-tree mount: each row renders Duplicate / Add-before /
Add-after / Remove with correct bound coordinates; the toggle renders (proving children
stayed a render function) and carries its `aria-label`; the label cell is select-only.

### 4. `src/edit.js` — mutator adoption, reveal extraction, single parse, control props (R6, R10, R11, R20, R4)

**R6 — adopt the helpers; replace eight inline two-level rebuilds.** `edit.js` imports
**exactly** `{ setSectionAt, updateHandEvents }` from `songModel.js` (in addition to its
existing `insertAt`/`removeAt`/`duplicateAt`/`newX` imports). **Do not** add `setMeasureAt`
or `setEventAt` to `edit.js`'s imports: there is no `edit.js` caller for either
(`setMeasureAt` is reached only transitively inside `updateHandEvents`, which lives in
`songModel.js`; `setEventAt` stays panel-only — the in-place note replace happens in
`NotePanel`). The spec's prose "import and use setSectionAt/setMeasureAt/setEventAt"
describes the helper **family** `edit.js` stops re-implementing; it is not a literal import
list. Adding the two unused names would create dead imports that lint/R18 flags.

Per-site mapping — four measure-array sites use `setSectionAt` (each replaces the whole
section's `measures` array, so the fit is "replace the section", not "replace one
measure"); four hand-array sites use `updateHandEvents`:

| `edit.js` site | Level | After |
|---|---|---|
| onAddMeasure | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: insertAt(section.measures, section.measures.length, newMeasure()) })` |
| onRemoveMeasure | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: removeAt(section.measures, measureIndex) })` |
| onDuplicateMeasure | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: duplicateAt(section.measures, measureIndex) })` |
| insertMeasureAt | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: insertAt(section.measures, target, newMeasure()) })` |
| onAddNote | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => insertAt(events, insertIndex, newNote()))` |
| onRemoveNote | hand-array (shrink) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => removeAt(events, eventIndex))` — helper owns the key-drop |
| onDuplicateNote | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => duplicateAt(events, eventIndex))` |
| insertNoteAt | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => insertAt(events, target, newNote()))` |

- The `commit({ ...working, sections: ... })` wrapper is replaced by the helper's return
  (the helpers spread `...song` and return the full new song):
  `commit(setSectionAt(working, …))` / `commit(updateHandEvents(working, …))`.
- The existing `const section = working.sections[sectionIndex]` guard lines stay (they drive
  the existence guard and read `section.measures`); what disappears is the `nextMeasures` +
  `sections.map(...)` pair and, for `onRemoveNote`, the whole `let nextMeasure / if-else /
  sections.map` block → one `updateHandEvents(...)` call.
- **Separation:** the helper is song-shape-only. `onAddNote`'s `insertIndex` (computed from
  the resolved selection — selection awareness, not song shape) stays in `edit.js` and is
  passed inside `fn`; the helper never sees the selection. The post-commit `setSelection(...)`
  + reveal also stay in `edit.js`.

**R20 consumer.** The three identical three-key reveal trios become
`revealAncestors(...ancestorKeys({ sectionIndex, measureIndex, hand }))`. The single-key
reveal sites stay calling `expansionKey` directly (see §1).

**R10 consumer.** The `onAddNote` `setSelection` gains `kind: "event"` (the compat block is
deleted in `selection.js`, §1).

**R11 — parse once.** The `accessibleName` memo must not re-parse `song`; reuse the
already-parsed `working` memo:
`song.trim() === "" ? "" : accessibleNameFor(working?.metadata)`. Reduce `isInvalid`
accordingly: `song.trim() !== "" && errors.length > 0`. `validateSong` already treats
unparseable JSON as a conformance error, so no behavior is lost for empty / valid / invalid
JSON.

**R9 consumer (import-path only).** `edit.js`'s `accessibleName` import repoints from the
deleted `./editor/accessibleName.js` to `./song/accessibleName.js` (§7). Independent of the
R11 memo-body change, though both touch the same `edit.js` area.

**R4 — control props.** Add `__next40pxDefaultSize` to the `edit.js` controls (the raw-JSON
`TextareaControl` and any Button-family control), add `__nextHasNoMarginBottom` to the
`edit.js` `TextareaControl` that lacks it, and (project-wide, §6) remove
`__nextHasNoMarginBottom` from every `NumberControl`.

**R17 consumer.** Delete the now-unused `__song-input` class hook in `edit.js` (no CSS or
test targets it; the CSS hook is removed in `editor.scss`, §5).

**Tests.** The existing `Edit.test.js` empty-hand assertion (removing the last event in a
hand yields that hand key **`undefined`**, never `[]`) stays green **unchanged** — it is the
integration pin for `updateHandEvents`'s wiring. The "keeps the hand when another event
remains" case pins the non-empty branch. Behavior for empty / valid / invalid JSON (R11) is
unchanged.

### 5. CSS split + selection color/trim (R3, R17)

The editor-only rules must be enqueued **only** in the editor. Today `block.json` wires only
`"style"` and `index.js` imports a single `style.scss`, so editor-only rules ship to site
visitors.

**`src/editor.scss` (new)** holds the editor-only rules: everything currently nested under
`.wp-block-piano-block-piano` from `&__workspace` onward — `&__workspace`, `&__tree` and its
`[role="gridcell"]` flex, the `@for` aria-level indent loop, `-expander`, `-label`,
`&__canvas`, `&__canvas-svg` and `.is-selected` — **re-parented under their own
`.wp-block-piano-block-piano { … }` block** in the new file, reusing the same `&__` nesting
verbatim. The move is self-contained: `style.scss` has zero `@use`/`@import`/`@mixin`/
`@include` and is the only `.scss` in `src/`.

**The `@for $i` aria-level loop moves verbatim (Guardrail C).** `$i` is declared and consumed
entirely inside the `&__tree` block, references no top-level variable, and moves byte-identical
into `editor.scss`'s `&__tree`, compiling identically. (The only other `$` tokens in the file
are `$gray-300` *inside CSS comments* — prose, not SCSS vars.) The moved block's doc-comment
header moves into `editor.scss` and is rewritten there per R17/R18 (drop the stale
`__song-input` sentence and stale comments).

**`src/style.scss` retains** the front-end / shared rules only: the `@font-face` "PB Music"
declaration (its docblock stays) and the pre-existing wrapper rules (`border`, `padding`,
`color`) on `.wp-block-piano-block-piano`.

**`src/index.js`** adds `import "./editor.scss"` beside the existing `import "./style.scss"`.
**Order is irrelevant:** wp-scripts emits them to **separate** files — `style.scss` →
`build/style-index.css` (via the `style.`-prefix rule), `editor.scss` → `build/index.css`
(any other imported CSS) — enqueued by separate `block.json` keys at different times, with no
overlapping selectors.

**`src/block.json`** keeps `"style": "file:./style-index.css"` and **adds**
`"editorStyle": "file:./index.css"`. RTL is auto-handled: wp-scripts emits
`style-index-rtl.css` + `index-rtl.css` and WordPress auto-enqueues the `-rtl` variant off
the same keys — no explicit `-rtl` `block.json` entry. The result works inside the iframed
editor canvas (apiVersion 3) exactly as today.

**R17 edits, applied to the moved rules in their new `editor.scss` home:**
- Replace the three `#007cba` occurrences with `var(--wp-admin-theme-color, #007cba)` so the
  selection highlight follows the admin color scheme. `.is-selected` stays **recolor-only**
  (fill/stroke color value only — no layout, size, or transform change) so the front-end SVG
  stays byte-identical (Guardrail C).
- Trim `__canvas` to its load-bearing `flex: 1 1 auto; min-width: 0` (its `flex-direction`/
  `gap` are no-ops because `SongCanvas` renders a single child).
- Delete the unused `__song-input` class hook and the stale comments.

**Tests.** No test pins the single-stylesheet build output — the unit suite mocks
`@wordpress/*` and imports no CSS; the e2e asserts rendered DOM, not which CSS files exist —
so adding `editor.scss`/`index.css` breaks no test. `npm run build` is the A3 verification
that `build/index.css` (+ `-rtl`) now emits. The `render.spec.js` front-end assertions stay
green (the moved classes never appear on the front end).

### 6. Control props pass (R4) — project-wide

Add `__next40pxDefaultSize` to **every** interactive control across the editor UI — every
`Button`, `SelectControl`, `TextControl`, `NumberControl`, `TextareaControl`, and
Button-family control in the inspector panels, the context/hand/pitch/metadata/annotation
editors, the list controls, the invalid-state view, and `edit.js`. **Remove**
`__nextHasNoMarginBottom` from every `NumberControl` (it has no such prop and forwards unknown
props to the underlying `<input>`, producing React unknown-prop dev warnings). Add
`__nextHasNoMarginBottom` to the one `edit.js` `TextareaControl` that lacks it. This is a
purely prop-presence pass with no design ambiguity. Acceptance: no `__next40pxDefaultSize`
deprecation warning and no `NumberControl` unknown-prop warning remain.

### 7. Shared helper extraction (R9) — front-end byte-identity

Remove the verbatim editor/front-end duplication by moving shared code **down** into the
already-shared trees (not by importing `view.js`).

**`src/song/accessibleName.js` (new).** Move `accessibleNameFor` (and its private
`trimmedString` helper) here, byte-identical, with the same `@wordpress/i18n` imports; only
`accessibleNameFor` is exported. **DELETE** `src/editor/accessibleName.js` (no shim).
`edit.js` is the only importer of the old file; it repoints to `./song/accessibleName.js`
(§4). `view.js` currently **defines** `accessibleNameFor` + `trimmedString` locally; it
switches to `import { accessibleNameFor } from "./song/accessibleName.js"` and deletes both
local bodies. This module imports only `@wordpress/i18n` (already a `view.js` dep, no React).

**`src/notation/dom.js` (new).** Move `availableWidthInSp` and `drawWhenFontReady` here.
This module must be **React-free** — it must **not** import `@wordpress/element` — so it does
not pull React into the front-end bundle. The `NARROW_CONTAINER_PX` (480) / `NARROW_SP_PX`
(7) consts (declared identically in both `view.js` and `SongCanvas.js`, used only by
`availableWidthInSp`) move with the function as module-private consts; both callers delete
their local declarations. `dom.js` imports `SP_PX` from `./constants.js` and
`MUSIC_FONT_FAMILY` from `./glyphs.js`. The canonical `availableWidthInSp` uses the
defensive optional-chaining form `container?.clientWidth ?? 0` (the superset from
`SongCanvas`; safe for `view.js`, which always passes a real element — never changes
front-end behavior).

- **No cycle:** `glyphs.js` and `constants.js` each have zero imports, so `dom.js → {constants,
  glyphs}` is a leaf-ward edge; nothing in `notation/` imports back through `dom.js`, and
  nothing in `notation/`/`song/` imports from `editor/` or `view.js`.
- **No test repoint:** both functions are currently module-private (un-exported), so no test
  imports them; behavior is pinned end-to-end by `SongCanvas.test.js` and `render.spec.js`.
  A direct `dom.js` unit (narrow-step threshold, 0-width floor) is an optional nice-to-have,
  not required.

**`ResizeObserver` is NOT unified (deliberate).** The per-surface wiring stays per-surface:
`SongCanvas`'s callback drives React state (`useEffect` / `setMeasuredWidth`) and returns an
unmount cleanup; `view.js`'s callback draws imperatively and lives for the document's
lifetime. Sharing it would drag `@wordpress/element` into the front-end bundle (forbidden) or
strip React from the editor lifecycle. A9 explicitly asserts `dom.js` does not import
`@wordpress/element` and the `ResizeObserver` is not unified.

**Front-end byte-identity guarantee.** After R9, `view.js`'s import graph gains two
React-free modules and loses three local function bodies — **zero** new
React/`@wordpress/element`/`@wordpress/components` enters the front-end bundle. The front-end
SVG stays byte-identical, pinned by `render.spec.js`'s accessible-name and structure
assertions and the `[data-hit]`-count-0 guard.

### 8. Dead `interactive` hit-rect removal (R8)

The `interactive` flag is an **options-object key**:
`renderSvg(model, { accessibleName = "", interactive = false } = {})`; `renderInto` forwards
the options object. Both production callers (`SongCanvas`, `view.js`) already pass an options
object **without** `interactive`, so dropping the key shifts no argument.

The internal threading carries `interactive` as the **last positional param** of each of the
five render functions (`renderSystem`/`renderMeasure`/`renderHand`/`renderNote`/`renderRest`);
remove that trailing param and its call-site arg from all five together (mechanical). Delete:
- `hitRect` (the helper),
- the two guarded `if (interactive)` branches (in the note and rest render functions),
- `HIT_RECT_WIDTH_SP` and `HIT_RECT_VERTICAL_MARGIN_SP` (the import and its `constants.js`
  definition),
- the `interactive` option-key path through `renderSvg`/`renderInto`.

**`data-hit` lives ONLY inside `hitRect`.** After deletion the string does not exist in
production, so the surviving "flagless render emits no `data-hit`" guard is real, not a
tautology. Because the flag is purely additive and dead, non-interactive output is unaffected.

**Tests.** Delete the "when interactive" feature `describe` in `svg.test.js` (the ~15 feature
lines). **Keep** the flagless no-hit assertions — they already call `renderSvg(model)` with no
options, so they need **no** re-point (they become unconditionally true). The non-interactive
structural blocks in `svg.test.js` stay green unchanged. The front-end pin in `render.spec.js`
(`[data-hit]` count 0) stays. No golden snapshot exists; attribute/structure + the unique
`data-hit` count is a sufficient pin for a purely-additive dead-code deletion.

**README (R8 tail).** Drop the file-layout `interactive` hit-rect clause, delete the
"now-dormant `interactive` hit-rect" section entirely, and drop the interactive-hit-rect test
clause; keep the "byte-identical front end" point (now unconditional).

### 9. Element icons + string-icon guard, realIcons lighten (R16, O1) — atomic pair

**Root cause the regular suite is blind today.** The default `Button`/`Icon`/`DropdownMenu`
mocks **swallow** the `icon` prop (`Button` destructures `icon: _icon`; `DropdownMenu`
swallows it; `Icon` renders a `<span data-icon>` with no icon content). So a string `icon` and
an element `icon` produce byte-identical DOM — `"plus"` vs `{plus}` are indistinguishable. The
realIcons test closes the gap **only for `StructureTree`** by locally re-mocking those three to
render `icon` through an element-rendering `Icon`.

**R16 production changes:**
- **Trash buttons** (in `PitchList`, `AnnotationList`, `HandConfigEditor`): `icon="trash"` →
  `icon={trash}` element + **add `isDestructive`**, and **keep the `label`** (it is the
  `aria-label` the remove-button tests query). Each file adds
  `import { trash } from "@wordpress/icons"`. No test breaks.
- **`AddButton`** (in `ListControls.js`): today `<Button variant="secondary" icon="plus"
  label={label}>{label}</Button>`. Drop the **redundant inner `<Button label>`** (a real
  button's visible text **is** its accessible name) while keeping the `{label}` **text child**
  and `AddButton`'s own `label` parameter:
  `<Button variant="secondary" icon={plus} onClick={onClick}>{label}</Button>`. Adds
  `import { plus } from "@wordpress/icons"`. `StructureTree`'s existing element icons stay.

  **NOT test-neutral — locator migration required.** The jsdom `Button` mock derives
  `aria-label` only from the `label`/`aria-label` prop, not from text children. Once the inner
  `label` is dropped, `buttonByName(container, "Add pitch")` (which matches `aria-label`)
  returns nothing. **Resolution: migrate the ~5 add-button test locators from aria-label to
  TEXT** (a `buttonByText` matching `button.textContent === "Add pitch"`, since the visible
  text child remains). Same treatment for the `HandConfigEditor` add-alteration button if any
  test locates it by aria-label. **Flag clearly:** "drop the redundant label" = drop the inner
  `<Button label>`, **not** `AddButton`'s `label` parameter; preserve `AddButton`'s accessible
  naming so the test locators (migrated to text) still resolve.

**O1 — the string-icon guard mechanism (element-sentinel + element-rendering default mocks):**
- `test/mocks/wordpress-icons.js` exports each icon as a small inert React **element** built
  with the runner's own `@wordpress/element` `createElement`, e.g.
  `const plus = createElement("svg", { "data-wp-icon": "plus" });`. Runner-built →
  `isValidElement(sentinel)` is trivially true; no `$$typeof` mismatch, so no React-dedup
  needed.
- Change the **default** `Icon` mock from the icon-blind `<span data-icon>` to the
  element-rendering form `isValidElement(icon) ? cloneElement(icon) : null`, and make default
  `Button`/`DropdownMenu` render `icon ? <Icon icon={icon} /> : null`. Now `icon={plus}`
  (element) renders the marked node; a regressed `icon="plus"` (string) is not a valid element
  → renders nothing.
- **Assertion (project-wide, RED-on-regression):** one parametrized test that mounts **each**
  icon-bearing component and asserts its icon host carries the sentinel marker (e.g.
  `button.querySelector("svg")` truthy / has `[data-wp-icon]`). RED on a string (no node),
  GREEN on the element. Coverage **must** be project-wide — the four leaf editors the
  StructureTree-only realIcons test never mounted (`ListControls`/`AddButton` (plus),
  `PitchList`, `AnnotationList`, `HandConfigEditor` (trash)) **plus** `StructureTree`
  (moreVertical, plus, chevrons). This is the realIcons render mechanism promoted into the
  always-run suite, minus the un-map + React-dedup machinery — cheapest and truest (it proves
  the icon **renders**, the actual failure mode, not just that the prop is non-string).

**O1 — LIGHTEN.** The project-wide sentinel guard is strictly stronger for R16's targets
(covers the four leaf editors) and far cheaper, so the realIcons infrastructure is deleted:
- `src/editor/__tests__/StructureTree.realIcons.test.js` (264 lines);
- the two-project structure in `jest.config.js` — collapse `projects: [unit, real-icons]` to a
  single flat config; remove the `real-icons` project, the `REAL_ICONS_TEST` const, the
  `testPathIgnorePatterns` exclusion, and the `testMatch` that selected it;
- the React-dedup `moduleNameMapper` (it existed solely so a real `@wordpress/icons` element —
  nested React 18 — was valid under the runner's React 19; with the realIcons test gone and the
  sentinel runner-built, it is unnecessary; only `@wordpress/icons` ships real elements and it
  is mocked).
Keep the `iconsMock` mapping (now pointing at the non-string-sentinel mock); the
components/i18n/block-editor mocks and structured-clone setup are unchanged. Net deletion
~360 lines.

**Ripple (flag to writer).** Rendering `icon` adds a child node to every iconful button across
the **whole** suite — verify no test asserts exact `children`/`textContent` equality on an
iconful button (the marker `<svg>` has no text, so `.textContent` is usually unaffected) and
**run the full suite** after the mock change. **Fallback** if the default-mock icon-render
change can't be made cleanly: keep realIcons **and** add a separate project-wide assertion
(strictly more code; lighten is preferred). Either form is acceptable provided the
RED-on-regression guarantee holds and the icons-mock change does not let a string-icon
regression silently pass.

**R16 + O1 land atomically** (see §11): the icons-mock change, the element-rendering default
mocks, the production element-icon swaps, the new project-wide guard, the realIcons/two-project
deletion, and the AddButton label-drop + locator migrations are one unit. Splitting them leaves
the guard wrong-colored mid-flight (a string-icon regression could pass).

### 10. Accessible name (R2) — atomic mock+production pair

`TreeGrid` has no `label` prop (its named props are
`onExpandRow`/`onCollapseRow`/`onFocusRow`/`applicationAriaLabel`; everything else spreads onto
the `<table role="treegrid">`), so the current `label` prop is a meaningless DOM attribute even
though its value is already a translated string.

**Production:** `StructureTree.js:569` changes `<TreeGrid label={…}>` →
`<TreeGrid aria-label={__("Song structure", "piano-block")}>` (alongside the R1 callbacks). The
dead `label` prop is dropped.

**Mock:** the `TreeGrid` mock today destructures `label` and renders `"aria-label": label`. R2
**removes the `label` destructure and the mapping**, leaving
`createElement("table", { role: "treegrid", ...rest })`. Because the mock already spreads
`...rest`, the production `aria-label="Song structure"` now lands as a real attribute through
`...rest` — matching the real component. The unit surface now matches the real prop surface.

**Tests.** No existing unit queries the tree by **name** (unit tests find it by
`[role="treegrid"]` only — precisely the blind spot the bug exploited), so nothing needs
re-query. **Add** an always-run unit asserting the rendered `<table>` carries
`aria-label="Song structure"` and **no** `label` attribute (the always-run pin backing the
e2e — a `label`-regression fails in jsdom too). e2e (A2): `getByRole("treegrid", { name:
"Song structure" })` resolves the tree (it does not resolve today). R2 lands atomically (mock
+ production + new unit) for the same "green ≠ broken" reason as R16/O1.

### 11. The remaining cleanups (R12, R13, R14, R19, O3, O5, R5, R18)

**R12 — omit helpers unified; `emit.js` re-homed.** `emit.js` moves from
`src/editor/inspector/emit.js` **up** to `src/editor/emit.js`, ending up exporting only
`omitEmpty` + `omitFalsy` (`emitBlock` is inlined away). This touches **five** production
importers (the spec's "the production importer" undersells it), the test, and
`MetadataEditor`:
- `ContextEditor.js` (in `src/editor/`): `./inspector/emit.js` → `./emit.js` (the
  cross-boundary import the spec calls out — now a sibling). Keeps `omitEmpty`; its local
  `emitMember` is inlined as `onChange(omitEmpty(...))`.
- `inspector/NotePanel.js`, `inspector/MeasurePanel.js`, `inspector/SectionPanel.js`:
  `./emit.js` → `../emit.js` (each imports `omitFalsy`).
- `inspector/SongPanel.js`: `./emit.js` → `../emit.js`; it imports `emitBlock` today — R12
  inlines `emitBlock` as `onChange(omitEmpty(...))`, so `emitBlock` is **deleted** from
  `emit.js` and `SongPanel` imports `omitEmpty` instead.
- `emit.test.js`: `../inspector/emit.js` → `../emit.js`, **and** drop the `emitBlock` import +
  its cases (inlined away) or the suite goes red on a missing export.
- `MetadataEditor.js` (in `src/editor/`): **adds** `import { omitFalsy } from "./emit.js"`,
  switches its two `onChange` sites from local `withField` to `omitFalsy`, deletes local
  `withField`.

The `withField` → `omitFalsy` swap means a whitespace-only Title now **drops** (omitFalsy
trims) — consistent with a whitespace-only Section name. No existing test asserts the old
persist behavior; **add** one new SongPanel/Metadata test asserting a whitespace-only Title
(`"   "`) now drops the key (pins A12's unified behavior).

**R13 — annotations wrappers collapsed.** The duplicated annotations drop-key wrappers in
`NotePanel` and `MeasurePanel` collapse to one-liners via the existing omit helpers, and the
two surfaces adopt a single consistent `onDeselect` idiom (replacing the current
`changeOptional`-vs-inline-destructure split). R13 lands **after** R12 (it uses the omit
helpers in their new home).

**R14 — `HandConfigEditor` array helpers.** Replace its local `replaceRow`, the inline
`filter((_, i) => i !== index)`, and the spread-append with the shared
`replaceAt`/`removeAt`/`insertAt` from `songModel.js` (it already imports from `songModel.js`;
add three names). Row add/remove/replace behavior is unchanged.

**R19 — heading removed.** Remove the `heading` prop and the two raw `<h3>` elements in
`ContextEditor`. The only caller passing `heading` (`SectionPanel`) duplicates the wrapping
`ToolsPanelItem`'s "Section overrides" label, so the duplication is removed.

**O3 — sprintf labels.** Replace the raw `` `${label} ${field}` `` concatenation in
`HandConfigEditor` (lowercase fragments, not reorderable for translators) with sprintf
templates, matching the rest of the PR. If any test/e2e locator relies on the composed
aria-label, update it to the new composed string (the same locator-migration caveat as R16's
AddButton).

**O5 — spacing polish.** Use `Flex`/`HStack` for the bare-`div` rows (`PitchList`,
`AnnotationList`, `HandConfigEditor`) and the adjacent button pairs (`NotePanel`,
`SectionPanel`, `SongPanel`, `InvalidState`). Pure cosmetic; no behavior or test risk. Safe to
defer if scope tightens, but in scope for this review.

**R5 — README dependency claim.** Reword the "no new runtime dependency" statement and the
"ajv would be the first runtime dependency" framing to acknowledge `@wordpress/icons` as a
bundled `@wordpress/*` runtime dependency, while keeping the validator's zero-dependency /
schema-as-data narrative intact. The dependency itself is correct and stays; only the docs
change.

**R18 — comments + provenance (project-wide).** Fix the stale comments that name code that no
longer exists (the `EventRow`, `MeasureEditor`/`BarlineControl`, `SectionEditor`, `repairPath`,
and `SongPreview` references — plus the `StructureTree` docblock's false keyboard claims,
corrected to the real `onExpandRow`/`onCollapseRow` path under R1, §3). Strip pipeline-provenance
tags (e.g. `KD 14`, `T6`, `AC3`) from comments while editing. No shipped comment references
nonexistent code or pipeline internals.

---

## Change ordering and dependencies

Helpers land first as the contract everything consumes; the two mock+production pairs are
atomic to keep "green" incompatible with "broken"; the rest are independent islands.

- **Phase A — pure helpers (no UI).** `selection.js` (R20 `ancestorKeys`/`eventKey`/
  `expansionKeyOf` + R10 stamp-`kind`/delete-compat) and `songModel.js` (R6 `updateHandEvents`
  + O4 export cleanup + O2 `HANDS`/derived `STAVES` + R15 `NONE_OPTION`), each as one per-file
  pass so its test updates happen once. **R20 MUST precede R1** (R1 consumes `expansionKeyOf`).
- **Phase B — consumers of Phase A.** R1 (StructureTree keyboard, needs `expansionKeyOf`), R6
  `edit.js` adoption (set*At + `updateHandEvents` + `ancestorKeys` reveals + R10 kind stamp),
  R14, R15 consumers, O2 consumers.
- **Phase C — atomic mock+production pairs.** **R16 + O1 land together** (icons-mock non-string
  sentinel + element-rendering default mocks + production element-icon swaps + new project-wide
  guard + delete realIcons/two-project config + AddButton label-drop and the ~5 locator
  migrations). **R2 lands together** (TreeGrid mock de-translation + StructureTree `aria-label`
  + new unit).
- **Phase D — independent islands (parallelizable).** R3+R17 (one `editor.scss` move, then
  admin-color/trim/drop-`__song-input`/comment fixes in the moved file + `block.json`/`index.js`
  wiring); R8 (`notation/` + `svg.test.js` + README tail); R9 then R11 (R9 = import-path move,
  R11 = memo body — same `edit.js` area); R12 then R13 (R13 needs R12's omit helpers in their
  new home); R7 (RowActionsMenu/RowLabelCell); R5, R18, R19, O3, O5 (cosmetic/isolated). R4
  (control-props pass) is a project-wide island.
- **Within `StructureTree.js` (R1, R7, O2, R18):** sequence **R1 → R7 → O2 → R18**, with the
  R18 docblock **rewritten last** (it documents the post-R1 real `onExpandRow`/`onCollapseRow`
  path; writing it before R1 lands would describe nonexistent code).

**Ordering hazard (test masking).** R16/O1's mock change makes the default Button/Icon mocks
**render** the icon (adds a child node); if the production icon swap and the mock swap were
split, a string-icon regression could pass. Keep R16+O1 atomic. The `DropdownMenu`
null-on-non-render-fn guard that R7 relies on is **unchanged** by R16/O1 (only icon rendering is
added), so R7 and R16 do not interfere given R16+O1 are atomic. No other item's test changes
mask another item's regression — they touch otherwise-orthogonal files and assertions.

---

## Test strategy: "tests green" ≠ "real component broken" (R1, R2, R16)

The three findings whose fix depends on a real `@wordpress/components`/`@wordpress/icons`
contract each get a **real-contract e2e** plus an **always-run jsdom guardrail** that fails RED
on the exact regression the old mock masked:

- **R1 (keyboard expand/collapse).** e2e drives real ArrowRight/ArrowLeft against the real
  TreeGrid (not chevron clicks). Always-run jsdom pins: (a) `expansionKeyOf(syntheticTr)`
  returns the right key (mount-free); (b) `StructureTree` passes non-no-op
  `onExpandRow`/`onCollapseRow` and each expandable row carries `data-expansion-key`. (a)+(b)
  make a no-callback **or** wrong-key regression fail in the always-run suite even though the
  mock cannot drive real arrows. The keyboard path uses the **same** `onToggleExpanded`, the
  **same** single `expanded` `Set`, and the **same** `expansionKey()` strings as the pointer
  path; leaf rows trigger no expansion.

- **R2 (accessible name).** e2e: `getByRole("treegrid", { name: "Song structure" })` resolves.
  Always-run jsdom: the rendered `<table>` carries `aria-label="Song structure"` and no `label`
  attribute. The mock no longer maps `label` → `aria-label`, so a regression that re-introduces
  the dead `label` prop fails in jsdom too.

- **R16 (element icons).** The de-helpfulized mocks (non-string element sentinels +
  element-rendering default `Icon`/`Button`/`DropdownMenu`) make a string `icon` render
  **nothing**. The project-wide parametrized assertion mounts every icon-bearing component and
  asserts its icon host has the marked node — RED on a reintroduced string `icon`, GREEN once
  all icons are element imports. This is RED-on-regression across all icon-bearing components
  (the four leaf editors the old realIcons test never mounted, plus `StructureTree`).

For the rest of the items, the always-run suite carries the behavioral pins: `Edit.test.js`'s
unchanged empty-hand assertion (R6 integration), the `songModel.test.js` `updateHandEvents`
unit (R6 rule), the `ancestorKeys`/`eventKey`/`expansionKey` byte-identity units (R20/Guardrail
A), the `svg.test.js` flagless no-hit assertions + `render.spec.js` `[data-hit]`-count-0 guard
(R8), the `render.spec.js` accessible-name/structure assertions + `SongCanvas.test.js` (R9
front-end parity), and one new SongPanel/Metadata whitespace-Title test (R12 unified behavior).

**Global parity gate.** Across all of the above, a published song renders byte-identically: the
song format/schema, `render.php`, and the front-end SVG (`view.js`, `src/notation/`) produce
identical output, pinned by `render.spec.js` and the non-interactive `svg.test.js` assertions.
The full unit and e2e suites pass, and no prior-review win regresses (Guardrails A–D).

---

## Trade-offs / alternatives considered

- **R1 — two guarded handlers vs. one toggle handler.** Considered separate
  add-only `onExpandRow` / delete-only `onCollapseRow` handlers. **Rejected:** the component
  contract already gates expand-on-collapsed and collapse-on-expanded, so a single
  `onToggleExpanded` (add-if-absent/delete-if-present) is correct and idempotent for both, and
  the safety is guaranteed by the contract rather than by duplicated guard code. The shared
  handler is simpler; worst case under a contract violation is one wrong toggle, never
  corruption.

- **R1 — `data-expansionKey` (camelCase) vs. `data-expansion-key` (kebab).** **Chose kebab.**
  React/JSX does not auto-kebab `data-*` props, so the camelCase form would silently emit
  `data-expansionkey` and the `getAttribute("data-expansion-key")` read would always miss — a
  latent trap. Kebab also matches core List View's `data-block` idiom.

- **R7 — Shape A (cell at call site) vs. Shape B (component renders its own cell).** **Chose
  Shape A.** The roving-tabindex render-prop arg only exists inside `TreeGridCell`'s callback,
  so the cell must stay at the call site for `RowActionsMenu` to receive it; Shape B buries the
  cell and needlessly couples the component to being the row's second cell.

- **R7 — how much label-cell folding.** **Chose to fold only the section+measure twins** into
  `RowLabelCell` (byte-identical, no conditionals) and leave hand (toggle-label, non-selectable)
  and note (chevron-less leaf) cells explicit. Folding the divergent cells would require
  `expandable?`/select-vs-toggle conditionals that obscure more than they save. (The spec allows
  folding none.)

- **R6 — where `updateHandEvents` lives, and `edit.js`'s import list.** **Chose `songModel.js`,
  composing on `setMeasureAt`,** so the empty-hand rule is the only new logic and the splice
  plumbing is the existing faces. `edit.js` imports only `{ setSectionAt, updateHandEvents }`;
  adding `setMeasureAt`/`setEventAt` "to satisfy the spec literally" would create dead imports
  that lint/R18 flags — the spec's prose names the helper family, not a literal import list.
  The four measure-array sites use `setSectionAt` (they replace the whole section's measures),
  not `setMeasureAt` (which replaces one measure).

- **R9 — extract-down vs. import `view.js`; unify the `ResizeObserver` or not.** **Chose to
  extract shared code down into `src/song/` and `src/notation/`** (React-free) rather than have
  the editor import `view.js`, eliminating the silent-drift risk without crossing layers. The
  `ResizeObserver` is deliberately **not** unified: the two consumers' lifecycles genuinely
  differ (React state + cleanup vs. forever-lived imperative draw), and unifying would either
  drag `@wordpress/element` into the front-end bundle or strip React from the editor lifecycle.

- **R16/O1 — prop-recording guard vs. tree-walk vs. render-the-icon sentinel.** **Chose the
  render-the-icon element-sentinel guard.** A `typeof !== "string"` prop-recording guard needs
  new mock instrumentation and tests the prop, not the render; a tree-walk cannot see a swallowed
  prop. The sentinel approach proves the icon actually **renders** (the real failure mode) and is
  the cheapest; it also lets the heavy two-project/realIcons infrastructure be deleted while the
  guarantee gets **stronger** (now project-wide).

- **O2 — touch `notation/layout.js`'s `HANDS` or not.** **Chose to leave it untouched.** It is
  in the front-end/notation-core layer; importing `songModel.HANDS` there would cross the layered
  boundary and risk front-end byte-identity. The two `HANDS` arrays stay intentionally separate.

- **O4 — `BPM_MIN_EXCLUSIVE` as the control `min`.** **Chose to delete it and keep `min={1}`.**
  It is an exclusive bound (`0`) that does not map to `NumberControl`'s inclusive `min`; wiring
  `min={BPM_MIN_EXCLUSIVE}` would allow `0`. The existing `min={1}` plus the bounded-int clamp
  already enforce the bound.

- **R8 — golden snapshot vs. attribute/structure + `data-hit` count.** **Chose the existing
  attribute/structure assertions plus the unique `data-hit`-count-0 guard.** No golden snapshot
  exists, and because `data-hit` ceases to exist in production after the deletion, the surviving
  count-0 guard is a real pin (not a tautology) for a purely-additive dead-code removal.
