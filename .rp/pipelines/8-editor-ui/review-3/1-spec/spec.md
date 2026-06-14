# Spec: Review 3 — Left-sidebar structure tree as the selection surface

## Overview

The Piano block's editor is canvas-first. Earlier reviews tried to make notes selectable by **clicking the rendered staff**, but that has proven unreliable. Review 3 changes the selection model: it adds a **structure tree** in a toggleable panel on the **left of the canvas** (rendered within the block's own editor area, not the editor's global List View), and makes that tree the way the author navigates and selects the song — like Gutenberg's List View for blocks and inner blocks.

The tree shows **Section → Measure → {Right hand, Left hand} → Note**. Sections and measures expand/collapse. The author **adds, removes, and duplicates** sections, measures, and notes from the tree, and **renames** sections and measures. Selecting a node **highlights** the corresponding section/measure/note on the canvas (the canvas is now **display + highlight only** — clicking the staff no longer selects) and **opens that node's settings** in the existing **right inspector** (Song / Note / Measure / Section panels). Raw-JSON editing and the song-level note-language selector are unchanged.

Review 3 makes one deliberate, additive change to the song format — an optional **`name`** on sections and measures, so custom labels persist — in the same spirit as the `language` field. Otherwise it stays editor-side: `render.php` and the front-end SVG rendering are unchanged (the front end ignores `name`). The block still persists a single `song` JSON string; the canvas reuses the existing highlight/decoration; conformant-by-construction editing is preserved.

## Requirements

### Left structure tree

1. The editor presents a **toggleable structure-tree panel on the left of the canvas**, within the block's own editor area. It shows the song hierarchy **Section → Measure → {Right hand, Left hand} → Note**. **Sections and measures expand/collapse.** The right-hand and left-hand groups under a measure organize that measure's two event lists.
2. The tree is the **primary selection surface**: selecting a section, measure, or note node sets the editor's current selection.
3. **Canvas click-to-select is removed.** The rendered canvas is **display + highlight only**.

### Selection → highlight + settings

4. Selecting a node **highlights the corresponding element on the canvas** — the section, measure, or note — reusing the existing canvas decoration; the canvas updates live as the song changes.
5. When a node is selected, its **settings appear in the right inspector**: the **Note / Measure / Section** panels (and the always-present **Song** panel). The left tree selects; the right inspector configures.

### Structural operations

6. The author can **add, remove, and duplicate** items at **every level** — sections, measures, and notes (a note is added under a hand group of a measure).
7. **Duplicate** produces a **deep copy inserted immediately after the original**: duplicating a section copies all its measures and notes (and its `name`); duplicating a measure copies both hands' notes (and its `name`); duplicating a note copies its pitches and properties.
8. **Reordering** (moving items up/down) is **not** included in this review.

### Labels

9. **Sections and measures have an editable, persisted `name`.** The tree shows the `name`; when unset it falls back to a positional label (e.g. "Section 1", "Measure 1"). The `name` is editable from the editor (the exact affordance — inline in the tree and/or a Name field in the Section/Measure panel — is a design decision).
10. **Notes are labeled by pitch name** in the tree — a single note shows its pitch (in the song's note-name language, e.g. "do" / "C"); a chord shows its pitches; a **rest** shows "rest".

### Song format, boundary, dependencies, carry-overs

11. **`name` is added to the song format/schema** as an **optional** property on sections and measures. It is **additive and permissive**: an existing song without it stays valid, it round-trips through raw-JSON editing, and validation never blocks saving.
12. **Format boundary — relaxed only for `name`:** the schema changes solely to add `name`. **`render.php` and the front-end SVG rendering are unchanged**; a published page renders a given song exactly as before (the front end ignores `name`).
13. Review-2's **right-sidebar Structure list** (sections → measures, in the right inspector) is **removed**, superseded by the left tree.
14. **Conformant by construction:** all tree operations (add/remove/duplicate), renames, and settings edits can only produce schema-conformant songs.
15. **Carry-overs:** the song-level **note-language selector**; **raw-JSON editing** behind the toolbar toggle with today's non-blocking validation; **progressive disclosure** of uncommon settings; **live canvas re-render** on edit; and all other review-2 behavior not changed here.
16. **WordPress-only dependencies:** implemented using only `@wordpress/*` packages already available to blocks; no outside runtime dependency.

## Out of Scope

1. **Canvas click-to-select** — removed (canvas is display + highlight only).
2. **Reordering** sections/measures/notes — deferred to a follow-up.
3. **Front-end consuming `name` or `language`** / showing them on the published page — future work.
4. **Changing `render.php` or the front-end SVG rendering** — unchanged.
5. **Audio playback** — future.
6. **Best-effort loading of invalid songs** (still routed to raw JSON) and **large-song performance tuning** — carried over.

## Acceptance Criteria

### AC1 — Left tree shows the hierarchy and toggles
- **Given** a Piano block with a valid song,
- **When** the author opens the left structure panel,
- **Then** it shows Section → Measure → Right/Left hand → Note, with sections and measures expandable/collapsible, and it can be toggled open/closed.

### AC2 — Selecting a node selects it (highlight + settings)
- **Given** the left tree,
- **When** the author selects a section, measure, or note node,
- **Then** the corresponding element is highlighted on the canvas and that node's settings appear in the right inspector.

### AC3 — Canvas no longer selects on click
- **Given** the rendered canvas,
- **When** the author clicks a note on the staff,
- **Then** it does not change the selection (the canvas is display + highlight only).

### AC4 — Add at every level
- **Given** the tree,
- **When** the author adds a section, a measure (within a section), or a note (within a hand group),
- **Then** the song structure updates accordingly.

### AC5 — Remove at every level
- **Given** the tree,
- **When** the author removes a section, measure, or note,
- **Then** that item is removed from the song.

### AC6 — Duplicate at every level (deep copy after original)
- **Given** the tree,
- **When** the author duplicates a section, measure, or note,
- **Then** a deep copy is inserted immediately after the original (a section copies its measures/notes; a measure copies both hands).

### AC7 — Rename sections and measures (persisted)
- **Given** a section or measure,
- **When** the author edits its name,
- **Then** the name is stored in the song, shown in the tree, and preserved across save/reload and a raw-JSON round-trip.

### AC8 — Note labels
- **Given** the tree,
- **When** the author views a note node,
- **Then** it is labeled by its pitch name (a chord shows its pitches) and a rest shows "rest".

### AC9 — Settings edits reflected
- **Given** a selected node,
- **When** the author edits its settings in the right inspector,
- **Then** the change is reflected in the stored `song` and the canvas.

### AC10 — `name` round-trips and validates; front end unchanged
- **Given** a song with section/measure `name` values,
- **When** the author switches to raw JSON and back, or views the published page,
- **Then** the `name` values are preserved, validation accepts them without blocking saving, and the front-end rendering is identical to the same song without `name`.

### AC11 — Conformant by construction
- **Given** any tree operation, rename, or settings edit,
- **When** it is applied,
- **Then** the resulting `song` is schema-conformant.

### AC12 — Raw JSON still never blocks saving
- **Given** the raw-JSON surface,
- **When** the author enters invalid or non-conformant content,
- **Then** it is still stored with an informational notice, without blocking saving.

### AC13 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used.
