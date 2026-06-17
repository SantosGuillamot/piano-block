# Code Review Rejected

Affected task IDs: T1, T4

## Checks performed

- Reviewed the diff from `16924dff14cc95951563ba6dba25d16f57b1a2cd` to `HEAD`.
- Read the spec, design doc, code plan, transcription notes, verification note, implementation-summary input, song fixture, and fixture test.
- Ran `npm run test:unit -- --runTestsByPath src/song/__tests__/laVieEnRose.test.js`: passed.
- Ran `npm run test:unit`: passed, 24 suites and 735 tests.
- Checked the shipped fixture/test for pipeline/PDF provenance text, composer metadata, and English pitch-step/alter-key spellings: no shipped provenance text, no composer metadata, and no English note names were found.
- Performed a visual spot-check against the rendered score pages for measure count, both hands, octave-shift sections, final barline, and supported markings.

## Blocking issues

### T1

- The transcription omits a supported arpeggio marking from the score. On page 1, first system, measure 3, the final right-hand half-note chord has a visible vertical wavy rolled-chord marking. The current song format supports this directly with an event-level `arpeggio` field, but `songs/la-vie-en-rose.json` has no `arpeggio` fields at all, and the measure-3 final right-hand chord is encoded without one. This fails the requirement to include supported non-note markings visible in the score.

### T4

- The implementation notes and summary do not report the omitted measure-3 arpeggio or explain why it was left out. If the arpeggio is intentionally considered ambiguous or not exactly representable, that uncertainty/limitation needs to be recorded in the implementation report; otherwise the supported marking should be encoded in the fixture.
