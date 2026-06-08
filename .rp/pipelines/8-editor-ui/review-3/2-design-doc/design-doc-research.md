# Design research — Review 3: Left-sidebar structure tree as the selection surface

Running record of the design Q&A between the **design-doc-analyst** and the
**design-doc-researcher** (`design-researcher-r3`). Decisions trace to the
authoritative spec (`../1-spec/spec.md`) Reqs/ACs and to the live `src/` code.
This file is the *research record*, not the final design doc.

## Status

- [x] Topic 1 — Left structure-tree panel — RESOLVED (layout, toggle,
      `__experimentalTreeGrid` component, row model, keyboard, identity/expansion,
      narrow width).
- [x] Topic 2 — Selection model (reuse + removals) — RESOLVED (OQ-4 closed).
- [x] Topic 3 — Structural ops (add/remove/duplicate) — RESOLVED.
- [x] Topic 4 — Editable `name` — RESOLVED (OQ-5 closed).
- [x] Topic 5 — Note labels — RESOLVED (OQ-6 closed).
- [x] Topic 6 — Boundary + carry-overs — RESOLVED.

All six topics resolved; OQ-1…6 resolved; Req/AC self-check below shows no gaps.

## Grounding (live code as read at start)

- **`src/edit.js`** — the mode container. Owns `working` (parsed song or seeded
  `newSong()`), the editor-only `selection` (kind-tagged, not persisted), `mode`,
  and the single `commit` persist path (`commitSong` re-validates then stores the
  raw string). Already lifts the four structural mutators
  (`onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure` + `onAddNote`)
  as the single owner of `working`+`commit`. Renders `SongCanvas` then
  `InspectorControls` (`SongPanel`, the right-sidebar `StructureList`, then the
  kind-gated `NotePanel`/`MeasurePanel`/`SectionPanel`).
- **`src/editor/selection.js`** — pure selection helpers. `resolveSelection(song,
  selection)` walks section→measure→event by `kind`, returning the live resolved
  object or `null` when stale. `measureCoords`/`globalMeasureNumber`/
  `measureNumbersForSection`/`selectionQuery` bridge a selection to the SVG's
  emitted `data-measure`/`data-hand`/`data-event-index` hooks.
- **`src/editor/SongCanvas.js`** — interactive canvas. `selectionFromTarget`
  (canvas click→selection) and the click/keydown listeners + the editor-only
  `interactive: true` hit-rect are the canvas click-to-select to be REMOVED.
  `decorateSelection` (kind-branched: `is-selected`/`is-active-measure`/
  `is-active-section`) is REUSED for tree-driven highlight.
- **`src/editor/songModel.js`** — factories (`newNote`/`newMeasure`/`newSection`/
  `newSong`/`newPitch`) + array helpers (`insertAt`/`removeAt`/`replaceAt`). The
  conformant-by-construction substrate for add/duplicate.
- **`src/editor/inspector/StructureList.js`** — Review-2 right-sidebar Structure
  list (sections→measures + Add note). To be REMOVED, superseded by the left tree.
- **`src/song/schema.js`** — schema-as-data, `additionalProperties` permissive
  everywhere; `language` is the precedent for an additive optional enum. `name`
  is added here (optional `string` on `section` and `measure`).
- **`src/editor/noteNames.js`** — `inferNoteNameSystem` + `SYSTEMS` (english/
  spanish) + `noteNameOptions`/`stepInSystem`. The per-song `system` already
  threads through the panels; note labels reuse it.
- **`src/editor/inspector/NotePanel.js` / `MeasurePanel.js` / `SectionPanel.js`**
  — kind-gated right-inspector panels (KEPT; rename affordance added to Section/
  Measure panels per Topic 4).

## Topics

### Topic 1 — Left structure-tree panel: layout, toggle, component, node identity

