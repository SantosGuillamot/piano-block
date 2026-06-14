# Design Doc — Review 3: Left-sidebar structure tree as the selection surface

## Overview

The Piano block's editor is canvas-first. Earlier reviews let authors select notes by
clicking the rendered staff; that has proven unreliable. Review 3 replaces the selection
model with a **structure tree** rendered in a toggleable panel to the **left of the
canvas**, inside the block's own editor area (not Gutenberg's global List View). The tree
becomes the way the author navigates and selects — Section → Measure → {Right hand, Left
hand} → Note — much like the List View navigates blocks and inner blocks.

Selecting a tree node **highlights** the matching element on the canvas (which is now
**display + highlight only** — clicking the staff no longer selects) and **opens that
node's settings** in the existing **right inspector** (Song / Note / Measure / Section
panels). From the tree the author can **add, remove, and duplicate** sections, measures,
and notes, and **rename** sections and measures.

The work is almost entirely editor-side and reuses the existing substrate: the
kind-tagged editor selection, `resolveSelection`, and the canvas `decorateSelection`
highlight are kept; the structural mutators already lifted into `edit.js` are reused and
extended. The single deliberate format change is an **additive optional `name`** on
sections and measures, in the same spirit as the existing optional `language` field.
`render.php` and the front-end SVG rendering are untouched — the front end ignores `name`,
so a published page renders identically. The block still persists exactly one `song` JSON
string, and editing stays conformant by construction.

This doc is standalone. It traces each decision to the authoritative spec
(`../1-spec/spec.md`) Requirements (Req 1–16) and Acceptance Criteria (AC1–AC13), and
carries the decisions and risks recorded in `design-doc-research.md`.

## Approach

Three moves, in dependency order:

1. **Add a left structure tree** as a sibling of `SongCanvas` inside the block wrapper,
   built on `@wordpress/components`' `__experimentalTreeGrid` — the same accessible
   primitive Gutenberg's List View is built on. It is toggled by a second
   `ToolbarButton` in the existing `BlockControls` group, gated by an editor-only
   `showTree` state. The tree flattens `working.sections` into visible rows whose row
   model carries `level`/`positionInSet`/`setSize`, keyed by **index-path** strings.
   (Req 1–2, 16.)

2. **Make the tree the only selection surface.** Tree rows call the existing
   `setSelection` with the same kind-tagged tuples the removed surfaces emitted, so the
   existing `resolveSelection` + canvas `decorateSelection` + kind-gated inspector panels
   all light up unchanged. Canvas click-to-select is **removed** (`selectionFromTarget` +
   native listeners + `makeEventsFocusable`), the editor-only `interactive` hit-rect is
   reverted so the editor SVG matches the front end, and the Review-2 right-sidebar
   `StructureList` is deleted. (Req 2–5, 13; AC2–AC3.)

3. **Round out structural ops and labels.** Add a pure `duplicateAt` helper and three
   `onDuplicate*` handlers; lift note-level remove to `edit.js` as `onRemoveNote`; reuse
   the existing add/remove handlers — every op routes through `commit` → `commitSong`'s
   re-validation guard. Add the optional `name` to the schema and an inspector
   `TextControl` rename in the Section/Measure panels, with a `name`-or-positional tree
   label. Label note rows by pitch name via a thin helper over `stepInSystem`. (Req 6–11;
   AC4–AC8, AC10–AC11.)

Everything is reuse-first: the new code is the tree component, one array helper, three
duplicate handlers + one lifted remove handler, one schema field, one label helper, and
the rename `TextControl`s. Nothing else in the working-object / commit / validation /
front-end path changes.

## Components

### New

- **`src/editor/StructureTree.js` (new).** The left tree. Renders
  `__experimentalTreeGrid` with rows derived from `working.sections`. Receives `song`
  (the working object), the resolved `selection`, `system` (for note labels), the
  expanded-path Set + its setter, and the full set of select/add/remove/duplicate
  callbacks. Emits kind-tagged selections via `onSelect`. Hand-group rows are
  organizational and non-selecting (they host per-hand "Add note" and toggle expansion
  only).
