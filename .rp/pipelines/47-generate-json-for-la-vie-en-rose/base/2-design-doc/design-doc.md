# Technical Design: Generate JSON for “La Vie en Rose”

## Goal

Add a complete Piano Block song transcription of the provided “La Vie en Rose” piano score as a normal tracked repository fixture at `songs/la-vie-en-rose.json`, and add automated coverage that proves the fixture is valid JSON, conforms to the existing song schema, and carries the required fixture-specific metadata.

The source score for the transcription is the committed pipeline artifact:

- `.rp/pipelines/47-generate-json-for-la-vie-en-rose/base/0-intent/La Vie En Rose - Edith Piaf.pdf`

The shipped project output should be self-contained: a song JSON file and validation test coverage. It should not ship the PDF under `songs/`, and it should not mention this pipeline in source code, comments, or user-facing documentation.

## Non-goals

Do not change any of the following to fit the score:

- song format or schema;
- validator behavior;
- visual editor model or UI;
- notation renderer;
- README or public song-format documentation;
- build/archive scripts.

Unsupported source notation must be omitted or reported rather than forced into unrelated JSON fields.

## Existing technical context

The Piano Block song format is a custom JSON document, not MusicXML or MIDI. Its required top-level member is `sections`; optional top-level members include `metadata`, `defaults`, and `language`.

Relevant existing infrastructure:

- `docs/song-format.md` is the human reference for supported fields.
- `src/song/schema.js` defines the schema-as-data used by the validator.
- `src/song/validate.js` exposes `validateSong(rawString)` and `parseAndValidate(rawString)`.
- `src/song/__tests__/validate.test.js` and `src/song/__tests__/schema.test.js` show the existing Jest testing style.
- `npm run test:unit` runs the Jest unit suite through `wp-scripts test-unit-js`.

Important validator limits:

- It validates JSON parsing, required fields, types, closed enums, note names, pitch octaves, alterations, and tempo bounds.
- It does not validate rhythmic totals, measure completeness, hand alignment, tie/slur pairing, or whether a transcription matches a source score.
- Unknown object properties are permissively ignored, so the implementation should avoid misspelled optional fields and should not invent new fields.

## Proposed architecture

The implementation should be data plus tests only:

1. Add `songs/la-vie-en-rose.json`.
2. Add one focused Jest unit test, for example `src/song/__tests__/laVieEnRose.test.js`, that reads that file from disk and validates it with the existing validator.
3. Leave all format, schema, validator, editor, renderer, and docs code unchanged.

This keeps the score as a reusable tracked fixture while preserving the existing Piano Block format as the single source of truth.

## Song fixture design

### Location and tracking

Create `songs/la-vie-en-rose.json` as a normal tracked file. The repository currently has no `songs/` directory and `.gitignore` does not ignore it, so implementation can create the directory directly.

Do not copy the source PDF into `songs/`. The PDF remains an internal source artifact under `.rp/`; the only shipped song asset is the JSON transcription.

### Top-level fields

The JSON should use this top-level shape:

```json
{
  "metadata": {
    "title": "La Vie en Rose"
  },
  "language": "spanish",
  "defaults": { ... },
  "sections": [ ... ]
}
```

Required decisions:

- `metadata.title` must be exactly `La Vie en Rose`.
- `metadata.composer` must be absent.
- `language` must be exactly `spanish`.
- All pitch `step` values should use lowercase Spanish solfège: `do`, `re`, `mi`, `fa`, `sol`, `la`, `si`.
- Any `alters` keys should also use Spanish note names.

### Defaults and sections

Use `defaults` for score-wide context that stays stable, such as:

- tempo: the PDF text stream exposes `= 72`; unless visual inspection shows a different beat unit, encode this as `{ "bpm": 72, "beatUnit": "quarter" }`;
- time signature, once visually confirmed;
- right-hand clef, expected to be `treble`;
- left-hand clef, expected to be `bass`;
- key/default accidentals using per-hand `alters` maps if that is the cleanest representation.

