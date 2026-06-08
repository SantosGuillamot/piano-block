# Design Doc: Editor UI for editing the song

## Overview

The Piano block stores one song as a JSON string (the block's `song` attribute) in the plugin's song format, and renders it as piano sheet music. Today the only authoring affordance in the editor is a single raw-JSON textarea.

This feature adds a **visual editing UI** on the block canvas so musically literate authors can build and edit a song without hand-writing JSON. The visual editor is the default surface; the existing **raw-JSON field stays available** behind a mode switch as the alternative. A **live preview** renders the song as sheet music beside the controls, reusing the block's existing notation renderer. The feature is **editor-only**: the song format, the server render (`render.php`), and the front-end rendering are unchanged; a song saved via the visual editor renders identically to the same song authored by hand.

This document traces to the spec's Requirements (1–13) and Acceptance Criteria (AC1–AC12).

## Approach

The mental model is **one canonical string, projected into a structured form**:

- The block's `song` **string attribute is the single source of truth.** The visual editor parses it into a working object (memoized) only when it is conformant; every edit produces a fresh object that is serialized back to the string via `setAttributes({ song })`. Visual and raw modes therefore can never disagree, and WordPress block undo/redo and external edits work without custom synchronization (Req 5/7/8; AC7).
- The block edit component (`edit.js`) becomes a thin **mode container** that renders one of: the visual editor (default), or the existing raw-JSON field. The two are never editable at once; a read-only live preview sits alongside the visual editor (Req 1/7; AC1).
- The visual editor branches on `validateSong(song)`: an **empty** song shows an empty "start a new song" state; a **conformant** song drives the full structured editor; a **non-empty invalid** song is not edited visually — the editor shows the validation errors and routes the author to raw JSON to fix it (Req 9; AC2/AC8).
- The structured editor uses **constrained `@wordpress/components` controls** so it can only ever produce schema-conformant songs (Req 4; AC5), and navigates the deep model by **drilling down one level at a time** (song → section → measure → event), keeping each screen simple on the narrow canvas (Req 2/3).
- The live preview reuses the **pure notation core** (`buildLayoutModel` + `renderInto`) so its output is identical to the front end (Req 5; AC6/AC10), while owning its own thin React-side glue so it stays independent of the front-end `view.js`.

## Components

All components are new React components under `src/` built from `@wordpress/components` and `@wordpress/block-editor`, except where noted. No new files are required outside `src/`.

- **`Edit` (`src/edit.js`, modified)** — the block edit component, refactored into a **mode container**. Holds the current editing mode (visual | json) in local UI state, derives `errors = validateSong(song)` (memoized), and renders:
  - a **mode switch** (a `BlockControls` toolbar button such as "Edit as JSON", and/or a small segmented toggle at the top of the block) — visual is the default mode;
  - in **visual** mode: `SongEditor` + `SongPreview`;
  - in **json** mode: the existing raw-JSON `TextareaControl` (label "Song (JSON)") with its non-blocking error `Notice` — preserved unchanged so its behavior still holds (Req 10; AC11).
- **`SongEditor`** — the visual editor root. Branches on validity: empty → `EmptyState`; conformant → the structured editor; non-empty invalid → `InvalidState`.
  - **`EmptyState`** — a "start a new song" affordance; the first content the author adds serializes a minimal conformant song `{ sections: [ … ] }` (AC2).
  - **`InvalidState`** — shows the `validateSong` error message(s) and a button to switch to raw JSON (AC8).
- **Structured editor (drill-down):**
  - **`SongOverview`** — top level: `MetadataEditor`, `ContextEditor` (for `defaults`), and `SectionList`.
  - **`MetadataEditor`** — `title`, `composer` (`TextControl`).
  - **`ContextEditor`** — `tempo` (`bpm`, `beatUnit`), `timeSignature` (`beats`, `beatType`), and per-hand `HandConfigEditor` (`clef`, `alters` map, `octaveShift`). Reused for `defaults` and per-section overrides; each field is independently present/absent (overrides).
  - **`SectionList` → `SectionEditor`** — a section's optional context overrides + its `MeasureList`.
  - **`MeasureList` → `MeasureEditor`** — a measure's `barlineStart`/`barlineEnd` (`BarlineControl`), its two per-hand **`EventList`s edited in place**, and measure-level `AnnotationList` (standalone, staff-anchored).
  - **`EventList` → `EventRow`** — each event edited inline (`type`, `duration`, `dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`); a row drills into **`EventEditor`** for deeper detail: the chord's `PitchList` and event-anchored `AnnotationList`.
  - **`PitchList` → `PitchEditor`** — `step` (note-name `SelectControl` in the per-song system), `octave`, `alter`.
  - **`AnnotationEditor`** — `text`, `placement` (and `staff` for standalone annotations).
  - **`ListControls`** — shared add / remove / move-up / move-down buttons used by every list (sections, measures, events, pitches, annotations).
- **`SongPreview`** — renders the live sheet-music preview. Holds a container ref; in an effect keyed on the conformant song + measured width, runs `validateSong` → `JSON.parse` → `buildLayoutModel` → `renderInto(ref, model, { accessibleName })`. Owns its own thin glue (font-ready gate, width→staff-space, accessible-name) — independent of `view.js`.
- **Unchanged / reused:** `src/song/validate.js` (`validateSong`), `src/song/normalizeStep.js` (`isNoteName`/`normalizeStep`), `src/song/schema.js`, `src/notation/layout.js` (`buildLayoutModel`), `src/notation/svg.js` (`renderInto`), `src/notation/constants.js`, `src/notation/glyphs.js`. `src/view.js`, `src/render.php`, and `src/block.json` are **untouched** (Req 13).

## Interfaces and Data Flow

- **Block attribute (unchanged):** `song: string` in `src/block.json`. The single persisted value; the front end reads it verbatim (Req 13).
- **Edit-side state:** the structured editor never holds the song as separate state. The data flow per edit is:

  ```
  song (string attr)
    └─ validateSong(song) ─ memo ─▶ valid? ──no──▶ Empty / Invalid state
                                       │yes
                                       ▼
                              JSON.parse → working object
                                       │  (author edits a field / adds / removes / reorders)
                                       ▼
                              next object → JSON.stringify
                                       │  (+ validateSong guard, see Decisions)
                                       ▼
                              setAttributes({ song })  ──▶ re-render + preview redraw
  ```

- **Serialization:** `JSON.stringify` of the working object. Only set fields are emitted (optional fields absent unless added). Canonical formatting (whitespace/key order not preserved) — accepted by the round-trip fidelity decision (Req 11).
- **Preview interface (reused as-is):** `buildLayoutModel(songObject, widthInSp)` → layout model; `renderInto(containerEl, model, { accessibleName })` → mounts the `<svg>`. Identical to the front-end call path, so the editor preview and the published page render the same notation (AC10).
- **Constrained-control vocabulary:** enumerated fields (durations, `beatUnit`, `beatType`, `clef`, `dynamic`, `tie`/`slur`/`crescendo`/`decrescendo`, barlines, annotation `placement`/`staff`, event `type`) → `SelectControl`; bounded numbers (`beats` ≥1, `octave` 0–9, `alter`/`alters` −2..+2, `octaveShift` −2..+2, `dots` 0–2, `bpm` >0) → `NumberControl`; note names → `SelectControl` in the per-song note-name system; free text (`title`, `composer`, annotation `text`) → `TextControl`/`TextareaControl`.

## Key Decisions

### Decision: The `song` string is the single source of truth
- **Choice:** Keep the `song` string attribute as the only state; parse to a working object (memoized) when conformant, and serialize back on every edit.
- **Alternatives:** Hold a parsed object in React state and mirror it to the string; or store the song as structured `block.json` attributes.
- **Trade-offs:** A single source of truth means visual and raw modes can never disagree and undo/redo/external edits work for free, at the cost of re-parse/re-serialize per edit (negligible for typical songs). A parsed-state mirror risks the two modes drifting; structured attributes would change storage/format and break the editor-only boundary.
- **Traces to:** Requirement 7, 8, 13; AC7, AC9.

### Decision: On-canvas visual editor + adjacent live preview, raw JSON behind a mode switch
- **Choice:** The block canvas shows the visual editor (default) with the live preview adjacent; a mode switch flips the canvas to the existing raw-JSON field. Never both at once.
- **Alternatives:** A modal song editor with the canvas showing only the preview; or an inspector-sidebar editor with the canvas showing the preview.
- **Trade-offs:** On-canvas keeps editing, preview, and result in one in-context surface and matches "visual is the default, JSON tucked behind a toggle," but the canvas width is tight for deep nesting (mitigated by drill-down navigation). A modal gives more room but puts editing a click away; the inspector is too narrow for deep structural editing.
- **Traces to:** Requirement 1, 7; AC1.

### Decision: Drill-down navigation of the hierarchy, with in-place measure editing
- **Choice:** Navigate one level at a time (song → section → measure → event) with a breadcrumb; a measure edits both hands' event lists in place, drilling into an event only for chord pitches and annotations.
- **Alternatives:** Nested accordions; a two-pane outline + detail.
- **Trade-offs:** Drill-down keeps each screen simple and scales to deep/large songs on a narrow canvas; in-place event editing avoids excessive drilling for the common task of entering a run of notes. Accordions grow noisy/tall; two-pane needs width the canvas lacks.
- **Traces to:** Requirement 2, 3, 6; AC3, AC4.

### Decision: Add/remove/reorder via buttons (no drag-and-drop)
- **Choice:** Move-up / move-down plus add / remove buttons on each list item at every level.
- **Alternatives:** Native HTML5 drag-and-drop; or both drag handles and buttons.
- **Trade-offs:** Buttons are dependency-free, fully keyboard-accessible, and simplest; reordering is one click per step (fine for typical list sizes). Drag-and-drop is more fluid for long lists but is custom code (no clean `@wordpress/components` primitive) and still needs a keyboard fallback.
- **Traces to:** Requirement 3, 12; AC4.

### Decision: Conformant by construction + a serialize-time validation guard
- **Choice:** Map every field to a constrained control so invalid states are unreachable; additionally run `validateSong` on the serialized string before `setAttributes` as a defensive guard. The note invariant ("a note needs ≥1 pitch") is enforced by the UI (a new note seeds a pitch; the last pitch can't be deleted; switching to `rest` drops pitches). No musical-timing checks.
- **Alternatives:** Constrained controls only (trust the UI); or free input with informational validation like the raw field.
- **Trade-offs:** Constrained controls make non-conformant output unreachable; the guard is cheap insurance reusing the single validator and prevents a latent bug from persisting a bad song from visual mode. No timing checks keeps parity with today's behavior.
- **Traces to:** Requirement 4; AC5.

### Decision: Note-name input via dropdown + a per-song note-name system
- **Choice:** A song-level note-name system setting (English / Spanish), inferred on load from existing pitches (default English for a new song); each pitch's `step` is chosen from that system's 7 names. Existing `step` spellings are preserved verbatim in the working model and only rewritten into the per-song system if the author edits that pitch; new pitches use the per-song system.
- **Alternatives:** Free-text note-name input validated against the vocabulary; or a per-pitch dropdown listing all 14 names (both systems).
- **Trade-offs:** A per-song dropdown is the friendliest pick-from-list option and is clearly conformant. For uniform-system songs (and any untouched pitch) the system round-trips exactly — which matches the intended model of one note-name language per song (a Spanish song stays Spanish, an English song stays English). The only narrowed case is a song that *mixes* systems within itself (e.g. `do` and `C` together): editing such a pitch normalizes it to the per-song spelling. This is accepted (see Risks/Open Questions). Free-text and the 14-item dropdown preserve mixes but are respectively more error-prone or longer to use.
- **Future extensibility:** the per-song-system approach generalizes to additional note-name languages (e.g. German) if the shared vocabulary in `normalizeStep.js` is extended later. Today the vocabulary is English + Spanish only; adding further systems is out of scope for this feature but is not precluded by this design.
- **Traces to:** Requirement 6, 11; AC9.

### Decision: Live preview reuses the notation core; thin glue duplicated (not shared with `view.js`)
- **Choice:** The preview reuses the pure notation core (`buildLayoutModel` + `renderInto`) directly and owns its own React-side glue (font-ready gate, width→sp, accessible name). `view.js` is left untouched.
- **Alternatives:** Extract the glue into a shared module reused by both `view.js` and the editor (a behavior-preserving refactor of `view.js`).
- **Trade-offs:** Duplicating the thin glue keeps the editor independent of `view.js`, which is expected to migrate to the WordPress Interactivity API (a front-end-only concern). AC10 (identical notation) still holds because the rendering core is shared; only the presentational glue is duplicated. The shared module would be DRYer but would couple the editor to code slated for rewrite.
- **Traces to:** Requirement 5, 12, 13; AC6, AC10.

## Dependencies

- **WordPress packages only** (`@wordpress/*`), already externalized by `@wordpress/scripts` (so nothing is added to the runtime/bundle dependency footprint, satisfying Requirement 12): `@wordpress/element` (React + hooks), `@wordpress/components` (`SelectControl`, `NumberControl`, `TextControl`, `TextareaControl`, `Button`, `Panel`/`PanelBody`, `Card`, `Flex`, `BaseControl`, `Notice`, etc.), `@wordpress/block-editor` (`useBlockProps`, `BlockControls`, optionally `InspectorControls`), `@wordpress/i18n` (`__`). No outside dependencies (AC12).
- **Internal modules (reused, unchanged):** `song/validate.js`, `song/normalizeStep.js`, `song/schema.js`, `notation/layout.js`, `notation/svg.js`, `notation/constants.js`, `notation/glyphs.js`.
- **Unchanged by this feature:** `src/view.js`, `src/render.php`, `src/block.json`, the song schema (Requirement 13).

## Failure Modes and Observability

- **Invalid / non-conformant stored song:** detected by `validateSong`; the visual editor shows the error message(s) and routes to raw JSON (AC8). The raw field itself shows the same informational notice and never blocks saving (AC11).
- **Empty song:** treated as "no song"; the visual editor shows the empty state and the preview renders nothing (parity with the front end's render-nothing behavior) (AC2).
- **Unexpected non-conformant serialization (latent bug):** the serialize-time `validateSong` guard prevents persisting a non-conformant string from visual mode; in normal operation it always passes (no error UI shown in visual mode).
- **Music font not yet loaded in the preview:** the preview gates its first draw on the font (duplicated glue), mirroring the front end; the hand-drawn skeleton still renders if the font is unavailable.
- **No new server-side or network failure modes** — the feature is entirely client-side in the editor; persistence is the standard block attribute path.

## Risks and Open Questions

- **Resolved — mixed note-name systems vs AC9 (owner-confirmed):** AC9's fidelity guarantee is read as **one note-name language per song** — a Spanish song stays Spanish, an English song stays English — which the per-song system preserves exactly (along with any untouched pitch). The only narrowed case is a single song that *mixes* systems within itself; editing such a pitch normalizes it to the per-song spelling. The owner accepted this narrowing. Future note-name languages (e.g. German) are out of scope now but accommodated by the approach (extend `normalizeStep.js`'s vocabulary).
- **Risk — re-serialize + preview redraw on each edit:** every edit re-serializes and redraws. Fine for typical songs; large-song performance is out of scope. If needed later, the preview redraw can be debounced (the front end already uses a rAF-debounced resize). Not a v1 requirement.
- **Risk — future `view.js` → Interactivity API migration:** the editor preview is intentionally decoupled from `view.js`. The shared notation core (`layout.js`/`svg.js`/`constants.js`/`glyphs.js`) must stay framework-neutral so both the editor and a future Interactivity-API front end can use it.
- **Risk — existing e2e tests target the raw field:** `specs/editor.spec.js` locates the field by the label "Song (JSON)" and the `.is-error` notice. Introducing the visual editor as the default surface means those tests (and selectors) must be updated in the Code phase; the raw field's label + notice are preserved so its behavior remains reachable and testable from JSON mode (AC11).