- **`duplicateAt(list, index)` in `src/editor/songModel.js` (new helper).** Pure,
  immutable, dependency-free deep insert-after:
  `insertAt(list, index + 1, structuredClone(list[index]))`.
- **A note-label helper** — `noteLabel(event, system)` (in `noteNames.js` or a small new
  `noteLabel.js`). Returns `__("rest", "piano-block")` for a rest, else the event's
  pitches mapped through `stepInSystem(step, system)` and space-joined.

### Changed

- **`src/edit.js`.** Add `showTree` editor-only state + the toolbar toggle; add an
  expanded-path Set state; render `StructureTree` left of `SongCanvas` inside a new
  `__workspace` flex wrapper; add `onDuplicateSection` / `onDuplicateMeasure` /
  `onDuplicateNote` and `onRemoveNote`; stop passing `onSelect`/`interactive` plumbing to
  the canvas where it concerns click-to-select; remove the `StructureList` import +
  render.
- **`src/editor/SongCanvas.js`.** Remove `selectionFromTarget`, the click/keydown native
  listeners and their `activateRef`/`onSelect` plumbing, and `makeEventsFocusable` (now
  dead). Keep the draw effect, the resize observer, and `decorateSelection`. Drop
  `interactive: true` at the `renderInto` call site so the editor SVG is byte-identical to
  the front end.
- **`src/song/schema.js`.** Add `name: { type: "string" }` to `$defs.section.properties`
  and `$defs.measure.properties`; `required` unchanged (optional, permissive).
- **`src/editor/inspector/SectionPanel.js` / `MeasurePanel.js`.** Add a `TextControl name`
  field, emitting via the existing `emitSection`/`emitMeasure` path (dropping the key when
  blank per the `emitBlock` idiom).
- **`src/style.scss`.** Add `&__workspace` flex-row rules alongside the existing
  `&__canvas` rules; give the canvas column `min-width: 0` so the SVG host's existing
  `min-width: 280px; overflow-x: auto` engages instead of crushing the tree.

### Removed

- **`src/editor/inspector/StructureList.js`** and its test
  `src/editor/inspector/__tests__/StructureList.test.js` — superseded by the left tree.
- The canvas click-to-select machinery inside `SongCanvas.js` (listed above).

### Kept (reused, not reimplemented)

- The editor-only kind-tagged `selection` state, `resolveSelection`, and the
  `measureCoords` / `globalMeasureNumber` / `measureNumbersForSection` / `selectionQuery`
  coordinate helpers (`selection.js`).
- `decorateSelection` and the canvas draw `useEffect` (`SongCanvas.js`) — the highlight
  path is untouched.
- The kind-gated `NotePanel` / `MeasurePanel` / `SectionPanel` and always-present
  `SongPanel`, and the lifted `commit` / `onAddNote` / `onAddSection` / `onRemoveSection`
  / `onAddMeasure` / `onRemoveMeasure` handlers in `edit.js`.
- `songModel.js` factories (`newSection`/`newMeasure`/`newNote`/`newPitch`/`newSong`) and
  array helpers (`insertAt`/`removeAt`/`replaceAt`); the permissive schema walker;
  `stepInSystem`/`SYSTEMS`; `render.php` and `view.js`/`svg.js`.

## Interfaces and Data Flow

### Editor state (all editor-only, never persisted)

`edit.js` holds, alongside today's `mode` and `selection`:

- `showTree: boolean` (`useState`) — the toolbar toggle's state.
- `expandedPaths: Set<string>` (`useState`) — **manual** expand/collapse toggles, keyed by
  index-path string.

The block continues to persist exactly the `song` string; none of the above is written to
attributes.

### Node identity — index-path keys

The format has no stable ids; the existing selection model is already index-coordinate
based (`{ sectionIndex, measureIndex?, hand?, eventIndex? }`). So a node's identity is its
**index-path string**, which doubles as the React `key`, the row's `data-path`, and
(parsed) the selection tuple:

