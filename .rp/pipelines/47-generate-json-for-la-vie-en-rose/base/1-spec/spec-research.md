# Spec Research: Generate JSON for “La Vie en Rose”

# Generate JSON for “La Vie en Rose”

> Source: GitHub issue #47: https://github.com/SantosGuillamot/piano-block/issues/47.
> This file is self-contained; agents do not need to open the source issue.

## Goal

Create a project-format JSON representation of “La Vie en Rose” using the provided source PDF.

## Context

The source PDF is available only in the local working copy at:

`songs/La Vie En Rose - Edith Piaf.pdf`

Because `songs/` is git-ignored and the PDF is not pushed, the source PDF has been copied into this intent folder as:

`La Vie En Rose - Edith Piaf.pdf`

Agents may convert the PDF pages to images if that is the clearest way to extract the song data.

## Q&A

### Q1

**Question:** Where should the finished La Vie en Rose JSON file live in the repository, and what filename should it use?

**Answer:** Add it in the `songs/` folder as `la-vie-en-rose.json`.

### Q2

**Question:** Because `songs/` is currently git-ignored, should this issue force-add and commit `songs/la-vie-en-rose.json` anyway?

**Answer:** The PDF has been moved outside `songs/`, and `songs/` should be used only for JSON songs. The JSON file should be tracked normally rather than force-added as an ignored file.

### Q3

**Question:** Should the JSON aim to transcribe the complete PDF score, including both right-hand and left-hand parts from start to finish?

**Answer:** Yes. The JSON should transcribe the complete PDF score, including both right-hand and left-hand parts from start to finish. If something in the PDF is not supported by the current song format, do not force it into an unsuitable field; note it and report it at the end.

### Q4

**Question:** Should the transcription include non-note markings that the current format supports, such as dynamics, ties/slurs, repeats/barlines, tempo, and free-text annotations?

**Answer:** Yes. Include non-note markings that the current format supports, such as dynamics, ties/slurs, repeats/barlines, tempo, and free-text annotations.

### Q5

**Question:** If the PDF is ambiguous or a marking cannot be confidently read, should the JSON use the best-supported transcription and record the uncertainty in the final summary rather than guessing?

**Answer:** Yes. If the PDF is ambiguous or a marking cannot be confidently read, use the best-supported transcription and record the uncertainty in the final summary rather than guessing.

### Q6

**Question:** Should the JSON use English note names (`C D E F G A B`) and set the song-level `language` field to `english`?

**Answer:** Use Spanish note names for the song and set the song-level `language` field to `spanish`.

### Q7

**Question:** Should the JSON include metadata with title `La Vie en Rose` and composer/author `Édith Piaf`, or should composer/author be taken exactly from the PDF if it differs?

**Answer:** Include title metadata for `La Vie en Rose`, but do not add composer metadata.

### Q8

**Question:** Should the issue include automated validation that `songs/la-vie-en-rose.json` parses and conforms to the existing song schema?

**Answer:** Yes. Include automated validation that `songs/la-vie-en-rose.json` parses and conforms to the existing song schema.

### Q9

**Question:** Should this issue avoid changing the song format, renderer, or editor code even if the PDF contains notation the current format cannot represent?

**Answer:** Yes. Avoid changing the song format, renderer, or editor code even if the PDF contains notation the current format cannot represent.

### Q10

**Question:** Please confirm the out-of-scope list: changing the song format/schema, changing the renderer/editor, forcing unsupported PDF notation into unsuitable JSON fields, adding composer metadata, committing source PDFs under `songs/`, and transcribing anything beyond the provided PDF. Is anything missing?

**Answer:** That's right.

## Research

- `package.json` already has `npm run test:unit` and the validator exports `validateSong`, so the repository has an existing automated path for schema-conformance checks.
- `docs/song-format.md` is the canonical song JSON reference. The output must be a conformant custom song object with required `sections`, optional `metadata`, `defaults`, and `language`, and grand-staff measures containing `rightHand`/`leftHand` event arrays.
- `src/song/schema.js` and `src/song/validate.js` define/enforce the conformant format. Validation checks structure, closed enum values, note names, alteration ranges, and required note pitches, but it does not check musical timing totals.
- The original issue noted the source PDF at `songs/La Vie En Rose - Edith Piaf.pdf`; the PDF was copied into committed phase-0 artifacts at `base/0-intent/La Vie En Rose - Edith Piaf.pdf` so pipeline work remains self-contained.
- The working copy has removed the `songs/` ignore rule. `songs/la-vie-en-rose.json` is therefore expected to be a normal tracked repository file, while source PDFs are kept outside `songs/`.

## Out of Scope

- Changing the song format, schema, validator, renderer, or editor to support additional notation.
- Forcing unsupported notation from the PDF into unsuitable JSON fields.
- Adding composer metadata.
- Committing source PDFs under `songs/`.
- Transcribing anything beyond the provided PDF.

## Consolidated Requirements

1. Create a repository file at `songs/la-vie-en-rose.json`.
2. The file must be a complete transcription of the provided La Vie en Rose PDF from start to finish, covering both right-hand and left-hand parts.
3. The transcription must use the existing Piano Block song JSON format and conform to the current schema.
4. The song must use Spanish note names and set the top-level `language` field to `spanish`.
5. The song must include title metadata for `La Vie en Rose` and must not include composer metadata.
6. The transcription must include all non-note markings that the current format supports, including dynamics, ties, slurs, repeats/barlines, tempo, and free-text annotations where present in the PDF.
7. Unsupported PDF notation must not be forced into unsuitable fields; unsupported items must be recorded and reported at the end of implementation.
8. Ambiguous or hard-to-read PDF content must be transcribed only when there is a best-supported reading; any remaining uncertainty must be recorded and reported at the end of implementation.
9. The issue must include automated validation that `songs/la-vie-en-rose.json` parses as JSON and conforms to the existing song schema.
