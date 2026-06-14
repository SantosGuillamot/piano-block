# Spec: Review 2 — Working selection, contextual add/remove, sidebar structure, and a note-language setting

## Overview

The Piano block's editor is **canvas-first** (from review 1): the rendered grand-staff is the interactive surface, the author selects a note/rest on it, and settings are edited in the block's right-hand inspector sidebar; raw-JSON editing remains behind a toolbar toggle. This review fixes and extends that editor:

1. **Note selection on the canvas does not work in practice** and must be fixed — clicking a note/rest must select it and drive the sidebar.
2. **The add/remove model is reworked.** Plain on-canvas add buttons are replaced by **selection-contextual add-note / remove-note** controls (the hand is inferred from the selection), and **section/measure management moves into the sidebar** as a browsable list where the author can see all sections and measures and add, remove, and edit them.
3. **A song-level note-language setting** (Spanish/English) is added: it is **stored in the song**, the editor shows note names in that language, and switching it **converts** all existing notes to the chosen language.

Item 3 introduces the one deliberate change to the song format this review makes — a new song-level `language` field. Otherwise the change stays **editor-side**: `render.php` and the front-end SVG rendering are unchanged this iteration (the front end consuming `language` is future work). The block still persists a single `song` JSON string as its source of truth, the editor reuses the notation core, and conformant-by-construction editing is preserved.

This document traces to the Requirements and Acceptance Criteria below.

## Requirements

### Selection (fix)

1. Clicking a **note or rest** on the rendered canvas **selects** it: the selected note is visibly highlighted and the sidebar's Note panel (and the selection's measure/section context) populates. This must work in the real editor, not only in unit tests.
2. Clicking **empty canvas space deselects**: the selection clears and the sidebar falls back to the Song panel (plus the structure view). 
3. **Mouse click** is sufficient for selection; canvas keyboard selection is not required this iteration.

### Add / remove note (selection-contextual)

4. With a note/rest selected, the author can **add a note** and **remove the selected note**. The **hand (right/left staff) is inferred** from the current selection — the author is not asked to choose a hand.
5. The add/remove-note affordances are **clear and legible** (standard `@wordpress/components` button styling), and may live on the canvas, in the sidebar, or both. The exact insert position of an added note, and how the **first** note is added to an empty measure/hand (where there is nothing to select), are design decisions.

### Sidebar structure view (sections & measures)

6. The sidebar presents a **browsable list of all sections and their measures** (to **measure depth** — individual notes are not listed; they remain edited via canvas selection).
7. From this list the author can **add and remove sections** and **add and remove measures** (within a section).
8. **Selecting a section or measure** in the list lets the author **edit its settings** (the Section / Measure settings panels), and **highlights/scrolls to it on the canvas**.
9. **Reordering** is not provided — the list supports add, remove, and edit only.

### Song-level note-language setting

10. A new **song-level `language`** field (values for **Spanish** and **English**) is added to the song format/schema. It is part of the stored `song` JSON and **round-trips** through raw-JSON editing; validation accepts it.
11. The **Song panel** exposes a **language selector**. 
12. **Switching the language converts** every stored note name in the song to the chosen language's spelling (e.g. Spanish `do/re/mi…` ⇄ English `C/D/E…`), keeping the song uniformly in the selected language.
13. The editor's **note-name controls display note names in the song's current language**.
14. **Initial language:** an existing song with no `language` field infers its initial language from its current note spellings (Spanish if it uses Spanish names, else English); a **new/empty** song defaults to **English**.

### Boundary, dependencies, and carry-overs

15. **Format boundary — relaxed only for `language`:** the song schema changes **solely** to add the `language` field. **`render.php` and the front-end SVG rendering are unchanged** this iteration; a published page renders a given song's notes exactly as before (the front end ignores `language` for now).
16. **Conformant by construction:** the visual controls (including language conversion and structure edits) can only ever produce schema-conformant songs.
17. **Raw JSON unchanged:** raw-JSON editing stays behind the toolbar toggle with today's non-blocking validation (stores unconditionally, never blocks saving).
18. **Progressive disclosure** of uncommon settings, **live canvas re-render** on every edit, and all other review-1 behavior not changed by this review are preserved.
19. **WordPress-only dependencies:** implemented using only `@wordpress/*` packages already available to blocks; no outside runtime dependency.

