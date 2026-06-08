# Spec: Editor UI for editing the song

## Overview

The Piano block stores one song as a JSON document (the block's `song` string attribute) in the plugin's own song format, and renders it as piano sheet music on the front end. Today the only way to author a song in the editor is a single raw-JSON text field.

This feature adds a **visual (friendly) editing UI** in the block editor so musically literate authors can build and edit a song without hand-writing JSON. The visual UI is the friendly default; **raw JSON editing remains available** as an alternative. Both operate on the same single song, and the editor shows a **live preview** of the rendered sheet music as the author works.

This is an **editor-only** feature: the song format/schema, the server render, and the front-end SVG rendering are unchanged.

## Requirements

### Visual editor — coverage

1. The block editor presents a visual UI for authoring the song. It is the friendly default surface; raw JSON editing is also available as an alternative.
2. The visual UI provides **full coverage** of the song model — every part can be created and edited:
   - **Song**: `metadata` (`title`, `composer`).
   - **Context** (on `defaults` and per-section overrides): `tempo` (`bpm`, `beatUnit`), `timeSignature` (`beats`, `beatType`), and per-hand `handConfig` for the right and left hand (`clef`, `alters` map, `octaveShift`).
   - **Sections**, each carrying optional context overrides and its `measures`.
   - **Measures**: per-hand event lists, `barlineStart`/`barlineEnd`, and standalone (staff-anchored) annotations.
   - **Events**: `type` (note/rest), `duration`, `dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`, and event-anchored annotations.
   - **Pitches** within a note: `step` (note name), `octave`, `alter`.
3. The visual UI supports **adding, removing, and reordering** items at every level — sections, measures, events within a hand, and pitches within a chord — in addition to editing existing values.

### Visual editor — behavior

4. The visual editor is **conformant by construction**: its controls only allow producing schema-conformant songs (constrained choices for enumerated fields, valid note names from the format's vocabulary, in-range numbers). The editor performs **no** musical-correctness/timing checks (it does not verify that a measure's event durations fill its time signature).
5. The visual editor shows a **live preview** of the rendered sheet music, reusing the block's existing SVG rendering, which updates as the author edits a valid song.
6. Target authors are **musically literate**; the UI may use standard musical vocabulary (note names, durations, clefs, dynamics) without heavy explanation.

### Two editing modes on one song

7. The visual editor and the raw JSON edit the **same single song** — the block's existing `song` string attribute in the existing format. The visual UI is the default; the exact placement, prominence, and switch mechanism between the two are left to design. The two modes are not shown and edited simultaneously side by side.
8. Switching to a mode reflects the current state of the song.
9. **Valid-song requirement**: the visual editor operates only on a valid, conformant song.
   - An **empty / whitespace-only** song is "no song": the visual editor starts fresh, letting the author begin a new song.
   - A **non-empty** song that is invalid JSON or non-conformant **cannot** be edited visually. The editor surfaces the validation problem(s) and directs the author to fix the song in raw JSON. Visual editing resumes once the song is valid. (No best-effort partial loading.)
10. **Raw JSON option preserved**: the raw JSON editing surface keeps today's behavior — the raw text is stored unconditionally on every change (even when invalid), and validation is informational and never blocks saving.

### Fidelity, dependencies, boundary

11. **Round-trip fidelity**: editing a song through the visual editor preserves all musical content the song format defines, including the **note-name system** the author used (English vs Spanish — e.g. `do` stays `do`, not silently converted to `C`). Incidental raw-text details (whitespace, key ordering, and unknown/extra keys the schema permissively ignores) need not be preserved.
12. **WordPress-only dependencies**: implemented using only `@wordpress/*` packages already available to blocks; no outside dependencies are added.
13. **Editor-only boundary**: the song format/schema (`src/song/schema.js`), the server render (`render.php`), and the front-end SVG rendering are unchanged. A song saved via the visual editor renders identically to the same song authored in raw JSON.

## Out of Scope

1. **Audio playback** — already future work for the plugin.
2. **Changing the song format / schema** — the song model stays as-is.
3. **Changing the server render or the front-end SVG rendering** — published-page output is unchanged.
4. **Musical-correctness / timing validation** — no checking that a measure's durations fill its time signature.
5. **Best-effort / partial loading of invalid songs** into the visual editor — a non-empty invalid song must be fixed in raw JSON first.
6. **Preserving exact raw-text formatting or unknown/extra keys** on a visual round-trip — only format-defined musical content (incl. the note-name system used) is preserved.
7. **Performance optimization for very large songs** — the live preview should be responsive for typical songs, but large-song tuning is not a goal.

## Acceptance Criteria

### AC1 — Visual editor is the default authoring surface
- **Given** a Piano block in the editor,
- **When** the author views the block,
- **Then** a visual UI for editing the song is presented as the default, and raw JSON editing is also available.

### AC2 — Start a song from scratch
- **Given** a freshly inserted block with an empty song,
- **When** the author uses the visual editor,
- **Then** they can begin building a new song from scratch (no raw JSON required).

### AC3 — Edit any part of the model
- **Given** a valid song open in the visual editor,
- **When** the author edits any supported element (metadata, context — tempo/time signature/clef/alters/octave shift, dynamics, ties, slurs, crescendo/decrescendo, barlines, annotations, notes/rests, pitches),
- **Then** the change is reflected in the stored `song`.

### AC4 — Add, remove, and reorder structure
- **Given** a valid song open in the visual editor,
- **When** the author adds, removes, or reorders a section, a measure, an event within a hand, or a pitch within a chord,
- **Then** the song structure updates accordingly.

### AC5 — Conformant by construction
- **Given** the author edits the song through the visual editor's controls,
- **When** any edit is applied,
- **Then** the resulting `song` is schema-conformant — the visual controls do not allow producing a non-conformant song.

### AC6 — Live preview updates
- **Given** a valid song open in the visual editor,
- **When** the author makes an edit,
- **Then** the rendered sheet-music preview updates to reflect the edit.

### AC7 — Raw JSON remains available and shares the song
- **Given** a song being edited visually,
- **When** the author switches to raw JSON editing,
- **Then** they see and can edit the same song's raw JSON, and a valid change made there is reflected when they return to the visual editor.

### AC8 — Non-empty invalid song is directed to raw JSON
- **Given** a block whose stored song is non-empty but invalid JSON or non-conformant,
- **When** the author opens the visual editor,
- **Then** the editor does not edit it visually; it surfaces the validation problem and directs the author to fix it in raw JSON, and visual editing becomes available once the song is valid.

### AC9 — Round-trip preserves musical content and note-name system
- **Given** a conformant song authored in raw JSON that uses Spanish note names (e.g. `do`),
- **When** the author edits it via the visual editor and saves,
- **Then** all format-defined musical content is preserved, including the note names remaining in the system they were written in (`do` stays `do`).

### AC10 — Front-end rendering unchanged
- **Given** a song saved via the visual editor,
- **When** the published page is viewed,
- **Then** the front-end sheet-music rendering is identical to the same song authored in raw JSON.

### AC11 — Raw field still never blocks saving
- **Given** the raw JSON editing surface,
- **When** the author enters invalid JSON or non-conformant content,
- **Then** the content is still stored and an informational validation message is shown, without blocking saving — matching today's behavior.

### AC12 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used; no outside runtime dependency is introduced.
