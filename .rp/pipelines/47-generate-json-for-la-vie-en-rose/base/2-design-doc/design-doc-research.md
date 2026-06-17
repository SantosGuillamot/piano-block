# Design Research: Generate JSON for “La Vie en Rose”

## Inputs reviewed

- `AGENTS.md`
- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/0-intent/intent.md`
- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/1-spec/spec.md`
- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/1-spec/spec-research.md`
- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/0-intent/La Vie En Rose - Edith Piaf.pdf`
- `docs/song-format.md`
- `src/song/schema.js`
- `src/song/validate.js`
- `src/song/normalizeStep.js`
- `src/song/__tests__/normalizeStep.test.js`
- `src/song/__tests__/schema.test.js`
- `src/song/__tests__/validate.test.js`
- `scripts/check-build.js`
- `scripts/check-build.test.js`
- `scripts/verify-archive.mjs`
- `package.json`
- `.gitignore`

## Research findings

- The target implementation should add a normal tracked song file at `songs/la-vie-en-rose.json`. The `songs/` directory is not currently ignored by `.gitignore`; it is absent in this worktree, so implementation can create it normally.
- No existing song fixture files were found. Existing song coverage is mostly inline test objects under `src/song/__tests__`, editor tests, and notation tests.
- The song format is a custom JSON object, not MusicXML/MIDI. Required top-level content is `sections`; optional top-level fields include `metadata`, `defaults`, and `language`.
- The JSON should use:
  - `metadata.title: "La Vie en Rose"`
  - no `metadata.composer`
  - `language: "spanish"`
  - Spanish pitch steps (`do`, `re`, `mi`, `fa`, `sol`, `la`, `si`) as the canonical spelling for this song.
- The existing schema and validator already support the needed validation surface: notes, rests, chords, durations through `thirty-second`, up to two dots, pitch octaves, per-note accidentals, clefs, key-like `alters`, section-scoped octave shifts, tempo, time signatures, dynamics, arpeggios, event/measure annotations, ties, slurs, gradual dynamics, and repeat/final/double barlines.
- The validator intentionally does not validate rhythmic totals, hand alignment, tie/slur pairing, or musical completeness. Human review against the PDF remains necessary for transcription completeness.
- `validateSong(rawString)` parses JSON internally and returns `[]` for a conformant song. `parseAndValidate(rawString)` also returns the parsed object. Tests can use either, but a dedicated test should explicitly assert JSON parsing and `validateSong(raw) === []` for the new file.
- `package.json` has `npm run test:unit` through `wp-scripts test-unit-js`; there is no dedicated song-validation script. A Jest test under `src/song/__tests__` is the lowest-friction automated validation path.
- The source PDF is a 3-page PDF 1.4 file, 122,567 bytes. The page tree reports `/Count 3`; pages are A4-sized (`595.27557 x 841.88977` points). Metadata reports RAD PDF/PDFescape creation, and the score text indicates it was created with Flat.
- Local PDF CLI tooling is limited: `pdfinfo`, `pdftotext`, `pdftoppm`, `pdftocairo`, `mutool`, `qpdf`, `gs`, ImageMagick, and `tesseract` are not installed. Available local tools include `/usr/bin/file`, `/usr/bin/strings`, `/usr/bin/mdls`, `/usr/bin/sips`, `/usr/bin/qlmanage`, `/usr/bin/python3`, Node 24, npm, and Python packages `cv2`/`numpy`.
- `sips` can render a single-page PDF to PNG. For this PDF, a temporary page-tree rewrite/split plus `sips` produced readable page images for all three pages without adding repository artifacts.
- Decoding the PDF text streams via the embedded ToUnicode map recovered these text chunks:
  - Page 1: `La Vie En Rose`, `Score created with the free version of Flat - https://flat.io`, `= 72`, `Grand Piano`, and measure labels including `5`, `8`, `12`.
  - Page 2: the Flat footer and measure labels `16`, `20`, `24`, `28`, `32`.
  - Page 3: the Flat footer and measure labels `36`, `40`, `44`, `48`, `52`.
- Visual inspection of rendered page images shows a grand-staff piano score with both hands, final barline, repeat barlines, ties/slurs, accidentals, chords, rests, and multiple `8va` dashed spans. The visible measure-label pattern suggests the score runs through the line labeled `52` and ends shortly after that line; implementation should verify exact measure count while transcribing.

## Design questions and answers

