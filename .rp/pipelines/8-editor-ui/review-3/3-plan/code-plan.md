# Code Plan — Review 3: Left-sidebar structure tree as the selection surface

This plan executes the approved design doc (`../2-design-doc/design-doc.md`) against the
authoritative spec (`../1-spec/spec.md`). Each task is one code-writer's unit of work,
ordered so every task builds cleanly on the prior tree state and is independently
committable with its own passing unit/e2e tests. There is a single shared working tree;
tasks run sequentially.

## Conventions every task follows

- **Repo tooling.** Lint is **biome** (`npm run lint`). Unit tests run with **`npm run
  test:unit`** (NOT `npm test`, NOT `wp-scripts lint-js`). E2e is `npm run test:e2e`
  (needs `npm run build` + `npm run env:start`; runners may not have Docker — write the
  e2e changes so they are correct-by-reading even if not executed here, and never let an
  unrun e2e block a unit-green commit).
- **Baseline.** Confirmed green at plan time: **602 unit tests / 20 suites**. Every task
  ends with `npm run test:unit` green and `npm run lint` clean. The net suite count moves
  as tasks add/remove tests; each task states its expected delta.
- **Indentation.** Source files use **tabs** (see `src/edit.js`, `src/editor/*.js`).
  `selection.js` happens to use a spaced style internally — match each file's existing
  style, do not reformat unrelated lines. Biome enforces this; run it.
- **Import style.** Editor modules import only from `@wordpress/*` (externals) and local
  `./…` paths. No new runtime dependency may be added (AC13). `structuredClone` is a
  standard global, not an import.
- **Commit format.** Imperative, sentence case, no trailing period, agent name in
  parentheses — e.g. `Add duplicateAt helper and note-label helper (code-writer)`. Commit
  only the files your task touches.
- **Conformant-by-construction.** Every structural/rename/settings edit must route through
  the existing `commit` → `commitSong` re-validation guard in `edit.js`. Do not bypass it.

## Reconciliation note carried into the relevant tasks (READ THIS)

The team-lead's brief says the `interactive` hit-rect revert "obsoletes review-2's
hit-rect/byte-identity unit tests in `src/notation/__tests__/svg.test.js`." The approved
design (Key Decision 6) chooses the **minimal revert**: stop passing `interactive: true`
at the `SongCanvas.js` `renderInto` call site; the `interactive` flag *stays* in `svg.js`
defaulting to `false`, so **`svg.js` is byte-stable**. Under the minimal revert:

