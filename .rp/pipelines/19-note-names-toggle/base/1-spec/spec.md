# Spec: Frontend toggle to show note names

## Overview

The Piano block renders a song as engraved sheet music (a grand staff with noteheads, stems, accidentals, clefs, and related notation) on the published frontend. Today the frontend shows no pitch names anywhere on the score.

This feature adds two things to the frontend:

1. A viewer-facing control that turns the display of note names on and off.
2. The note-name display itself: when turned on, each nameable note on the score shows its pitch name.

A "note name" is the bare pitch letter or syllable in the song's own notation system (for example "C" in English or "do" in Spanish/solfège), without any accidental marker and without any octave number. The toggle only shows or hides these names; it never changes which notation system is used (that is a property of the song).

The feature is frontend-only. The block editor is unchanged: it gains no toggle, and the editor's score canvas continues to show no note names.

This is the first interactive (viewer-operable) UI on the block's frontend; until now the frontend has only rendered the score.

## Requirements

### Functional

1. **A toggle control exists on the frontend.** On a published page or post, a rendered Piano block that draws nameable notes displays a viewer-facing control that toggles note-name display on and off. The control is visibly associated with its own block's score.

2. **Toggling shows and hides note names.**
   - When the toggle is ON, a note name is displayed for every nameable note in the rendered score.
   - When the toggle is OFF, no note names are displayed, and the score appears exactly as it does today (the current visual is unchanged).
   - Activating the control flips between these two states.

3. **The default state is OFF.** On initial page load, note names are hidden; the viewer must act to reveal them.

4. **A "note name" is the bare pitch letter or syllable in the song's notation system.**
   - The displayed name is the note's step in the song's notation system: an English letter (C, D, E, …) or a Spanish/solfège syllable (do, re, mi, …).
   - The notation system is determined by the song itself, not by the viewer. The toggle only shows or hides names; it never lets the viewer change the system.
   - The name contains NO accidental marker: a C-sharp note shows "C", a B-flat note shows "B". (The accidental remains visible as the existing accidental glyph drawn next to the notehead; it is simply absent from the name text.)
   - The name contains NO octave number: a C in one octave and a C in another both show "C".
   - For the same notes, the names shown on the frontend match the note-name strings the editor already uses (same system resolution, same spellings).

5. **Coverage of names.**
   - Names apply to notes in BOTH hands/staves (treble and bass).
   - For a chord (a stack of simultaneous pitches), every notehead in the stack gets its own name.
   - Rests get NO name.
   - Tied notes are each named; a tie does not suppress naming on either end.
   - Every note in a conformant song is nameable.

6. **Per-instance independence.** Each Piano block instance on a page has its own independent toggle and state. Toggling note names on one block must NOT affect any other Piano block on the same page.

7. **The control reflects its state and reverses cleanly.**
   - The control communicates its current on/off state to assistive technology.
   - The toggle is fully reversible and idempotent: turning names ON, then OFF, then ON again returns to a visually identical names-on result, with no drift across any number of toggles.

8. **The control label is human-readable and translatable.** The control has a clear, viewer-facing label (for example, "Show note names"), provided as a translatable string under the `piano-block` text domain, consistent with how the block already supplies translated strings to the frontend.

9. **Names survive responsive redraws.** When the block redraws because its rendered width changed, the current toggle state is preserved: if names were on, they remain on after the redraw; if off, they remain off.

10. **Note names remain legible.** When names are shown, they must be readable and must not render in an illegibly overlapping way — neither with each other nor with existing score elements (noteheads, accidentals, ledger lines, dynamics, annotations, tempo, ottava markings).

### Gating (when the control appears)

11. **The control appears only when the block draws nameable notes.**
    - An empty or whitespace-only song renders no block at all on the frontend, so no control and no names appear.
    - An invalid or non-conformant song renders nothing on the frontend, so the control does NOT appear.
    - A conformant song that contains no nameable notes (for example, only rests) renders without the control, because there is nothing to name.

### Constraints

12. **WordPress Interactivity API (hard constraint).** The frontend toggle interactivity must be built with the WordPress Interactivity API. The toggle state must be held per block instance (not in shared/global state), so that Requirement 6 holds.

13. **Editor behavior unchanged.** This feature is frontend-only. The block editor gains no toggle, and the editor's score canvas continues to show no note names. Note-name rendering must be opt-in (defaulting to off) so that, when names are not requested, the notation output is byte-identical to today's output. The editor canvas and the published frontend currently emit byte-identical notation output for the same song (a string-equality guarantee an existing unit test enforces); that equality must continue to hold for the names-off default. (See AC10 for the byte-identical assertion and AC11 for the standing editor-scope guarantee.)

## Out of Scope