- **Where should the song live?** Create `songs/la-vie-en-rose.json` as a tracked repository file. Do not commit the source PDF under `songs/`.
- **Should implementation change format/schema/validator/rendering to fit the PDF?** No. Use only the existing format and existing validator.
- **How should the JSON be structured?** Use `defaults` for stable score-wide context such as tempo, time signature, and clefs. Use `sections` only when section-scoped context changes are needed, especially for key/default accidentals, clef changes, tempo/time changes, or representable whole-section octave shifts.
- **How should note names be represented?** Use lowercase Spanish solfège pitch steps throughout the transcription and set top-level `language` to `spanish`.
- **How should the tempo be represented?** The PDF text stream contains `= 72`, visually a metronome marking. Represent it as `defaults.tempo: { "bpm": 72, "beatUnit": "quarter" }` unless visual inspection proves the beat unit differs.
- **How should source-only or layout text be handled?** Do not encode the Flat footer, page numbers, or printed measure numbers as song annotations. They are source/layout artifacts, not musical annotations.
- **How should non-note markings be handled?** Encode supported markings directly: repeat/final/double barlines on measures, event-level `tie`/`slur` starts/stops, `dynamic` values from the supported enum, `crescendo`/`decrescendo` spans, `arpeggio`, and free-text musical annotations where applicable.
- **How should `8va` be handled?** Use `rightHand.octaveShift: 1` in a new section only when the `8va` span can be represented as section-scoped context over whole measures or a whole section. If an `8va` begins/ends mid-measure or otherwise cannot be represented accurately by section-scoped `octaveShift`, do not force it; transcribe pitches as written/sounding according to the chosen convention and report the limitation.
- **How should unsupported or ambiguous notation be handled?** Keep a transcription-notes list during implementation. Encode only best-supported readings in JSON. Report unsupported notation and unresolved uncertainty in the final implementation summary, not in shipped source comments or docs.
- **How should automated validation be added?** Add a Jest unit test under `src/song/__tests__` that reads `songs/la-vie-en-rose.json`, asserts `JSON.parse` succeeds, asserts `validateSong(raw)` returns `[]`, and checks `language`, `metadata.title`, and absence of `metadata.composer`.

## Decisions

- Add only data and test coverage for this issue: `songs/la-vie-en-rose.json` plus a unit test for that file. Avoid changes to song format, schema, validator, editor, renderer, and general docs.
- Use the existing validator as the conformance authority rather than duplicating schema logic in a new script.
- Prefer one dedicated test file, for example `src/song/__tests__/laVieEnRose.test.js`, with Node `fs`/`path` reading the JSON from `process.cwd()`.
- The validation test should include both conformance and required metadata checks because schema validation alone would allow omitted `language`, omitted title, and a composer field.
- Treat PDF extraction as evidence-gathering, not an automated source of truth. The PDF is vector notation; local text extraction only recovers title/tempo/instrument/footer/measure labels, not full note data. Full transcription must be manual/visual from rendered pages.
- Do not encode source provenance, workflow references, page numbers, or Flat watermark text in shipped JSON.
- Use `.rp` artifacts only for workflow/research/transcription notes if needed; shipped files must stand alone.

## Risks and mitigations

- **Risk: The validator will pass an incomplete or rhythmically incorrect transcription.** Mitigation: implementation must manually compare every measure and both hands against rendered page images; the automated test only proves parse/schema conformance.
- **Risk: Local PDF tooling cannot directly extract all pages as text or MusicXML.** Mitigation: use rendered page images for transcription. `sips` plus temporary single-page PDF copies works locally; keep generated images outside the repository.
- **Risk: Some PDF notation may not map cleanly to the current format.** Mitigation: do not invent fields or misuse unrelated fields. Report unsupported items such as mid-measure octave-shift spans, tuplets/grace notes/ornaments if present, pedal lines if present, volta endings if present, or per-pitch ties inside a chord if the event-level tie cannot express them.
- **Risk: Spanish note spelling may be inconsistent if copied from English-oriented examples.** Mitigation: use Spanish steps for all pitches and optionally grep the finished JSON for English pitch-step values before committing.
- **Risk: Composer/credit text may be mistaken for metadata.** Mitigation: enforce absence of `metadata.composer` in the test. Ignore source credits unless they are musical annotations supported by the format.
- **Risk: Unsupported notation could be silently lost.** Mitigation: maintain an implementation checklist of each unsupported/uncertain source marking and include it in the final implementation report.

## Open questions

- Exact time signature, key/default accidentals, measure count, and every pitch/rhythm still require full visual transcription from the rendered PDF pages.
- The exact extent of each `8va` span must be verified; some spans may be section-representable and others may need to be reported as unsupported/approximate.
- The score may contain ties/slurs on only some notes of a chord; the format has event-level tie/slur only, so implementation must decide whether each marking is representable or should be reported.
- It remains to verify whether the PDF contains any dynamics, arpeggios, pedal markings, tuplets, grace notes, volta endings, or other markings not obvious from initial inspection.
