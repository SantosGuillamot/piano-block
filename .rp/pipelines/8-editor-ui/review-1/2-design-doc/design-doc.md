# Design Doc: Review 1 — Canvas-first editor UI for the Piano block

## Overview

The Piano block stores one song as a JSON string (the block's `song` attribute) and renders it as grand-staff sheet music. An earlier iteration added a visual editor as an on-canvas **drill-down** of nested panels (song → section → measure → event → pitch) beside a separate read-only preview. This review replaces that with a **Gutenberg-native, canvas-first** editor: the rendered sheet-music canvas becomes the single interactive surface, the author **selects a note (or rest) on the staff**, and the block's **right-hand settings sidebar** (`InspectorControls`) shows the settings for that note and for the **measure** and **section** it lives in. A always-present **Song** panel holds song-level settings. Uncommon settings hide behind progressive disclosure. Notes are added directly on the canvas, on whichever staff (right/left hand) they are added to. **Raw-JSON editing stays** behind the existing mode toggle.

This is **editor-only**: the song schema, `render.php`, the front-end render, and the shared notation core are unchanged; a visually-edited song renders identically to the same song authored in raw JSON. The `song` string remains the single source of truth — selection and edit mode are editor-only React state. The design maximizes reuse: the notation core already emits per-note identity hooks, the render glue and the editing primitives (vocabularies, factories, list helpers, field controls) already exist; what is new is the canvas selection layer and the relocation of settings into the inspector sidebar. Traces to the spec's Requirements (1–19) and Acceptance Criteria (AC1–AC17).

## Approach

The mental model is **one canonical string, an interactive rendering of it, and a sidebar of settings for the current selection**:

- The block's `song` **string attribute stays the only persisted state.** The visual branch derives a working object (`JSON.parse`, or a seeded `newSong()` when the string is empty), and every edit serializes a fresh object back via `setAttributes({ song })`. Visual and raw modes can never disagree; WordPress block undo/redo and external edits work without custom synchronization (Req 2, 18; AC12).
- `edit.js` stays a thin **mode container** with the existing JSON toggle. Only the **visual branch** is rewritten — from "drill-down panels + read-only preview" to "**interactive canvas + inspector sidebar**." JSON mode and its non-blocking validation are untouched (Req 2, 17; AC1, AC15).
- The **canvas** is the `SongPreview` render path made interactive: it renders the working song with the notation core, and a click (or keyboard activation) on a note maps to a **selection** — `{ sectionIndex, measureIndex, hand, eventIndex }` — using the `data-*` hooks the core already emits. The selected note is highlighted by post-render decoration (Req 1, 3; AC3, AC6).
- The **sidebar** (`InspectorControls`) always shows a **Song** panel; when an event is selected it additionally shows **Note**, **Measure**, and **Section** panels for the selected event and its measure/section. Each panel shows a small **common** set of controls and reveals the rest through native progressive disclosure (Req 4–7; AC4, AC5, AC10).
- Editing reuses the existing **constrained controls + factories + list helpers** so output is **conformant by construction**; a `validateSong` guard runs before persisting (Req 11, 13; AC11). **Full model coverage** is retained — every part is reachable through the canvas (selection/add) and the sidebar panels (Req 8; AC7).

## Components

All new/changed code lives under `src/`, built from `@wordpress/*` packages. The notation core (`src/notation/*`), the song layer (`src/song/*`), `src/view.js`, `src/render.php`, and `src/block.json` are **untouched** (Req 18).

### Changed

- **`Edit` (`src/edit.js`)** — keeps the `mode` state and `BlockControls` toggle. The visual branch is replaced: instead of `SongEditor` + read-only `SongPreview`, it renders the **interactive canvas** plus **`InspectorControls`**. It owns the editor-only **selection** state and derives the working object (`song.trim() === "" ? newSong() : JSON.parse(song)`), the `errors = validateSong(song)` memo, and the `onChangeSong`/edit helpers. JSON mode is unchanged (Req 2, 17).

### New

- **`SongCanvas`** — the interactive sheet-music surface. Reuses `SongPreview`'s render path (`validateSong` gate → `buildLayoutModel` → `renderInto`, the font gate, and the rAF-debounced `ResizeObserver`). Adds: (a) a click/keydown handler that hit-tests `[data-kind="note"]` and resolves a selection; (b) per-hand **add-note** affordances and an end-of-score **add-measure** affordance; (c) post-render **selection decoration** (an `is-selected` class + focusability) on the selected node. Renders the working object directly (so the seeded empty song shows an empty grand staff).
- **`selection.js`** — pure helpers: `measureCoords(song)` returns the ordered `(sectionIndex, measureIndex)` per global measure number (mirroring `buildLayoutModel`'s sections→measures walk); `resolveSelection(song, selection)` returns the selected event/measure/section or `null` if stale; and the inverse used to scope the highlight query `[data-measure][data-hand][data-event-index]`.
- **Sidebar panels (`src/editor/inspector/`)**, each an `InspectorControls` `PanelBody`:
  - **`SongPanel`** — metadata (`MetadataEditor`) + `defaults` context (`ContextEditor`); per-hand `handConfig` behind disclosure.
  - **`NotePanel`** — the selected event: note↔rest `type`, pitches (`PitchList`/`PitchEditor`), `duration`; `alter`/`dots`/`dynamic`/`tie`/`slur`/`crescendo`/`decrescendo`/event annotations behind disclosure; **Remove note**.
  - **`MeasurePanel`** — the selected note's measure: `barlineStart`/`barlineEnd` and standalone annotations behind disclosure; **Remove measure**.
  - **`SectionPanel`** — the selected note's section: context overrides (`ContextEditor`) behind disclosure; **Add/Remove section**.
  - Each panel groups its **optional/advanced** controls in a `ToolsPanel` (reveal = add the field, reset = remove it — conformant by construction).

### Reused unchanged

- Render/core: `src/notation/layout.js` (`buildLayoutModel`), `src/notation/svg.js` (`renderInto`, already emitting `data-kind`/`data-hand`/`data-event-index`/`data-measure`/`data-system`), `constants.js`, `glyphs.js`.
- Song layer: `src/song/validate.js` (`validateSong`), `src/song/normalizeStep.js`, `src/song/schema.js`.
- Editor primitives: `src/editor/songModel.js` (vocabularies, numeric bounds, factories, list helpers), `src/editor/serializeSong.js`, `src/editor/noteNames.js` (per-song note-name system, preserving `do`/`C` — AC14), `src/editor/accessibleName.js`.
- Field controls reused as panel contents: `MetadataEditor`, `ContextEditor`, `HandConfigEditor`, `EventEditor`, `PitchEditor`, `PitchList`, `AnnotationEditor`, `AnnotationList`.
- `InvalidState` (non-empty invalid → "Edit as JSON").

### Removed

- Drill-down navigation, superseded by canvas + sidebar: `SongOverview`, `SectionList`, `SectionEditor`, `MeasureList`, `MeasureEditor`, `EventList`, `EventRow`, `Breadcrumb`, `EmptyState`. The standalone read-only `SongPreview` is absorbed into `SongCanvas` (its render glue is reused). `ListControls` (move-up/down) is removed with reordering.

## Interfaces and Data Flow

- **Block attribute (unchanged):** `song: string` in `src/block.json` (default `""`). The front end reads it verbatim (Req 18).
- **Editor-only state:** `mode` (`visual` | `json`) and `selection` (`{ sectionIndex, measureIndex, hand, eventIndex } | null`). Neither is persisted.
- **Per-edit data flow:**

  ```
  song (string attr)
   ├─ ""        → working = newSong()        (seeded; not persisted until first edit)
   └─ non-empty → validateSong → valid? ──no──▶ InvalidState ("Edit as JSON")
                                    │yes
                                    ▼  working = JSON.parse(song)
        (author selects a note on canvas → selection coords)
        (author edits a control / adds / removes)
                                    ▼
        next working object  (songModel factories + insertAt/removeAt/replaceAt)
                                    ▼  serializeSong → validateSong guard
                              setAttributes({ song })
                                    ▼
                     canvas re-renders (renderInto) → re-apply selection decoration
  ```

- **Selection mapping:** click → `target.closest('[data-kind="note"]')` → `data-hand` + `data-event-index`; `closest('[data-measure]')` → global measure number → `measureCoords(song)` → `(sectionIndex, measureIndex)`. Highlight: scoped query `[data-measure="g"] [data-hand="h"] [data-event-index="i"]` → add `is-selected`.
- **Sidebar contract:** `InspectorControls` renders `SongPanel` always; if `resolveSelection(song, selection)` is non-null it also renders `NotePanel`/`MeasurePanel`/`SectionPanel` bound to the resolved event/measure/section; each panel calls back with an updated working object that flows through the per-edit path above.
- **Constrained-control vocabulary (reused from `songModel`):** enumerated fields → `SelectControl`; bounded numbers → `NumberControl`; note names → `SelectControl` in the per-song note-name system; free text → `TextControl`/`TextareaControl`.

## Key Decisions

### Decision: Reuse the notation core's emitted hooks for selection — no core change
- **Choice:** Hit-test the `data-kind`/`data-hand`/`data-event-index`/`data-measure` attributes `svg.js` already emits, and recompute the section/measure flatten editor-side (`measureCoords`).
- **Alternatives:** Add `data-section-index`/`data-measure-index` to the measure group in `svg.js`; or have the core return a richer selectable scene graph.
- **Trade-offs:** Reading existing attributes keeps the front-end-shared core byte-for-byte unchanged (airtight Req 18) for a trivial editor-side flatten; adding attributes is marginally simpler at the hit-test but mutates shared code and nudges the boundary.
- **Traces to:** Req 3, 18; AC3, AC16.

### Decision: Selection highlight by scoped query, not by `id`
- **Choice:** Decorate the selected node found via `[data-measure][data-hand][data-event-index]` after each render.
- **Alternatives:** Select by the emitted `id` (`${hand}-note-${eventIndex}`); pass a selected-path into the core to render the highlight.
- **Trade-offs:** The `id` is **not** globally unique (`eventIndex` resets per measure), so a scoped query is required; post-render decoration keeps `svg.js` untouched, where rendering a highlight in the core would not.
- **Traces to:** Req 3, 6, 18; AC3, AC6.

### Decision: Settings in `InspectorControls`; Song always, Note/Measure/Section on selection
- **Choice:** Relocate all settings to the block inspector sidebar; the Song panel is always present, the Note/Measure/Section panels appear for the selected event.
- **Alternatives:** Keep settings on the canvas (today's model); a modal editor.
- **Trade-offs:** The inspector is the Gutenberg-native home for block settings and scales to large songs (jump to a note, edit in a fixed sidebar) where on-canvas panels do not; the cost is that the panels require the block to be selected (handled — note selection does not deselect the block).
- **Traces to:** Req 4, 5, 6; AC4, AC5.

### Decision: Native progressive disclosure via `ToolsPanel` for optional fields
- **Choice:** Each panel shows its common required controls directly and groups optional/advanced controls in a `ToolsPanel` (reveal = add field, reset = remove field).
- **Alternatives:** A collapsible "Advanced" `PanelBody`; a custom show-advanced toggle.
- **Trade-offs:** `ToolsPanel`'s optional/reset semantics map exactly onto the song model's optional fields and keep conformance automatic; it does not fit required fields, which is why pitch/duration render outside it. A plain collapsible would mix required/optional less cleanly.
- **Traces to:** Req 7; AC10.

### Decision: Seed the empty song editor-side and lazily
- **Choice:** For an empty `song`, the visual branch uses `newSong()` as the working object so the canvas shows an empty grand staff; the attribute stays `""` until the first edit persists it.
- **Alternatives:** Change `block.json`'s `song` default; persist the seed on mount.
- **Trade-offs:** Lazy editor-side seeding preserves the front end's "empty = render nothing" and stores nothing the author did not intend; changing the default or persisting on mount would make an untouched block render an empty staff and would cross the editor-only boundary.
- **Traces to:** Req 10, 18; AC2.

### Decision: Add notes on the canvas via a default-note affordance; hand by staff
- **Choice:** Each hand of each measure exposes a canvas add affordance; clicking appends a default `newNote()` to that hand (after the selected event if any, else append) and selects it for tuning in the sidebar.
- **Alternatives:** Click an empty staff position to place a note at the implied pitch (Y→pitch); a toolbar insert acting on a chosen hand.
- **Trade-offs:** The default-note approach is simplest, conformant by construction, and makes "hand = which staff" literal; click-to-place is more fluid but needs a Y→pitch inverse the core does not expose and raises clef/ledger ambiguity (deferred).
- **Traces to:** Req 9, 11; AC8.

### Decision: Add/remove placement; omit reordering in v1
- **Choice:** Add-measure and add-note on the canvas; add/remove section, remove measure, remove note, and chord pitch add/remove in their sidebar panels. **Reordering is omitted** in v1.
- **Alternatives:** All structural ops on the canvas; keep move-up/down reorder controls.
- **Trade-offs:** This keeps the frequent add path on the canvas while giving low-frequency structural ops a stable home; omitting reorder (optional per Req 12, and the owner asked to drop it if it complicates) removes the `ListControls` and a class of index-shuffling edge cases.
- **Traces to:** Req 11, 12; AC9.

### Decision: Conformant-by-construction edits with a serialize-time guard
- **Choice:** Reuse the `songModel` closed vocabularies, numeric bounds, factories, and immutable list helpers; run `validateSong` on the serialized string before `setAttributes`. The note invariant (≥1 pitch) is UI-enforced (a new note seeds a pitch; the last pitch can't be removed; switching to rest drops pitches).
- **Alternatives:** Constrained controls only; free input with informational validation.
- **Trade-offs:** Constrained controls make non-conformant output unreachable and the guard is cheap insurance reusing the one validator; no musical-timing checks keeps parity with today.
- **Traces to:** Req 11, 13; AC11.

### Decision: Note-name system preserved per song (carried over)
- **Choice:** Reuse `noteNames.js` — the per-song note-name system inferred on load; each pitch's `step` is chosen from that system, and untouched pitches round-trip verbatim.
- **Alternatives:** Free-text note names; a 14-name dropdown spanning both systems.
- **Trade-offs:** A per-song system is the friendliest conformant pick-list and keeps a Spanish song Spanish / English English (`do` stays `do`); the only narrowed case is a song mixing systems within itself, accepted in the base feature.
- **Traces to:** Req 14; AC14.

## Dependencies

- **WordPress packages only** (already externalized by `@wordpress/scripts`, so no runtime/bundle dependency is added — Req 19; AC17): `@wordpress/element` (React + hooks), `@wordpress/block-editor` (`useBlockProps`, `BlockControls`, **`InspectorControls`**), `@wordpress/components` (`PanelBody`, `ToolsPanel`/`ToolsPanelItem`, `SelectControl`, `NumberControl`, `TextControl`, `TextareaControl`, `ToggleControl`, `Button`, `Notice`, `ToolbarButton`/`ToolbarGroup`), `@wordpress/i18n` (`__`).
- **Internal modules (reused, unchanged):** the notation core, the song layer, and the editor primitives listed under Components.
- **Unchanged by this feature:** `src/notation/*`, `src/song/*`, `src/view.js`, `src/render.php`, `src/block.json`, the song schema (Req 18).

## Failure Modes and Observability

- **Non-empty invalid / non-conformant stored song:** `validateSong` detects it; the visual branch shows `InvalidState` (errors + "Edit as JSON") and the canvas renders nothing. The raw field shows the same non-blocking notice and never blocks saving (Req 16, 17; AC13, AC15).
- **Empty song:** treated as "no song"; the editor seeds `newSong()` for the canvas (empty grand staff) without persisting until the first edit; the front end still renders nothing (Req 10; AC2).
- **Stale selection:** after a structural change, undo/redo, or a raw-JSON edit, `resolveSelection` returns `null` and the selection clears (sidebar falls back to Song-only) — no edits target a missing event.
- **Latent non-conformant serialization:** the serialize-time `validateSong` guard prevents persisting a bad string from visual mode; in normal operation it always passes.
- **Music font not yet loaded:** the canvas gates its first draw on the font (reused `SongPreview` glue); the selection decoration runs after each actual draw, not before, so it never targets a not-yet-rendered node.
- **No new server-side or network failure modes** — entirely client-side in the editor; persistence is the standard block-attribute path.

## Risks and Open Questions

- **Editor-side flatten must track the core's measure ordering** — `measureCoords` mirrors `buildLayoutModel`'s sections→measures walk; both read `song.sections[].measures[]` order, and a unit test should pin the mapping so they cannot drift.
- **Full re-render + re-decoration per edit** — reuses the whole-SVG redraw on each change; fine for typical songs, large-song performance is out of scope (spec Out-of-Scope 7); debouncing is a future option.
- **`InspectorControls` requires block selection** — panels show only when the Piano block is selected; the note click is handled within the block and must not bubble to a block-deselect.
- **Open — Y→pitch click-to-place** for adding a note at an exact staff position: deferred; needs an inverse pitch/clef mapping the core does not expose.
- **Open — full keyboard traversal of the canvas** (arrow keys note-to-note): baseline is focus + Enter/Space to select; richer traversal is a refinement.
- **Open — measures/sections with zero events** are reachable only after adding a note (direct measure/section selection is deferred — spec Out-of-Scope 9); acceptable for v1, the seeded first measure is reachable via its add-note affordance.
- **Open — single-event selection only** in v1 (no multi/range selection).
