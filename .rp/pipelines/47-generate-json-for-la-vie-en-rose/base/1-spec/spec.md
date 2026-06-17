# Spec: Generate JSON for “La Vie en Rose”

## Overview

Create a project-format JSON transcription of the provided “La Vie en Rose” PDF score. The finished song must be committed as a normal repository file at `songs/la-vie-en-rose.json` and must be usable by the existing Piano Block song format without changing the format, schema, validator, editor, or renderer.

The source PDF for this pipeline is available in the phase-0 artifacts as `0-intent/La Vie En Rose - Edith Piaf.pdf`.

## Requirements

1. The repository must contain `songs/la-vie-en-rose.json`.
2. `songs/la-vie-en-rose.json` must be a complete transcription of the provided PDF score from start to finish.
3. The transcription must include both right-hand and left-hand parts.
4. The JSON must conform to the current Piano Block song format documented in `docs/song-format.md` and validated by the existing song schema.
5. The JSON must use Spanish note names and set the top-level `language` field to `spanish`.
6. The JSON must include title metadata for `La Vie en Rose`.
7. The JSON must not include composer metadata.
8. The transcription must include non-note markings from the PDF when the current format supports them, including dynamics, ties, slurs, repeats/barlines, tempo, and free-text annotations.
9. If the PDF contains notation that the current format does not support, that notation must not be forced into unsuitable JSON fields.
10. Unsupported PDF notation and any unresolved transcription uncertainty must be reported at the end of implementation.
11. If part of the PDF is ambiguous or cannot be confidently read, the transcription must use only the best-supported reading and must record the uncertainty for the final implementation report.
12. Automated validation must confirm that `songs/la-vie-en-rose.json` parses as JSON and conforms to the existing song schema.

## Out of Scope

- Changing the song format, schema, validator, renderer, or editor to support additional notation.
- Forcing unsupported notation from the PDF into unsuitable JSON fields.
- Adding composer metadata.
- Committing source PDFs under `songs/`.
- Transcribing anything beyond the provided PDF.

## Acceptance Criteria

1. Given the repository after implementation, when `songs/la-vie-en-rose.json` is inspected, then the file exists at that exact path.
2. Given `songs/la-vie-en-rose.json`, when it is parsed as JSON, then parsing succeeds.
3. Given the parsed song JSON, when it is validated with the existing Piano Block song schema, then validation reports no conformance errors.
4. Given the parsed song JSON, when its top-level fields are inspected, then `language` is `spanish`, `metadata.title` is `La Vie en Rose`, and `metadata.composer` is absent.
5. Given the provided PDF score, when the JSON transcription is compared against it, then the transcription covers the complete score from start to finish, including both right-hand and left-hand parts.
6. Given supported non-note markings in the PDF, when the JSON transcription is compared against the score, then supported dynamics, ties/slurs, repeats/barlines, tempo, and free-text annotations are represented in the existing format.
7. Given notation in the PDF that the current song format does not support, when the JSON is inspected, then that notation is not forced into unsuitable fields and is instead reported in the implementation summary.
8. Given ambiguous or hard-to-read PDF content, when the implementation summary is inspected, then any remaining transcription uncertainty is listed.
9. Given the repository’s automated checks for this issue, when they run, then they include validation that `songs/la-vie-en-rose.json` parses and conforms to the existing song schema.
