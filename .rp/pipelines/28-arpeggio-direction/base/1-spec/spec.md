# Spec — Support arpeggios with direction

## Overview

A chord in the piano block can be marked as **arpeggiated** (a "rolled" chord).
An arpeggio is a chord whose notes are sounded in quick succession — bottom to
top, or top to bottom — rather than struck simultaneously. In standard music
notation it is drawn as a **vertical wavy line** to the left of the chord's
noteheads, and its **direction** is shown by an arrowhead on that line: upward,
downward, or no arrow at all (a plain, undirected roll).

This feature lets an author mark any chord as arpeggiated and choose its
direction, and it makes that marking appear when the music is rendered. It adds
one optional, per-chord marking to the song format, an editor control to set it,
and the rendered wavy-line glyph. The marking is part of the existing family of
per-event notation markings (such as dynamics, ties, and slurs) and behaves
consistently with them.

## Requirements

### Functional behavior

- **R1 — Optional per-chord marking.** A chord (a single note event) may carry an
  optional arpeggio marking. The marking's value is one of a closed set of three:
  **up**, **down**, or **nondirectional**. When the marking is absent, the chord
  is not arpeggiated. There is no separate "off" value — absence is the only way
  to express "not arpeggiated."

- **R2 — Direction semantics.** When present, the marking means the chord is
  arpeggiated, and its value gives the direction:
  - **up** — the chord rolls bottom-to-top, shown with an upward arrowhead;
  - **down** — the chord rolls top-to-bottom, shown with a downward arrowhead;
  - **nondirectional** — a plain wavy line with no arrowhead (an undirected roll).

- **R3 — Rendered form.** When the marking is set on a chord that is rendered, the
  chord shows a vertical wavy line to the **left** of its noteheads, spanning the
  chord's full vertical extent (from its lowest notehead to its highest). The
  direction is conveyed by the arrowhead: present at the top for **up**, present
  at the bottom for **down**, and absent for **nondirectional**.

- **R4 — Placement relative to accidentals and stems.** The wavy line is drawn
  further left than any accidentals on that chord and clear of the chord's
  stem/beams. When the chord has no accidentals, the line sits at a fixed gap to
  the left of the noteheads. (Musical convention places the arpeggio sign outside
  — further from the noteheads than — the accidentals.)

- **R5 — Single-pitch chords.** An arpeggio marking on a single-pitch note is
  accepted and renders a short wavy line spanning that one notehead. It is not an
  error, even though a one-note roll is musically trivial.

- **R6 — Tall chords.** The wavy line spans the full vertical distance between the
  chord's lowest and highest noteheads, however tall the chord is.

- **R7 — Combines with other markings.** The arpeggio marking is independent of
  every other per-chord marking. A chord may carry an arpeggio together with any
  combination of tie, slur, dynamic, dots, crescendo/decrescendo, etc.; all such
  markings render together, each in its own region of the chord.

- **R8 — Render parity.** The arpeggio renders identically in both rendering
  surfaces: the editor's notation canvas and the published front end. There is no
  visual difference between the two.

### Authoring

- **R9 — Editor control.** The visual editor exposes the arpeggio marking for the
  selected note in its note-details inspector, as a select/dropdown with the
  options **None**, **Up**, **Down**, and **Nondirectional**. Choosing a direction
  sets the marking; choosing **None** removes it entirely (no arpeggio value is
  written). When a song is loaded that already has an arpeggio value on a chord,
  the control shows that value as selected.

- **R10 — Rest behavior in the editor.** The arpeggio control is shown for a rest
  as well (consistent with how the inspector treats other per-event markings). A
  value may be set on and stored against a rest, but it has no rendered effect on
  a rest (a rest has no noteheads for a wavy line to attach to), and it is never
  an error.

### Persistence and validation

- **R11 — Round-trip.** The arpeggio value is stored verbatim as part of the song
  data and survives editing the raw song data (e.g. raw-JSON editing) unchanged.

- **R12 — Closed-enum validation, non-blocking.** Validation accepts the three
  valid values (**up**, **down**, **nondirectional**). A value outside this set is
  flagged informationally only and **never blocks saving** — consistent with how
  the format validates every other closed-vocabulary marking.

- **R13 — Permissive context.** An arpeggio value is accepted in any event context
  and is never rejected for the kind of event it sits on (for example, on a rest).
  There is no negative or context-dependent conformance rule for the marking; an
  unexpected placement is silently ignored at render time, not treated as an error.

## Out of Scope

- **O1 — No audio.** The arpeggio is visual notation only. It does not change how
  the song sounds; there is no playback, and the chord is not audibly rolled. (The
  block has no audio engine, consistent with every other marking in the format.)

- **O2 — No grand-staff or multi-event arpeggio.** An arpeggio marks a single
  chord — one event, in one hand. There is no cross-hand "grand-staff" arpeggio
  (a single wavy line rolling across both staves) and no arpeggio spanning
  multiple events.

- **O3 — No per-marking accessibility announcement.** The arpeggio is not
  separately announced to assistive technology. This is consistent with every
  other notation marking, none of which is individually described to assistive
  tech today. A per-marking accessible description is potential future work
  affecting all markings, not specific to arpeggios.

- **O4 — No music-font change.** The wavy line and arrowhead are drawn as plain
  SVG primitives, the same way ties, slurs, and dynamic hairpins are already
  drawn. Adding dedicated arpeggio symbols to the embedded music font is neither
  required nor in scope.

## Acceptance Criteria

1. A song with an arpeggio value of **up** on a chord validates without error, and
   the value survives a round-trip through raw-data editing unchanged. The same
   holds independently for **down** and **nondirectional**.

2. A chord with an arpeggio value of outside the valid set (for example,
   "sideways") is flagged informationally during validation but does **not** block
   saving the song.

3. A chord with an arpeggio marking renders a vertical wavy line to the **left** of
   its noteheads, positioned **outside** (further left than) any accidentals on
   that chord and spanning the chord's full height. **up** shows an arrowhead at
   the top of the line; **down** shows an arrowhead at the bottom; **nondirectional**
   shows the wavy line with no arrowhead.

4. The same arpeggio marking renders identically in the editor's notation canvas
   and in the published front-end output.

5. A single-pitch note with an arpeggio marking renders a short wavy line without
   error.

6. A rest with an arpeggio value set is accepted (not a validation error) and
   draws no wavy line.

7. A chord that carries an arpeggio together with any of tie, slur, dots, and
   dynamic renders all of those markings, each in its own region, with the
   arpeggio to the left of the noteheads.

8. In the editor, selecting a chord shows an arpeggio control with the options
   None / Up / Down / Nondirectional. Choosing a direction applies it; choosing
   **None** removes the marking so that no arpeggio value remains on the chord.
   Loading a song whose chord already has an arpeggio value shows that value
   pre-selected in the control.