| Level | Example path | Selection emitted |
|---|---|---|
| Section | `s0` | `{ kind: "section", sectionIndex: 0 }` |
| Measure | `s0/m1` | `{ kind: "measure", sectionIndex: 0, measureIndex: 1 }` |
| Hand group | `s0/m1/rightHand` | none (non-selecting) |
| Note/rest | `s0/m1/rightHand/e2` | `{ kind: "event", sectionIndex: 0, measureIndex: 1, hand: "rightHand", eventIndex: 2 }` |

Index-paths are positional and shift on insert/remove/duplicate — the **same** staleness
the selection model already tolerates (`resolveSelection` re-resolves each render and
drops a stale selection; the remove handlers proactively clear stale selections).
Synthesizing stable ids into the working state is rejected: it would fight the
single-string, conformant-by-construction, only-`name`-added design.

### Expansion state — manual Set layered with auto-expand of selection ancestors

Whether a row is expanded is derived, not just stored:

```
isExpanded(path) = expandedPaths.has(path)
                || path is an ancestor of the resolved selection
```

The selection's ancestor indices come straight off `resolveSelection`'s result each
render, so the selected branch is **always revealed** with no stored state to go stale.
This makes the manual Set far less load-bearing and absorbs the index-shift problem for the
important case (the selected branch). Best-effort staleness on the manual Set is then
acceptable — it matches the selection model, and reordering is out of scope. The
once-considered index-shift remap is unnecessary and is dropped.

### Tree row model (`__experimentalTreeGrid` contract)

`StructureTree` flattens `working.sections` into an ordered list of **visible** rows
(respecting `isExpanded`), each a `__experimentalTreeGridRow` (`<tr role="row">`) carrying:

- `level` (1-based): 1 = Section, 2 = Measure, 3 = Right/Left hand group, 4 = Note/rest
  leaf.
- `positionInSet` / `setSize` (1-based) computed within the row's sibling group →
  `aria-posinset` / `aria-setsize`.
- `isExpanded` for section/measure/hand rows → `aria-expanded`.

The first `__experimentalTreeGridCell` (a render-prop, `children={(props) => …}`) holds the
selecting `Button` (the cell spreads roving-tabindex props onto it); the label is the
`name`-or-positional string (section/measure) or the pitch label (note). Trailing
`__experimentalTreeGridCell` / `__experimentalTreeGridItem` cells host the per-row
add/remove/duplicate `Button`s (`TreeGridItem` is used where a single cell holds multiple
focusables).

`__experimentalTreeGrid` itself renders `<table role="treegrid">` and supplies the
**accessible treegrid keyboard model** for free: roving tabindex, Up/Down between rows,
Left/Right to collapse/expand and move between focusables, and the
`aria-level`/`-posinset`/`-setsize`/`-expanded` wiring derived from the row props. The
component's callbacks `onExpandRow(row)` / `onCollapseRow(row)` read the row's `data-path`
and toggle `expandedPaths`; `onFocusRow` is consumer-owned and needs no extra state here.

### Selection → highlight → settings (unchanged downstream)

A select `Button` calls `onSelect` with the kind-tagged tuple → `setSelection` →
`resolveSelection(working, selection)` each render → the canvas `useEffect` runs
`decorateSelection(container, resolvedSelection, song)` (branching on `selection.kind` for
`is-selected` / `is-active-measure` / `is-active-section`), and the kind-gated inspector
panels render. This is exactly today's path; only the producer of the tuple changes from
canvas-click to tree-click. The selection-decoration data hooks (`data-measure`,
`data-hand`, `data-event-index`, `data-kind`) are emitted by `svg.js` unconditionally, so
removing click-to-select does not touch the highlight path.

### Structural-op data flow

Each op is an immutable `.map`/splice over `working`, ending in `commit(next)` →
`commitSong(next, onChangeSong)`, which serializes and **re-validates** before persisting
the raw string:

