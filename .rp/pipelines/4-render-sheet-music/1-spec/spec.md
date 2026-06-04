# Spec: Render the Piano block's song as visual sheet music (grand staff)

## Overview

The Piano block (`piano-block/piano`) stores a complete piano song as a custom, dependency-free JSON document in its single `song` string attribute. The document models a **grand staff** — a right-hand part and a left-hand part read together. Today the block does nothing visual with that data: the editor offers a raw-JSON text field with non-blocking validation, and the frontend (a dynamic block) simply echoes the raw JSON string inside a `<pre>`.

This feature turns that stored data into **readable piano sheet music on the frontend**. When a reader views a post containing a Piano block whose song is valid, the block displays a normal-looking printed piano score — two clefs braced together, key/time signatures, beamed notes over chords, ties, slurs, dynamics, a tempo marking, and measure numbers — instead of the raw text. The notation is drawn by the project's own rendering engine, **without** any third-party music-notation library.

Scope is deliberately focused: **this issue renders on the frontend only**. The editor is left exactly as it is today (raw-JSON field + validation notice); a live in-editor preview is a future issue. The bar for "done" is **recognizable and data-faithful** notation — clearly a standard piano score that correctly reflects the song's data — not professional engraving quality.

### The song format (input to the renderer)

The renderer consumes the song document shipped by the storage feature. Its shape (all field names are normative):

- **`song`** = `{ metadata?, defaults?, sections }`. `sections` is the only required member.
- **`metadata`** = `{ title?, composer? }` — optional free-text bibliographic data.
- **`defaults`** and each **`section`** carry the *constant musical context*: `tempo` (`{ bpm, beatUnit? }`), `timeSignature` (`{ beats, beatType∈{1,2,4,8,16,32} }`), and per-hand `rightHand`/`leftHand` **handConfig** = `{ clef?∈{treble,bass,alto,tenor}, alters?, octaveShift?∈[-2..2] }`. A section overrides only the fields it changes; everything else is inherited from `defaults`. `alters` is a map of note-name → integer alteration (−2..+2) acting as key-signature-like default accidentals for that hand; it replaces wholesale, it does not merge. A **new section** is how the format expresses any mid-song change of tempo, time signature, clef, default accidentals, or octave shift.
- A **`section`** = `{ tempo?, timeSignature?, rightHand?, leftHand?, measures }`. `measures` is required.
- A **`measure`** = `{ rightHand?, leftHand?, barlineStart?, barlineEnd? }`. Each hand is an array of **events**; both hands are optional (a measure may have one hand or none). Barlines are each one of `regular | repeat-start | repeat-end | double | final` (absent = regular).
- An **`event`** = `{ type∈{note,rest}, duration∈{whole,half,quarter,eighth,sixteenth,thirty-second}, dots?∈[0..2], pitches?, dynamic?∈{pp,p,mp,mf,f,ff,sf,sfz}, chordSymbol?(free text), tie?∈{start,stop}, slur?∈{start,stop} }`. A `note` carries a non-empty `pitches` array (a chord is several pitches in one event); a `rest` omits it.
- A **`pitch`** = `{ step, octave∈[0..9], alter?∈[-2..2] }`. `step` is a note name in English (`C D E F G A B`) or Spanish solfège (`do re mi fa sol la si`), case-insensitive. `alter` is a per-note accidental that overrides the section's `alters` default for that note name.

A song is **conformant** when it satisfies this format. Conformance is exactly what the project's existing validator (`validateSong` in `src/song/validate.js`, driven by the schema-as-data in `src/song/schema.js`) checks: valid JSON, correct structure, and values within the closed vocabularies above. The format performs **no musical-timing validation** — a measure's events need not sum to its time signature, and the two hands need not be equal in length. The empty string `""` is the "no song" state, never a song document.

## Requirements

### Rendering & coverage

