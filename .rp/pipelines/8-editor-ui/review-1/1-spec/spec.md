# Spec: Review 1 — Canvas-first editor UI for the Piano block

## Overview

The Piano block stores one song as a JSON document (the block's `song` string attribute) and renders it as grand-staff piano sheet music on the front end. An earlier iteration added a visual editor so authors don't have to hand-write JSON, but it grew into a complex **on-canvas drill-down editor**: nested panels walking the song hierarchy (song → section → measure → event → pitch), with a separate **read-only** preview beside them. It doesn't lean on the tools the Gutenberg editor already provides, and it scales poorly to large songs — reaching a note means walking deep nested panels, and the rendered music plays no part in editing.

This review reworks the editor into a **Gutenberg-native, canvas-first** experience. The **rendered sheet-music canvas becomes the single interactive surface**: the author selects a note (or rest) directly on the staff, and the **block settings sidebar** (`InspectorControls`) shows the settings for that note and for the **measure** and **section** it lives in. Song-level settings live in an always-present **Song** panel in the sidebar. Uncommon settings are hidden by default behind progressive disclosure. Notes are added directly on the canvas, on whichever staff (right- or left-hand) the author adds them to. **Raw-JSON editing remains available** behind the existing mode toggle.

This is an **editor-only** change: the song format/schema, the server render (`render.php`), and the front-end SVG rendering are unchanged. A song saved via the visual editor renders identically to the same song authored in raw JSON. The visual editor retains **full coverage** of the song model; what changes is *how* the author reaches and edits each part — the canvas for selection and structure, the sidebar for settings.

## Requirements

### Canvas-first authoring surface

1. The block editor presents a **canvas-first visual editor** as the default authoring surface. The **rendered sheet-music canvas is the single sheet-music surface** — there is no separate read-only preview pane. The canvas **re-renders live** to reflect every edit, reusing the block's existing notation rendering so its output matches the front end.
2. **Raw-JSON editing remains available** as the alternative, behind the **same mode toggle** the block has today. The visual editor is the default; the two modes are never shown and edited side by side. Switching modes reflects the current state of the same single song.

### Selection and the settings sidebar

3. The author can **select an event — a note or a rest — directly on the canvas** (the rendered staff). "Note" throughout this spec means any event (note or rest).
4. When an event is selected, the **block settings sidebar** (`InspectorControls`) presents that event's settings **and** the settings of the **measure** and the **section** the event belongs to.
5. **Song-level settings** are **always available** in the sidebar as a dedicated **Song** panel, regardless of selection: metadata (`title`, `composer`) and the `defaults` context (`tempo` `bpm`/`beatUnit`, `timeSignature` `beats`/`beatType`, and per-hand `handConfig` — `clef`, `alters`, `octaveShift`).
6. When **nothing is selected**, the sidebar shows **only** the Song panel.
7. **Non-common settings are hidden by default**, with a clear way to reveal and edit them (progressive disclosure). A small **common** set is visible by default. The exact partition of common vs. advanced settings is determined during design.

### Coverage of the song model

8. The visual editor retains **full coverage** of the song model — every part can be created and edited through the canvas + sidebar:
   - **Song**: `metadata` (`title`, `composer`).
   - **Context** (on `defaults` and as per-section overrides): `tempo`, `timeSignature`, and per-hand `handConfig` (`clef`, `alters`, `octaveShift`).
   - **Sections**: optional context overrides and their `measures`.
   - **Measures**: per-hand event lists, `barlineStart`/`barlineEnd`, and standalone (staff-anchored) annotations.
   - **Events**: `type` (note/rest), `duration`, `dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`, and event-anchored annotations.
   - **Pitches** within a note: `step` (note name), `octave`, `alter`.

### Adding, removing, and structure

9. **Adding a note happens on the canvas.** The **hand is determined by which staff** the note is added to: a note added on the right-hand staff belongs to the right hand; one added on the left-hand staff belongs to the left hand.
10. A freshly inserted or empty block **seeds a minimal conformant song** (at least one section and one measure) so the canvas renders an empty grand staff the author can immediately start adding notes to. (No separate "empty-state" screen.)
11. The author can **add and remove** items at every level — sections, measures, events within a hand, and pitches within a chord. Add/remove affordances are **preferably on the canvas** (a soft preference; design may place some in the sidebar).
12. **Reordering** items is **optional**: it may be supported, but may be **omitted** if it would complicate the implementation. (It is not a required capability for this review.)

### Conformance, fidelity, and boundary (carried over unchanged)

13. **Conformant by construction**: the visual controls can only produce schema-conformant songs (constrained choices for enumerated fields, valid note names, in-range numbers). The editor performs **no** musical-correctness/timing checks.
14. **Round-trip fidelity**: editing a song through the visual editor preserves all musical content the format defines, including the **note-name system** the author used (`do` stays `do`, `C` stays `C`). Incidental raw-text details (whitespace, key order, unknown/extra keys) need not be preserved.
15. **Two modes, one song**: the visual editor and the raw-JSON field edit the **same** `song` string attribute in the existing format. A valid change made in one mode is reflected in the other.
16. **Non-empty invalid song**: a non-empty song that is invalid JSON or non-conformant **cannot** be edited visually (the canvas cannot render it). The editor surfaces the validation problem(s) and directs the author to fix it in raw JSON; visual editing resumes once the song is valid. An **empty / whitespace-only** song is treated as "no song" and replaced by the seeded minimal song (Req 10).
17. **Raw JSON never blocks saving**: the raw-JSON surface keeps today's behavior — raw text is stored unconditionally on every change (even when invalid), and validation is informational and never blocks saving.
18. **Editor-only boundary**: the song format/schema (`src/song/schema.js`), the server render (`src/render.php`), and the front-end SVG rendering are unchanged. A song saved via the visual editor renders identically to the same song authored in raw JSON.
19. **WordPress-only dependencies**: implemented using only `@wordpress/*` packages already available to blocks; no outside runtime dependency is added.

## Out of Scope

1. **Audio playback** — future work for the plugin.
2. **Changing the song format / schema** — the song model stays as-is.
3. **Changing the server render or the front-end SVG rendering** — published-page output is unchanged.
4. **Musical-correctness / timing validation** — no checking that a measure's durations fill its time signature.
5. **Best-effort / partial loading of invalid songs** into the visual editor — a non-empty invalid song must be fixed in raw JSON first.
6. **Preserving exact raw-text formatting or unknown/extra keys** on a visual round-trip — only format-defined musical content (incl. the note-name system used) is preserved.
7. **Performance tuning for very large songs** — improving navigation/usability at scale is the goal; raw rendering/serialization performance optimization is not.
8. **Reordering** sections/measures/events/pitches — optional; may be omitted (see Req 12).
9. **Direct selection of whole measures or sections on the canvas** — deferred to a possible follow-up; in this review, measure and section settings are reached through the currently-selected event (Req 4).

## Acceptance Criteria

### AC1 — Canvas-first visual editor is the default, raw JSON still available
- **Given** a Piano block in the editor,
- **When** the author views the block,
- **Then** the rendered sheet-music canvas is presented as the default editing surface, and raw-JSON editing is available behind the existing mode toggle.

### AC2 — Empty block seeds a minimal song
- **Given** a freshly inserted block with an empty song,
- **When** the author views the block in the visual editor,
- **Then** a minimal conformant song (at least one section and one measure) is present and the canvas renders an empty grand staff ready for notes — without requiring raw JSON.

### AC3 — Select a note on the canvas
- **Given** a valid song rendered on the canvas,
- **When** the author clicks a note or rest on the staff,
- **Then** that event becomes the selection and the block settings sidebar shows its settings.

### AC4 — Selected note exposes its measure and section settings
- **Given** an event is selected on the canvas,
- **When** the author opens the block settings sidebar,
- **Then** the sidebar shows the event's settings together with the settings of the measure and the section that event belongs to, and edits made there are reflected in the stored `song`.

### AC5 — Song panel always present; empty selection shows only it
- **Given** a Piano block with a valid song,
- **When** nothing is selected,
- **Then** the sidebar shows only the Song panel (metadata + `defaults` context); and **when** an event is selected, the event/measure/section panels appear in addition to the Song panel.

### AC6 — Canvas updates live on edit
- **Given** a valid song on the canvas,
- **When** the author changes any setting in the sidebar or adds/removes content,
- **Then** the canvas re-renders to reflect the change.

### AC7 — Full coverage of the model
- **Given** a valid song open in the visual editor,
- **When** the author edits any supported element (metadata; context — tempo/time signature/clef/alters/octave shift; dynamics, ties, slurs, crescendo/decrescendo, barlines, annotations; notes/rests; pitches),
- **Then** the change is reflected in the stored `song`.

### AC8 — Add notes on the canvas, hand by staff
- **Given** a valid song on the canvas,
- **When** the author adds a note on the right-hand staff or the left-hand staff,
- **Then** the note is added to the corresponding hand of the target measure, and the canvas updates.

### AC9 — Add and remove at every level
- **Given** a valid song open in the visual editor,
- **When** the author adds or removes a section, a measure, an event within a hand, or a pitch within a chord,
- **Then** the song structure updates accordingly. (Reordering is optional and may be absent.)

### AC10 — Progressive disclosure of uncommon settings
- **Given** an event, measure, section, or the song is being edited in the sidebar,
- **When** the author views the panel,
- **Then** a small common set of settings is visible by default and the remaining (uncommon) settings are hidden behind a reveal affordance that exposes them for editing.

### AC11 — Conformant by construction
- **Given** the author edits the song through the visual editor's controls,
- **When** any edit is applied,
- **Then** the resulting `song` is schema-conformant — the visual controls cannot produce a non-conformant song.

### AC12 — Two modes share one song
- **Given** a song being edited visually,
- **When** the author switches to raw JSON,
- **Then** they see and can edit the same song's raw JSON, and a valid change there is reflected when they return to the visual editor.

### AC13 — Non-empty invalid song is directed to raw JSON
- **Given** a block whose stored song is non-empty but invalid JSON or non-conformant,
- **When** the author views the visual editor,
- **Then** it does not edit the song visually; it surfaces the validation problem and directs the author to fix it in raw JSON, and visual editing becomes available once the song is valid.

### AC14 — Round-trip preserves musical content and note-name system
- **Given** a conformant song authored in raw JSON that uses Spanish note names (e.g. `do`),
- **When** the author edits it via the visual editor and saves,
- **Then** all format-defined musical content is preserved, including the note names remaining in the system they were written in (`do` stays `do`).

### AC15 — Raw field still never blocks saving
- **Given** the raw-JSON editing surface,
- **When** the author enters invalid JSON or non-conformant content,
- **Then** the content is still stored and an informational validation message is shown, without blocking saving.

### AC16 — Front-end rendering unchanged
- **Given** a song saved via the visual editor,
- **When** the published page is viewed,
- **Then** the front-end sheet-music rendering is identical to the same song authored in raw JSON.

### AC17 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used; no outside runtime dependency is introduced.
