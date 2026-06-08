# Docs review — Editor UI (issue #8) — APPROVED

## Verdict

**APPROVED.** All five doc tasks (D1–D5) are accurate, complete against their
Acceptance, faithful to shipped behavior, free of scope creep, and free of any
pipeline references. Every cross-link and anchor resolves.

## Batch scope

- **Tasks reviewed:** D1, D2, D3, D4, D5 (the entire doc plan).
- **Diff inspected:** `48c1f3b..HEAD`. Only `README.md` (+37/−19) and
  `docs/song-format.md` (1 line) are touched — exactly the two files the plan
  scopes, nothing else.
- **Source of truth:** the shipped editor code (`src/edit.js`, `src/editor/*`,
  `src/song/schema.js`) and the actual rendered docs.

## Summary

The docs now describe the visual editor as the default authoring surface with a
read-only live preview, raw JSON behind a toolbar mode switch, drill-down
navigation, button-based add/remove/reorder (no drag-and-drop), empty→fresh and
non-empty-invalid→fix-in-JSON routing, and per-song English/Spanish note-name
preservation. The raw-JSON field's behavior (label *Song (JSON)*, help text,
informational-never-blocking validation, raw text always stored, structural-not-
timing) is preserved and relocated into the JSON-mode step. The song format,
`render.php`, and the front-end render are correctly described as unchanged
(confirmed: `git diff 48c1f3b..HEAD -- src/` is empty). D5 changed only the
intro wording of the format reference and touched no field-level docs.

## Checks table

| Check | Result | Evidence |
| --- | --- | --- |
| Only README.md + song-format.md touched | PASS | `git diff --stat 48c1f3b..HEAD` shows exactly those two files |
| src/ unchanged in docs phase (format/render/front end intact) | PASS | `git diff --name-only 48c1f3b..HEAD -- src/` is empty |
| Visual editor = default; raw JSON behind mode switch | PASS | README status, "What the block does today", step 2/3; matches `edit.js:46` (`useState("visual")`) and the toolbar toggle `edit.js:74-85` |
| Preview is read-only (not a twin editor) | PASS | README step 2 "it is a preview, not a second editor"; matches `SongPreview.js` (no onChange; `edit.js:24` comment) |
| Drill-down nav (song→section→measure→event) + breadcrumb | PASS | README step 2; matches `SongEditor.js` `StructuredEditor`/`trailFor` and `Breadcrumb.js` |
| Add/remove/reorder via buttons, no drag-and-drop | PASS | README step 2 "(there is no drag-and-drop)"; matches `ListControls.js` |
| Empty→fresh start | PASS | README step 2 / "When a song can't be edited visually"; matches `EmptyState.js` ("Start a new song" → `newSong()`) |
| Non-empty-invalid → fix-in-JSON | PASS | README step 2 + step 3; matches `InvalidState.js` and `SongEditor.js:271` branch |
| Per-song English/Spanish note names preserved | PASS | README step 2 note-name note; matches `noteNames.js` (`inferNoteNameSystem`, preserved verbatim) |
| Raw field: label *Song (JSON)*, non-blocking validation preserved | PASS | README step 3 quotes label + help verbatim; matches `edit.js:88-103` |
| Field reference stays canonical (no field-level dup in README) | PASS | README step 2/3 point to `docs/song-format.md`; no field tables added |
| All anchors resolve (`#using-the-piano-block`, `#4-what-the-front-end-shows`, `#annotated-example-song`) | PASS | Headings present at README.md:17, :62 and song-format.md:391 |
| No pipeline/AC/Req/T/D references in shipped docs | PASS | `grep -E '\.rp/|AC[0-9]|Req ?[0-9]|\bT[0-9]+\b|\bD[0-9]+\b|spec\.md|design-doc|doc-plan|Traces to'` → none |
| D4 file-layout: `src/edit.js` row = mode container | PASS | README.md:130 |
| D4: `src/editor/` + `__tests__/` rows added, dir-level, `npm run test:unit` | PASS | README.md:131-132; `test:unit` exists in package.json |
| D4: unchanged rows (view.js, render.php, notation/, song/, block.json) intact | PASS | README.md:128, :134-141 unchanged in substance |
| D3: "A visual authoring UI" removed from Forthcoming; audio + richer notation kept | PASS | README.md:189-193 |
| D5: only intro wording changed; no field tables/examples/annotated example touched | PASS | `git diff` shows a single-line change at song-format.md:9 |

## Accuracy spot-check (one concrete claim per task, verified vs code/file)

- **D1** — README status: "a **visual editing UI (the default)** with a **live
  notation preview**, and **raw-JSON editing remains available**." Verified: the
  editor defaults to visual mode (`src/edit.js:46`, `useState("visual")`) and the
  toolbar toggles to JSON (`src/edit.js:74-85`). The dropped "no visual authoring
  UI yet" claim is correctly gone.
- **D2** — README step 3 quotes the help text *"The raw song document as JSON.
  Validation is informational and never blocks saving."* — exact match to
  `src/edit.js:90-92`, and the label *Song (JSON)* matches `src/edit.js:89`.
- **D3** — "A visual authoring UI" no longer appears as forthcoming; the section
  now reads "Song *storage*, **visual authoring**, and front-end **notation
  rendering** have landed" (README.md:189). Audio playback (README.md:191) and
  richer notation elements (README.md:193) remain. Verified by reading the
  Forthcoming section.
- **D4** — `src/editor/` row claims "the structured drill-down editors (song /
  section / measure / event / pitch) … live, read-only sheet-music **preview**
  that reuses the notation core in `src/notation/`." Verified: those editors
  exist in `src/editor/` and `SongPreview.js` imports `buildLayoutModel`/
  `renderInto` from `../notation/*`. "Built only on `@wordpress/*` packages"
  matches the editor imports (no third-party runtime dep).
- **D5** — song-format.md:9 now reads "The block now has a **visual editor** —
  the default authoring surface … and **raw JSON** is also available." The prior
  "There is no visual notation *editor* yet" is gone, the "no audio playback"
  statement is kept, and the inbound links `#using-the-piano-block` and
  `#4-what-the-front-end-shows` resolve to README.md:17 and README.md:62. No
  field-level content changed (single-line diff).

## Drift sweep

- No surface left with stale "by hand / no visual editor / raw-JSON-only /
  forthcoming visual UI" wording: the status blurb, "What the block does today",
  the authoring workflow, the Forthcoming list, the file-layout table, and the
  format-reference intro were all updated. Remaining "raw JSON by hand" phrasing
  exists only as the *legitimate alternative* mode, not as the sole surface.
- No shipped public surface the plan intended to cover is left undocumented: the
  toolbar mode switch, visual editor, live preview, empty/invalid states,
  note-name systems, and `src/editor/` code path are all documented.
- Conservative on labels: the README describes the "mode switch in the block
  toolbar" without over-quoting the exact button text ("Edit as JSON" /
  "Visual editor", `src/edit.js:80-83`), in line with the plan's "do not
  over-specify exact button labels" constraint. This is correct, not a gap.

## Issues

None.