1. On the frontend, when a Piano block's stored `song` is conformant, the block renders it as visual piano sheet music: a braced **grand staff** with the right-hand part on the upper staff and the left-hand part on the lower staff. This rendered notation replaces the current raw-JSON `<pre>` output entirely.
2. The rendering covers the full set of notation the stored format can express:
   - per-hand **clefs**: `treble`, `bass`, `alto`, `tenor`;
   - **key-signature-like default accidentals** from each hand's `alters`;
   - **time signature** (`beats`/`beatType`);
   - **tempo marking** rendered as text from `tempo.bpm` and optional `tempo.beatUnit` (e.g. "♩ = 120");
   - **noteheads, stems, flags**, and **beams** joining flagged notes;
   - **dotted notes** (1 and 2 dots);
   - **rests** of every duration;
   - **accidentals** including doubles, covering both per-hand defaults (`alters`) and per-note overrides (`pitch.alter`), in the range −2..+2;
   - **chords** (multiple `pitches` in one event) drawn as stacked noteheads;
   - **ties** and **slurs** (from the `tie`/`slur` start/stop markers);
   - **dynamics** (`pp`…`sfz`);
   - **chord symbols** (free-text `chordSymbol`);
   - **barlines**: regular, repeat-start, repeat-end, double, final;
   - **octave shifts** / ottava from `octaveShift` (±1 = 8va/8vb, ±2 = 15ma/15mb);
   - **measure numbers**.
3. The rendering reflects **multiple sections and mid-song changes**: when a new section changes the tempo, time signature, a hand's clef, its default accidentals, or its octave shift, that change is shown at the start of that section's measures.
4. Each pitch is placed on the **correct staff line or space** for the active clef of its hand, with **ledger lines** drawn when the pitch sits outside the staff. Accidentals are shown correctly, with a per-note `alter` taking precedence over the hand's `alters` default for that note name.
5. Within each measure the two hands are **vertically aligned** on a shared per-measure time grid, and horizontal spacing is reasonable and readable. The result must be clearly recognizable as a standard piano score (the "recognizable + data-faithful" bar); precise engraving conventions are not required.

### Layout

6. The score **wraps into multiple stacked grand-staff systems** (lines) sized to the available container width, and **reflows responsively** as the width changes. It remains usable at narrow and mobile widths.

### Frontend display states

7. When the stored `song` is **empty or whitespace**, the block outputs nothing.
8. When the stored `song` is **present but not renderable** (invalid JSON or non-conformant), the block outputs nothing — no raw-JSON echo and no reader-facing error message. Only a conformant song produces visible output.
9. The renderer is **robust to any conformant song** and never errors on conformant input. It must not assume a measure's events sum to the time signature or that the two hands have equal total length; it renders the events present, best-effort. It still draws the braced two-staff grand staff when a measure has only one hand or an empty hand.

### Constraints

10. **No third-party music-notation library** (e.g. VexFlow, abcjs, OpenSheetMusicDisplay, Verovio) is added or used. The rendering engine is the project's own code. A standalone, open-licensed *asset* such as a music font is permitted (an asset is not a "library" in this sense).
11. The notation **may rely on client-side JavaScript** on the frontend; rendering without JavaScript (and presence in the initial server HTML for crawlers) is not required.
12. The implementation continues to satisfy the project's existing baseline: it builds with the current `@wordpress/scripts` toolchain, passes Biome lint/format, and targets the project's supported WordPress/PHP versions.

### Editor

13. The **editor is unchanged** by this issue: the block keeps its raw-JSON authoring field and its non-blocking validation notice, and does **not** render notation in the editor.

### Presentation

