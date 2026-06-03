# Spec: Store song information in the Piano block

## Overview

The Piano block (`piano-block/piano`) is a dynamic, server-rendered WordPress block scaffolded in issue #1 (`save: null`; front-end output produced by `src/render.php`). This feature gives the block the ability to **store a complete piano song as structured data** in a single block attribute named `song`.

A song spans a **grand staff** — a right-hand and a left-hand part — and must be able to capture the musical detail needed to represent real piano scores (notes, chords, rests, durations, accidentals, clefs, time signatures, tempo, dynamics, chord symbols, ties, slurs, repeats, octave shifts, and metadata) in a **custom, dependency-free JSON format** owned by this project.

This issue establishes three things: the **storage attribute and its format**; a **minimal authoring affordance** (a raw-JSON field in the editor that validates conformance); and the **front-end output** (`render.php` serializes the stored song to a string). It does **not** include a visual notation authoring UI, audio playback, or notation rendering — see Out of Scope. The intended v1 author is someone comfortable editing JSON directly, since the only authoring affordance is a raw-JSON field.

## Requirements

### Storage & format

1. The block defines a single attribute named `song` that persists with the block instance.
2. The song is a **custom, dependency-free JSON document** — no external notation format (MusicXML / ABC / MIDI), no third-party music libraries, and no nested innerBlocks.
3. The format models a **grand staff**: a right-hand part and a left-hand part that can be represented time-aligned.
4. The format must be able to represent the following in v1:
   - Notes and rests with durations (whole, half, quarter, eighth, sixteenth, thirty-second) and dotted durations.
   - Pitch as a note name + octave, with a per-note accidental ranging from double-flat to double-sharp.
   - Chords — several pitches sounding together in a single event.
   - Note names in **both** English letters (C–B) and Spanish solfège (do–si), accepted and treated as **equivalent** (do=C, re=D, mi=E, fa=F, sol=G, la=A, si=B) and mixable within one song.
   - Per-hand context: clef (treble / bass / alto / tenor); per-hand default accidentals (an alteration applied to a note name); and a per-hand octave-shift marking (ottava, e.g. 8va / 8vb).
   - Mid-song changes to tempo, clef, time signature, per-hand default accidentals, and per-hand octave-shift.
   - Time signature (beats + beat unit) and tempo (beats-per-minute + beat unit).
   - Dynamics (pp, p, mp, mf, f, ff, sf, sfz); chord symbols (free text); ties and slurs (as start / stop); and barlines including repeats.
   - Song metadata: title and composer.
5. The format **starts minimal and grows additively**: there is no schema `version` field; future capabilities are added as optional fields.
6. The format must **not preclude future audio playback** — it retains pitch, octave, duration, and tempo precision. Any representational shorthand (e.g. the per-hand octave-shift marking) must combine deterministically with per-note data to yield a concrete sounding pitch.

### Authoring (editor)

7. The block's editor provides a **minimal raw-JSON input** (e.g. a text / code field) that lets an author paste or edit the `song` JSON directly.
8. The editor **validates** the entered content for **full structural / field conformance** to the song format: required fields present, values drawn from the allowed sets (durations, clefs, dynamics, note names, barlines, …), and correct types and nesting — the level of checking a JSON Schema expresses. When the content is non-conformant, the editor surfaces a **clear, visible error**.
9. Editor validation is **informational only and does not block persistence**: the author's raw input is stored in `song` even when it is non-conformant.
10. A **freshly inserted block has no song**: `song` starts empty and the field is blank. Conformance validation applies only to non-empty input.

### Front end (render)

11. `src/render.php` outputs the **stored song content serialized as a string**. It performs **no validation** and makes no well-formedness guarantee — it outputs whatever is stored.
12. When the block has no song, the front end outputs **nothing meaningful** (no song content).
13. The front-end output is **safely escaped**, so arbitrary stored content cannot introduce unsafe markup or executing script (no XSS).

### Platform

14. The block remains a **dynamic block** (`save: null`, server-rendered via `render.php`), building on the issue-#1 scaffold: WordPress 6.9+, PHP 7.4+, built with `@wordpress/scripts`, `apiVersion` 3, linted with Biome, source under `src/`.

## Out of Scope

- Rich / visual notation authoring UI — anything beyond the single raw-JSON field.
- Audio playback / sound generation.
- Front-end notation rendering (drawing staves and notes); `render.php` only emits the stored content as text.
- Render-time validation or guarding — the front end does not validate stored data.
- Blocking persistence of invalid input — the editor never prevents saving; its validation errors are informational only.
- Musical-timing validation — verifying that a measure's events fill its time signature, or that the two hands stay time-aligned. Timing is the author's responsibility in v1.
- Richer notation elements — articulations, ornaments, pedal, fingering, tuplets, voltas, polyphony / multiple voices per hand, lyrics, etc. (future additive work).
- A schema `version` field and migrations.
- Import / export of standard notation formats (MusicXML / ABC / MIDI).
- Performance optimization for very large songs.

> The following are intentionally **deferred to the design phase**, not excluded from the product: the exact JSON structure and field names; how the `song` attribute is typed so it can hold raw (possibly non-conformant) input; the octave-shift magnitude range; note-name case handling / normalization; and the render output formatting (compact vs pretty) and wrapping element.

## Acceptance Criteria

**AC1 — `song` attribute exists and persists**
- **Given** a Piano block, **When** its `song` attribute is set and the post is saved and reloaded, **Then** the same `song` value is present on the block.

**AC2 — New block starts empty**
- **Given** a freshly inserted Piano block, **When** the editor loads it, **Then** the raw-JSON field is blank and no song content is stored.

**AC3 — Empty block renders nothing meaningful**
- **Given** a Piano block with no song, **When** the block is rendered on the front end, **Then** no song content is output.

**AC4 — Conformant song is accepted without error**
- **Given** the editor's raw-JSON field, **When** the author enters JSON that conforms to the song format, **Then** no validation error is shown and the value is stored in `song`.

**AC5 — The format covers all required musical elements**
- **Given** a song that uses notes, rests, chords, dotted durations, per-note accidentals, both English and Spanish note names, per-hand clef / default accidentals / octave-shift, mid-song tempo / clef / time-signature / accidental changes, dynamics, chord symbols, ties, slurs, repeat barlines, and title / composer metadata, **When** it is validated in the editor, **Then** it is accepted as conformant.

**AC6 — Non-conformant input is flagged but still stored**
- **Given** the raw-JSON field, **When** the author enters content that is not valid JSON or does not conform to the song format, **Then** the editor shows a clear validation error **and** the entered content is still stored in `song`.

**AC7 — Front end outputs the stored song as a string**
- **Given** a Piano block whose `song` holds content, **When** the block is rendered on the front end, **Then** the output contains the stored song serialized as a string.

**AC8 — Front-end output is escaped**
- **Given** a `song` value containing characters significant in HTML (e.g. `<`, `>`, `&`, quotes) or markup that could execute script, **When** the block is rendered on the front end, **Then** the output is escaped so that no unsafe markup or script executes.

**AC9 — Both note-name systems are accepted**
- **Given** a pitch written with an English note name (e.g. `G`) and the same pitch written with the equivalent Spanish solfège name (e.g. `sol`), **When** each song is validated, **Then** both are accepted as conformant. (The format documents the two systems as equivalent for future audio use.)

**AC10 — Validation is structural only, not musical-timing**
- **Given** a song that is structurally conformant but whose measure durations do not fill the time signature, or whose two hands are not time-aligned, **When** it is validated in the editor, **Then** it is accepted (no timing error is raised).