## Out of Scope

1. **Front-end consuming the `language` field** / showing note names on the published page — future work (stored + round-trips only).
2. **Changing `render.php` or the front-end SVG rendering** — unchanged this iteration.
3. **Reordering** sections/measures/events.
4. **Listing individual notes/events** in the sidebar structure view — measure depth only.
5. **Canvas keyboard selection** — mouse-only this iteration.
6. **Selecting a measure/section by clicking the canvas** — reached via the sidebar list (which highlights the canvas).
7. **Audio playback** — future.
8. **Best-effort loading of invalid songs** (still routed to raw JSON) and **large-song performance tuning** — carried over from review 1.

## Acceptance Criteria

### AC1 — Clicking a note selects it
- **Given** a song rendered on the canvas in the live editor,
- **When** the author clicks a note or rest,
- **Then** that note becomes selected (visibly highlighted) and the sidebar shows its Note panel and its measure/section context.

### AC2 — Clicking empty space deselects
- **Given** a note is selected,
- **When** the author clicks empty canvas space,
- **Then** the selection clears and the sidebar returns to the Song panel + structure view.

### AC3 — Add a note, hand inferred
- **Given** a note/rest is selected,
- **When** the author uses "add note",
- **Then** a new note is added to the same hand as the selection (no hand prompt), and the canvas updates.

### AC4 — Remove the selected note
- **Given** a note/rest is selected,
- **When** the author uses "remove note",
- **Then** that note is removed from its hand and the canvas updates.

### AC5 — Sidebar lists all sections and measures
- **Given** a valid song,
- **When** the author views the sidebar,
- **Then** a browsable list shows every section and, within it, its measures (to measure depth).

### AC6 — Add/remove a section from the list
- **Given** the sidebar structure list,
- **When** the author adds or removes a section,
- **Then** the song's sections update accordingly.

### AC7 — Add/remove a measure from the list
- **Given** the sidebar structure list,
- **When** the author adds or removes a measure within a section,
- **Then** that section's measures update accordingly.

### AC8 — Select a section/measure to edit + highlight canvas
- **Given** the sidebar structure list,
- **When** the author selects a section or a measure,
- **Then** its settings become editable in the sidebar and the corresponding location is highlighted/scrolled to on the canvas.

### AC9 — Language selector converts notes and persists
- **Given** a song open in the editor,
- **When** the author switches the Song panel's language between Spanish and English,
- **Then** every note name in the stored song is converted to the chosen language and the chosen `language` is stored in the song.

### AC10 — Initial language inference / default
- **Given** an existing song with no `language` field that uses Spanish note names (e.g. `do`),
- **When** it is opened in the editor,
- **Then** the language is shown as Spanish; **and** a newly inserted (empty) block defaults to English.

### AC11 — Language field round-trips and validates
- **Given** a song with a `language` field,
- **When** the author switches to raw JSON and back,
- **Then** the `language` field is preserved, validation accepts it, and it does not block saving.

### AC12 — Front-end rendering unchanged
- **Given** a song saved by the editor (including its `language` field),
- **When** the published page is viewed,
- **Then** the front-end sheet-music rendering is identical to how that song's notes rendered before this review (the front end ignores `language`).

### AC13 — Conformant by construction
- **Given** any visual edit (selection-driven add/remove, structure add/remove, language conversion, settings edits),
- **When** it is applied,
- **Then** the resulting `song` is schema-conformant.

### AC14 — Raw JSON still never blocks saving
- **Given** the raw-JSON surface,
- **When** the author enters invalid or non-conformant content,
- **Then** it is still stored with an informational notice, without blocking saving.

### AC15 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used.