- **Persistence** of the viewer's choice across page reload or navigation. The toggle resets to its default (OFF) on each load.
- **Page-wide or shared** toggling across multiple block instances (this would contradict Requirement 6).
- **Viewer choice of notation system** (English vs. solfège). The system follows the song.
- **Accidentals or octave in the name text.** Names stay bare step letters/syllables (per Requirement 4).
- **Screen-reader announcement or live-region narration** of each individual note name when toggled. The control's on/off state is exposed to assistive technology; per-name screen-reader exposure is deferred.
- **Print styling** for note names.
- **Adding a toggle to the editor.**
- **The exact on-screen placement of the toggle control**, and **the exact placement and collision-avoidance geometry of the note-name text** on the score, are design-phase decisions. The spec fixes only the observable outcomes: the control is visible and associated with its block's score (Requirement 1), and the names are legible and non-overlapping (Requirement 10).

## Acceptance Criteria

**AC1 — Control present, default off.**
Given a published page with a conformant, note-bearing Piano block,
When the page loads,
Then the rendered output shows a toggle control, and no note names are displayed.

**AC2 — Toggle shows and hides all names.**
Given a conformant, note-bearing Piano block with note names hidden,
When the viewer activates the control,
Then a note name appears for every nameable note (both staves, and every notehead in every chord);
And when the viewer activates the control again,
Then all note names are removed and the score's original (names-off) visual is restored.
(AC2 covers a single off → on → off cycle restoring the original visual; AC6 extends this to no-drift idempotency across repeated cycles, and AC10 pins what "original visual" means in byte terms.)

**AC3 — Name content follows the song's system, with no accidental and no octave.**
Given a note that sounds as a C-sharp,
When note names are shown for a song in English,
Then that note shows "C" (no "#", no octave digit);
And when the same note is shown for a song in Spanish,
Then that note shows "do".
The bare step is shown regardless of how the note is altered: whether the sharp comes from a per-note alteration (the note's own `pitch.alter`) or from an inherited key-signature-style default accidental (the hand/section `handConfig.alters` map), the name is the bare step "C" / "do" with no accidental in the text. The visible accidental glyph next to the notehead is unaffected.

**AC4 — Per-instance independence.**
Given two Piano blocks (A and B) on one page, each with note names hidden,
When the viewer turns note names on for block A,
Then block A shows note names and block B shows none;
And the same independence holds when toggling block B instead.

**AC5 — State exposed to assistive technology.**
Given the toggle control,
When note names are on versus off,
Then the control exposes its corresponding on/off state to assistive technology.

**AC6 — Reversible and idempotent (no drift).**
Given a names-on rendering of a conformant Piano block,
When the viewer toggles names OFF and then ON again, any number of times,
Then the resulting names-on rendering is identical to the first names-on rendering, and each names-off rendering is identical to the original names-off visual.
(AC6 generalizes AC2's single-cycle restoration to no-drift idempotency across repeated toggles.)

**AC7 — Names survive a width change.**
Given a Piano block with note names shown,
When the block's rendered width changes and the score redraws,
Then the note names remain visible after the redraw.

**AC8 — Translatable label.**
Given the toggle control,
When it is rendered,
Then its label comes from a translatable string under the `piano-block` text domain.

**AC9 — No nameable notes, no control.**
Given a Piano block whose conformant song contains no nameable notes (for example, only rests),
When the page loads,
Then the block renders without the toggle control.

**AC10 — Names off produces byte-identical output (frontend default and editor equivalence).**
Given a conformant song,
When the frontend renders that song with note names not requested (the default), and the editor canvas renders the same song,
Then the frontend's rendered score output is byte-identical to today's frontend output for that song (no added, removed, or changed markup of any kind when names are off);
And the editor canvas's rendered output is byte-identical to the names-off frontend output for the same song (the existing editor-canvas / frontend SVG string-equality is preserved).
(This is the literal, machine-checkable guarantee — string equality of the emitted output, not merely "looks the same." "Byte-identical to today's output" is the bar AC2's "original visual restored" refers to.)

**AC11 — Editor scope: no toggle, no names on the editor canvas, ever.**
Given the block editor,
When a Piano block is edited (under any condition, including when another Piano block elsewhere has note names turned on),
Then the editor gains no note-name toggle control, and the editor's score canvas shows no note names.

**AC12 — Invalid or empty song, no control.**
Given a Piano block whose song is empty/whitespace, or invalid/non-conformant,
When the page loads,
Then the frontend shows no score and no toggle control.

**AC13 — Names legible and non-overlapping.**
Given a conformant Piano block with note names shown (including dense chords and passages, and scores that also contain dynamics, annotations, tempo, or ottava text),
When the names are displayed,
Then each name is legible and does not render illegibly overlapping other names or other score elements.
