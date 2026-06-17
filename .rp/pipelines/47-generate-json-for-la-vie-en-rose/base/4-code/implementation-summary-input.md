# Implementation summary input

## Unsupported or approximated notation

- Independent voices within one staff are approximated as one event stream per hand. This affects sustained bass tones under moving accompaniment, dense chordal figures, multi-voice left-hand accompaniment, and final held sonorities.
- Several `8va` spans begin or end mid-measure or cross system breaks. The current format only supports octave shifts as section-level hand context, so these passages are approximated with section-level right-hand `octaveShift` values where they cover the surrounding passage.
- Per-pitch ties and slurs inside chords cannot be represented. Event-level `tie` markers are used only for clear whole-event ties; finer per-note tie/slur detail is omitted.
- No unsupported notation was encoded through invented or misleading fields. The handoff notes do not identify remaining tuplets, grace notes, ornaments, articulations, pedal markings, or volta endings that were encoded or require special handling beyond omission/approximation with supported fields.

## Remaining transcription uncertainty

- Measures 1-4 and 28-31 contain dense chords and accidentals that are difficult to resolve fully from the rendered pages; the JSON uses the best-supported visual reading.
- The final right-hand half-note chord in measure 3 carries the visible rolled-chord marking; no arrowhead or directional cue is visible, so the event uses `"arpeggio": "nondirectional"`.
- Measures 32-35 and 43-53 contain compact high-register `8va` passages with close chord voicings; the transcription is complete but should be musically reviewed for exact voicing and rhythm.
- Measures with multi-voice left-hand accompaniment are rhythmically approximate because independent simultaneous durations cannot be represented in one hand stream.

## Verification results

- Focused fixture test passed: `npm run test:unit -- --runTestsByPath src/song/__tests__/laVieEnRose.test.js`. This includes JSON parsing and `validateSong` conformance for `songs/la-vie-en-rose.json`.
- Tracked diff verification found only the La Vie en Rose fixture and pipeline notes changed for the measure 3 arpeggio fix.