**Frame.** The block's editor area must show a toggleable structure tree to the
*left of the canvas* (within the block, not the editor's global List View),
Section → Measure → {Right hand, Left hand} → Note, sections/measures
expand/collapsible, as the primary selection surface. (Req 1–3, AC1, AC3; WP-only
Req 16/AC13.)

**Evidence (researcher, r3).**
- `edit.js:256-352` returns `<div {...useBlockProps()}>` wrapping `<SongCanvas>`
  then `<InspectorControls>`. `InspectorControls` portals to Gutenberg's GLOBAL
  right sidebar — it is NOT inline. So the in-block editor area today is just the
  canvas, and the left tree must be a sibling of `<SongCanvas>` inside the block
  wrapper.
- Canvas click handler calls `clickEvent.stopPropagation()` (`SongCanvas.js:335-337`)
  to keep the block selected; a left-panel sibling of `Button`s does not interfere.
- Block already depends only on `@wordpress/{components,block-editor,element,i18n,
  blocks,dom-ready}` (grep of `src/`). `node_modules` not installed in the worktree,
  so package introspection is from API knowledge (flagged for pinning where load-bearing).

**Decisions.**

1. **Layout: a plain styled flex row inside the block wrapper.** Wrap the visual
   branch's canvas + new tree in a `…__workspace` flex `<div>` (tree left, canvas
   right), styled in `style.scss` alongside the existing `&__canvas` rules
   (`style.scss:40-44`). No `@wordpress/*` layout primitive needed — the block
   already hand-rolls its canvas CSS, and the SVG host's `min-width:280px;
   overflow-x:auto` (`style.scss:49-51`) already scrolls a wide score, which
   survives being a flex child. *Rationale:* matches the codebase's existing
   hand-rolled-CSS idiom; minimal surface; WP-only. (Req 1, 16.) *Narrow-width
   behavior deferred to follow-up Q (see Open Questions).* 

2. **Toggle: a second `ToolbarButton` in the existing `BlockControls`
   `ToolbarGroup`** (`edit.js:258-269`), mirroring the "Edit as JSON" button, with
   `isActive` bound to an editor-only `showTree` `useState` (same pattern as
   `mode`/`selection`, `edit.js:90-95`; never persisted). *Rationale:* idiomatic,
   keyboard-reachable via the block toolbar, consistent with the existing toggle.
   (Req 1, AC1.)

3. **Tree component: `__experimentalTreeGrid` from `@wordpress/components`
   (RECOMMENDED).** *(Reversed from an initial hand-built-tree lean once the
   researcher verified the TreeGrid API against Gutenberg `trunk` — authoritative
   source — and the keyboard-model trade-off resolved decisively in TreeGrid's
   favor.)* Verified exports (Gutenberg `packages/components/src/index.ts`):
   `__experimentalTreeGrid`, `__experimentalTreeGridRow`, `__experimentalTreeGridCell`,
   `__experimentalTreeGridItem` (there is NO non-experimental `TreeGrid`).
   - **It is the same primitive Gutenberg's List View is built on**
     (`block-editor/src/components/list-view/index.js` imports
     `__experimentalTreeGrid as TreeGrid`), so the block's tree behaves *like* the
     List View the spec compares it to (spec line 5) — the closest match to the
     stated mental model — WITHOUT being the global List View (out of scope).
   - **`@wordpress/components` only** (Req 16/AC13); experimental WP APIs are already
     precedented here (`__experimentalToolsPanel`/`__experimentalToolsPanelItem`/
     `__experimentalNumberControl` across every inspector panel,
     e.g. `NotePanel.js:29-33`, `SongPanel.js:23-29`).
   - **Free accessible treegrid keyboard model** — roving tabindex, Up/Down between
     rows, Left/Right (collapse/expand + move between focusables), `aria-level`/
     `aria-posinset`/`aria-setsize`/`aria-expanded` derived from the row props. This
     *resolves* the keyboard-model dilemma (gap A): no dishonest `role="tree"` and no
     hand-rolled arrow-key logic.
   - **Props/contract:** `__experimentalTreeGrid` renders `<table role="treegrid">`
     with callbacks `onFocusRow(event,startRow,destRow)`, `onExpandRow(row)`,
     `onCollapseRow(row)` (consumer owns the state change). `__experimentalTreeGridRow`
     (`<tr role="row">`) requires `level` (1-based), `positionInSet` (1-based),
     `setSize`; optional `isExpanded`→`aria-expanded`. `__experimentalTreeGridCell`
     (`<td role="gridcell">`) is a render-prop: `children={(props)=>…}` spread onto
     the one focusable child (a `Button`) for roving tabindex;
     `__experimentalTreeGridItem` for multiple focusables in one cell (the per-row
     add/remove/duplicate action buttons).
   - **Cost/trade-off:** it is `__experimental` (accepted precedent) and table-shaped,
     so row-action buttons live in `TreeGridCell`/`TreeGridItem` render-props — more
     ceremony than plain `Button` rows. *Decision: TreeGrid*, because the spec
     explicitly invokes the List-View model and the block already depends on
     experimental WP components. (Req 1–2, 16; AC1, AC13.)
   - **Documented fallback + its a11y rule (W3C-grounded).** If the plan instead
     hand-rolls from `Button`s (mirroring `StructureList`/`AnnotationList`), it MUST
     use **disclosure (`aria-expanded`) + list (`<ul>/<li>` or `role="list"/
     "listitem"`) semantics, and MUST NOT claim `role="tree"`** — per the W3C ARIA
     APG, `role="tree"` *obliges* the full arrow-key model (Up/Down between visible
     nodes, Right=expand/first-child, Left=collapse/parent, single roving tabindex),
     and a `role="tree"` without it is worse than not claiming it (ATs announce
     "tree" then the documented keys don't respond). The Disclosure pattern requires
     only Enter/Space toggle — native `Button` behavior, each its own tab stop, zero
     custom key handling — which is exactly the existing `StructureList` baseline and
     suffices for AC1 (expand/collapse) + AC2 (select). `aria-level`/`-setsize`/
     `-posinset` may be added descriptively without obliging the arrow-key model. In
     short: the only honest way to get the *full* tree keyboard model is TreeGrid
     (our choice); the hand-rolled fallback ships disclosure+list semantics, not a
     bare `role="tree"`. Both are `@wordpress/*`-only.

4. **Tree row model.** Flatten `working.sections` to an ordered list of *visible*
   rows (respecting `isExpanded` — manual Set ORed with selection-ancestors, see
   decision 6), each a `TreeGridRow` with computed `level`/`positionInSet`/`setSize`:
   - level 1 = Section rows; level 2 = Measure rows (under an expanded section);
     level 3 = the two fixed hand-group rows Right/Left hand (under an expanded
     measure); level 4 = Note/rest leaves (under a hand group).
   - First `TreeGridCell` holds the select `Button` (label = `name`-or-positional for
     section/measure, pitch-label for a note — Topics 4/5); trailing
     `TreeGridCell`/`TreeGridItem`s hold add/remove/duplicate `Button`s.
   - `onExpandRow`/`onCollapseRow` read the row's `data-path` and toggle the
     expanded-path Set. Selecting a row calls the same `setSelection` with the
     kind-tagged tuple → `decorateSelection` highlights the canvas unchanged.

5. **Keyboard model (gap A — RESOLVED by TreeGrid).** No hand-rolled keyboard logic
   and no `role`-honesty problem: TreeGrid supplies the full `role="treegrid"`
   roving-tabindex + arrow expand/collapse model, satisfying AC1 (expand/collapse) and
   AC2 (select) with WP's own accessible primitive. Hand-group rows appear in the tree
   for hierarchy but are non-selecting (Topic 2, OQ-4).

6. **Node identity / expansion state (gap B).** The format has **no stable ids** —
   `StructureList` keys purely by array index (`StructureList.js:78,112`) and the
   selection model is itself index-coordinate-based (`{sectionIndex, measureIndex,
   hand, eventIndex}`). So **index-path keys** are the natural, correct scheme: a node
   id `"s0"` / `"s0/m1"` / `"s0/m1/rightHand"` / `"s0/m1/rightHand/e2"` doubles as the
   React `key`, the row `data-path`, and (parsed) the selection tuple. Expansion state
   = a `useState` **Set of expanded index-path strings** (editor-only, not persisted,
   like `mode`/`selection`). Index-paths are positional and shift on
   insert/remove/duplicate — the SAME staleness the selection already tolerates
   (`resolveSelection` re-resolves and drops a stale selection each render,
   `selection.js:116-171`; remove handlers proactively clear stale selections,
   `edit.js:212-214,248-253`). *Decision (refined per researcher, W3C/code-grounded):*
   keep a small **`useState` Set of expanded index-path strings for MANUAL toggles**,
   and **layer auto-expand of the current selection's ancestors on top** — derive
   "expanded" as `isExpanded(path) = set.has(path) || path is an ancestor of the
   resolved selection`. The ancestor indices come straight off `resolveSelection`
   (`selection.js:135-170`) each render, so the selected branch is ALWAYS revealed
   with NO stored state to go stale — this makes the manual Set far less load-bearing
   and absorbs the index-shift problem for the important case. Best-effort staleness on
   the manual Set is then acceptable (matches the selection model; reordering is out of
   scope). The optional index-shift remap becomes unnecessary given auto-expand and is
   dropped. Synthesizing stable ids in working state is rejected (it fights the
   single-string, conformant-by-construction, only-`name`-added design). *Cost:*
   trivial — a `Set<string>` + an `isExpanded` that ORs membership with
   ancestor-of-selection; no new dependency. (Req 1.)

7. **Narrow width (gap C).** `&__workspace { display:flex; gap:1em; align-items:
   flex-start }`; the tree column is fixed-ish (`flex:0 0 auto; width:16em;
   min-width:12em; max-width:40%` so it stays readable but never eats the row); the
   canvas column gets `flex:1 1 auto;` **and the load-bearing `min-width:0`** — a flex
   item defaults to `min-width:auto` and would refuse to shrink below its content,
   pushing the tree out; `min-width:0` lets it shrink so the SVG host's existing
   `min-width:280px; overflow-x:auto` (`style.scss:49-51`) engages and the score
   scrolls horizontally rather than crushing the tree. The **toolbar toggle is the
   intended escape hatch** for very tight widths (collapse the tree to reclaim canvas
   — Req 1 "toggleable"); a media-query stack-to-vertical (`flex-direction:column`) is
   optional polish, not spec-required — left out of the committed design. (Req 1.)

**Topic 1 — fully resolved.** All three follow-up gaps (A keyboard, B identity/
expansion, C narrow width) closed by the evidence above.

### Topic 2 — Selection model: reuse + removals

**Frame.** The tree becomes the primary selection surface; canvas click-to-select
is removed (canvas = display + highlight only); the right-sidebar StructureList is
removed. Reuse the existing kind-tagged `selection` + `resolveSelection` +
`decorateSelection`. (Req 2–5, 13; AC2, AC3.)

**Evidence (researcher r3, verified first-hand by analyst).**
- `decorateSelection` (`SongCanvas.js:180-229`) is a pure function of
  `(container, selection, song)` branching only on `selection.kind` — no dependency
  on how the selection was produced. A tree-node click calling the same
  `setSelection` lights the canvas identically. The CSS classes `is-selected`/
  `is-active-measure`/`is-active-section` already exist (`style.scss:55-73`).
- Selection shape is already kind-tagged and tree-ready: `resolveSelection`
  (`selection.js:116-171`) accepts `{kind, sectionIndex, measureIndex?, hand?,
  eventIndex?}` and StructureList already emits `{kind:"section",…}` /
  `{kind:"measure",…}` (`StructureList.js:82,117-121`); a tree note node emits the
  full event tuple, the same shape `selectionFromTarget` produced.
- **Verified (analyst):** the selection-decoration data hooks `data-measure`,
  `data-hand`, `data-event-index`, `data-kind` are emitted UNCONDITIONALLY
  (`svg.js:571,721-722,765-766,911-913`); the editor-only hit-rect is gated solely
  on the `interactive` flag (`svg.js:771-772,918-919`). So removing click-to-select
  does NOT touch the highlight path.

**Decisions.**

1. **Reuse the selection substrate unchanged.** `selection` (editor-only useState,
   `edit.js:95`), `resolveSelection`, `decorateSelection`, and the `selection.js`
   coord helpers (`measureCoords`/`globalMeasureNumber`/`measureNumbersForSection`/
   `selectionQuery`) are all KEPT and drive the tree-driven highlight + the
   kind-gated right-inspector panels exactly as today. The tree emits the same
   kind-tagged tuples StructureList emits, plus the event tuple for note nodes.
   (Req 2, 4, 5; AC2.)

2. **Remove canvas click-to-select.** Delete from `SongCanvas.js`:
   `selectionFromTarget` (`:102-130`), the click/keydown native listeners and
   `activateRef`/`onSelect` plumbing (`:319-359,319-322`), and `makeEventsFocusable`
   (`:140-148`, called `:281`) which becomes dead (events no longer activatable).
   `SongCanvas` keeps the draw effect + resize observer + `decorateSelection`. The
   `onSelect` prop is dropped from the canvas; `edit.js` no longer passes it. (Req 3;
   AC3.)

3. **`interactive` hit-rect — minimal revert (RECOMMENDED), with full revert as
   optional cleanup.** With click-to-select gone there are NO hit-rect consumers.
   *Minimal:* stop passing `interactive:true` at the call site (`SongCanvas.js:276`
   → `{accessibleName}` only). The flag defaults to `false` (`svg.js:284`), so the
   editor SVG becomes byte-identical to the front end; svg.js is untouched and the
   dead-but-defaulted `interactive`/`hitRect`/`HIT_RECT_*` simply never fire. *Full
   revert (svg.js untouched again):* additionally delete `hitRect` (`svg.js:251-261`),
   `HIT_RECT_WIDTH_SP` (`:65`), the `interactive` param threading throughout, and the
   `HIT_RECT_VERTICAL_MARGIN_SP` import (`:34`) + constant (`constants.js:27-34`) —
   touches many signatures AND requires deleting/updating the hit-rect tests
   (`svg.test.js:986-1044` "editor-only per-event hit-rect", plus refs in
   `SongCanvas.test.js`/`Edit.test.js`). *Decision:* default to the **minimal revert**
   (smaller diff, zero front-end risk, the spec's "ideally revert so svg.js is
   untouched" is satisfied behaviorally since the front end never set the flag);
   note full revert as optional cleanup the plan may include if it wants the
   editor-only param physically gone. Both satisfy "front end unchanged" (Req 12,
   AC10) since `view.js` never set `interactive`. *(See Risk R-2.)*

4. **Remove the right-sidebar StructureList.** Delete `inspector/StructureList.js`
   (import `edit.js:20`, render `edit.js:306-315`) and its test
   `__tests__/StructureList.test.js`. Its lifted handlers move to driving the tree.
   (Req 13.)

5. **Hand-group nodes are organizational, not selectable.** Right hand / Left hand
   group nodes under a measure exist to organize the two event lists and host the
   "add note to this hand" action; they are NOT a selectable `selection.kind` (the
   schema/selection model has no "hand" selection — only section/measure/event).
   Selecting them would have no inspector panel and no canvas decoration. *Decision:*
   hand groups render as non-selecting labels (a static row or a disclosure-only
   row) that carry the per-hand "Add note" affordance; only section/measure/note
   rows drive `setSelection`. *(Resolved — OQ-4: no "hand" selection kind exists.)*

### Topic 3 — Structural ops: add / remove / duplicate at every level

**Frame.** Add, remove, and **duplicate** at section / measure / note level, from
the tree; duplicate = deep copy inserted immediately after the original;
conformant by construction; reordering out of scope. (Req 6–8, 14; AC4–AC6, AC11.)

**Evidence (researcher r3).**
- `edit.js` already lifts the mutators as the single owner of `working`+`commit`:
  `commit` (`:158`), `onAddNote` (`:164`, already inserts-after-selection via
  `insertAt(events, eventIndex+1, …)`), `onAddSection` (`:194`), `onRemoveSection`
  (`:207`), `onAddMeasure` (`:220`), `onRemoveMeasure` (`:238`). Each is an immutable
  `.map`+`insertAt`/`removeAt` then `commit(next)` (which serializes+revalidates,
  `serializeSong.js:40-53`).
- Factories + helpers in `songModel.js`: `newSection`/`newMeasure`/`newNote`/
  `newPitch`; `insertAt`/`removeAt`/`replaceAt` (pure, immutable slice+splice).
- A section/measure/note is plain JSON (everything round-trips through
  `JSON.stringify`, `serializeSong.js:28`) — so a deep copy is `structuredClone`
  (standard global, no `@wordpress/*` — satisfies AC13) or `JSON.parse(JSON
  .stringify(…))`.
- Note-level remove currently lives in `NotePanel.removeEvent` (`NotePanel.js:129-145`,
  drops the hand key when the list empties).

**Decisions.**

1. **Add `duplicateAt` to `songModel.js`** alongside the array helpers:
   `duplicateAt(list, index) => insertAt(list, index + 1, structuredClone(list[index]))`.
   Pure, immutable, deep, dependency-free. A deep copy of a conformant fragment is
   conformant (covers a section's measures/notes + its `name`; a measure's both
   hands + its `name`; a note's pitches/props — Req 7). (AC6, AC11.)

2. **Three duplicate handlers in `edit.js`**, mirroring the three add handlers:
   `onDuplicateSection(si)`, `onDuplicateMeasure(si, mi)`, `onDuplicateNote(si, mi,
   hand, ei)` — same immutable `.map` splice pattern, using `duplicateAt`/index+1.
   Optionally select the new copy (mirrors `onAddNote` auto-selecting the inserted
   note, `edit.js:183`). (AC6.)

3. **Lift note-level remove to `edit.js`** as `onRemoveNote(si, mi, hand, ei)`,
   mirroring `NotePanel.removeEvent` (drop the hand key when the list empties), so
   the tree can remove notes directly (the NotePanel's own Remove can call the same
   lifted handler). Add (`onAddNote`) and section/measure add+remove already exist
   and are reused. (Req 6; AC4, AC5.)

4. **Conformant by construction holds for free.** Every op routes through `commit`
   → `commitSong` which re-validates and refuses a non-conformant string
   (`serializeSong.js:40-52`) — AC11 is structurally enforced regardless of which
   surface drives the edit. Reordering is deliberately absent (Req 8).

### Topic 4 — Editable, persisted `name` on sections + measures

**Frame.** Add an additive, optional `name` to sections and measures; the tree
shows it with a positional fallback ("Section 1"/"Measure 1"); editable from the
editor; round-trips through raw JSON; default-by-absence. (Req 9, 11; AC7, AC10.)

**Evidence (researcher r3, verified first-hand by analyst).**
- `schema.js` `$defs.section` (`:63-76`) has `required:["measures"]`; `$defs.measure`
  (`:78-94`) has no `required`. The walker only inspects DECLARED properties and
  **ignores unknown keys** (verified: `validate.js:191-198`), so even today a `name`
  round-trips permissively; declaring it documents it + gives a type error on a
  non-string. Exact precedent: the optional `language` field (`schema.js:40-44`,
  "permissive and optional").
- `render.php` does NO parsing — it escapes `<`→`&lt;` and emits the raw `song`
  verbatim in an inert `<script type="application/json">`; the front end never reads
  `name`. So AC10 ("front-end identical") holds trivially. (Req 12.)
- Panels' optional-key-drop idiom: `emitBlock` (`inspector/emit.js:21-28`) sets a
  key or `delete`s it when empty; Section/Measure panels emit the whole song via
  `emitSection`/`emitMeasure` and already drop unset keys.

**Decisions.**

1. **Schema:** add `name: { type: "string" }` to `$defs.section.properties`
   (`schema.js:63-76`) and `$defs.measure.properties` (`:78-94`); `required`
   unchanged (optional). Permissive + additive, mirroring `language`. (Req 11; AC10.)
   Extend `schema.test.js`/`validate.test.js` with a `name` round-trips/validates case.

2. **Rename affordance: a `TextControl name` field in the Section and Measure
   inspector panels (RECOMMENDED primary).** Slots into `SectionPanel`
   (emit via `emitSection`, dropping the key when blank per the `emitBlock` idiom)
   and `MeasurePanel` (via `emitMeasure`). Pure `@wordpress/components`. *Rationale:*
   the inspector is already the "configure" surface (the tree selects, the inspector
   configures — Req 5); a `TextControl` here is minimal, consistent, and avoids
   building inline-tree-edit keyboard plumbing. Inline-in-tree rename is a possible
   secondary affordance but is NOT required by the spec (Req 9 leaves it open) — kept
   out of this review. *(Resolved — OQ-5: inspector-only is sufficient for AC7.)*
   (Req 9; AC7.)

3. **Tree label = `name` when set, else positional fallback.** `section.name ||
   sprintf("Section %d", n)`; `measure.name || sprintf("Measure %d", n)` — the same
   `sprintf` ordinals StructureList already builds (`StructureList.js:84-88,124-128`).
   Blank/absent `name` ⇒ fallback (default-by-absence). (Req 9; AC7.)

### Topic 5 — Note labels in the tree

**Frame.** A note node is labeled by pitch name in the song's note-name language;
a chord shows its pitches; a rest shows "rest". (Req 10; AC8.)

**Evidence (researcher r3).**
- Current language: `system = working?.language ?? inferNoteNameSystem(working)`
  (`edit.js:138-141`). `noteNames.js` exports `SYSTEMS` (`:34-37`,
  english `C…B` / spanish `do…si`) and `stepInSystem(step, system)` (`:131-136`,
  canonicalizes any stored `step` and re-spells into the target system, idempotent).
- A rest is `event.type === "rest"` (no pitches); a note is `type === "note"` with a
  non-empty `pitches` array (`newNote` `songModel.js:139`; invariant `validate.js
  :209-235`).

**Decisions.**

1. **A net-new thin label helper** (in `noteNames.js` or a small `noteLabel.js`),
   reusing `stepInSystem`: `event.type === "rest"` → `__("rest","piano-block")`;
   else `event.pitches.map(p => stepInSystem(p.step, system)).join(" ")`. Passing
   every stored `step` through `stepInSystem` guarantees a consistent label
   regardless of the stored spelling. The per-song `system` is already threaded into
   `edit.js`; pass it to the tree. (Req 10; AC8.) *Resolved — OQ-6: pitch-name(s)
   only, NO octave (AC8 doesn't mention octave); octave is optional later polish.*
   Only `@wordpress/*` dep is `__` for "rest".

### Topic 6 — Boundary, dependencies, carry-overs

**Frame.** Schema change ONLY for `name`; `render.php`/front-end SVG unchanged;
preserve the note-language selector, raw-JSON editing + non-blocking validation,
conformant-by-construction, progressive disclosure, live re-render, WP-only deps;
StructureList removal. (Req 12–16; AC10, AC12, AC13.)

**Evidence (researcher r3, key points verified first-hand).**
- Only schema delta is `name` (Topic 4). `render.php` emits the raw song verbatim;
  front-end SVG is byte-identical (the `interactive` flag was never set by `view.js`,
  and the minimal-revert drop makes the editor SVG identical too). (Req 12; AC10.)
- Carry-overs intact in current code: note-language selector in `SongPanel`
  (`SongPanel.js:166-172` via `mapSong`); raw-JSON toggle + non-blocking validation
  (`edit.js:99-102,258-288`); live re-render via the canvas `useEffect` on
  `[song, selection, accessibleName]` (`SongCanvas.js:261-288`); progressive
  disclosure via `__experimentalToolsPanel` in every panel; conformant-by-construction
  via `commitSong` (`serializeSong.js:40-52`). (Req 14, 15.)
- WP-only deps: `@wordpress/{components,block-editor,element,i18n,…}` only;
  `structuredClone` is a standard global, not a dependency. (Req 16; AC13.)

**Decisions.** No new runtime dependency; schema delta is `name` only; `render.php`
and `view.js`/svg.js emit path untouched (minimal-revert keeps svg.js byte-stable);
all listed carry-overs preserved by reuse, not reimplementation. The removed surfaces
(canvas click-to-select, StructureList) are editor-only and have no front-end effect.

## Open Questions

- **OQ-1 (Topic 1, narrow width) — RESOLVED.** Tree `flex:0 0 16em`+min-width,
  canvas `flex:1; min-width:0` (existing `overflow-x:auto` scrolls); the toggle is
  the escape hatch. (See Topic 1 decision 7.)
- **OQ-2 (Topic 1, keyboard) — RESOLVED.** `__experimentalTreeGrid` supplies the full
  accessible treegrid keyboard model; no hand-rolled logic. (Topic 1 decisions 3, 5.)
- **OQ-3 (Topic 1, identity) — RESOLVED.** Index-path keys + an editor-only
  manual expanded-path Set, **layered with auto-expand of the selection's ancestors**
  (derived off `resolveSelection`, no stored state), so the selected branch is always
  revealed and index-shift staleness stops mattering for the key case. (Topic 1
  decision 6.)
- **OQ-4 (Topic 2, hand groups) — RESOLVED (analyst, code-grounded; researcher
  concurs in substance).** Hand-group rows are organizational + non-selecting: they
  host the per-hand "Add note" and toggle expansion only. The selection model has
  ONLY `section`/`measure`/`event` kinds (verified `selection.js:139-170`) — there is
  no "hand" kind, no inspector panel, and no canvas decoration for a hand, so making
  hand rows selectable would have nothing to select into. Confirmed nothing is being
  ignored. (Req 1.)
- **OQ-5 (Topic 4, rename affordance) — RESOLVED (analyst, spec-grounded).**
  Inspector-only `TextControl name` (Section + Measure panels) is the primary and sole
  rename affordance for this review. Spec Req 9 explicitly leaves the affordance open
  ("inline in the tree **and/or** a Name field in the Section/Measure panel"), so
  inspector-only satisfies AC7; it avoids inline-edit keyboard plumbing inside TreeGrid
  cells. Inline-tree rename is possible future polish, not required. (Req 9; AC7.)
- **OQ-6 (Topic 5, note label) — RESOLVED (analyst, spec-grounded).** Pitch-name(s)
  only, no octave. Spec AC8 says "labeled by its pitch name … a chord shows its
  pitches" with no mention of octave; a compact pitch-name label meets AC8. Octave is
  optional polish that can be added later if disambiguation proves necessary. (AC8.)

## Risks

- **R-1 (TreeGrid pinning):** `node_modules` is not installed in this worktree, so
  the chosen `__experimentalTreeGrid` API (exports, row props, callbacks, a11y) was
  verified against Gutenberg `trunk` (authoritative source) rather than the installed
  build. The block consumes `@wordpress/components`/`@wordpress/block-editor` as
  WordPress-runtime externals (NOT `package.json` deps; `block.json` `apiVersion:3`,
  `.wp-env.json` `core:null`=latest WP), and `__experimentalTreeGrid` has shipped in
  WP core for years, so it is available to blocks. *Mitigation:* the API is stable and
  is what List View itself uses; experimental WP APIs are already a precedented
  dependency here. If the plan wants it pinned to a specific WP tag, the researcher can
  fetch that tag. The hand-rolled `role="tree"` fallback remains available if TreeGrid
  proves unsuitable at implementation time (also `@wordpress/*`-only).
- **R-2 (hit-rect tests):** The full svg.js revert would have to delete/update the
  hit-rect tests (`svg.test.js:986-1044`, refs in `SongCanvas.test.js`/`Edit.test.js`).
  The recommended minimal revert avoids that churn but leaves dead-but-defaulted
  `interactive`/`hitRect` code in svg.js; the plan chooses which, both front-end-safe.
- **R-3 (canvas test fallout):** Removing canvas click-to-select
  (`selectionFromTarget` + listeners + `makeEventsFocusable`) invalidates the
  canvas-selection tests in `SongCanvas.test.js`/`Edit.test.js` and the
  `StructureList.test.js` suite (StructureList removed); these must be replaced by
  tree-driven selection/op tests. Tracked for the plan, not a design blocker.

## Self-check — Req/AC coverage

Every spec Requirement (1–16) and Acceptance Criterion (AC1–AC13) maps to a topic
decision. No gap found.

| Spec item | Addressed by | How |
|---|---|---|
| Req 1 (toggleable left tree, hierarchy, expand/collapse) | T1 | Flex `__workspace`; `__experimentalTreeGrid` Section→Measure→Hand→Note row model; toolbar toggle (`showTree`). |
| Req 2 (tree = primary selection surface) | T1, T2 | Tree rows call `setSelection` with kind-tagged tuples; reused `resolveSelection`. |
| Req 3 (canvas click-to-select removed) | T2 | Delete `selectionFromTarget` + listeners + `makeEventsFocusable`; drop `onSelect`. |
| Req 4 (selection → canvas highlight, live) | T2 | Reuse `decorateSelection` (kind-branched) + the canvas draw `useEffect`. |
| Req 5 (selection → right inspector panels) | T2 | Kind-gated `Note/Measure/Section`+always-on `Song` panels unchanged. |
| Req 6 (add/remove/duplicate at every level) | T3 | Reuse add/remove handlers; new `onDuplicate*`; lift `onRemoveNote`. |
| Req 7 (duplicate = deep copy after original, incl. `name`) | T3 | `duplicateAt` via `structuredClone` + `insertAt(index+1)`. |
| Req 8 (no reordering) | T3 | Deliberately absent. |
| Req 9 (editable `name`, positional fallback) | T4 | `TextControl name` in Section/Measure panels; `name||sprintf` tree label. |
| Req 10 (note labels by pitch; chord; rest) | T5 | `stepInSystem` join; `"rest"` for `type==="rest"`. |
| Req 11 (`name` additive/optional/permissive) | T4 | `name:{type:"string"}`, not `required`; permissive walker. |
| Req 12 (boundary: only `name`; render.php/front-end unchanged) | T4, T6 | Schema delta = `name`; `render.php` emits raw song; minimal `interactive` revert. |
| Req 13 (remove right-sidebar StructureList) | T2 | Delete `inspector/StructureList.js` + import/render + test. |
| Req 14 (conformant by construction) | T3, T6 | Every op routes through `commitSong` re-validate guard. |
| Req 15 (carry-overs: language selector, raw-JSON, disclosure, live render) | T6 | Preserved by reuse (`SongPanel`/`mapSong`, JSON mode, `ToolsPanel`, draw effect). |
| Req 16 (WP-only deps) | T1–T6 | `@wordpress/*` only; `structuredClone` is a standard global. |
| AC1 (tree shows hierarchy + toggles) | T1 | TreeGrid rows + expand/collapse + `showTree` toggle. |
| AC2 (select node → highlight + settings) | T2 | `setSelection` → `decorateSelection` + kind-gated panels. |
| AC3 (canvas no longer selects on click) | T2 | Listeners/`selectionFromTarget` removed. |
| AC4 (add at every level) | T3 | `onAddSection/Measure/Note`. |
| AC5 (remove at every level) | T3 | `onRemoveSection/Measure/Note`. |
| AC6 (duplicate = deep copy after) | T3 | `onDuplicate*` + `duplicateAt`. |
| AC7 (rename sections/measures, persisted, round-trips) | T4 | `name` schema + `TextControl` + permissive round-trip. |
| AC8 (note labels: pitch/chord/rest) | T5 | label helper. |
| AC9 (settings edits reflected) | T2 (panels kept) | Unchanged panel `onChange`→`commit`→canvas redraw. |
| AC10 (`name` round-trips/validates; front end unchanged) | T4, T6 | Permissive validate; `render.php` ignores `name`; SVG byte-identical. |
| AC11 (conformant by construction) | T3 | `commitSong` guard. |
| AC12 (raw JSON never blocks saving) | T6 | JSON mode + non-blocking notice unchanged. |
| AC13 (no outside dependencies) | T1, T3, T6 | `@wordpress/*`-only; `structuredClone` standard global. |

**Out-of-scope respected:** canvas click-to-select removed (not re-added);
reordering deferred; front end never consumes `name`/`language`; `render.php`/SVG
emit unchanged; no audio; invalid-song→raw-JSON and large-song perf carried over.
