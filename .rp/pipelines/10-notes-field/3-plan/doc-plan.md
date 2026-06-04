# Doc Plan: Free-text `notes` annotations placeable above or below either staff

## Overview

This feature replaces the single per-event `chordSymbol` string with a general **notes** capability: a note holds free text plus an explicit `placement` (`above` / `below`), and attaches either **per-event** (tied to a note/rest, inheriting that event's staff and horizontal column) or **standalone** (attached at the measure level with an explicit `staff` and optional `beat` horizontal anchor). All four grand-staff positions — above and below each of the two staves — become reachable. `chordSymbol` is removed as a clean break: legacy songs that carry it stay valid but the annotation stops rendering, with no auto-migration.

The author-facing song-format reference (`docs/song-format.md`) is where the `notes` model lives today as the removed `chordSymbol` field, so it is the primary surface to rewrite: the per-event and standalone shapes, the `placement`/`staff` enums, the `beat` units, defaults, free-text/verbatim semantics, the four placement positions, and the one-line `chordSymbol` → `notes` migration guidance (spec Requirement 8). The contributor-facing `README.md` carries one secondary reference (an aside in the script-breakout-escape explanation that names `chordSymbol` as an example free-text field) that must be re-pointed at `notes`. A repository-wide sweep confirms these are the only two documentation files outside the pipeline's own `.rp/` artifacts that reference the changed behavior; `AGENTS.md` and `src/notation/OFL.txt` carry no `chordSymbol`/annotation references and need no change.

**Critical sequencing note for every doc-writer.** The Docs phase runs **after** the Code phase. The shipped code (code-plan Task 3) will already have stripped the literal `chordSymbol` token from `docs/song-format.md` and `README.md` and left only a brief placeholder for the `notes` field. Every task below must therefore be authored against the **final shipped code** — read the actual `src/song/schema.js` (the `eventNote` / `standaloneNote` `$defs` and the `event.notes` / `measure.notes` attachment points), `src/notation/layout.js`, `src/notation/svg.js`, and `src/notation/constants.js` to confirm field names, enum values, defaults, units, and observable behavior before writing. Document only what the code actually ships; do not document deferred or out-of-scope behavior (spanning annotations, section/song-level standalone notes, a "between staves"/centered placement value, auto-migration, or musical-timing validation of `beat`). Do not reintroduce the `chordSymbol` token except inside the single migration line that explicitly teaches authors how to rewrite legacy data.

## Tasks

### Task 1: Document the per-event and standalone `notes` model in the song-format reference

- **Goal:** Replace the removed `chordSymbol` field documentation in `docs/song-format.md` with a complete, accurate author-facing reference for the new `notes` capability in both attachment modes, so a song author can hand-write conformant `notes` arrays for any of the four grand-staff positions.
- **Audience:** Song authors (people writing raw song JSON by hand).
- **Files:**
  - `docs/song-format.md`
- **Sections-scope:**
  - The **Events** section (currently the `event :=` schema block, the `chordSymbol` bullet, and the single-event JSON example — around lines 156–193 before the code phase edits them): rewrite the per-event annotation documentation here to describe `event.notes` (the per-event mode).
  - The **`measures` — the grand-staff pairing** section (the `measure :=` schema block and its bullets, around lines 67–82): add documentation for `measure.notes` (the standalone mode) as a new optional measure member, consistent with how `barlineStart`/`barlineEnd` are documented as optional measure members.
  - A short new conceptual passage (either a new subsection, e.g. "Notes (annotations)", or extending the Events/measures coverage) that explains `notes` as one concept with two attachment modes. The doc-writer chooses placement to fit the document's existing structure and tone; keep it within the Events and `measures` sections so it does not overlap Task 2 (migration) or Task 3 (annotated example) or Task 4 (README).
  - Do **not** touch the "Annotated example song" section or its intro prose (that is Task 3) and do **not** add the migration line here (that is Task 2).
- **Depends on:** none
- **Traces to:**
  - Spec Requirements 1, 2, 3, 4 (per-event `notes` of `{text, placement}`; standalone `measure.notes` of `{text, placement, staff, beat?}`; one concept, two modes; optional and empty both valid).
  - Spec Requirements 9, 10, 11, 12 (validation: `text` required string with `""` valid; `placement` required enum `above|below`; `staff` required enum `rightHand|leftHand` on standalone; `beat` optional number `≥ 0`, quarter-beats, fractional allowed).
  - Spec Requirements 14, 16, 17 (the four placement positions are author-visible; per-event note aligns to its event's column; standalone `beat` anchors horizontally with higher beat further right, no-`beat` near the measure's left edge).
  - Spec Requirement 18 (text renders verbatim).
  - Design "Schema additions", "Note primitive (layout → emit)", Decision "Two `$defs` for the two attachment modes".
  - Code-plan Task 1 (the shipped `eventNote` / `standaloneNote` `$defs` and the `event.notes` / `measure.notes` attachment points), Task 5 (the `beat` → X anchoring semantics author-visible: higher beat further right, no-`beat` ≈ left edge).
- **Acceptance:**
  - A song author can read this section and hand-write a conformant per-event note and a conformant standalone note for any of the four grand-staff positions (above/below the right-hand staff, above/below the left-hand staff) without reading any other file.
  - The reference documents, for the **per-event** mode: that a note attaches to a note or rest event via a `notes` array; the per-event note's required fields and that its staff is implicit (inherited from the hand whose array the event lives in); and that the note aligns horizontally with its event.
  - The reference documents, for the **standalone** mode: that a note attaches at the measure level via a `notes` array; its required fields including the explicit staff field; the optional horizontal-anchor field, its unit, and that absence anchors near the measure's left edge while larger values move it rightward.
  - The reference states, for both modes: the allowed `placement` values and that placement is required with no default; that the text field is required free text whose empty value is valid and renders nothing; and that the text renders verbatim. (Use whatever the shipped schema actually names and enumerates — confirm against `src/song/schema.js`.)
  - The reference makes clear that `notes` is optional on both events and measures and that both an absent `notes` and an empty `notes: []` are valid.
  - The reference is consistent with the format's documented "additive growth / unknown fields ignored / enumerated values closed" conventions and does not contradict the existing "Additive growth" and conformance-policy passages.
  - No `chordSymbol` token appears in any section this task touches.
  - The documented field shapes, names, enums, and defaults match the shipped `src/song/schema.js` (verified by the doc-writer reading the final code).

### Task 2: Add the `chordSymbol` → `notes` migration line

- **Goal:** Give an author with a legacy song one explicit, copy-adaptable line showing how to rewrite a legacy `chordSymbol` value as an equivalent `notes` entry, and stating that the legacy field is now silently ignored and no longer renders.
- **Audience:** Song authors with existing songs that still carry `chordSymbol`.
- **Files:**
  - `docs/song-format.md`
- **Sections-scope:**
  - A single short migration note placed where an author would naturally look for it — adjacent to the per-event `notes` documentation from Task 1 (the Events section) is the recommended home, or alternatively the "Additive growth" section that already discusses how the format evolves. The doc-writer picks one location and keeps the migration content to roughly one line plus minimal framing, so it does not bloat or duplicate Task 1's reference.
  - This is the **only** place in the documentation where the `chordSymbol` token may appear after this feature ships (it must appear here, as the thing being migrated away from).
- **Depends on:** Task 1 (so the migration line can reference the now-documented `notes` shape rather than re-explaining it).
- **Traces to:**
  - Spec Requirement 8 ("Documentation includes one explanatory line telling authors how to rewrite a legacy `chordSymbol: \"C\"` as `notes: [{ \"text\": \"C\", \"placement\": \"above\" }]`").
  - Spec Requirement 7 (a legacy `chordSymbol` stays valid as an ignored unknown key and does not render; no auto-migration, no rejection, no warning).
  - Spec acceptance criterion: "Given the documentation, when an author looks up how to migrate, then there is a line showing that `chordSymbol: \"C\"` should be rewritten as `notes: [{ \"text\": \"C\", \"placement\": \"above\" }]`."
  - Design Decision "Remove `chordSymbol` as a clean break" (legacy data valid-but-non-rendering; one docs migration line is the only accommodation).
  - Code-plan Requirement-8 split note (token removal is in code Task 3; the migration-line *content* is owned here).
- **Acceptance:**
  - An author who looks up "how do I migrate my old `chordSymbol`?" finds a single explanatory line that shows the rewrite from the legacy `chordSymbol` form to the equivalent `notes` entry (an above-placement per-event note).
  - The line (or its immediate context) states that a legacy `chordSymbol` remains valid but is now ignored and no longer renders, and that there is no automatic migration — the rewrite is manual.
  - The migration line is the only occurrence of the `chordSymbol` token remaining in the documentation; it does not reintroduce `chordSymbol` as a supported field anywhere else.
  - The rewrite shown matches the shipped schema's `notes` shape (confirmed against `src/song/schema.js`).

### Task 3: Update the annotated example song and its intro to use `notes`

- **Goal:** Make the document's copy-pasteable annotated example, and the prose that lists what it exercises, demonstrate the new `notes` capability instead of the removed `chordSymbol`, so the canonical starting template authors copy is current and renders annotations correctly.
- **Audience:** Song authors (the annotated example is the primary copy-and-adapt template).
- **Files:**
  - `docs/song-format.md`
- **Sections-scope:**
  - The **Annotated example song** section: the intro paragraph that enumerates the elements the example exercises (currently mentions "a free-text chord symbol", around line 272) and the JSON example block itself (currently carries `"chordSymbol": "C"`, around line 298).
  - Only this section. Do not modify the Events/measures reference (Task 1), the migration line (Task 2), or the README (Task 4).
- **Depends on:** Task 1 (the example must match the field model documented there).
- **Traces to:**
  - Spec Requirement 6 (no `chordSymbol` token remains anywhere, including the example).
  - Spec Requirements 1, 2, 14 (the example should demonstrate the real `notes` shape; ideally exercise more than one placement / a standalone note so the example showcases the new capability, while staying a valid, renderable song).
  - Spec Requirement 18 (free text renders verbatim).
  - Design "Note primitive", rendering bands.
  - Code-plan Task 3 (removes the `chordSymbol` token from the example, leaving the richer demonstration to docs), Tasks 6–8 (the shipped rendering of the four bands the example may showcase).
- **Acceptance:**
  - The annotated example contains at least one valid `notes` entry (replacing the former `chordSymbol`), and the intro prose lists "a note / annotation" (or equivalent) in place of "a free-text chord symbol".
  - The example song remains a single, valid, copy-pasteable, conformant song document (no comments inside the JSON; it still validates and still renders) — verify by validating/rendering against the shipped code.
  - No `chordSymbol` token appears anywhere in this section.
  - Any `notes` entries used in the example match the shipped schema shape (per-event and/or standalone), and any `placement`/`staff`/`beat` values used are within the shipped enums/ranges.
  - The example continues to read as a broad-coverage demonstration consistent with the rest of the section's framing (it still exercises the spread of elements the intro promises).

### Task 4: Re-point the README's script-breakout-escape aside from `chordSymbol` to `notes`

- **Goal:** Update the one contributor-facing reference in `README.md` that names `chordSymbol` as an example of an author free-text field (in the explanation of why PHP escapes `<` before printing the song into the inert `<script>`), so the contributor documentation names a field that still exists and the XSS-inert guarantee is described against the current model.
- **Audience:** Contributors / maintainers (the README's "For contributors" → "The song format and validator" section explains the render contract and escaping rationale).
- **Files:**
  - `README.md`
- **Sections-scope:**
  - The **For contributors** → **The song format and validator** subsection, specifically the "Render contract" / script-breakout-escape paragraph (around line 162) that currently cites `chordSymbol` as an example free-text field where an unescaped `</script>` could otherwise close the carrier early.
  - Only this reference. Do not alter the file-layout table, the conformance-policy bullets, or other README sections (they carry no `chordSymbol`/annotation reference; a repo sweep confirmed line 162 is the sole occurrence in README). The code phase (Task 3) already rewords this line to a placeholder; this task ensures the final wording correctly and accurately names the `notes` field and preserves the escaping rationale.
- **Depends on:** none (independent of the `docs/song-format.md` tasks).
- **Traces to:**
  - Spec Requirement 6 (no `chordSymbol` token remains anywhere, including the README).
  - Spec Requirement 19 (the XSS-inert guarantee carries over unchanged from `chordSymbol` to `notes`; the escaping mechanism is field-agnostic).
  - Design component note on `src/render.php` (the script-breakout escape is field-agnostic and unchanged; the comment naming `chordSymbol` is reworded to `notes`).
  - Code-plan Task 3 (rewording the `render.php` comment and the README line off the `chordSymbol` token).
- **Acceptance:**
  - The script-breakout-escape paragraph names a note's free text (i.e. the `notes` field, or "a note's text") instead of `chordSymbol` as the example of author free text that could otherwise carry a breakout sequence, and continues to name `metadata.title` as it does today.
  - The escaping rationale (replacing `<` with `<` to neutralize `</script>` / `<!--` breakout while round-tripping losslessly through `JSON.parse`) is preserved and still accurate.
  - No `chordSymbol` token remains in `README.md`.
  - The description is consistent with the shipped `src/render.php` behavior (the escape is field-agnostic and unchanged) — confirmed by the doc-writer against the final code.

## Coverage map (doc surface → task)

- **`docs/song-format.md` — Events / `measures` reference** (the `notes` field model, both modes, enums, defaults, units, verbatim semantics) → **Task 1**.
- **`docs/song-format.md` — migration guidance** (Requirement 8 line; legacy `chordSymbol` valid-but-ignored) → **Task 2**.
- **`docs/song-format.md` — annotated example + its intro prose** (the `chordSymbol` usages at lines ~272 and ~298) → **Task 3**.
- **`README.md` — contributor script-breakout-escape aside** (the `chordSymbol` reference at line ~162) → **Task 4**.
- **`AGENTS.md`, `src/notation/OFL.txt`** — swept and confirmed to carry **no** `chordSymbol`/annotation references → **no task needed**.
- **Inline comments / JSDoc, test fixtures, the `render.php` source comment** — these are **code** surfaces owned by code-plan Task 3 (token removal across `src/`, `specs/`), not documentation tasks; intentionally **out of this doc plan's scope** to avoid overlap with the code phase.
