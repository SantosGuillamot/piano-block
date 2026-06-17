# Transcription notes

## Unsupported or approximated notation

- The score uses independent voices within the same staff in several places (sustained bass tones under moving accompaniment, dense chordal figures, and the final held sonorities). The current song format has one event stream per hand, so these passages are encoded as best-effort sequential note/chord events rather than separate voices.
- Several `8va` spans begin or end mid-measure or are split across system breaks. The current format supports octave shifts only as section-level hand context, so the spans are approximated with section-level right-hand `octaveShift` values where they cover the surrounding passage.
- Ties/slurs on selected notes inside chords cannot be represented per pitch. Event-level `tie` markers are used only for the clearest whole-event ties; finer tie/slur detail is omitted.

## Unresolved transcription uncertainty

- Introductory measures 1-4 and transition measures 28-31 contain dense chords and accidentals that are difficult to resolve fully from the rendered pages; the JSON uses the best-supported visual reading.
- Page 1, first system, measure 3 has a visible rolled-chord wavy line on the final right-hand half-note chord; no arrowhead or directional cue is visible, so it is encoded as `"arpeggio": "nondirectional"`.
- High-register `8va` passages in measures 32-35 and 43-53 are visually compact and include some close chord voicings; the transcription keeps the passage complete but may require musical review for exact voicing and rhythm.
- Measures with multi-voice left-hand accompaniment are rhythmically approximate because the format cannot encode independent simultaneous durations in one hand.
