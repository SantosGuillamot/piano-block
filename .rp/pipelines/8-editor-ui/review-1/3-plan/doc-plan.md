# Doc Plan: Review 1 — Canvas-first editor UI for the Piano block

This plan covers the **narrative/external documentation** changes for the canvas-first editor
rework. The code (and inline code-symbol docs) ships in phase 4; this plan is only the standalone,
human-facing docs that describe *how the author edits a song* and *how the editor is built*.

## What changed (the behavior these docs must now reflect)

The visual editor is being reworked from an **on-canvas drill-down** (nested song → section →
measure → event → pitch panels, a breadcrumb, add/remove/**move-up/move-down** buttons, a "start a
new song" empty-state button, and a separate **read-only live preview** beside the editor) into a
**Gutenberg-native, canvas-first** editor:

- The **rendered sheet-music canvas is the single interactive surface** — there is no separate
  preview pane. The author **selects a note (or rest) directly on the staff** (clicking it).
- The **block settings sidebar** (`InspectorControls`) holds the settings: an always-present
  **Song** panel, plus **Note / Measure / Section** panels for the selected event and its
  measure/section. Uncommon settings hide behind **progressive disclosure** (a small common set
  shows by default; the rest is revealed).
- **Adding a note happens on the canvas**, and the **hand is determined by which staff** the note is
  added to (right-hand staff → right hand, left-hand staff → left hand). Add/remove of sections,
  measures, notes, and chord pitches is available (add-note and add-measure on the canvas;
  add/remove section, remove measure, remove note, chord pitch add/remove in the sidebar panels).
- **Reordering is omitted** in this version (no move-up/move-down).
- A fresh/empty block **seeds a minimal song** so the canvas shows an **empty grand staff** ready
  for notes — there is **no "start a new song" button / empty-state screen**.
- **Raw-JSON editing is unchanged** — same mode toggle, same non-blocking validation, same
  "raw never blocks saving."
- **Front-end render, the song format/schema, and validation are unchanged** (editor-only change).

These are user-facing behavior changes, so the author-facing docs are now **factually wrong** in
several places and must be corrected. The format reference is correct except for one editor-coupled
clause.

## Documents in scope (what this project actually maintains)

| Doc | Role | Touched here? |
| --- | --- | --- |
| `README.md` | The project's single home for status, the author workflow, and contributor/architecture notes. | **Yes** — primary; multiple sections. |
| `docs/song-format.md` | Canonical **format** reference (fields, values, note-name systems, example). Format is unchanged. | **Light touch** — one editor-coupled clause + link integrity. |
| `AGENTS.md` | Agent guidance (keep pipeline workflow out of shipped artifacts). | No — unaffected. |
| `.rp.md`, `.rp/**` | Internal pipeline artifacts. | No — out of scope (do not cite the pipeline in shipped docs; see AGENTS.md). |

There is **no** `CHANGELOG` / `readme.txt` in this project, so there is no changelog task. The
README's **Forthcoming** section is the closest thing to a running change log and is updated below.

## Cross-cutting constraints (every task must honor)

- **Editor-only boundary in prose.** Do not claim the song format, the front-end render, validation,
  or the published-page output changed — they did not. Keep the front-end (`### 4. What the front
  end shows`) and validator narrative accurate-as-is unless a task explicitly touches it.
- **No pipeline references in shipped docs** (AGENTS.md): never mention specs/design/plan/`AC#`/
  `T#`/"review N" in `README.md` or `docs/song-format.md`. Write as a standalone project.
- **Preserve heading anchors that are linked.** `docs/song-format.md` links to the README anchors
  `#using-the-piano-block` and `#4-what-the-front-end-shows`. Keep those headings' text (and thus
  their slugs) intact, or update every inbound link in lockstep. Prefer keeping them.
- **Match existing voice and density.** The README is detailed and prose-heavy with bolded lead-ins;
  match that register. Don't invent UI labels — use the user-visible names the editor presents
  (panel titles "Song" / "Note" / "Measure" / "Section"; the existing mode-toggle labels and the
  raw field's "Song (JSON)" label and help text, which are unchanged).
- **Don't over-document.** Describe behavior the author can observe; do not enumerate internal module
  names in author-facing sections (those belong only in the contributor file-layout section, D4).

---

## Task order overview

1. **D1** — README: status blurb + "What the block does today" (canvas-first, no preview pane).
2. **D2** — README: "Using the Piano block" workflow (§intro, §2, and §3 cross-references) — the
   canvas + sidebar authoring story; remove drill-down/breadcrumb/move/empty-state language.
3. **D3** — README: "Forthcoming" (visual-authoring wording; no separate preview).
4. **D4** — README: contributor "File layout" table + build-model notes (new editor architecture).
5. **D5** — `docs/song-format.md`: light touch — fix the editor-coupled clause; verify links.

Sequential, one doc-writer each, sharing one working tree. D1→D4 all edit `README.md`, so order
matters to avoid clobbering; D5 is the only `docs/song-format.md` edit and lands last.

---

## D1 — README status blurb + "What the block does today"

**Goal:** Correct the top-of-README description of the editor so it states the **canvas-first**
model: the rendered sheet-music canvas is the single interactive surface (select notes on the
staff), settings live in the block settings sidebar, and there is **no separate live preview pane**.
Keep "raw-JSON editing remains available" and the dynamic-block / front-end description intact.

**Audience:** Anyone landing on the repo — evaluators, site builders, contributors orienting
themselves. First impression of what the block is and does.

**Files:** `README.md`.

**Sections-scope:**
- The blockquote **Status** paragraph (currently: "author that song through a **visual editing UI
  (the default)** with a **live notation preview**").
- **`## What the block does today`** — the bullet that currently says "structured controls for
  building and editing the song, alongside a **live sheet-music preview** that mirrors the front-end
  render."
- Leave the **dynamic / server-rendered** bullet and the closing "no playable keyboard or audio yet"
  paragraph as-is (still true).

**Sections-scope — what to convey:**
- The visual editor is still the **default**; raw-JSON still available behind the mode switch
  (unchanged).
- The **rendered sheet-music canvas is itself the editing surface** — the author selects notes on
  the staff and edits settings in the **block settings sidebar**. Drop "live preview pane" framing;
  the canvas re-renders live as you edit (it *is* the live render, not a second pane).
- Keep the existing link to `docs/song-format.md` and the front-end-render description.

**Depends on:** none (first task).

**Traces to:** the canvas-first authoring surface and the always-present settings sidebar; the
"raw-JSON remains available" and "front-end unchanged" invariants.

**Acceptance:** The Status blurb and "What the block does today" describe a canvas-first editor with
settings in the block sidebar and **no** separate read-only preview pane; the words "preview pane"/
"live preview" (as a separate surface) no longer appear in these two sections; raw-JSON-available and
the front-end/dynamic-block description are preserved; the `docs/song-format.md` link still resolves.
No pipeline references.

---

## D2 — README "Using the Piano block" workflow

**Goal:** Rewrite the author workflow so it describes the **canvas-first** experience end to end:
insert → the block opens on a **seeded empty grand staff** (no "start a new song" button) →
**add notes on the canvas** (hand = which staff) → **select a note on the staff** → edit its
settings, plus its **measure** and **section**, and the always-present **Song** settings, in the
**block settings sidebar**, with **progressive disclosure** of uncommon settings → raw-JSON still
available. Remove all drill-down / breadcrumb / move-up-down / separate-preview language.

**Audience:** Authors/editors using the block in WordPress — the primary "how do I use this" reader.

**Files:** `README.md`.

**Sections-scope:**
- **`## Using the Piano block`** intro paragraph (currently frames "visual editor … live preview …
  drill-down").
- **`### 2. Build the song in the visual editor`** — the **largest** rewrite. Currently describes:
  a "start a new song from scratch" button + seed; "drill-down navigation … breadcrumb"; "add /
  remove / **move-up / move-down** buttons"; and "a **live, read-only sheet-music preview** … you
  can't edit the score directly in it." All of this is now wrong.
- **`### 3. Edit the raw JSON instead`** — the raw-JSON behavior is **unchanged** (same toggle,
  label "Song (JSON)", help text, non-blocking validation, store-verbatim). **Keep its substance**;
  only adjust any sentence that cross-references the visual editor's old shape so it points at the
  new canvas/sidebar model. Do **not** alter the validation-never-blocks-saving wording.
- Leave **`### 1. Insert the block`** (inserter under **Media**) and **`### 4. What the front end
  shows`** essentially as-is (front-end is unchanged) — but make sure §2's new text hands off to §4
  cleanly. **Do not rename the `### 4. What the front end shows` heading** (it is an inbound anchor
  from `docs/song-format.md`).

**Sections-scope — what to convey in §2 (the new authoring story):**
- The block **opens to a canvas-first visual editor by default**. A freshly inserted block shows an
  **empty grand staff** ready for notes (the editor seeds a minimal song) — **no button to press
  first**, no empty-state screen.
- **Add notes on the canvas**, and **which staff you add to decides the hand** (right-hand staff =
  right hand, left-hand staff = left hand). You can also **add a measure** on the canvas.
- **Select a note (or rest) by clicking it on the staff.** When a note is selected, the **block
  settings sidebar** shows that note's settings **and** the settings for the **measure** and
  **section** it belongs to. A **Song** panel (title, composer, and the song-wide musical defaults —
  tempo, time signature, clef, accidentals, octave shift) is **always present** in the sidebar; when
  nothing is selected, the sidebar shows only the Song panel.
- **Progressive disclosure:** each panel shows a small set of common settings, with the less-common
  ones revealed on demand.
- **Add and remove** across the model: add notes/measures on the canvas; add/remove sections, remove
  measures, remove notes, and add/remove chord pitches from the sidebar panels. **Reordering is not
  available** in this version (so: no move-up/move-down — drop that claim entirely; do not promise
  reordering).
- The canvas **re-renders live** as you edit (it draws with the **same notation the published page
  uses**) — but frame it as the single interactive canvas, **not** a separate read-only preview.
- Keep the still-true notes: **conformant by construction** (controls only allow valid songs; no
  musical-timing check); **note-name systems** (English/Spanish, a song keeps its system, with the
  pointer to `docs/song-format.md`); and **"when a song can't be edited visually"** (empty → starts
  fresh on a seeded staff; non-empty invalid → fix in raw JSON, then visual editing resumes).
  Re-verify each of these reads correctly against the canvas-first flow (e.g. the empty case is now
  "a seeded empty staff," not "a start-a-new-song button").

**Depends on:** D1 (consistent canvas-first framing established up top).

**Traces to:** canvas-first authoring; select-on-canvas; sidebar Song/Note/Measure/Section panels;
always-present Song panel and empty-selection behavior; progressive disclosure; add-on-canvas with
hand-by-staff; add/remove coverage; reorder omitted; seeded empty staff; raw-JSON unchanged;
invalid-song routing.

**Acceptance:** §2 describes selecting notes on the canvas and editing in the block settings sidebar
(Song always; Note/Measure/Section on selection) with progressive disclosure, adding notes on the
canvas with hand-by-staff, the seeded empty grand staff (no "start a new song" button), and
add/remove coverage; it contains **no** mention of drill-down, breadcrumb, move-up/move-down /
reorder, or a separate read-only preview pane. §3 still accurately describes the unchanged raw-JSON
mode (toggle, "Song (JSON)" label/help, never-blocks-saving). The `### 4. What the front end shows`
heading is unchanged. No pipeline references; the `docs/song-format.md` links resolve.

---

## D3 — README "Forthcoming"

**Goal:** Update the one-paragraph "what has landed" framing at the top of **Forthcoming** so the
authoring sentence matches the canvas-first editor (no "live preview" as a separate pane). The
forward-looking bullets (audio, richer notation) are unaffected.

**Audience:** Readers gauging maturity / roadmap — the "what works now vs. what's coming" view.

**Files:** `README.md`.

**Sections-scope:**
- **`## Forthcoming`** — the lead paragraph (currently: "Authoring now happens in a **visual editor
  with a live preview** …"). Adjust to "a canvas-first visual editor (select and edit notes on the
  rendered staff, with settings in the block sidebar)," keeping "raw-JSON editing stays available."
- Leave the **Audio playback** and **Richer notation elements** bullets and the "gradual dynamics
  already land" note unchanged (still true; front-end render is unchanged).

**Depends on:** D1, D2 (use the same canvas-first phrasing already settled).

**Traces to:** visual authoring has landed in canvas-first form; raw-JSON stays; render unchanged.

**Acceptance:** The Forthcoming lead paragraph describes canvas-first authoring without a separate
live-preview pane and keeps raw-JSON-available; the audio / richer-notation bullets are unchanged.
Phrasing is consistent with D1/D2. No pipeline references.

---

## D4 — README contributor "File layout" + build-model notes

**Goal:** Bring the **contributor/architecture** documentation in line with the new editor: update
the `src/edit.js` and `src/editor/` descriptions to the **canvas + inspector-sidebar** architecture
(interactive canvas, `InspectorControls` panels, selection layer), drop the removed drill-down /
breadcrumb / reorder / two-column-preview language, and avoid listing modules that no longer exist.

**Audience:** Contributors / maintainers extending the editor — the internal architecture view.

**Files:** `README.md`.

**Sections-scope:**
- **`### File layout`** table — the two editor rows:
  - **`src/edit.js`** — currently "a **mode container** that shows the **visual editor + live
    preview** by default and switches to a **raw-JSON** field … in JSON mode." Keep the mode-container
    framing (it's still a thin mode container with the JSON toggle); update the visual branch to
    "**interactive sheet-music canvas + a block settings sidebar (`InspectorControls`) of panels**"
    instead of "visual editor + live preview." Keep the "both surfaces edit the same `song` string;
    mode toggle is editor-only UI state" sentence (still true), and that selection is editor-only
    state.
  - **`src/editor/`** — currently describes "the structured **drill-down** editors (song / section /
    measure / event / pitch) and the empty / invalid states, the shared **list controls and
    breadcrumb** … and the live, **read-only sheet-music preview**." Rewrite to the new shape: the
    **interactive canvas** (reusing the notation core to render and to hit-test note selection via
    the data hooks the core emits), the **inspector-sidebar panels** (Song always; Note/Measure/
    Section for the selection), the pure **selection helpers**, the reused leaf field-editors, and
    the per-song note-name / serialize-time-conformance / accessible-name helpers — still built only
    on `@wordpress/*`. Keep it at the granularity the table uses (a role sentence per path), not a
    file-by-file inventory.
  - **`src/editor/__tests__/`** — adjust the parenthetical so it no longer names removed pieces
    ("the structured editors, the preview"); describe it as unit tests for the editor (the mode
    container, the canvas, the inspector panels, the selection helpers, and the leaf editors).
- **Other `### File layout` rows** (`piano-block.php`, `block.json`, `index.js`, `style.scss`,
  `render.php`, `view.js`, `src/notation/*`, `src/song/*`, `specs/`, `build/`, `.wp-env.json`) are
  **unchanged** — verify they still read true and leave them. In particular `render.php`, `view.js`,
  `notation/`, `song/`, and `block.json` are explicitly **unchanged** by this rework.
- **`### The build model`** and **`### The song format and validator`** — the editor rework adds no
  runtime dependency and doesn't change the build pipeline, the schema/validator, or the render
  contract. Confirm these read true and **leave them as-is** unless a sentence specifically names the
  old editor shape (the build-model and validator sections don't, so expect no change). Do **not**
  reopen the validator/render-contract prose.
- **`specs/` row** mentions `editor.spec.js` ("authoring + persistence") — that stays accurate at
  this granularity even though the spec's internals are rewritten; leave the wording, just confirm.

**Sections-scope — what to convey:**
- The editor is now **canvas + sidebar**, not drill-down panels + a separate preview.
- The canvas reuses the existing notation core (no new render engine; the core is untouched) and
  reads the data hooks it already emits to map a click to a selected note.
- Settings live in the **block settings sidebar** (`InspectorControls`).
- **Reordering / move controls were removed.** Don't reference breadcrumb, drill-down navigation,
  list move controls, or a two-column visual/preview layout.
- Still **`@wordpress/*`-only**; the notation core, song layer, `view.js`, `render.php`, and
  `block.json` are **unchanged**.

**Depends on:** D1–D3 (author-facing framing settled first; this is the contributor mirror of it).

**Traces to:** the editor-architecture change (canvas + inspector + selection), removed drill-down/
reorder components, reused notation core and leaf editors, WP-only deps, and the unchanged
core/render/format boundary.

**Acceptance:** The `src/edit.js` and `src/editor/` rows (and the `__tests__` parenthetical) describe
the canvas + inspector-sidebar + selection architecture and name no removed module
(drill-down/breadcrumb/list-move/two-column-preview language is gone); the unchanged rows (render,
view, notation, song, block.json, build model, validator) are left accurate and untouched; the
"@wordpress/* only, no new runtime dependency" and "core/render/format unchanged" statements hold.
No pipeline references.

---

## D5 — `docs/song-format.md` light touch (authoring clause + link integrity)

**Goal:** The format reference is **format-only and unchanged**, but its one editor-coupled sentence
in the intro currently says the block has "a visual editor … with structured controls and a **live
notation preview**." Correct that single clause to the canvas-first framing and confirm its links
into the README still resolve. No format/field content changes.

**Audience:** Authors reading the format reference who follow its pointer to the editor workflow.

**Files:** `docs/song-format.md`.

**Sections-scope:**
- **`## Intro and mental model`**, the paragraph at line ~9: change "a **visual editor** — the
  default authoring surface, with structured controls and a **live notation preview**" to the
  canvas-first phrasing (e.g. "a **canvas-first visual editor** — the default authoring surface,
  where you select and edit notes on the rendered staff with settings in the block sidebar"), keeping
  "**raw JSON** is also available as an alternative," "both modes produce the **same song**," and the
  existing link to **[Using the Piano block](../README.md#using-the-piano-block)** and
  **[What the front end shows](../README.md#4-what-the-front-end-shows)** intact.
- Verify the second inbound link near line ~315 (the crescendo/decrescendo "[What the front end
  shows]" link) still resolves to the unchanged README heading.
- **Everything else in `song-format.md` stays** — fields, values, ranges, note-name systems,
  inheritance, the minimal/empty-state distinction, and the annotated example are about the
  **format**, which is unchanged. Do not touch them.

**Depends on:** D2, D4 (the README anchors it links to must be final/stable first — D2 preserves
`#using-the-piano-block` and `#4-what-the-front-end-shows`).

**Traces to:** canvas-first authoring (the one editor-coupled clause); format unchanged; cross-doc
link integrity.

**Acceptance:** The intro clause describes the canvas-first editor (no "live notation preview" as a
separate surface) while keeping raw-JSON-as-alternative and same-song wording; both README links from
`song-format.md` resolve to existing headings; no format/field content changed; no pipeline
references.

---

## Traceability summary

| Behavior change | Tasks |
| --- | --- |
| Canvas is the single interactive surface (no separate preview pane) | D1, D2, D3, D4, D5 |
| Select a note on the canvas | D2, D4 |
| Settings in the block sidebar (Song always; Note/Measure/Section on selection) | D2, D4 |
| Progressive disclosure of uncommon settings | D2 |
| Add notes on the canvas; hand by staff | D2 |
| Add/remove at every level | D2, D4 |
| Reordering omitted (no move-up/down) | D2, D4 |
| Seeded empty grand staff (no "start a new song" button) | D2 |
| Raw-JSON editing unchanged | D2 (verify), D1/D3 (mention) |
| Invalid non-empty song → fix in raw JSON | D2 (verify) |
| Editor architecture (canvas + inspector + selection; core reused, unchanged) | D4 |
| Front-end render / format / validator unchanged | D1/D2/D3/D4 (preserve), D5 (format-only touch) |
| WP-only dependencies (no new runtime dep) | D4 |