- The `renderSvg — editor-only per-event hit-rect (interactive flag)` describe block in
  `svg.test.js` (lines ~986–1050) tests `svg.js`'s API in isolation (`renderSvg(model, {
  interactive: true|false })`). Because `svg.js` is unchanged, **those tests still pass and
  are NOT removed** — keeping them green is the right outcome and satisfies "keep the suite
  green." They now document a dormant-but-present capability; that is acceptable and is the
  design's explicit trade ("leaves dead-but-defaulted `interactive`/`hitRect` code").
- The genuinely obsoleted tests are the **SongCanvas** test that clicks the per-event
  hit-rect and the **SongCanvas/Edit** click-to-select tests — because click-to-select and
  the editor's use of the hit-rect are both removed. Those are handled in Tasks T2 and T7.
- The front-end byte-identity e2e assertion in `specs/render.spec.js` (`[data-hit]` count
  0) already passes because `view.js` never set `interactive`; it stays as-is.

This is the design-authoritative reading; the team-lead's "update/remove svg.test.js" is
satisfied by confirming (and documenting in the commit message) that the minimal revert
leaves those svg-layer tests valid and green — no edit to that describe block is required.
If a future reviewer insists on the *full* revert (deleting `hitRect`/`HIT_RECT_*`/the
`interactive` threading), that is the optional cleanup in Decision 6 and would then require
deleting that describe block — out of scope for this plan, which takes the minimal revert.

---

## T1 — Schema: additive optional `name` on section + measure

**Goal.** Declare the additive, optional, permissive `name: { type: "string" }` on the
section and measure schema defs so it is documented and type-checked, while staying
non-blocking (an absent/blank `name` is valid; a non-string `name` is a type error, never a
save-blocker because raw-JSON mode stores any string regardless).

**Files.**
- `src/song/schema.js` (edit).
- `src/song/__tests__/schema.test.js` (edit — add coverage).

**Changes.**
- In `src/song/schema.js`, add `name: { type: "string" }` to `$defs.section.properties`
  and `$defs.measure.properties`. Leave `required` arrays unchanged (so `name` stays
  optional). Mirror the existing inline-comment idiom used for `language` (one short
  comment noting it is the optional editor-side label, permissive, never required).
- In `schema.test.js`, add tests that mirror the existing `language`-enum test shape:
  (a) `$defs.section.properties.name` and `$defs.measure.properties.name` declare
  `type: "string"`; (b) neither `section.required` nor `measure.required` contains
  `"name"`. Optionally cross-check via `validateSong` (imported in the sibling
  `noteNames.test.js` pattern) that a section/measure carrying a string `name` validates
  and one carrying a non-string `name` produces a type error — only if `validate.test.js`
  conventions make this trivial; otherwise keep to the schema-shape assertions.

**Depends on.** None (first task).

**Traces to.** Req 11, 12; AC10, AC11. Design KD 10, 15.

**Acceptance.**
- `npm run test:unit` green (suite count +N for the new schema tests).
- `npm run lint` clean.
- `render.php`/`view.js`/`svg.js` untouched. No change to `required`. The walker already
  ignores unknown keys, so existing songs without `name` remain valid (no regression in
  `validate.test.js`).

---

## T2 — Note-label helper (`noteLabel`)

**Goal.** Add the pure tree-label helper that turns an event into its display label:
`"rest"` (i18n via `__`) for a rest, else its pitch step(s) mapped through
`stepInSystem(step, system)` and space-joined (pitch-name(s) only, **no octave**). This is
a leaf helper with no React, depended on by the tree (T6).

**Files.**
- `src/editor/noteNames.js` (edit — add and export `noteLabel`), **or** a small new
  `src/editor/noteLabel.js`. Prefer adding to `noteNames.js` (it already owns
  `stepInSystem` and imports `__`-adjacent helpers), to avoid a new file — match the
  design's "in `noteNames.js` or a small new `noteLabel.js`," choosing `noteNames.js`.
- `src/editor/__tests__/noteNames.test.js` (edit — add a `noteLabel` describe block),
  matching the existing `describe("stepInSystem", …)` style.

**Changes.**
- Implement `export function noteLabel(event, system)`:
  - `event?.type === "rest"` → `__("rest", "piano-block")`.
  - else map `event?.pitches ?? []` through `stepInSystem(pitch?.step, system)` and
    `.join(" ")`. A note with one pitch yields one name; a chord yields space-joined names.
  - Be defensive about a missing/odd event (return the `"rest"` string only for an explicit
    rest; for a malformed note with no pitches, an empty join is acceptable — the tree only
    ever feeds it conformant working-object events, but keep it throw-free).
- Add `import { __ } from "@wordpress/i18n";` to `noteNames.js` (it does not currently
  import it; `__` is the only `@wordpress/*` dependency this adds, satisfying AC13).
- Tests: a single English note → `"C"`; a single Spanish-spelled note in the `spanish`
  system → `"do"`; a chord `[C, E, G]` → `"C E G"`; a rest → `"rest"`; canonicalization
  (an English `C` rendered in the `spanish` system → `"do"`, proving it routes through
  `stepInSystem`). Reuse the mock `__` (identity) from `test/mocks/wordpress-i18n.js`.

**Depends on.** None code-wise (independent of T1); place after T1 for clean ordering.

**Traces to.** Req 10; AC8. Design KD 13.

**Acceptance.**
- `npm run test:unit` green (suite +N). `npm run lint` clean.
- No octave appears in any label (the C4/C5 ambiguity is deferred by design).

---

## T3 — `duplicateAt` array helper

**Goal.** Add the pure, immutable, dependency-free deep insert-after helper the duplicate
handlers (T5) build on: `duplicateAt(list, index)` returns a new array with a
`structuredClone` of `list[index]` inserted at `index + 1`.

**Files.**
- `src/editor/songModel.js` (edit — add and export `duplicateAt`, alongside
  `insertAt`/`removeAt`/`replaceAt`).
- `src/editor/__tests__/songModel.test.js` (edit — add a `duplicateAt` describe block,
  matching the existing array-helper test style).

**Changes.**
- Implement `export function duplicateAt(list, index)` as
  `insertAt(list, index + 1, structuredClone(list[index]))`, reusing the existing
  `insertAt`. Match the existing JSDoc density of `insertAt`/`removeAt`/`replaceAt`.
- Behavior to pin in tests: the copy is inserted immediately after the original (length
  +1, the new element at `index + 1` deep-equals the original); it is a **deep** copy
  (mutating a nested field of the copy does not touch the original — e.g. duplicate a
  section, push a measure into the copy, assert the original section's `measures` length is
  unchanged); the source array is never mutated; an out-of-range index — decide and pin one
  behavior consistent with `removeAt`/`replaceAt`'s out-of-range tolerance (those return a
  plain copy on out-of-range; for `duplicateAt`, `structuredClone(undefined)` is `undefined`
  and inserting it would corrupt the list — so guard: if `index < 0 || index >= list.length`
  return `list.slice()` unchanged, mirroring the tolerate-and-copy convention). Pin that
  guard with a test.

**Depends on.** None code-wise; order after T2.

**Traces to.** Req 7; AC6, AC11, AC13. Design KD 7.

**Acceptance.**
- `npm run test:unit` green (suite +N). `npm run lint` clean.
- No new import (`structuredClone` is a global).

---

## T4 — Rename `TextControl` in Section and Measure inspector panels

**Goal.** Add an editable, persisted `name` field to the Section and Measure inspector
panels via a `TextControl`, emitting through each panel's existing
`emitSection`/`emitMeasure` path and **dropping the `name` key when blank** (the
`emitBlock` drop-when-empty idiom). This is the chosen sole rename affordance (AC7).

**Files.**
- `src/editor/inspector/SectionPanel.js` (edit).
- `src/editor/inspector/MeasurePanel.js` (edit).
- `src/editor/__tests__/SectionPanel.test.js` (edit — add name-field coverage).
- `src/editor/__tests__/MeasurePanel.test.js` (edit — add name-field coverage).

**Changes.**
- `SectionPanel`: import `TextControl` from `@wordpress/components`. Add a `TextControl`
  labeled `__("Section name", "piano-block")` (pick a label distinct from the future
  tree-inline affordance and unambiguous in tests), `value={section.name ?? ""}`. On
  change: if the trimmed value is non-empty, `emitSection({ ...section, name: value })`;
  if blank, emit the section with the `name` key removed (`const { name: _dropped,
  ...rest } = section; emitSection(rest);`). Place it before/above the override ToolsPanel
  or wherever reads cleanly with the panel's existing structure — keep it simple and at the
  top of the panel body so it is the primary, obvious control.
- `MeasurePanel`: same pattern with `__("Measure name", "piano-block")`,
  `value={measure.name ?? ""}`, emitting via `emitMeasure` and dropping the key when blank.
  Note `MeasurePanel`'s body is currently entirely inside the `ToolsPanel`; add the name
  `TextControl` **outside** the ToolsPanel (it is a primary, always-visible field, not a
  progressive-disclosure override), e.g. directly under `<PanelBody>` before the
  `<ToolsPanel>`.
- Tests (mirror existing `*Panel.test.js` shape — render the panel with a resolved
  selection, drive the mocked `TextControl` input, assert the emitted next song): typing a
  name sets `section.name`/`measure.name`; clearing it drops the key (the emitted object has
  no `name`); the field shows the current `name` value. The components mock already provides
  a `TextControl` stand-in (renders `<input type="text">` with `aria-label` = label and
  `onChange(value)`), so no mock change is needed.

**Depends on.** T1 (schema declares `name`, so a name-carrying emission validates through
`commit`). Functionally the panel emits to its `onChange` (the parent's `commit`); the
schema must already accept `name` for the round-trip to be conformant.

**Traces to.** Req 9, 11, 14; AC7, AC9, AC11. Design KD 11.

**Acceptance.**
- `npm run test:unit` green (suite +N). `npm run lint` clean.
- Blank name never persists an empty-string husk (clean round-trip).
- No change to the override/barline/annotation behavior already tested.

---

## T5 — Lift `onRemoveNote` + add three `onDuplicate*` handlers in `edit.js`

**Goal.** Round out the structural mutators in `edit.js` (the single owner of `working` +
`commit`): lift note-level remove as `onRemoveNote(sectionIndex, measureIndex, hand,
eventIndex)` (mirroring `NotePanel.removeEvent`, dropping the hand key when the list
empties, clearing a now-stale selection), and add `onDuplicateSection(si)` /
`onDuplicateMeasure(si, mi)` / `onDuplicateNote(si, mi, hand, ei)` using `duplicateAt`
(index+1). Each duplicate may optionally select its inserted copy (mirroring `onAddNote`'s
auto-select); at minimum it must commit a conformant song. Wire `NotePanel`'s existing
Remove to call the lifted `onRemoveNote` so the logic lives in one place.

This task adds the handlers to `edit.js` but does **not** yet render the tree (that is T6)
— the handlers are exercised here via the existing surfaces (NotePanel remove) and unit
tests, then consumed by the tree in T6.

**Files.**
- `src/edit.js` (edit — add the four handlers; pass `onRemoveNote` to `NotePanel`).
- `src/editor/inspector/NotePanel.js` (edit — replace the local `removeEvent` splice with
  a call to the lifted `onRemoveNote`, keeping the `onRemove?.()` selection-clear signal
  OR folding the selection clear into the lifted handler — see Changes).
- `src/editor/__tests__/Edit.test.js` (edit — add handler coverage), and/or
  `src/editor/__tests__/NotePanel.test.js` if the remove wiring is asserted at the panel
  level.

**Changes.**
- In `edit.js`, add (mirroring the existing `onAddNote`/`onRemoveMeasure` immutable-splice
  style, all routing through `commit`):
  - `onRemoveNote(sectionIndex, measureIndex, hand, eventIndex)`: reproduce
    `NotePanel.removeEvent`'s splice — `removeAt(measure[hand], eventIndex)`; if the result
    is empty drop the `[hand]` key, else set it; rebuild measure→section→song via the
    existing `.map`/`replaceAt` idiom already used in the file; `commit(next)`; then clear
    the selection if it pointed at (or under) the removed note (mirror the
    `onRemoveMeasure` staleness guard: clear when `selection.sectionIndex/measureIndex/
    hand/eventIndex` match).
  - `onDuplicateSection(sectionIndex)`: `commit({ ...working, sections: duplicateAt(
    working.sections, sectionIndex) })`. Optionally select the copy at `sectionIndex + 1`
    (`setSelection({ kind: "section", sectionIndex: sectionIndex + 1 })`).
  - `onDuplicateMeasure(sectionIndex, measureIndex)`: rebuild the section with
    `duplicateAt(section.measures, measureIndex)`; commit. Optionally select the copy.
  - `onDuplicateNote(sectionIndex, measureIndex, hand, eventIndex)`: rebuild the hand with
    `duplicateAt(measure[hand], eventIndex)`; rebuild measure→section→song; commit.
    Optionally select the copy at `eventIndex + 1`.
  - Guard each against a missing section/measure/hand (mirror `onAddMeasure`'s `if
    (!section) return;`) so a stale call is a no-op, never a throw.
- In `NotePanel.js`: add an `onRemoveNote` prop and call
  `onRemoveNote(sectionIndex, measureIndex, hand, eventIndex)` from the Remove button
  instead of the local splice. **Decision:** keep `removeEvent`'s `onRemove?.()`
  selection-clear contract working — simplest is to have the lifted `onRemoveNote` own the
  selection-clear (as the other lifted removers do) and have the parent pass it; then
  `NotePanel` no longer needs its local splice at all. If the existing `NotePanel`
  unit/e2e tests assert the panel-local removal, update them to assert the lifted-handler
  call (record the next song through the parent, as `Edit.test.js` already does for
  add/remove). Keep `onRemove`/`onChange` props only if still needed; remove dead local
  code (`removeEvent`'s splice) to avoid two implementations.
- Tests in `Edit.test.js` (reuse its `renderEdit` harness that records persisted songs):
  - `onDuplicateSection` deep-copies after the original (sections length +1; the copy at
    index+1 deep-equals the original incl. its `name` if set; mutating the original later
    would not be observable, but the persisted string proves the copy carries the measures);
    `validateSong(persisted) === []`.
  - `onDuplicateMeasure` / `onDuplicateNote` likewise (measure copies both hands; note copies
    pitches/properties). Drive them through whatever surface is available in this task —
    since the tree is not yet rendered, you may temporarily exercise the handlers by
    selecting a note and (if you also wire duplicate buttons into a panel) — **but do NOT
    add duplicate buttons to panels** (the tree is the duplicate surface per the design).
    Instead, write these as focused tests that import `edit.js` and assert via a minimal
    driver, OR defer the duplicate-handler *UI* assertions to T6 and here assert only
    `onRemoveNote` (which has a real surface: the Note panel's Remove). **Recommended
    split:** in T5 fully test `onRemoveNote` via the Note panel Remove (a real surface) and
    add the three `onDuplicate*` handlers with their logic covered indirectly by T6's tree
    tests. If you prefer direct coverage now, add the three duplicate tests in T6 where the
    tree provides the buttons. Either way the handlers must exist and be committed in T5 so
    T6 can call them.

**Depends on.** T3 (`duplicateAt`).

**Traces to.** Req 6, 7, 8; AC4, AC5, AC6, AC11. Design KD 7, 8, 9.

**Acceptance.**
- `npm run test:unit` green. `npm run lint` clean.
- `onRemoveNote` removes the note, drops an emptied hand key, clears a stale selection, and
  the persisted song validates.
- The three `onDuplicate*` handlers exist, route through `commit`, and (when exercised in
  T6) produce a conformant deep-copy-after-original.
- No duplicate buttons added to inspector panels (the tree owns that surface).
- One remove implementation only (NotePanel no longer carries a parallel local splice).

---

## T6 — `StructureTree` component + wire it into `edit.js` (toggle, workspace layout, styles); remove `StructureList`

**Goal.** Build the left structure tree on `__experimentalTreeGrid`, render it left of
`SongCanvas` inside a new `__workspace` flex wrapper gated by an editor-only `showTree`
state with a second `ToolbarButton`, and remove the right-sidebar `StructureList`
(import + render + file + test). The tree is the new selection surface and hosts
add/remove/duplicate at every level plus the per-hand "Add note". Hand-group rows are
non-selecting (disclosure-only). Labels are `name`-or-positional (section/measure) and
`noteLabel` (notes).

This is the largest task; it depends on T2 (`noteLabel`), T4 (rename panels exist so a
tree selection opens a Section/Measure panel that can rename), and T5 (the
duplicate/remove handlers it wires up).

**Files.**
- `src/editor/StructureTree.js` (new).
- `src/edit.js` (edit — `showTree` state + toolbar button; `expandedPaths` Set state;
  `__workspace` wrapper rendering `StructureTree` + `SongCanvas`; pass the
  select/add/remove/duplicate callbacks + `system` + selection + expanded state; remove
  the `StructureList` import and its `<StructureList … />` render).
- `src/style.scss` (edit — add `&__workspace` flex-row rules; give the canvas column
  `min-width: 0`).
- `test/mocks/wordpress-components.js` (edit — add mocks for `__experimentalTreeGrid` and
  its `__experimentalTreeGridRow` / `__experimentalTreeGridCell` / `__experimentalTreeGridItem`
  parts so the tree renders in jsdom).
- `src/editor/__tests__/StructureTree.test.js` (new — the tree's unit suite).
- `src/editor/inspector/StructureList.js` (**delete**).
- `src/editor/__tests__/StructureList.test.js` (**delete** — real path confirmed; the
  design doc's `inspector/__tests__/…` citation is stale).
- `src/editor/__tests__/Edit.test.js` (edit — replace StructureList-driven assertions with
  tree-driven ones; the toggle now gates the tree).

**Changes.**

*StructureTree component.*
- Import from `@wordpress/components`: `__experimentalTreeGrid as TreeGrid`,
  `__experimentalTreeGridRow as TreeGridRow`, `__experimentalTreeGridCell as TreeGridCell`,
  `__experimentalTreeGridItem as TreeGridItem`, plus `Button`. From `@wordpress/i18n`:
  `__`, `sprintf`. (R-1: these are experimental `@wordpress/components` exports verified
  against Gutenberg trunk; they ship in WP core. If at implementation time TreeGrid proves
  unavailable/unsuitable, fall back to the **disclosure (`aria-expanded`) + list
  (`role="list"/"listitem"`)** hand-roll from `Button`s — and **MUST NOT** claim
  `role="tree"` — per Design KD 3 / Risk R-1. The fallback is `@wordpress/*`-only and ships
  the same disclosure baseline as the old `StructureList`.)
- Props (per design "Interfaces and Data Flow"): `song` (the working object), `selection`
  (resolved), `system`, `expandedPaths` (Set) + `setExpandedPaths` (or an
  `onToggleExpanded(path)` callback), and callbacks: `onSelect`, `onAddSection`,
  `onRemoveSection`, `onDuplicateSection`, `onAddMeasure`, `onRemoveMeasure`,
  `onDuplicateMeasure`, `onAddNote`, `onRemoveNote`, `onDuplicateNote`.
- **Flatten** `song.sections` into an ordered list of *visible* rows (respecting
  `isExpanded`), each carrying `level` (1 section / 2 measure / 3 hand group / 4 note),
  `positionInSet`/`setSize` (1-based within sibling group), and `isExpanded` for
  expandable rows. Key/`data-path` is the **index-path string** (`s0`, `s0/m1`,
  `s0/m1/rightHand`, `s0/m1/rightHand/e2`).
- **`isExpanded(path)`** = `expandedPaths.has(path)` OR `path` is an ancestor of the
  resolved selection (auto-expand selection ancestors — derive the selection's ancestor
  paths from `selection.sectionIndex`/`measureIndex`/`hand`). This always reveals the
  selected branch regardless of manual-Set staleness (design "Expansion state").
- **Selection emit** (the same kind-tagged tuples the removed surfaces emitted, so
  `resolveSelection` + `decorateSelection` + the kind-gated panels all light up unchanged):
  - section row Button → `onSelect({ kind: "section", sectionIndex })`.
  - measure row Button → `onSelect({ kind: "measure", sectionIndex, measureIndex })`.
  - note row Button → `onSelect({ kind: "event", sectionIndex, measureIndex, hand,
    eventIndex })`.
  - **hand-group rows do NOT select** (no "hand" kind exists). They are disclosure-only
    labels that toggle expansion and host the per-hand "Add note"
    (`onAddNote(sectionIndex, measureIndex, hand)`) for both `rightHand` and `leftHand`.
- **Labels:**
  - section: `section.name || sprintf(__("Section %d", "piano-block"), sectionIndex + 1)`.
  - measure: `measure.name || sprintf(__("Measure %d", "piano-block"), measureIndex + 1)`
    (same ordinals `StructureList` used).
  - hand group: `__("Right hand", "piano-block")` / `__("Left hand", "piano-block")`.
  - note: `noteLabel(event, system)`.
- **Row actions** (per design): the first `TreeGridCell` (render-prop `children={(props)
  => …}` spreading roving-tabindex props onto the selecting `Button`) holds the label
  Button; trailing `TreeGridCell`/`TreeGridItem` host the per-row add/remove/duplicate
  Buttons. Use `TreeGridItem` where one cell holds multiple focusables. Give every action
  Button a precise, assertable `label` (e.g. `Remove section 1`, `Duplicate section 1`,
  `Remove measure 1 of section 1`, `Duplicate measure 1 of section 1`, `Add note to right
  hand of measure 1 of section 1`, `Remove note 2 of right hand of measure 1 of section 1`,
  `Duplicate note 2 …`, `Add measure to section 1`, `Add section`) — i18n via `sprintf`.
  Keep labels distinct enough that an `exact`-name lookup never collides (mirrors the e2e
  `structureRow` `exact` concern).
- **Expansion callbacks:** TreeGrid's `onExpandRow(row)` / `onCollapseRow(row)` read the
  row's `data-path` and toggle it in `expandedPaths` (via `setExpandedPaths`/the toggle
  callback). `onFocusRow` is consumer-owned and needs no extra state.

*edit.js wiring.*
- Add editor-only state: `const [showTree, setShowTree] = useState(false);` and
  `const [expandedPaths, setExpandedPaths] = useState(() => new Set());` (neither
  persisted).
- Add a **second `ToolbarButton`** in the existing `BlockControls` `ToolbarGroup`,
  `isActive={showTree}`, toggling `showTree`, labeled e.g. `__("Structure", "piano-block")`
  (or "Show structure"/"Outline" — pick one clear label and use it consistently in tests).
  It mirrors the "Edit as JSON" button. Only meaningful on the visual surface.
- In the visual branch, wrap the canvas + tree in a `__workspace` flex `<div>`:
  `<div className="wp-block-piano-block-piano__workspace">{showTree && <StructureTree …
  />}<SongCanvas … /></div>`. Tree left, canvas right (DOM order tree-then-canvas).
- Pass to `StructureTree`: `song={working}`, `selection={resolvedSelection}`, `system`,
  `expandedPaths`, the expansion setter/callback, and all the
  select/add/remove/duplicate/add-note/remove-note handlers (existing
  `onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure`/`onAddNote` plus the
  new `onRemoveNote`/`onDuplicateSection`/`onDuplicateMeasure`/`onDuplicateNote` from T5).
- **Remove** the `import { StructureList } …` line and the entire `<StructureList … />`
  block in `InspectorControls`. The kind-gated `NotePanel`/`MeasurePanel`/`SectionPanel`
  and always-present `SongPanel` stay exactly as-is.
- `SongCanvas` still receives `song`/`selection`/`accessibleName`. **Do not** remove its
  `onSelect` prop wiring in this task if T7 has not yet landed — but since T7 follows, keep
  this task's `edit.js` change limited to: stop relying on the canvas as a selection
  *producer* conceptually, while leaving `onSelect={setSelection}` on `SongCanvas` until T7
  removes the canvas click-to-select. (Cleaner: this task may leave `onSelect` passed; T7
  removes both the prop and the canvas machinery together. State this explicitly so the
  tree-driven selection tests here don't depend on the canvas.)

*style.scss.*
- Under `.wp-block-piano-block-piano`, add `&__workspace { display: flex; flex-direction:
  row; gap: …; align-items: flex-start; }`. The tree column is `flex: 0 0 auto; width:
  16em; min-width: 12em; max-width: 40%;` (apply to the tree's own root class — give
  `StructureTree` a root class like `…__tree`). The canvas column (`&__canvas`) gets the
  **load-bearing `min-width: 0`** so it can shrink and the existing `&__canvas-svg`
  `min-width: 280px; overflow-x: auto` scrolls a wide score instead of crushing the tree.
  Do not change existing `&__canvas`/`&__canvas-svg` rules other than adding `min-width: 0`
  to the canvas column. A stack-to-vertical media query is optional and left out (design).

*Component mocks.*
- In `test/mocks/wordpress-components.js`, add stand-ins and export them as
  `__experimentalTreeGrid`, `__experimentalTreeGridRow`, `__experimentalTreeGridCell`,
  `__experimentalTreeGridItem`. Keep them minimal and DOM-honest like the existing mocks:
  - `TreeGrid` → render a `<table role="treegrid">` (or a plain wrapper) with `children`.
    Accept and ignore `onExpandRow`/`onCollapseRow`/`onFocusRow` (or, to test expansion,
    have the row's expand/collapse control call them — simplest is to let the
    component drive expansion through the Buttons it renders, and have the mock just render
    children; assert expansion via what rows are present). Prefer the simplest mock that
    lets the unit tests assert row inventory, labels, select payloads, and action-button
    wiring.
  - `TreeGridRow` → `<tr role="row">` honoring `level`→`aria-level`,
    `positionInSet`→`aria-posinset`, `setSize`→`aria-setsize`, `isExpanded`→`aria-expanded`
    (so tests can assert the ARIA wiring), passing through `data-path` and children.
  - `TreeGridCell` → render its render-prop child (`children(props)`) inside a `<td
    role="gridcell">`, passing a minimal `props` object (the real one carries roving-tabindex
    handlers; the mock can pass `{}` or basic props). Support the non-render-prop child form
    too if the component uses it.
  - `TreeGridItem` → same render-prop handling inside its cell context.
  - Document each mock with the same JSDoc density as the existing mocks, noting they are
    DOM-honest stand-ins for jsdom assertions and leave true keyboard/roving-tabindex
    behavior to the e2e suite.

*StructureTree.test.js (new).* Render the tree into jsdom (same `createRoot`/`act` harness
the sibling suites use — see `StructureList.test.js`). Pin:
- **Inventory:** rows for sections, measures, hand groups, and notes at the right levels;
  collapsed sections/measures hide their descendants until expanded (or auto-expanded via
  selection). Use a multi-section fixture like `StructureList.test.js`'s.
- **Labels:** `name`-or-positional for section/measure (set a `name`, assert it shows;
  unset, assert "Section 1"/"Measure 1"); note labels via `noteLabel` (a note → pitch, a
  chord → space-joined, a rest → "rest"); hand-group labels "Right hand"/"Left hand".
- **Select payloads:** clicking a section/measure/note Button calls `onSelect` with the
  exact kind-tagged tuple; clicking a hand-group row does **not** call `onSelect`.
- **Actions:** add/remove/duplicate Buttons call the right handler with the right coords at
  each level; the per-hand "Add note" calls `onAddNote(si, mi, hand)` for both hands.
- **Expansion/auto-expand:** a row is expanded when in `expandedPaths` OR when it is an
  ancestor of the selection (assert the selected note's section+measure are revealed even
  with an empty `expandedPaths`).
- **A11y wiring (via the mock):** rows carry `aria-level`/`aria-posinset`/`aria-setsize`,
  and expandable rows carry `aria-expanded`.

*Edit.test.js updates.* Replace the StructureList-specific tests:
- The existing `"seeds a first note from the Structure list…"` and
  `"onAddMeasure targets the section the Structure list fires for"` tests reference
  StructureList labels (`Add note to measure 1 of section 1`, `Add measure to section 1`).
  Re-point them at the tree: first toggle the tree open via the new toolbar Button, then
  drive the tree's equivalent action buttons (use the tree's chosen labels). Keep the
  assertions on the persisted song + validate + panel-open behavior.
- Add a test: toggling the Structure toolbar button shows/hides the tree (`__workspace`
  contains the tree only when `showTree`).
- Add a test: selecting a tree section/measure/note row reveals the right kind-gated panels
  (Section only / Measure+Section / all three) — mirroring the e2e `selecting Structure
  rows reveals the right panels` intent at the unit level.
- Any Edit test that *only* asserted StructureList presence ("Structure" panel in the
  inspector) is removed or replaced (the Structure list is gone; the tree lives in the
  workspace, not `InspectorControls`).

**Depends on.** T2 (`noteLabel`), T4 (rename panels), T5 (remove/duplicate handlers).

**Traces to.** Req 1, 2, 5, 6, 9, 13, 16; AC1, AC2, AC4, AC5, AC6, AC7, AC8, AC13. Design
KD 1, 2, 3, 4, 11, 12, 13, 14; Removed/Changed components.

**Acceptance.**
- `npm run test:unit` green; the StructureList suite is gone and the StructureTree suite is
  present; Edit suite updated. Net suite count reflects −(StructureList tests) +(StructureTree
  + new Edit tests).
- `npm run lint` clean.
- The tree shows Section → Measure → {Right/Left hand} → Note; sections/measures
  expand/collapse; the panel toggles open/closed (AC1). Selecting a node sets the
  kind-tagged selection that opens the right panels and (via the canvas, already wired)
  highlights the canvas (AC2). Hand rows never select (KD 14). Add/remove/duplicate at every
  level route through `commit` (AC4–AC6, AC11). Rename via the Section/Measure panels still
  works (AC7). Note/chord/rest labels correct (AC8). `@wordpress/*`-only (AC13).
- `StructureList.js` and `StructureList.test.js` are deleted; no dangling import.
- `render.php`/`view.js`/`svg.js` untouched.

---

## T7 — Remove canvas click-to-select + minimal `interactive` revert in `SongCanvas`

**Goal.** Make the canvas **display + highlight only**: remove `selectionFromTarget`, the
native click/keydown listeners + their `activateRef`/`onSelect` plumbing, and
`makeEventsFocusable` (now dead), and drop `interactive: true` at the `renderInto` call
site (minimal revert → editor SVG byte-identical to the front end; **`svg.js` stays
byte-stable**). Keep the draw `useEffect`, the `ResizeObserver`, and `decorateSelection`
untouched (the highlight path is unchanged). Remove the now-unused `onSelect` prop from
`SongCanvas` and from `edit.js`'s `<SongCanvas …>` usage.

**Files.**
- `src/editor/SongCanvas.js` (edit — remove click-to-select machinery; drop
  `interactive: true`; drop `onSelect` prop + the focusable-making).
- `src/edit.js` (edit — stop passing `onSelect` to `SongCanvas`).
- `src/editor/__tests__/SongCanvas.test.js` (edit — remove the click/keydown/hit-rect
  selection tests; keep the mount/decoration tests).
- `src/editor/__tests__/Edit.test.js` (edit — remove/replace the canvas-click selection
  tests; selection now comes only from the tree, already covered in T6).
- `specs/editor.spec.js` (edit — the e2e canvas-click selection tests).
- `specs/render.spec.js` (no change expected — the `[data-hit]` count-0 assertion already
  passes since `view.js` never set `interactive`; verify by reading, do not edit).

**Changes.**
- In `SongCanvas.js`: delete `selectionFromTarget`, `makeEventsFocusable`, the
  `activateRef` ref and its assignment, and the `useEffect` that adds the
  `click`/`keydown` native listeners. Remove `onSelect` from the props and the JSDoc.
  In the draw effect, drop the `makeEventsFocusable(container)` call and change
  `renderInto(container, model, { accessibleName, interactive: true })` to
  `renderInto(container, model, { accessibleName })` (minimal revert). Keep
  `decorateSelection(container, selection, song)` and the resize observer. Update the
  component/file JSDoc to describe it as **display + highlight only** (no hit-testing, no
  click-to-select), removing the now-false "SELECTION hit-testing" prose.
- In `edit.js`: change `<SongCanvas song={working} accessibleName={accessibleName}
  selection={resolvedSelection} onSelect={setSelection} />` to drop `onSelect`
  (`setSelection` is still used by the tree and the remove/duplicate handlers, so keep the
  state). 
- `SongCanvas.test.js`: remove the tests that depend on removed behavior — `"fires onSelect
  …"` (note/empty/rest), `"fires onSelect when the per-event hit-rect … is the click
  target"`, `"fires onSelect on Enter/Space …"`, `"ignores keydowns …"`, and `"makes
  note/rest groups focusable …"`. **Keep** the mount tests (`<svg role='img'>`, seeded
  empty song), all the `decorateSelection` tests (`is-selected`, stale, `is-active-measure`,
  `is-active-section`, scroll), and `"renders no on-canvas add affordances"`. Update the
  suite's header JSDoc to say the canvas is selection-decoration only (no hit-testing).
- `Edit.test.js`: remove/replace tests that select by clicking a canvas note group — e.g.
  `"reveals the Note/Measure/Section panels when a note is selected on the canvas"`,
  `"inserts a contextual note right after the selected event …"` (this one selects via
  canvas click then uses the Note panel — re-point the *selection* step to a tree-row click,
  toggling the tree open first; the contextual-add behavior itself is unchanged), the
  `selectLoneNote` helper and the `kind-tagged panel gating` / `lifted structural mutators`
  describes that rely on a canvas click → either re-point them to a tree selection or fold
  them into T6's tree-driven selection tests. The `"clears a stale selection after a raw
  edit removes the selected event"` test selects via canvas click — re-point its selection
  step to a tree-row click. Net: no Edit test should click a canvas note to drive selection
  after this task.
- `specs/editor.spec.js`: remove `"selecting a note reveals the Note, Measure and Section
  panels"` (canvas-click selection) and `"clicking a note off its ink (in-column gap) still
  selects it"` (the hit-rect e2e — obsolete with click-to-select gone). Add an e2e (or fold
  into the existing `"selecting Structure rows reveals the right panels and highlights the
  canvas"`, which already targets the tree concept) asserting a **canvas click does NOT
  change selection** (AC3): click a `[data-kind="note"]` group and assert no Note panel
  appears / no `.is-selected` lands. Re-point any e2e that previously selected via canvas
  click to use the tree. Update the spec's header JSDoc to state the canvas is display +
  highlight only and the tree is the selection surface. Keep the language/round-trip/JSON
  tests unchanged.

**Depends on.** T6 (the tree must be the live selection surface before the canvas producer
is removed, so the e2e/unit selection coverage moves to the tree without a gap).

**Traces to.** Req 3, 4, 12; AC3, AC10. Design KD 5, 6, 15; Risk R-2, R-3.

**Acceptance.**
- `npm run test:unit` green; the removed SongCanvas/Edit selection tests are gone, the
  decoration tests still pass.
- `npm run lint` clean.
- `SongCanvas` no longer hit-tests or sets selection on click/keydown; the canvas is
  display + highlight only (AC3). The editor SVG is byte-identical to the front end
  (no `[data-hit]`); `svg.js` is byte-stable (the `interactive` flag/`hitRect` remain in
  `svg.js`, just unused — minimal revert per KD 6).
- `decorateSelection` and the resize observer are unchanged (AC4 live highlight preserved).
- `specs/render.spec.js`'s `[data-hit]` count-0 assertion still passes (verified, not
  edited).
- The svg.js `interactive-flag` describe block in `svg.test.js` remains green and unedited
  (it tests `svg.js`'s unchanged API; see the Reconciliation note above). State this in the
  commit message.

---

## T8 — Integration check: lint, full unit suite, boundary audit, e2e read-through

**Goal.** Final guard: the whole unit suite is green, lint is clean, the front-end boundary
is provably untouched, and the e2e spec is internally consistent with the new surfaces.

**Files.**
- No production source changes expected. Small test fixups only if integration reveals a
  gap (a stale import, a mock export, a label collision). If a fix is needed, keep it
  minimal and in the file that owns the gap.

**Changes / checklist.**
- Run `npm run test:unit` — all suites green. Record the final count and the delta from the
  602 baseline (expected: roughly flat-to-up — new StructureTree/noteLabel/duplicateAt/
  schema/rename tests added; StructureList suite and the canvas-click selection tests
  removed).
- Run `npm run lint` — clean.
- **Boundary audit (AC10, Req 12):** `git diff` shows **no change** to `src/render.php`,
  `src/view.js`, or `src/notation/svg.js`. Confirm `svg.js` is byte-identical to the
  branch tip at plan start (the minimal revert never touched it). Confirm the only schema
  delta is the additive `name` on section + measure (T1). Confirm no new runtime dependency
  in `package.json` and no non-`@wordpress/*` import added (`structuredClone` is a global).
- **e2e read-through (cannot assume Docker):** verify `specs/editor.spec.js` is internally
  consistent — every selection now flows through the tree toggle + tree rows; the
  StructureList `structureRow`/`Add note to measure …` helpers/labels are updated to the
  tree's labels; the canvas-click and hit-rect e2e tests are gone; an AC3 "canvas click does
  not select" assertion exists; the `[data-hit]` boundary assertion in `render.spec.js` is
  intact. If the runner has Docker, run `npm run build && npm run env:start && npm run
  test:e2e`; otherwise document that e2e was validated by read-through.
- Spot-check that toggling the tree, selecting each node kind, and add/remove/duplicate/
  rename each route through `commit` (so AC11 holds for every surface) — covered by the
  unit suites; just confirm none was lost in integration.

**Depends on.** T1–T7.

**Traces to.** All ACs (final guard); especially AC10, AC11, AC12, AC13; Req 12, 14, 15,
16. Risks R-1, R-2, R-3 closed/accepted.

**Acceptance.**
- `npm run test:unit` green; `npm run lint` clean.
- `render.php`/`view.js`/`svg.js` byte-unchanged; schema delta is `name`-only; deps
  `@wordpress/*`-only.
- e2e spec consistent with the new tree-driven selection surface (run if Docker is
  available; else read-through-verified and documented).

---

## Task summary

| # | Title | Depends on |
|---|---|---|
| T1 | Schema: additive optional `name` on section + measure | — |
| T2 | Note-label helper (`noteLabel`) | — |
| T3 | `duplicateAt` array helper | — |
| T4 | Rename `TextControl` in Section + Measure panels | T1 |
| T5 | Lift `onRemoveNote` + three `onDuplicate*` handlers in `edit.js` | T3 |
| T6 | `StructureTree` + workspace/toggle/styles; remove `StructureList` | T2, T4, T5 |
| T7 | Remove canvas click-to-select + minimal `interactive` revert | T6 |
| T8 | Integration check: lint, unit, boundary audit, e2e read-through | T1–T7 |

**Out-of-scope respected (do not implement):** canvas click-to-select (removed, not
re-added); reordering up/down; the front end consuming `name`/`language`; any change to
`render.php`/`view.js`/`svg.js` output; audio; octave in note labels (C4/C5 ambiguity
deferred); the *full* `interactive`/`hitRect` deletion (optional cleanup only — this plan
takes the minimal revert).