- **Add:** reuse `onAddSection` / `onAddMeasure(sectionIndex)` / `onAddNote(sectionIndex,
  measureIndex, hand)`.
- **Remove:** reuse `onRemoveSection` / `onRemoveMeasure`; new `onRemoveNote(sectionIndex,
  measureIndex, hand, eventIndex)` mirrors `NotePanel.removeEvent` (drop the hand key when
  the list empties). `NotePanel`'s own Remove can call the same lifted handler.
- **Duplicate (new):** `onDuplicateSection(si)` / `onDuplicateMeasure(si, mi)` /
  `onDuplicateNote(si, mi, hand, ei)` — same immutable splice pattern, using
  `duplicateAt`/index+1. Each may optionally select the new copy (mirroring `onAddNote`
  auto-selecting its inserted note).

### Tree labels

- Section row: `section.name || sprintf(__("Section %d", "piano-block"), n)`.
- Measure row: `measure.name || sprintf(__("Measure %d", "piano-block"), n)` — the same
  `sprintf` ordinals `StructureList` built.
- Note row: `noteLabel(event, system)` — `"rest"` for `type === "rest"`, else
  pitch-name(s) joined (no octave).

`system` is already computed in `edit.js`
(`working?.language ?? inferNoteNameSystem(working)`) and is threaded into the tree.

## Key Decisions

Each decision cites the spec Req/AC it satisfies and, where relevant, the alternative it
beat.

1. **Layout: a hand-rolled `__workspace` flex row inside the block wrapper.** Wrap the
   visual branch's canvas + tree in a `…__workspace` flex `<div>` (tree left, canvas
   right), styled in `style.scss` alongside the existing `&__canvas` rules. No
   `@wordpress/*` layout primitive — the block already hand-rolls its canvas CSS. The tree
   column is `flex: 0 0 auto; width: 16em; min-width: 12em; max-width: 40%`; the canvas
   column is `flex: 1 1 auto` with the **load-bearing `min-width: 0`** so it can shrink and
   the SVG host's existing `min-width: 280px; overflow-x: auto` scrolls a wide score rather
   than crushing the tree. The toolbar toggle is the intended escape hatch at tight widths;
   a stack-to-vertical media query is optional polish, left out. *(Req 1, 16.)*

2. **Toggle: a second `ToolbarButton` in the existing `BlockControls` `ToolbarGroup`**,
   mirroring the "Edit as JSON" button, `isActive`-bound to an editor-only `showTree`
   state. Idiomatic, keyboard-reachable, never persisted. *(Req 1; AC1.)*

3. **Tree component: `__experimentalTreeGrid` (chosen over a hand-rolled `Button` tree).**
   It is the same primitive Gutenberg's List View is built on, so the block's tree behaves
   *like* the List View the spec invokes (without being the global List View, which is out
   of scope). It is `@wordpress/components`-only, and experimental WP APIs are already a
   precedent here (`__experimentalToolsPanel`/`__experimentalNumberControl` across every
   inspector panel). Critically, it supplies the **full accessible treegrid keyboard
   model** for free — resolving the keyboard/`role`-honesty dilemma with no hand-rolled
   arrow-key logic and no dishonest `role="tree"`. Cost: it is `__experimental` and
   table-shaped, so row-action buttons live in `TreeGridCell`/`TreeGridItem` render-props
   (more ceremony than plain `Button` rows) — accepted. *Documented fallback (Risk R-1):*
   if TreeGrid proves unsuitable at implementation time, hand-roll from `Button`s using
   **disclosure (`aria-expanded`) + list (`<ul>/<li>` or `role="list"/"listitem"`)
   semantics — and MUST NOT claim `role="tree"`** (per the W3C ARIA APG, a bare
   `role="tree"` obliges the full arrow-key model and is worse than not claiming it). The
   fallback ships the same disclosure baseline as today's `StructureList` and is also
   `@wordpress/*`-only. *(Req 1–2, 16; AC1, AC13.)*