Use new `sections` only when the current format requires section-scoped changes, such as:

- time signature changes;
- tempo changes;
- clef changes;
- key/default accidental changes;
- whole-measure or whole-section octave shifts.

Avoid using section or measure `name` fields for printed measure numbers or page/layout labels. Those are source layout aids, not musical content.

### Measures and events

Each measure should contain both hands when present in the score:

```json
{
  "rightHand": [ ...events ],
  "leftHand": [ ...events ]
}
```

Use:

- `type: "note"` with non-empty `pitches` for notes and chords;
- `type: "rest"` for rests;
- duration enums supported by the format: `whole`, `half`, `quarter`, `eighth`, `sixteenth`, `thirty-second`;
- `dots` for single or double dotted values;
- pitch `alter` for accidentals that are not covered by the effective `alters` context;
- measure `barlineStart` / `barlineEnd` for repeat, double, and final barlines.

Because validator conformance does not prove musical correctness, the implementer must manually compare every measure and both hands against the PDF-derived page images.

## Supported notation mapping

Encode supported score markings directly in the existing fields:

| PDF marking | JSON representation |
| --- | --- |
| Title | `metadata.title` |
| Tempo mark | `defaults.tempo` or section `tempo` |
| Time signature | `defaults.timeSignature` or section `timeSignature` |
| Treble/bass clefs | hand `clef` in `defaults` or section context |
| Key/default accidentals | hand `alters` maps, with per-note `alter` overrides |
| Notes/chords | `note` events with one or more `pitches` |
| Rests | `rest` events |
| Dots | event `dots` |
| Dynamics | event `dynamic` values: `pp`, `p`, `mp`, `mf`, `f`, `ff`, `sf`, `sfz` |
| Hairpins | `crescendo` / `decrescendo` start and stop markers |
| Ties | event-level `tie: "start"` / `"stop"` where the whole event can be represented |
| Slurs | event-level `slur: "start"` / `"stop"` where the whole event can be represented |
| Repeat, double, final barlines | measure `barlineStart` / `barlineEnd` |
| Musical free text | event or measure `annotations` |
| Arpeggios | event `arpeggio` if present |
| Whole-section 8va/8vb | hand `octaveShift` in a section, when the span aligns with section boundaries |

Do not encode non-musical source text such as the Flat watermark/footer, page labels, or printed measure numbers.

## Transcription workflow from the PDF

The PDF is a three-page vector score. Available local text extraction recovers only title, tempo text, instrument name, footer text, and measure labels; it does not recover note data. The transcription therefore must be manual and visual.

Recommended workflow:

1. Render the PDF pages to temporary images outside the repository. Local `sips` can render PDF content; if needed, split or rewrite temporary single-page PDF copies outside the repo before rendering.
2. Visually inspect each rendered page at sufficient zoom.
3. Create a measure-by-measure checklist covering the entire score from the first measure through the final barline. Initial PDF text evidence shows visible measure labels through `52`, so verify the exact ending measure count during transcription.
4. For each measure, transcribe right hand and left hand independently, then compare them together for obvious alignment or missing-content errors.
5. Record supported non-note markings while transcribing rather than as a separate pass, so ties, slurs, dynamics, repeats, and text do not get lost.
6. Keep a local implementation notes list for unsupported notation and unresolved ambiguity. Report that list in the final implementation summary, not in shipped source comments or docs.
7. After the JSON is complete, run the unit validation test and inspect the file for accidental English note names or accidental composer metadata.

Temporary rendered images and scratch transcription notes should not be committed unless they live under the pipeline artifact area for review purposes. They should not be shipped as project docs or source assets.

## Unsupported or ambiguous notation handling

The implementation should be conservative: encode only what the current format can express accurately and report the rest.

Known representational limits to watch for:

