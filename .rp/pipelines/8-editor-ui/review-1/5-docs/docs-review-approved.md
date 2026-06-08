# Docs review — review-1 (canvas-first editor UI): APPROVED

**Verdict:** Approved.
**Batch:** D1–D5 (`README.md`, `docs/song-format.md`).
**Diffed:** `git diff 13edd06..HEAD` (doc commits `b473f1c`(D1) → `341cdf1`(D5)).
**Reviewed against:** doc-plan, spec, design doc, and the **shipped code** in `src/`.

## Rationale

The documentation batch accurately reflects what shipped, contains no stale language,
delivers each task's acceptance, keeps every cross-doc link resolving, and leaks no
pipeline references. The accuracy spot-checks against `src/` all passed:

- **Canvas-first single interactive surface.** README Status, "What the block does
  today", "Using the Piano block" intro, §2, "Forthcoming", and `song-format.md`'s intro
  all describe the rendered staff as the single editing surface with settings in the
  block sidebar — never a separate read-only preview. Matches `src/editor/SongCanvas.js`
  (the old preview's render path made interactive) and `src/edit.js` (canvas +
  `InspectorControls`, no second pane).
- **Select on the canvas; sidebar panels.** README §2 and the File-layout `src/edit.js`/
  `src/editor/` rows describe selecting a note/rest on the staff and the always-present
  **Song** panel plus **Note/Measure/Section** on selection. Matches `src/edit.js`
  (`SongPanel` always; `NotePanel`/`MeasurePanel`/`SectionPanel` gated on
  `resolvedSelection`) and the four `src/editor/inspector/*` panels.
- **Real add-note label form.** README's "*Add note to right hand in measure 1*" matches
  `SongCanvas.js` verbatim (`__("Add note to %1$s in measure %2$d")` with hand label
  "right hand"/"left hand"). "Add measure" matches the end-of-score button. Hand-by-staff
  matches the `HANDS` → `onAddNote(sectionIndex, measureIndex, key)` wiring.
- **Progressive disclosure.** README's "*Advanced* disclosure" wording matches every
  panel's `ToolsPanel label={__("Advanced")}`. The Note panel's disclosed set (dots,
  dynamic, tie, slur, crescendo/decrescendo, annotations) and visible set (type,
  duration, pitches) match `NotePanel.js`; the Song panel's common (title/composer,
  tempo BPM, time signature) vs. advanced (beat unit, per-hand clef/accidentals/octave
  shift) split matches `SongPanel.js`.
- **Add/remove coverage; reordering omitted.** README's "add notes/measures on the
  canvas; add/remove sections, remove the selected note, add/remove chord pitches in the
  sidebar; **no move-up/move-down**" matches the shipped buttons (Remove note, Remove
  measure, Add/Remove section, PitchList) and the absence of any move control wired into
  the editor UI (`ListControls.js` survives only as `AddButton`, imported by the reused
  leaf lists — no move controls reach the shipped surface, so the README claim holds).
- **Seeded empty staff.** README's "empty grand staff … nothing to press first … seeded
  empty staff" matches `edit.js` lazy `newSong()` seeding; no "start a new song" button
  language remains anywhere.
- **Raw JSON unchanged.** §3 / Status / Forthcoming keep the toggle, "Song (JSON)" label,
  the never-blocks-saving help text, and the non-blocking notice — all verbatim in
  `edit.js`. Invalid-non-empty routing to raw JSON matches `InvalidState`.
- **File-layout architecture section.** The `src/edit.js`, `src/editor/`, and `__tests__`
  rows name only files that exist (`SongCanvas`, `inspector/`, `selection.js`) and no
  removed module. The "unchanged" rows (render.php, view.js, notation, song, block.json,
  build model, validator, `specs/editor.spec.js`) were left untouched by the diff and
  read true.

**No drift:** a scan of `README.md` and `docs/song-format.md` finds no "drill-down",
"breadcrumb", "move-up/move-down", "separate/live preview pane", or "start a new song"
in user-facing prose. (The only "reorder" hit is "re-escape, **reorder**, or fail" in the
unchanged render-contract paragraph — JSON-key reordering, not the editor move control.)

**Link integrity:** `song-format.md` links `../README.md#using-the-piano-block` and
`../README.md#4-what-the-front-end-shows` (intro and the line-~315 crescendo reference)
both resolve — the README headings `## Using the Piano block` and
`### 4. What the front end shows` are intact, and `#forthcoming` resolves to `## Forthcoming`.

**Completeness vs. doc-plan:** D1 (Status + "What the block does today"), D2 ("Using the
Piano block" §intro/§2/§3), D3 ("Forthcoming" lead), D4 (File-layout editor rows +
`__tests__` parenthetical), and D5 (`song-format.md` intro clause + links) each delivered
their Goal/Acceptance; nothing material missing, nothing out-of-scope added, no pipeline
references in the shipped docs.
