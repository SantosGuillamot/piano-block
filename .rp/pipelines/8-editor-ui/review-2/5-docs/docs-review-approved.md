# Docs review — Review 2 (editor UI): APPROVED

**Verdict:** Approved. The D1–D4 docs batch is accurate against the shipped code,
complete against the doc plan, drift-resistant on the front-end boundary, and free
of stale claims, pipeline references, and inline code-symbol leaks.

**Scope reviewed:** `git diff 12341d1..HEAD` for `README.md` and
`docs/song-format.md` (commits `2d38b93` D1 → `cb9d02e` D3 → `e78c7cb` D4),
against `3-plan/doc-plan.md`, `1-spec/spec.md`, `2-design-doc/design-doc.md`, and
spot-checks of `src/`.

## What was verified against the code

### D1 — Selection-contextual add/remove + on-canvas grid removed
- README intro (line 19) no longer claims notes are added on the canvas — changed
  to "you **select** notes directly on it … where you also add and remove notes."
- "Add notes from the sidebar" paragraph (line 29) states notes are added from the
  **Note** panel, no per-staff "Add note to right hand in measure N" buttons, no
  end-of-score "Add measure", **hand inferred**, and an empty measure's first note
  from the **Structure** list. Matches `NotePanel.js:293`
  (`onAddNote(sectionIndex, measureIndex, hand)`) and the StructureList first-note
  path (`StructureList.js`).
- The **Section** panel bullet correctly says add/remove of sections now lives in
  Structure, with the precise caveat that a convenience **Add section / Remove
  section** still appears in the Section panel — verified accurate against
  `SectionPanel.js:123–131` (not a stale claim; a faithful one).
- The on-canvas add-grid is confirmed **gone**: `SongCanvas.js` has no
  `__canvas-actions`, `HANDS`, `Add note to`, or `Add measure`.
- "Reordering is not available" retained.

### D2 — Sidebar Structure view
- New paragraph (line 39): always-present, lists sections → measures to **measure
  depth**, individual notes **not** listed, add/remove sections and measures,
  per-measure **Add note**, **select-to-edit + highlight and scroll** on the canvas,
  **no reordering**. Matches `StructureList.js` and `SongCanvas.js`
  (`is-active-measure` / `is-active-section`, `scrollIntoView`,
  `measureNumbersForSection`).

### D3 — `language` field + Note-language selector
- `docs/song-format.md`: top-level shape line now `{ metadata?, defaults?,
  language?, sections }`; new `## \`language\`` subsection documents the exact
  strings **`"spanish"` / `"english"`** (explicitly *not* ISO `es`/`en`),
  optional/additive, editor-only meaning, **"front end does not consume it yet"**,
  and stored / round-trips / validates / never-blocks. Matches
  `schema.js:44` (`language: { enum: ["spanish", "english"] }`).
- README "Note names" paragraph: documents the **Note language** selector
  (English / Spanish) that **converts** every note name and **stores** the choice,
  **infers** initial language for existing songs and defaults new songs to
  **English**, and links to the `#language` field. Matches `SongPanel.js:167`
  (label `"Note language"`) and `LANGUAGES` values `english`/`spanish`.
- No doc claims the published page shows the language or changes rendering;
  confirmed the front end reads no `language` (zero hits in `view.js`/`render.php`).

### D4 — Contributor docs
- `src/editor/` file-layout row names **`StructureList`**, describes the canvas as
  **selection + decoration only** with the on-canvas add affordances removed, and
  notes the **kind-tagged** selection. `StructureList.js` and `StructureList.test.js`
  exist.
- `src/notation/` row + the dedicated **"editor-only `interactive` hit-rect"**
  architecture note: opt-in `interactive` flag emits a transparent per-event
  hit-rect; the front end passes **no** flag so its SVG is **byte-identical**.
  Verified `view.js:134` (`renderInto(container, model, { accessibleName })` — no
  flag), `SongCanvas.js:276` (`interactive: true`), and `svg.js:284`
  (`renderSvg(model, { accessibleName = "", interactive = false })` — opt-in,
  default false).
- Additive-growth prose (README and song-format) mentions `language` as the latest
  additive optional field, stating absent is valid and the front end does not read
  it.
- `src/edit.js` row updated at altitude (structural mutators + kind-tagged
  selection), matching `edit.js:194–238`.
- `render.php` / `view.js` rows still correctly describe the front end as unchanged.
- Tests paragraph adds proportional mentions (Structure list, contextual add/remove,
  language conversion, editor-only hit-rect / front-end parity) without inventing
  test names.

## Cross-cutting checks
- **Drift-resistance:** every reference to `language` consumption is editor-only;
  no doc implies front-end note-name behavior. The contributor hit-rect note is
  accurate (front end omits the flag → byte-identical).
- **No stale claims:** no surviving "on-canvas add-grid", "add notes on the canvas",
  or "Add measure" affordance claims; the only matches are the corrected prose that
  negates them.
- **Anchors resolve both ways:** README ⇄ song-format links
  (`#language`, `#note-name-systems-english-and-spanish-and-case`,
  `#additive-growth-no-version-field`, `#2-build-the-song-in-the-visual-editor`,
  `#using-the-piano-block`, `#4-what-the-front-end-shows`) all target existing
  headings.
- **No pipeline references** and **no inline code-symbol docs** in author-facing
  prose (file names appear only in the contributor File-layout / architecture
  sections, as the plan allows).
- **Voice and altitude** match the existing dense second-person prose; no
  out-of-scope additions; field detail stays in `docs/song-format.md` with the
  README cross-linking rather than duplicating (the C↔do table is not repeated).

All four tasks delivered; nothing material missing.