14. **Accessibility:** the rendered notation exposes a concise **accessible label** to assistive technology (e.g. a graphic/image role with an accessible name such as the song's `metadata.title`, or "Piano sheet music" with title/composer when present). A rich, screen-reader-navigable description of the music is not required.
15. **Color:** the notation may be drawn in a fixed color; adapting to the theme's colors is not required.

### Forward compatibility

16. The approach must **not preclude** later interactive features (a moving playhead, per-note highlighting synced to audio, playback), but none of these are built in this issue.

## Out of Scope

- **In-editor notation / live preview.** The editor keeps only today's raw-JSON field + validation notice; no notation is rendered in the editor. (Consequently the "single renderer shared by editor and frontend" concern does not apply here — only the frontend renders.)
- **Showing raw JSON or an error on the frontend** for non-renderable songs. The frontend shows rendered notation or nothing; the existing raw `<pre>` passthrough is removed.
- **Professional engraving quality** — precise optical spacing, collision avoidance, beam-slope/stem-direction rules — and matching any specific reference score.
- **No-JS / server-side-rendering guarantee.** Notation need not appear with JavaScript disabled or in the initial HTML for crawlers.
- **Rich, screen-reader-navigable description** of the musical content (only a basic accessible label is in scope).
- **Theme-adaptive color** (e.g. `currentColor`, light/dark adaptation).
- **Displaying `metadata.title` / `metadata.composer`** as visible text or a score heading (they may still feed the accessibility label).
- **New authoring UX** — no visual note-input UI; songs are still entered as raw JSON, unchanged from today.
- **Audio, playback, a moving playhead, per-note highlighting, and any interactivity** — static notation only.
- **Changes to the song format / storage** (`src/song/*`, `docs/song-format.md`). This issue consumes the format as-is; it does not redefine it.

## Acceptance Criteria

1. **Renders notation instead of raw data.**
   Given a published post containing a Piano block whose `song` is a conformant grand-staff document,
   When a reader views the post,
   Then the block displays piano sheet music as a braced grand staff with a right-hand (upper) and left-hand (lower) staff,
   And the raw JSON text is not shown.

2. **Full notational coverage.**
   Given a conformant song that exercises per-hand clefs, `alters`-based default accidentals, a time signature, a tempo, notes and rests of varying durations with 1–2 dots, beamed note groups, chords, per-note accidentals including doubles, ties, slurs, dynamics, chord symbols, every barline type, an octave shift, and measure numbers,
   When the block is rendered on the frontend,
   Then each of those elements is present in the notation and attached to the correct event or position.

3. **Correct pitch placement.**
   Given a note with a specific `step`, `octave`, and optional `alter` under a given hand clef,
   When it is rendered,
   Then the notehead sits on the correct staff line or space for that clef (with ledger lines when the pitch is outside the staff),
   And its accidental is shown correctly, with a per-note `alter` overriding the hand's `alters` default for that note name.

4. **Mid-song section changes.**
   Given a song whose second section changes the time signature, a hand's clef, the tempo, the default accidentals, or the octave shift relative to the first,
   When it is rendered,
   Then the change is shown at the start of that section's measures.

5. **Per-measure alignment and responsive wrapping.**
   Given a song with more measures than fit the container width and both hands present,
   When it is rendered at a given width and then at a narrower width,
   Then the measures wrap onto multiple stacked grand-staff systems sized to the container at each width,
   And within every measure the two hands are vertically aligned.

6. **Empty song renders nothing.**
   Given a Piano block whose `song` is empty or whitespace,
   When a reader views the post,
   Then the block outputs nothing.

7. **Non-renderable song renders nothing.**
   Given a Piano block whose `song` is present but is invalid JSON or non-conformant,
   When a reader views the post,
   Then the block outputs nothing — no raw JSON and no error message.

8. **Robust to musically-unbalanced songs.**
   Given a conformant song in which a measure's events do not sum to its time signature and the two hands have unequal total duration,
   When it is rendered,
   Then the block renders the notation best-effort without error and still draws both staves.

9. **One-hand / empty-hand measures.**
   Given a conformant measure that contains only one hand (or an empty hand array),
   When it is rendered,
   Then both staves of the grand staff are still drawn, with the present hand's events on its staff.

10. **No notation library.**
    Given the shipped plugin and its build,
    When its dependencies are inspected,
    Then no third-party music-notation library is present,
    And the notation is produced by the project's own code (a standalone open-licensed music-font asset, if used, is permitted).

11. **Editor unchanged.**
    Given the Piano block in the editor,
    When the author selects and edits it,
    Then the editor still presents the raw-JSON field and its non-blocking validation notice,
    And no notation is rendered in the editor.

12. **Accessible label.**
    Given a rendered score on the frontend,
    When it is inspected with assistive technology,
    Then the notation graphic exposes a concise accessible name (e.g. the song's title, or "Piano sheet music" with composer when present).
