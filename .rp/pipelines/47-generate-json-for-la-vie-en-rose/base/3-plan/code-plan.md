# Code Plan: Generate JSON for “La Vie en Rose”

## Scope and constraints

Implement data and test changes only:

- Add `songs/la-vie-en-rose.json` as a tracked Piano Block song fixture transcribed from `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/0-intent/La Vie En Rose - Edith Piaf.pdf`.
- Add or adjust unit test coverage for this fixture.
- Do not change song format, schema, validator, editor, renderer, public docs, build scripts, or archive scripts.
- Do not commit rendered PDF images, scratch transcription notes, or the source PDF outside `.rp/`.
- Do not add source-provenance, pipeline, or uncertainty comments to shipped files.

## Implementation tasks

### Task 1

Task ID: T1
Goal: Create the La Vie en Rose song fixture from the provided PDF artifact.
Files:
- `songs/la-vie-en-rose.json`
- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/0-intent/La Vie En Rose - Edith Piaf.pdf` (read-only source artifact)
Changes:
- Create the `songs/` directory if it does not exist.
- Manually transcribe the complete PDF score from start to finish into `songs/la-vie-en-rose.json` using the existing Piano Block song format.
- Include both right-hand and left-hand parts for every measure where they appear.
- Set top-level `language` to `spanish`.
- Set `metadata.title` exactly to `La Vie en Rose`.
- Do not include `metadata.composer`.
- Use lowercase Spanish pitch steps only: `do`, `re`, `mi`, `fa`, `sol`, `la`, `si`.
- Use Spanish keys for any `alters` maps.
- Use existing supported fields for notes, chords, rests, durations, dots, accidentals, tempo, time signature, clefs, default/section hand context, ties, slurs, dynamics, hairpins, arpeggios, barlines, and musical annotations.
- Do not encode Flat footer text, page labels, printed measure numbers, or other non-musical layout/source text.
- Do not invent fields for notation the current format cannot represent.
Depends on: None
Traces to: Spec requirements 1-8 and 12; acceptance criteria 1-7; design sections “Song fixture design”, “Supported notation mapping”, and “Transcription workflow from the PDF”.
Acceptance:
- `songs/la-vie-en-rose.json` exists and is valid JSON.
- The fixture conforms to the current song schema through the existing validator.
- The fixture includes the complete score, both hands, and supported non-note markings visible in the PDF.
- The fixture has `language: "spanish"`, `metadata.title: "La Vie en Rose"`, and no `metadata.composer`.
- No unsupported notation is forced into unrelated or invented JSON fields.

### Task 2

Task ID: T2
Goal: Add focused unit coverage for the La Vie en Rose fixture.
Files:
- `src/song/__tests__/laVieEnRose.test.js`
- `songs/la-vie-en-rose.json` (test fixture input)
Changes:
- Add a Jest test file that reads `songs/la-vie-en-rose.json` from `process.cwd()` using Node `fs` and `path`.
- Assert `JSON.parse(raw)` succeeds.
- Assert `validateSong(raw)` returns `[]`.
- Assert `parsed.language` is exactly `spanish`.
- Assert `parsed.metadata.title` is exactly `La Vie en Rose`.
- Assert `parsed.metadata.composer` is absent, for example with `expect(parsed.metadata).not.toHaveProperty("composer")`.
- Traverse the parsed song and assert all pitch `step` values are one of `do`, `re`, `mi`, `fa`, `sol`, `la`, `si`.
- Traverse `defaults.rightHand.alters`, `defaults.leftHand.alters`, every section-level `rightHand.alters`, and every section-level `leftHand.alters`; assert all alter keys are Spanish note names only.
- Keep the test fixture-specific; do not broaden the shared validator or schema behavior.
Depends on: T1
Traces to: Spec requirements 4-7 and 12; acceptance criteria 2-4 and 9; design section “Automated validation design”.
Acceptance:
- The new test fails if the JSON is unparsable, schema-invalid, missing the required title, not marked Spanish, includes composer metadata, uses English pitch steps, or uses English alter keys.
- Existing validator, schema, editor, renderer, and docs files remain unchanged.

### Task 3

Task ID: T3
Goal: Verify the fixture and unit coverage without expanding implementation scope.
Files:
- `songs/la-vie-en-rose.json`
- `src/song/__tests__/laVieEnRose.test.js`
Changes:
- Run the focused fixture test:
  - `npm run test:unit -- --runTestsByPath src/song/__tests__/laVieEnRose.test.js`
- Run the full unit suite:
  - `npm run test:unit`
- Optionally run a direct parse check while iterating:
  - `node -e 'JSON.parse(require("fs").readFileSync("songs/la-vie-en-rose.json", "utf8")); console.log("ok")'`
- Review `git diff -- songs/la-vie-en-rose.json src/song/__tests__/laVieEnRose.test.js` for accidental invented fields, English note names, composer metadata, source comments, or pipeline references.
- Review `git status --short` before committing to ensure only the song fixture and fixture test are staged for the implementation commit.
Depends on: T1, T2
Traces to: Spec requirement 12; acceptance criteria 2-4 and 9; design sections “Automated validation design” and “Risks and mitigations”.
Acceptance:
- Focused fixture test passes.
- Full unit suite passes, or any unrelated pre-existing failure is clearly identified in the implementation summary.
- The implementation diff contains only `songs/la-vie-en-rose.json` and `src/song/__tests__/laVieEnRose.test.js` unless a test-file adjustment is explicitly justified.
- No format/schema/validator/editor/renderer/docs files are modified.

### Task 4

Task ID: T4
Goal: Report unsupported notation and remaining transcription uncertainty at completion.
Files:
- Implementation summary only; no shipped source file changes for this task.
Changes:
- While transcribing, keep a temporary checklist of unsupported notation and hard-to-read or ambiguous measures.
- Report unsupported notation in the final implementation summary, especially any mid-measure `8va`/`8vb` spans, per-pitch ties or slurs within chords, tuplets, grace notes, ornaments, articulations, pedal markings, volta endings, or other markings that cannot be represented accurately with current fields.
- Report unresolved transcription uncertainty in the final implementation summary with enough measure/location detail for review.
- If no unsupported notation or uncertainty remains, state that explicitly in the implementation summary.
- Do not place uncertainty notes, PDF provenance, or pipeline references inside `songs/la-vie-en-rose.json`, tests, comments, or public docs.
Depends on: T1, T3
Traces to: Spec requirements 8-11; acceptance criteria 7-8; design sections “Unsupported or ambiguous notation handling” and “Implementation boundary”.
Acceptance:
- Final implementation summary includes a clear unsupported-notation/uncertainty section.
- Unsupported notation is not encoded via invented or misleading fields.
- Shipped repository files remain standalone and free of workflow/provenance notes.

## Commit guidance for implementation phase

The implementation commit should include only the new song fixture and its unit test, with an imperative sentence-case message such as `Add La Vie en Rose song fixture (code-writer)`.