4. **Index-path node identity + manual expanded-path Set layered with auto-expand of
   selection ancestors.** Chosen over synthesizing stable ids into working state (rejected
   — fights the single-string, only-`name`-added design). Index-path staleness on the
   manual Set is acceptable because it matches the selection model and auto-expand always
   reveals the selected branch with no stored state. *(Req 1.)*

5. **Reuse the selection substrate unchanged; remove the canvas/StructureList producers.**
   `decorateSelection` is a pure function of `(container, selection, song)` branching only
   on `selection.kind`, so a tree click calling the same `setSelection` lights the canvas
   identically. Delete `selectionFromTarget` + listeners + `makeEventsFocusable` from the
   canvas, and delete `StructureList` + its import/render + test. *(Req 2–5, 13; AC2–AC3.)*

6. **`interactive` hit-rect — minimal revert (chosen), with full revert as optional
   cleanup.** With click-to-select gone there are no hit-rect consumers. *Minimal
   (chosen):* stop passing `interactive: true` at the `SongCanvas.js` `renderInto` call
   site; the flag defaults to `false` in `svg.js`, so the editor SVG becomes byte-identical
   to the front end and **`svg.js` stays byte-stable**. *Full revert (optional cleanup):*
   additionally delete `hitRect`, `HIT_RECT_WIDTH_SP`, the `interactive` param threading,
   and the `HIT_RECT_VERTICAL_MARGIN_SP` import/constant — but that touches many signatures
   and forces deleting/updating the hit-rect tests (Risk R-2). Both satisfy "front end
   unchanged" since `view.js` never set `interactive`. The plan picks one; default to
   minimal. *(Req 12; AC10.)*

7. **`duplicateAt` via `structuredClone` + `insertAt(index + 1)`.** A
   section/measure/note is plain JSON that round-trips through `JSON.stringify`, so a deep
   copy is `structuredClone` (a standard global, not a `@wordpress/*` dependency — satisfies
   AC13). A deep copy of a conformant fragment is conformant, covering a section's
   measures/notes + its `name`, a measure's both hands + its `name`, and a note's
   pitches/properties. *(Req 7; AC6, AC11, AC13.)*

8. **Three duplicate handlers + lifted `onRemoveNote` in `edit.js`.** Mirror the existing
   add handlers' immutable `.map` splice; route through `commit`. Reordering is
   deliberately absent. *(Req 6, 8; AC4–AC6.)*

9. **Conformant by construction holds for free.** Every op (add/remove/duplicate/rename/
   settings edit) routes through `commit` → `commitSong`, which re-validates and refuses a
   non-conformant string — AC11 is structurally enforced regardless of which surface drives
   the edit. *(Req 14; AC11.)*

10. **Schema: additive optional `name: { type: "string" }` on section + measure.**
    `required` unchanged. The permissive walker already ignores unknown keys, so `name`
    round-trips today; declaring it documents it and gives a type error on a non-string —
    exactly mirroring the optional `language` precedent. *(Req 11; AC10.)*

11. **Rename affordance: an inspector `TextControl name` in the Section and Measure
    panels** (chosen as the primary and sole affordance). Slots into `SectionPanel`/
    `MeasurePanel`, emitting via `emitSection`/`emitMeasure` and dropping the key when blank
    (the `emitBlock` idiom). Pure `@wordpress/components`. The spec leaves the affordance
    open ("inline in the tree **and/or** a Name field in the Section/Measure panel"), so
    inspector-only satisfies AC7 and avoids building inline-edit keyboard plumbing inside
    TreeGrid cells. Inline-tree rename is possible future polish. *(Req 9; AC7.)*

12. **Tree label = `name` when set, else positional fallback** (`name || sprintf(…)`),
    reusing the `sprintf` ordinals `StructureList` built. Blank/absent ⇒ fallback
    (default-by-absence). *(Req 9; AC7.)*