- `8va` / `8vb` spans that begin or end mid-measure cannot be represented exactly because `octaveShift` is section-scoped.
- Ties or slurs on only selected pitches within a chord may not be representable because `tie` and `slur` are event-level.
- Tuplets, grace notes, ornaments, articulations, pedal lines, volta endings, and other specialized markings may be unsupported unless they can honestly be represented as existing annotations without changing their meaning.
- Crescendo/decrescendo spans crossing rendered line breaks may validate, but renderer behavior is limited; still encode them only if the format fields accurately describe the musical span.

Policy:

- Do not invent fields.
- Do not use unrelated fields as a workaround.
- If a marking is unsupported, leave it out of `songs/la-vie-en-rose.json` and include it in the final implementation report.
- If a measure or pitch is ambiguous, choose the best-supported reading from the PDF and include the uncertainty in the final implementation report.
- Do not put uncertainty notes or source-provenance comments in the JSON file; JSON comments are invalid, and shipped artifacts should remain standalone.

## Automated validation design

Add a dedicated Jest test that uses the existing validator rather than duplicating schema logic.

The test should:

1. Read `songs/la-vie-en-rose.json` as a raw string with Node `fs` and `path`, rooted at `process.cwd()`.
2. Assert `JSON.parse(raw)` succeeds.
3. Assert `validateSong(raw)` returns `[]`.
4. Assert `parsed.language` is `spanish`.
5. Assert `parsed.metadata.title` is `La Vie en Rose`.
6. Assert `parsed.metadata.composer` is absent.
7. Assert all pitch steps, and any `alters` keys, use Spanish note names only.

The Spanish-name assertion is fixture-specific because the general schema intentionally accepts both English and Spanish note-name systems. Keeping that check in the fixture test avoids changing the shared validator semantics.

Run with:

```sh
npm run test:unit -- --runTestsByPath src/song/__tests__/laVieEnRose.test.js
npm run test:unit
```

## Trade-offs

### Tracked JSON fixture instead of generated output

Committing the JSON directly makes the song immediately usable and reviewable, and avoids adding a custom generation step. The trade-off is that transcription quality depends on manual review; automated validation cannot prove completeness against the PDF.

### Existing custom format instead of MusicXML/MIDI

Using the existing format ensures the song works with the current block, editor, validator, and renderer. The trade-off is limited notation coverage. Unsupported PDF features must be reported rather than encoded losslessly.

### Existing validator plus fixture-specific Jest checks

The existing validator remains the conformance authority, reducing maintenance and avoiding duplicate schema code. Fixture-specific checks cover requirements that are intentionally outside the schema, such as title, composer absence, and Spanish-only spelling.

### Section-scoped context for 8va and other changes

Using sections for context changes matches the documented model and renderer expectations. The trade-off is that some source spans may not align with section boundaries. When they do not, implementation should avoid awkward section splits that distort measure structure and should report the limitation.

## Risks and mitigations

- **Incomplete or incorrect transcription passes validation.** Mitigate with a measure-by-measure visual checklist against all PDF pages and both hands.
- **Unsupported notation is silently lost.** Mitigate by maintaining an implementation notes list and reporting unsupported/ambiguous items at completion.
- **English note names slip into a Spanish fixture.** Mitigate with a dedicated Spanish-name assertion in the fixture test and a manual grep/review pass.
- **Composer metadata is accidentally added from source credits.** Mitigate with a test assertion that `metadata.composer` is absent.
- **Invented or misspelled optional fields are ignored by the validator.** Mitigate by adhering strictly to `docs/song-format.md` and reviewing optional-field spelling for markings such as `annotations`, `crescendo`, `decrescendo`, and `arpeggio`.
- **Temporary PDF-rendering outputs are accidentally committed.** Mitigate by creating them outside the repository or cleaning them before commit, and by checking `git status` before committing.

## Implementation boundary

The code phase should commit only the fixture and its validation test. It should not modify shared format/schema/validator/editor/renderer code. Any final report can describe unsupported notation and unresolved transcription uncertainty, but shipped files should not contain pipeline references or source-processing notes.
