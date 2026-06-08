# Design Research: Review 1 — Canvas-first editor UI

## Research

### Notation core already exposes interactivity hooks (no core change needed for selection)

`src/notation/svg.js` `renderNote` (lines ~704–711) stamps every note group with identity:

```js
const g = el("g", {
  "data-kind": "note",
  "data-hand": handKey,            // "rightHand" | "leftHand"
  "data-event-index": note.eventIndex,
  id: `${handKey}-note-${note.eventIndex}`,
});
```

These groups are nested under `<g data-measure="<number>">` (`renderMeasure`, ~line 519) and `<g data-system="<index>">` (`renderSystem`, ~line 294). The module's own header (line ~18) states it "stamps a stable id / `data-*` (the event index, hand, kind) on each per-event [group]" and `renderNote`'s doc calls the group "the interactivity hook." So a canvas click can be hit-tested to `[data-kind="note"]` and read `data-hand` + `data-event-index`, with the enclosing `data-measure`. **No change to the shared notation core is required to make notes selectable.**

Caveat: `data-measure` is the **global sequential measure number** (1..N assigned in `buildLayoutModel`'s flatten), not `(sectionIndex, measureIndexWithinSection)`. Mapping the global number back to model coordinates is a design topic (Topic: Selection model).

### Render glue is already a reusable component

`src/editor/SongPreview.js` is thin DOM glue around the core: an effect keyed on the `song` string runs `validateSong` (render-or-nothing gate) → `JSON.parse` → `buildLayoutModel(data, availableWidthInSp(container))` → `renderInto(container, model, { accessibleName })`, with a font-ready gate and a rAF-debounced `ResizeObserver`. The interactive canvas reuses this exact path and adds click hit-testing + a selection highlight.

### Single source of truth + mode container

`src/edit.js` is a thin mode container: editor-only `mode` state (`visual` | `json`), a `BlockControls` toolbar toggle ("Edit as JSON" / "Visual editor"), `errors = validateSong(song)` (memoized; empty string = "no song", never validated), and `onChangeSong = (next) => setAttributes({ song: next })`. The block persists exactly one attribute: `song: string` (`src/block.json`, default `""`). Visual edits parse → mutate → serialize back to the string. Selection and `mode` are editor-only UI state, never persisted.

### Editing primitives are already factored

`src/editor/songModel.js` exports: closed vocabularies (`DURATIONS`, `BEAT_TYPES`, `CLEFS`, `DYNAMICS`, `BARLINES`, `EVENT_TYPES`, `SPAN_STATES`, `PLACEMENTS`, `STAVES`), numeric bounds (`OCTAVE_MIN/MAX`, `ALTER_MIN/MAX`, `OCTAVE_SHIFT_MIN/MAX`, `DOTS_MIN/MAX`, `BEATS_MIN`, `BPM_MIN_EXCLUSIVE`), conformant factories (`newPitch`, `newNote`, `newRest`, `newMeasure`, `newSection`, `newSong`, `newEventAnnotation`, `newStandaloneAnnotation`), and immutable list helpers (`insertAt`, `removeAt`, `moveItem`, `replaceAt`). A test cross-checks values/bounds against the schema so they cannot drift. `src/editor/serializeSong.js` serializes the working object back to the string. These are reused as-is by the canvas add/remove actions and the sidebar controls.

### Existing visual-editor components: reuse vs. drop

- **Reuse (field editors → sidebar panel contents):** `MetadataEditor`, `ContextEditor`, `HandConfigEditor`, `EventEditor`, `PitchEditor`, `PitchList`, `AnnotationEditor`, `AnnotationList`, plus `noteNames.js`, `accessibleName.js`, `serializeSong.js`, `songModel.js`.
- **Drop (drill-down navigation, superseded by canvas + sidebar):** `SongOverview`, `SectionList`, `SectionEditor`, `MeasureList`, `MeasureEditor`, `EventList`, `EventRow`, `Breadcrumb`. (Their per-field controls move into sidebar panels.)
- **`InvalidState`/`EmptyState`:** `InvalidState` (errors + "Edit as JSON") is reused for the non-empty-invalid route; `EmptyState` is replaced by seeding a minimal song (Topic: Empty/seeded song).

### "Block settings" sidebar = `InspectorControls`

`@wordpress/block-editor` exports `InspectorControls`; children render in the editor's right-hand block settings panel for the selected block. `@wordpress/components` provides `ToolsPanel`/`ToolsPanelItem` (the native "show only what's set, reveal the rest from a menu" pattern), `PanelBody` (collapsible sections), `SelectControl`, `__experimentalNumberControl`/`NumberControl`, `TextControl`, `ToggleControl`. All are WP-only (Req 19).

## Topics

### Topic: Overall approach / mental model

- **Spec link:** Req 1–7, 18; AC1.
- **Decision:** Keep `edit.js` as the mode container with the existing JSON toggle untouched; only the *visual* branch changes. The visual branch becomes an **interactive canvas** (the `SongPreview` render path, now click-selectable) coordinated with the block's **`InspectorControls` sidebar** (the settings panels). The `song` string stays the only persisted state; selection is editor-only React state. Reuse the notation core untouched; reuse the existing field editors as panel contents; drop the drill-down navigation components.
- **Rationale:** Maximizes reuse, preserves the single-source-of-truth and editor-only boundary, and matches "canvas-first + block settings." Owner confirmed the shape, then delegated the remaining topics ("go ahead autonomously").

### Topic: Selection model — mapping a canvas click to the song

- **Spec link:** Req 3, 4; AC3.
- **Options:** (1) Read the notation core's already-emitted `data-*` hooks and recompute the section/measure flatten in the editor to map the global `data-measure` number → `(sectionIndex, measureIndex)`. No core change. (2) Add `data-section-index`/`data-measure-index` attributes to the measure group in `svg.js`. Small additive change to the shared core.
- **Trade-offs:** (1) keeps the shared notation core byte-for-byte unchanged (cleanest re: Req 18) at the cost of a tiny editor-side flatten that must mirror `buildLayoutModel`'s ordering. (2) is marginally simpler at the hit-test but mutates the front-end-shared `svg.js` (even if only inert attributes), nudging the editor-only boundary.
- **Decision:** Option (1). A pure editor helper `measureCoords(song)` returns the ordered list of `(sectionIndex, measureIndex)` per global measure number (the same sections→measures walk `buildLayoutModel` does); the click handler reads `target.closest('[data-kind="note"]')` → `data-hand` + `data-event-index`, and `closest('[data-measure]')` → global number → coords. Selection = `{ sectionIndex, measureIndex, hand, eventIndex }`.
- **Rationale:** Zero notation-core change keeps Req 18 airtight; the flatten is trivial and deterministic.

### Topic: Selection highlight on the canvas

- **Spec link:** Req 3, 6; AC3, AC6.
- **Note:** the emitted `id` (`${hand}-note-${eventIndex}`) is **not globally unique** — `eventIndex` resets per measure, so the same id repeats across measures. Do not select by `id`.
- **Decision:** After each `renderInto`, the editor decorates the selected node found by the scoped query `[data-measure="<global>"] [data-hand="<hand>"] [data-event-index="<i>"]`, adding an `is-selected` class (CSS highlight). Pure editor-side post-render decoration; `svg.js` untouched.
- **Rationale:** Editor-only, robust against id collisions, reuses the existing render path unchanged.

### Topic: Sidebar architecture and what shows when

- **Spec link:** Req 4, 5, 6, 8; AC4, AC5.
- **Decision:** `InspectorControls` always renders a **Song** `PanelBody` (metadata + `defaults` context). When an event is selected, three more panels render — **Note**, **Measure**, **Section** — editing the selected event and the measure/section it lives in. Nothing selected → only the Song panel. Section/measure panels operate on the coords derived from the selection (measure = the selected note's measure; section = its section).
- **Rationale:** Directly realizes Req 4–6; reuses `ContextEditor` (Song/Section context), `MetadataEditor`, `EventEditor`/`PitchList`/`AnnotationEditor` (Note), and barline/annotation controls (Measure) as panel bodies.

### Topic: Progressive disclosure of uncommon settings

- **Spec link:** Req 7; AC10.
- **Options:** (1) `ToolsPanel`/`ToolsPanelItem` — the native Gutenberg "show what's set, reveal the rest from a ⋮ menu, reset to clear" pattern. (2) A nested collapsible `PanelBody initialOpen={false}` "Advanced" section. (3) A custom "Show advanced" toggle.
- **Trade-offs:** `ToolsPanel`'s reset/optional semantics fit the song model's **optional** fields exactly (dots default 0, dynamic/tie/slur/crescendo/decrescendo/annotations absent, context overrides absent, alters empty, octaveShift 0) — revealing adds the field, resetting removes it (conformant by construction). It does not fit **required** fields (pitch, duration), which must always show. A plain collapsible mixes required/optional less cleanly.
- **Decision:** Each panel renders its **common, required** controls directly, and groups the **optional/advanced** controls in a `ToolsPanel` whose `ToolsPanelItem`s reveal (add) and reset (remove) the optional field. Default common/advanced partition (design-fixed per Req 7, adjustable):
  - **Song:** common = title, composer, tempo (`bpm`, `beatUnit`), time signature (`beats`, `beatType`); advanced = per-hand `handConfig` (`clef`, `alters`, `octaveShift`).
  - **Note:** common = pitch (`step`, `octave`) + `duration`; advanced = `alter`, `dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`, event annotations, and the note↔rest `type` switch.
  - **Measure:** common = (none shown by default beyond the add/remove action); advanced = `barlineStart`, `barlineEnd`, standalone annotations.
  - **Section:** common = (none by default); advanced = context overrides (`tempo`, `timeSignature`, per-hand `handConfig`), each override independently present/absent.
- **Rationale:** Native Gutenberg UX, and the optional-field reset semantics keep conformance automatic.

### Topic: Empty block → seeded minimal song

- **Spec link:** Req 10, 18; AC2.
- **Options:** (1) Change `block.json`'s `song` default to a seeded minimal JSON. (2) Editor-side seed, **persisted on mount** (`setAttributes` immediately when empty). (3) Editor-side seed, **lazy** — render the seed on the canvas but persist nothing until the first real edit.
- **Trade-offs:** (1) makes the **front end** render a minimal empty-staff song for an untouched block and changes stored data — breaks "empty = render nothing" and the editor-only boundary. (2) is simple but persists a song the author never intentionally created (an inserted-then-abandoned block renders an empty staff on the front end). (3) preserves "empty = nothing" on the front end and the boundary; the only cost is the editor computing a seed object for the empty case.
- **Decision:** Option (3). In the visual branch, the working object is `song.trim() === "" ? newSong() : JSON.parse(song)`; the canvas renders it so an empty block shows an empty grand staff. The attribute stays `""` until the author's first edit (add a note / change a setting), which serializes the working object and persists it.
- **Rationale:** Satisfies AC2 without touching the front end or storing an unintended song; respects Req 18.

### Topic: Adding notes on the canvas

- **Spec link:** Req 9, 11; AC8.
- **Options:** (1) A per-hand "add note" affordance on each measure (e.g. a "+" target at the hand's measure end); clicking appends `newNote()` (default C4 quarter) to that hand and selects it for tuning in the sidebar. (2) Click an empty staff position to place a note at the pitch implied by the Y (inverse pitch mapping). (3) A toolbar "insert note" acting on the selected hand.
- **Trade-offs:** (1) is simplest, conformant by construction (reuses `newNote`), and makes "hand = which staff" literal; the author sets exact pitch in the sidebar. (2) is more fluid but needs a Y→pitch inverse the core doesn't expose, raises clef/ledger ambiguity, and edges toward musical assumptions — more code, more risk. (3) loses the canvas/staff directness.
- **Decision:** Option (1) for v1: each hand of each measure exposes a canvas add affordance; clicking appends a default note to that hand (insert after the selected event if one is selected in that hand, else append) and selects it. Y→pitch click-to-place is a future refinement (logged as a risk/open question).
- **Rationale:** Meets Req 9 / AC8 with minimal complexity and guaranteed conformance.

### Topic: Add/remove structure (measures, sections, pitches) and reordering

- **Spec link:** Req 11, 12; AC9.
- **Decision:**
  - **Add measure:** canvas affordance at the score end (and contextually after the selected note's measure). **Remove measure:** from the Measure sidebar panel.
  - **Add/remove section:** from the Section sidebar panel (sections have no canvas selection in v1, so the canvas has no natural anchor — placed in the sidebar per Req 11's allowance).
  - **Add/remove pitch (chord):** from the Note panel's reused `PitchList` (the note invariant — ≥1 pitch — is enforced: the last pitch can't be removed; switching to rest drops pitches).
  - **Remove note:** from the Note panel (and Delete/Backspace on the canvas selection).
  - **Reorder:** **omitted in v1.** Req 12 makes it optional and the owner asked to drop it if it complicates; leaving it out removes the move-up/down controls at every level and the associated edge cases.
- **Rationale:** Keeps the common add path on the canvas (soft preference), puts low-frequency structural ops where they have a home, and trims reorder to reduce complexity.

### Topic: Edit data flow and the conformance guard

- **Spec link:** Req 11, 13, 18; AC6, AC11.
- **Decision:** Every edit: derive the working object (`newSong()` if empty else `JSON.parse(song)`) → apply an immutable update with `songModel` helpers / factories → `serializeSong` → run `validateSong` as a defensive guard → `setAttributes({ song })`. The canvas re-renders from the new string (reusing `SongPreview`'s effect), then re-applies the selection decoration. Constrained controls (closed vocabularies + numeric bounds from `songModel`) make non-conformant output unreachable; the guard is cheap insurance.
- **Rationale:** Carries over the base feature's conformant-by-construction model and single-source-of-truth; the canvas live-updates per AC6.

### Topic: Selection lifecycle / invalidation

- **Spec link:** Req 4, 6, 16.
- **Decision:** On each render, resolve the selection coords against the current working object; if they no longer point at an event (e.g. after removing the measure, undo/redo, or a raw-JSON edit), clear the selection so the sidebar falls back to Song-only. Switching to JSON mode clears the selection.
- **Rationale:** Prevents editing a non-existent event and keeps the sidebar consistent with the canvas.

### Topic: Non-empty invalid / empty handling

- **Spec link:** Req 16, 17; AC13, AC15.
- **Decision:** Reuse `InvalidState` for a non-empty invalid song in the visual branch (show `validateSong` errors + an "Edit as JSON" button that flips `mode` to `json`); the empty case is the seeded canvas (Topic: Empty block). The raw-JSON surface keeps its non-blocking validation unchanged.
- **Rationale:** Direct realization of AC13/AC15, reusing existing components.

### Topic: Canvas selection accessibility

- **Spec link:** Req 19 (WP conventions imply accessibility); AC3.
- **Decision:** The editor decorates note groups post-render (editor-only, `svg.js` untouched) with `tabindex="0"`, `role="button"`, and an `aria-label` (pitch/duration/hand), and wires keydown so Enter/Space selects a focused note. Pointer click also selects. The sidebar controls are natively keyboard-accessible. Full arrow-key traversal between notes is a refinement (Open Questions).
- **Rationale:** Provides a baseline keyboard path to selection without touching the front-end render.

## Open Questions

- **Y→pitch click-to-place** for adding notes at an exact staff position (richer than the default-note + sidebar-tune flow) — deferred; needs an inverse pitch/clef mapping the core doesn't expose.
- **Full keyboard traversal of the canvas** (arrow keys to move selection note-to-note, across hands/measures/systems) — baseline is focus+Enter to select; richer traversal is a refinement.
- **Reaching a measure/section with zero events** — with direct measure/section selection deferred (spec Out-of-Scope 9) and selection driven by events, a measure containing no events is only reachable after adding a note to it. The seeded song's first (empty) measure is reachable via its add-note affordance; this is acceptable for v1.
- **Multi-note / range selection** — v1 is single-event selection only.

## Risks

- **Editor-side flatten must mirror `buildLayoutModel`'s measure ordering** — if the core's sections→measures walk ever changes, `measureCoords` must track it. Mitigated by both deriving from the same `song.sections[].measures[]` order; a unit test should pin the mapping.
- **Full re-render + re-decoration per edit** — reuses `SongPreview`'s whole-SVG redraw on every change. Fine for typical songs; large-song performance is out of scope (spec Out-of-Scope 7). Debouncing is a future option.
- **Selection decoration races the async font-gated first draw** — `SongPreview` gates the first paint on the music font; the selection decoration must run after each actual draw (hook into the same effect), not before.
- **`InspectorControls` visibility requires the block to be selected** — the sidebar panels only show when the Piano block is the selected block in the editor; selecting a note must not deselect the block. The note click is handled inside the block without bubbling to a block-deselect.