13. **Note labels via a thin `stepInSystem` helper.** `"rest"` for `type === "rest"`, else
    pitches mapped through `stepInSystem(step, system)` (which canonicalizes any stored
    spelling into the song's system) and space-joined. **Pitch-name(s) only, no octave** —
    AC8 says "labeled by its pitch name … a chord shows its pitches" with no mention of
    octave; octave is optional later polish. The only `@wordpress/*` dependency is `__` for
    "rest". *(Req 10; AC8.)*

14. **Hand-group rows are organizational, not selectable.** The selection model has only
    `section`/`measure`/`event` kinds — there is no "hand" kind, no inspector panel, and no
    canvas decoration for a hand. So hand rows render as non-selecting (disclosure-only)
    labels that host the per-hand "Add note" affordance and toggle expansion; only
    section/measure/note rows drive `setSelection`. *(Req 1; AC1.)*

15. **Boundary preserved: schema delta is `name` only.** `render.php` does no parsing — it
    escapes `<` and emits the raw `song` verbatim in an inert `<script type="application/
    json">`; the front end never reads `name`, so a published page renders identically.
    With the minimal `interactive` revert, the editor SVG is byte-identical to the front
    end too. Carry-overs (note-language selector via `SongPanel`/`mapSong`; raw-JSON toggle
    + non-blocking validation; progressive disclosure via `__experimentalToolsPanel`; live
    canvas re-render via the draw `useEffect`) are preserved by reuse, not reimplementation.
    *(Req 12, 15; AC9, AC10, AC12.)*

## Dependencies

- **No new runtime dependency.** Only `@wordpress/*` packages already available to blocks
  are used: `@wordpress/components` (incl. `__experimentalTreeGrid` and its row/cell/item
  parts, `TextControl`, `ToolbarButton`/`ToolbarGroup`), `@wordpress/block-editor`
  (`BlockControls`, `InspectorControls`, `useBlockProps`), `@wordpress/element`
  (`useState`/`useMemo`), `@wordpress/i18n` (`__`/`sprintf`). `structuredClone` is a
  standard global, not a package dependency. *(Req 16; AC13.)*
- **Schema:** the single additive `name` field on section + measure (`src/song/schema.js`).
- **Untouched:** `render.php`, `view.js`, `svg.js` (byte-stable under the minimal revert),
  the validate walker, and the `commit`/`commitSong` persist path.

## Failure Modes and Observability

- **Stale selection / stale expanded paths after a structural edit.** Index-paths shift on
  insert/remove/duplicate. Handled by the existing model: `resolveSelection` re-resolves
  each render and drops a stale selection (the inspector falls back to Song-only); the
  remove handlers proactively clear a stale selection; auto-expand of selection ancestors
  always reveals the selected branch regardless of the manual Set. Manual-Set staleness is
  best-effort by design (matches the selection model; reordering is out of scope).
- **Non-conformant edit attempt.** `commitSong` re-validates and refuses to persist a
  non-conformant serialization — the conformance guard is the single choke point for every
  op (AC11). A latent control bug surfaces as a refused commit, not a corrupt song.
- **Invalid / unparseable `song` string.** Unchanged: a non-empty invalid song routes to
  `InvalidState` ("Edit as JSON"); raw-JSON mode stores any string with a non-blocking
  notice and never blocks saving (AC12).
- **Non-string `name`.** Now a declared `string` type, so a non-string `name` is a
  validation type error rather than a silently-tolerated unknown key.
- **Front-end safety.** `render.php` emits the raw song verbatim and ignores `name`; the
  SVG is byte-identical to a song without `name`, and to the editor SVG under the minimal
  `interactive` revert (AC10). Observable via the SVG-emit tests and the unchanged
  `render.php`.

## Risks and Open Questions

- **R-1 — `__experimentalTreeGrid` API pinning.** `node_modules` is not installed in this
  worktree, so the TreeGrid exports, row props, callbacks, and a11y model were verified
  against Gutenberg `trunk` (authoritative source) rather than the installed build. The
  block consumes `@wordpress/components`/`@wordpress/block-editor` as WordPress-runtime
  externals (not `package.json` deps; `block.json` `apiVersion: 3`), and
  `__experimentalTreeGrid` has shipped in WP core for years, so it is available to blocks.
  *Mitigation:* it is the same primitive List View uses; experimental WP APIs are already
  precedented here. If the plan wants it pinned to a specific WP tag, the researcher can
  fetch that tag. The hand-rolled disclosure+list fallback (Decision 3) remains available
  and is also `@wordpress/*`-only.
- **R-2 — hit-rect test fallout (only if full revert is chosen).** The full `svg.js` revert
  would have to delete/update the hit-rect tests (`svg.test.js` "editor-only per-event
  hit-rect", plus refs in `SongCanvas.test.js`/`Edit.test.js`). The recommended minimal
  revert avoids that churn but leaves dead-but-defaulted `interactive`/`hitRect` code in
  `svg.js`. The plan chooses which; both are front-end-safe.
- **R-3 — canvas / StructureList test replacement.** Removing canvas click-to-select
  (`selectionFromTarget` + listeners + `makeEventsFocusable`) invalidates the
  canvas-selection tests in `SongCanvas.test.js`/`Edit.test.js`, and deleting
  `StructureList` removes its `StructureList.test.js` suite. These must be replaced by
  tree-driven selection/op tests (select a node → highlight + panels; add/remove/duplicate
  at each level; rename round-trip; note/chord/rest labels). Tracked for the plan, not a
  design blocker.

No open questions remain: OQ-1 (narrow width), OQ-2 (keyboard), OQ-3 (identity), OQ-4
(hand groups), OQ-5 (rename affordance), and OQ-6 (note label) are all resolved in the
research and carried above.

## Spec coverage

| Spec item | Decision(s) |
|---|---|
| Req 1 (toggleable left tree, hierarchy, expand/collapse) | 1, 2, 3, 4, 14 |
| Req 2 (tree = primary selection surface) | 3, 5 |
| Req 3 (canvas click-to-select removed) | 5, 6 |
| Req 4 (selection → canvas highlight, live) | 5, 15 |
| Req 5 (selection → right inspector panels) | 5 |
| Req 6 (add/remove/duplicate at every level) | 7, 8 |
| Req 7 (duplicate = deep copy after, incl. `name`) | 7 |
| Req 8 (no reordering) | 8 |
| Req 9 (editable `name`, positional fallback) | 11, 12 |
| Req 10 (note labels: pitch/chord/rest) | 13 |
| Req 11 (`name` additive/optional/permissive) | 10 |
| Req 12 (boundary: only `name`; render.php/front-end unchanged) | 6, 10, 15 |
| Req 13 (remove right-sidebar StructureList) | 5 |
| Req 14 (conformant by construction) | 9 |
| Req 15 (carry-overs preserved) | 15 |
| Req 16 (WP-only deps) | 1, 3, 7, 13 (Dependencies) |
| AC1 (tree shows hierarchy + toggles) | 2, 3, 14 |
| AC2 (select node → highlight + settings) | 5 |
| AC3 (canvas no longer selects on click) | 5, 6 |
| AC4 (add at every level) | 8 |
| AC5 (remove at every level) | 8 |
| AC6 (duplicate = deep copy after) | 7, 8 |
| AC7 (rename, persisted, round-trips) | 10, 11, 12 |
| AC8 (note labels: pitch/chord/rest) | 13 |
| AC9 (settings edits reflected) | 15 |
| AC10 (`name` round-trips/validates; front end unchanged) | 6, 10, 15 |
| AC11 (conformant by construction) | 7, 9 |
| AC12 (raw JSON never blocks saving) | 15 |
| AC13 (no outside dependencies) | 7, 13 (Dependencies) |

**Out-of-scope respected:** canvas click-to-select removed (not re-added); reordering
deferred; the front end never consumes `name`/`language`; `render.php`/SVG emit unchanged;
no audio; invalid-song→raw-JSON and large-song-perf behavior carried over.
