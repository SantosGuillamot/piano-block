# Docs phase batch review — APPROVED

**Verdict: APPROVED.** The full docs batch (doc-plan Tasks D1–D4, diff `8d2bdda..HEAD`, HEAD `1e4d503`) meets the bar. The changed docs — `docs/song-format.md` (new) and `README.md` (edited) — are accurate to the shipped code, complete against the plan, scope-disciplined, internally consistent, and clean Markdown.

Scope of review: the batch as one diff, against the shipped code (`src/song/schema.js`, `src/song/validate.js`, `src/block.json`, `src/edit.js`, `src/render.php`, `specs/`, `package.json`, `.wp-env.json`), the spec, the design doc, and the doc-plan.

## What was verified

### Accuracy to shipped code (no drift)
- **Format reference vs `src/song/schema.js`:** every field, enum, and integer range in `docs/song-format.md` matches the schema —
  - enums: `clef` (`treble|bass|alto|tenor`), `dynamic` (`pp|p|mp|mf|f|ff|sf|sfz`), `duration`/`beatUnit` (`whole|half|quarter|eighth|sixteenth|thirty-second`), `barlineStart`/`barlineEnd` (`regular|repeat-start|repeat-end|double|final`), `tie`/`slur` (`start|stop`), `type` (`note|rest`), `beatType` (`{1,2,4,8,16,32}`);
  - ranges: `octave` 0..9, `alter` −2..+2, `octaveShift` −2..+2, `dots` 0..2, `timeSignature.beats` ≥1;
  - required members: top-level `sections`; `section.measures`; `event.{type,duration}`; `pitch.{step,octave}`; `tempo.bpm`; `timeSignature.{beats,beatType}` — all as documented;
  - the note⇒non-empty-`pitches` conditional documented as "the one conditional" matches the schema's single `if`/`then`.
- **Walker special cases vs `src/song/validate.js`:** the doc's claims that an unrecognised note name (`"H"`, `"doh"`) is an error, that `alters` keys must be note names and values integers in −2..+2, that note names are case-insensitive across both systems, and that `bpm` must be `> 0`, all match `checkStep` / `checkAlters` / `checkBpm` and `NOTE_NAMES`.
- **Lenient-vs-closed policy:** "unknown fields are ignored, misspelled enum value is an error" matches the permissive `additionalProperties` walk and the `enum` membership check.
- **Editor (README) vs `src/edit.js`:** field control (a single multi-line `TextareaControl`), label **"Song (JSON)"**, and help text **"The raw song document as JSON. Validation is informational and never blocks saving."** are quoted verbatim from the source; non-blocking / informational / empty-not-validated / no-timing-check behavior matches `useMemo(... song.trim() === "" ? [] : validateSong(song))` and the non-dismissible error `Notice`.
- **Render (README) vs `src/render.php`:** escaped verbatim `<pre>` passthrough via `esc_html()` + `get_block_wrapper_attributes()`, nothing output when empty/whitespace-only, no validation/parsing/re-serialization — all accurate.
- **Contributor file-layout / scripts:** `src/song/schema.js`, `src/song/validate.js`, `src/song/__tests__/`, `specs/editor.spec.js`, `specs/render.spec.js` all exist; `npm run test:unit` / `test:e2e` exist in `package.json`; the `song` attribute (`{ "type": "string", "default": "" }`) matches `src/block.json`; `.wp-env.json` PHP 8.3 / latest-WP / plugin-mapped claim matches the file. The README's e2e coverage summary matches the actual `specs/` assertions.

### Example conformance (executed, not eyeballed)
- Ran the annotated example with comments stripped, plus the minimal song and all four smaller "valid" snippets (metadata, tempo/timeSignature, inheritance) from `docs/song-format.md`, through the **shipped `validateSong`**: every one returns `[]` (conformant).
- The annotated example is a verbatim match for the `COMPREHENSIVE_SONG` fixture in `src/song/__tests__/validate.test.js`, confirming the doc's "same song as the unit-test fixture" claim and demonstrating the full AC5 element list.

### Completeness vs the doc plan
- **D1** delivers the canonical author-facing reference (top-level shape, metadata, constant-context model, measures, tempo/timeSignature asymmetry, handConfig + inheritance/wholesale-`alters`-replace, events, pitches, both note-name systems + equivalence table (AC9), barlines, pitch-resolution as forward-looking intent, additive-growth, and the annotated example (AC5)). AC10 "no timing validation / hands need not align" is stated.
- **D2** delivers the usage guide (insert, raw-JSON field with the real label/help, fresh block empty, informational non-blocking validation, empty-not-validated, structural-only, escaped `<pre>` passthrough, no notation/audio in v1, tip to the annotated example).
- **D3** delivers contributor notes (storage model + why-string, schema-as-data + zero-dependency walker + no-`ajv` with the recorded swap trigger, lenient/closed policy, additive-growth/no-`version`, render contract, tests & commands with the e2e prerequisite sequence).
- **D4** delivers the top-level refresh (status/intro no longer call it a pure placeholder for song storage), the file-layout table, bidirectional cross-links, an accurate "Forthcoming", and a consistent validation/render story across all docs.

### Scope discipline
- No out-of-scope feature (audio, notation rendering, visual authoring UI, `version` field, import/export, MusicXML/ABC/MIDI) is presented as present behavior. Each appears only as a "future / not-yet" note or an explicit "it is **not**" disclaimer.

### Single source of truth, links, quality
- Docs link to `src/song/schema.js` and cross-link each other; no duplicated, divergent schema copy in prose.
- All internal anchors resolve: README `#using-the-piano-block`, `#forthcoming`; `docs/song-format.md#annotated-example-song`; and the format doc's `../README.md#using-the-piano-block`. The `docs/song-format.md` ↔ README cross-links exist in both directions.
- Code fences balanced in both files (34 / 4); tables well-formed; the design-doc pointer path in the README resolves.

## Note (not a docs defect, per the dispatch)
`src/block.json`'s `description` still reads "A placeholder Piano block — a scaffold for a future interactive piano." That is shipped plugin metadata, explicitly outside the docs-phase scope, and no doc claims otherwise — so it is not grounds to fail this batch. It remains an already-flagged optional code follow-up.

**Result: docs phase approved. No tasks require rework.**
