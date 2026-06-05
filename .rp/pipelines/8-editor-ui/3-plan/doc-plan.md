# Doc Plan: Editor UI for editing the song

This plan lists the documentation changes that ship alongside the visual
editor feature. Each task block below is dispatched verbatim to a separate
`doc-writer`.

## What actually changes for readers

The block editor now offers a **visual authoring UI** as the **default**
surface, with a **live sheet-music preview** beside the controls, while
**raw-JSON editing remains available** behind a mode switch. The song format,
the server render, and the front-end SVG rendering are **unchanged** — a song
authored visually renders identically to the same song typed as JSON. So the
docs that describe *authoring* (the README's status blurb, "What the block does
today", and "Using the Piano block" workflow, plus its file-layout table and
"Forthcoming" list) need real revision; the **song-format reference**
(`docs/song-format.md`) needs only **light pointer/wording touches** because the
format itself does not change.

## Shipped-doc constraints (apply to every task)

- The shipped docs must read as a standalone project. Do **not** reference the
  internal pipeline workflow or its artifacts in any way: no `.rp/`, no spec /
  design / plan citations, no `AC#`, `Req#`, or `T#` task ids. (The "Traces to"
  fields below are for planning only and MUST NOT appear in the docs.)
- Document **only** behavior the feature actually ships. Do not invent UI
  details the code does not implement. In particular: the visual editor is the
  default; raw JSON is the alternative behind a mode switch (the two are never
  shown side by side as twin editors — the preview is read-only); the editor
  navigates the song by **drilling down** one level at a time (song → section →
  measure → event); add/remove/reorder is via **buttons** (no drag-and-drop);
  an **empty** song starts a fresh visual song; a **non-empty invalid** song
  **cannot** be edited visually and is routed to raw JSON to fix; note names use
  a **per-song system** (English vs Spanish) and a song's existing note-name
  language is preserved.
- Keep the song format described **exactly as it is today** — no schema/field
  changes. `render.php` and the front-end rendering are untouched.
- Match the existing docs' voice, Markdown style, heading style, and
  cross-link conventions. Keep existing anchors stable where other docs link to
  them (e.g. `#using-the-piano-block`, `#4-what-the-front-end-shows`,
  `#annotated-example-song`).

---

## D1 — Revise the README status blurb and "What the block does today"

**Goal:** Bring the README's top-of-page status statement and the "What the
block does today" overview in line with the shipped behavior: authoring is now
a **visual UI by default** with a **live notation preview**, and **raw-JSON
editing remains available** as an option; the front-end rendering is unchanged.

**Audience:** End users / WordPress authors evaluating the plugin, plus anyone
skimming the README to learn what the block is.

**Files:** `README.md`.

**Sections-scope:**
- The `> **Status:**` blockquote near the top (currently says the song is
  "authored by hand in a raw-JSON editor field" and that the block "does **not**
  yet ... offer a visual authoring UI"). Update it to say the block provides a
  **visual editing UI (the default)** with a **live preview**, while raw-JSON
  editing stays available; remove the "no visual authoring UI yet" claim. Keep
  the audio-playback-is-future-work statement (audio is still out of scope).
- The "## What the block does today" section, especially the bullet that
  currently says "it shows a single **raw-JSON field**" and the closing
  paragraph that says "authoring is still by hand in a raw-JSON field". Reframe:
  the editor presents a **visual editor by default** (with a live sheet-music
  preview) and **raw JSON as an alternative**; both edit the **same single
  song**; the validation-is-informational-and-never-blocks-saving behavior of
  the raw-JSON field is **preserved** (it now lives in the raw-JSON mode). Keep
  the existing description of the dynamic/server-rendered block and the
  front-end rendering **unchanged in substance**.

**Depends on:** (none)

**Traces to:** Req 1, 5, 7, 10, 13; AC1, AC6, AC7, AC10, AC11.

**Acceptance:**
- The status blurb no longer claims authoring is by-hand-only or that a visual
  authoring UI does not exist; it states the visual UI is the default and raw
  JSON remains available, and still notes audio playback is future work.
- "What the block does today" describes both editing modes (visual default +
  raw-JSON option), the live preview, and that the front-end rendering is
  unchanged; it does not describe the raw-JSON field as the *only* surface.
- No pipeline/AC/Req/T references; existing cross-links and the
  `#using-the-piano-block` reference still resolve.

---

## D2 — Rewrite the README "Using the Piano block" authoring workflow

**Goal:** Replace the by-hand-JSON-only workflow with the real authoring
workflow: insert the block → use the **visual editor** (the default) to build
and edit the song, watching the **live preview** → optionally switch to **raw
JSON** to edit the same song as text. Document the empty-start and
invalid-song-routing behavior, and preserve the description of what the front
end shows.

**Audience:** End users / WordPress authors actually creating a song in the
editor.

**Files:** `README.md`.

**Sections-scope:** The entire "## Using the Piano block" section and its
numbered steps. Specifically:
- Intro paragraph: drop "In v1 you author that song **by hand** ... by typing or
  pasting the JSON"; state that you author the song with a **visual editor**
  (the default) and can also edit the **raw JSON** of the same song.
- "### 1. Insert the block" — keep essentially as-is (inserter, **Media**
  category, search "Piano").
- Replace the JSON-centric "### 2. Enter a song" with a step that describes the
  **visual editor as the default surface**: a freshly inserted (empty) block
  lets you **start a new song from scratch** with no JSON; you build/edit the
  song through visual controls that cover the whole model (metadata; tempo/time
  signature/clef/accidentals/octave shift; sections, measures, events, pitches;
  dynamics, ties, slurs, crescendo/decrescendo, barlines, annotations), using
  **drill-down navigation** (song → section → measure → event) and
  **add/remove/move-up/move-down buttons** to add, remove, and reorder items.
  Note that the controls only let you produce a valid song, and that the editor
  does **not** check musical timing (a bar's durations need not fill its time
  signature). Do **not** over-specify exact button labels/screens beyond what
  the feature ships.
- Add a step covering the **live preview**: alongside the visual editor a
  read-only **sheet-music preview** updates as you edit, using the same notation
  the published page uses.
- Add a step covering the **raw-JSON option**: a **mode switch** flips the block
  to a raw-JSON field editing the **same song**; switching reflects the current
  song. Preserve today's raw-field behavior here — label *Song (JSON)*, the help
  text, validation is **informational and never blocks saving**, the raw text is
  always stored. Fold the existing "### 3. What the validation does" content
  into this raw-JSON step (empty input shows no error; structural/field checking
  only, not timing). For the field reference, keep pointing to
  [`docs/song-format.md`](docs/song-format.md) as the canonical source (do not
  duplicate field-level detail).
- Add a short note on the **valid-song rule** for the visual editor: an
  **empty/whitespace song** is "no song" and the visual editor starts fresh; a
  **non-empty but invalid** song (bad JSON or non-conformant) **cannot** be
  edited visually — the editor surfaces the problem and directs you to **fix it
  in raw JSON**, after which visual editing resumes.
- Add a short **note-name note**: note names can be English (`C D E F G A B`) or
  Spanish (`do re mi fa sol la si`); a song keeps the system it was written in
  (a Spanish song stays Spanish), and the format reference covers the
  vocabulary.
- Keep "### 4. What the front end shows" **substantively unchanged** (conformant
  → sheet music; empty → nothing; non-renderable → nothing, no echo/error; no
  visible title/composer heading). Renumber steps as needed so the section reads
  cleanly. Keep the closing **Tip** pointing to the annotated example as a
  starting template (it can now be pasted in raw-JSON mode).

**Depends on:** D1.

**Traces to:** Req 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11; AC1, AC2, AC3, AC4, AC5,
AC6, AC7, AC8, AC9, AC11.

**Acceptance:**
- The section leads with the **visual editor as the default** authoring surface,
  describes starting a song from scratch, full-model editing via drill-down, and
  add/remove/reorder via buttons.
- The **live preview** is described (read-only, updates on edit, same notation as
  the front end).
- The **raw-JSON option** is documented as an alternative editing the same song,
  reachable via a mode switch, with today's never-blocks-saving validation
  behavior preserved (label *Song (JSON)*, informational validation, raw text
  always stored, structural-not-timing).
- The empty-start and **non-empty-invalid → fix-in-raw-JSON** behaviors are
  stated, and the per-song note-name preservation is mentioned.
- "What the front end shows" is unchanged in substance; the
  `#4-what-the-front-end-shows` anchor (linked from `docs/song-format.md`)
  still resolves (or the doc-writer updates that inbound link if the heading
  number changes — see D5).
- No pipeline/AC/Req/T references; the format reference remains the canonical
  field-level source (not duplicated here).

---

## D3 — Update the README "Forthcoming" list

**Goal:** Remove "A visual authoring UI" from the not-yet-done list (it now
ships) and keep the genuinely-remaining future work accurate.

**Audience:** End users / WordPress authors and contributors gauging what is and
is not in the plugin yet.

**Files:** `README.md`.

**Sections-scope:** The "## Forthcoming" section.
- Remove the "**A visual authoring UI** — anything beyond the single raw-JSON
  field; in v1 you write the song JSON by hand" bullet (this capability has
  landed).
- Keep **Audio playback** and **Richer notation elements** as future work
  (still out of scope). Adjust the intro sentence(s) so they no longer imply the
  visual authoring UI is forthcoming; it is fine to note that authoring now has
  a visual editor and what remains is audio + richer notation.
- Do not introduce any new "forthcoming" item the feature does not warrant.

**Depends on:** D1.

**Traces to:** Req 1; AC1.

**Acceptance:**
- "A visual authoring UI" no longer appears as forthcoming/not-done.
- Audio playback and richer notation elements remain listed as future work.
- The section's framing is consistent with the visual editor having shipped; no
  pipeline/AC/Req/T references.

---

## D4 — Update the README file-layout table and contributor notes for the editor UI

**Goal:** Make the contributor-facing "File layout" table (and any adjacent
contributor wording) accurately describe `src/edit.js` as a **mode container**
and account for the new editor UI under `src/editor/`, so a contributor can find
the visual-editor code. Confirm the format/validator and render sections still
read correctly (they are unchanged by this feature).

**Audience:** Plugin contributors / developers.

**Files:** `README.md`.

**Sections-scope:** The "## For contributors" area, primarily the "### File
layout" table.
- Update the `src/edit.js` row: it is no longer "renders the raw-JSON `song`
  field" only — it is now the block's editor component refactored into a **mode
  container** that shows the **visual editor + live preview** by default and the
  **raw-JSON field** (unchanged: `TextareaControl` + non-blocking error
  `Notice`) in JSON mode.
- Add a row (or rows) for **`src/editor/`** — the visual editor UI: the
  structured drill-down editors (song / section / measure / event / pitch),
  shared list controls, the note-name and song-shape helpers, and the live
  sheet-music **preview** that reuses the existing notation core. Keep the
  description at the directory level (do not enumerate every file unless it
  matches the table's existing granularity); co-located unit tests live in
  `src/editor/__tests__/`.
- Confirm the rows for `src/view.js`, `src/render.php`, `src/notation/`,
  `src/song/*`, and `src/block.json` remain accurate — they are **unchanged** by
  this feature; do not rewrite them beyond fixing anything that the editor
  change makes stale.
- If the surrounding contributor prose (e.g. the build-model bullets) references
  `edit.js` as solely the raw-JSON field, adjust that wording to match the mode
  container.
- The "### The song format and validator" and render-contract prose are about
  unchanged code — leave them as-is unless a sentence is now inaccurate.

**Depends on:** D1.

**Traces to:** Req 12, 13; AC10, AC12.

**Acceptance:**
- The `src/edit.js` row describes the mode container (visual default + raw-JSON
  mode), not a raw-JSON-only field.
- `src/editor/` appears in the file layout with an accurate directory-level
  description (visual editor + live preview), and its `__tests__` location is
  noted in keeping with the table's style.
- Rows for the unchanged files (`view.js`, `render.php`, `notation/`, `song/`,
  `block.json`) remain accurate and are not falsely described as changed.
- No new runtime dependency is implied; the editor uses only WordPress packages
  (consistent with the existing "build model" description). No pipeline/AC/Req/T
  references.

---

## D5 — Light touch to the song-format reference (authoring-mode wording + pointers)

**Goal:** Correct the few sentences in `docs/song-format.md` that assert
authoring is "by hand / no visual editor yet", and keep its cross-links to the
README workflow accurate — **without** changing any field-level format
documentation (the format is unchanged).

**Audience:** End users / WordPress authors (and contributors) reading the
canonical song-format reference.

**Files:** `docs/song-format.md`.

**Sections-scope:** Targeted wording only — do **not** touch the field tables,
shapes, enums, examples, inheritance rules, or the annotated example (the format
does not change).
- The "## Intro and mental model" paragraph currently says "In v1 you author a
  song **by hand**, by typing or pasting the JSON directly into the block's
  raw-JSON field ... There is no visual notation *editor* yet". Revise to note
  that the block now has a **visual editor** (the default) and that raw JSON —
  which this document describes — is also available; this reference covers the
  **format** that both modes produce. Keep the statement that there is **no
  audio playback** (still future work).
- Where the doc points to the README workflow (e.g. the
  `#using-the-piano-block` and `#4-what-the-front-end-shows` links), make sure
  the link text/targets still match after D2's renumbering. If D2 changes the
  "what the front end shows" heading number/anchor, update the inbound link here
  to match (coordinate with the anchor D2 lands on).
- Do not add new format capabilities or change any allowed values; the only
  edits are the authoring-mode wording and link-target fixups.

**Depends on:** D2.

**Traces to:** Req 11, 13; AC9, AC10.

**Acceptance:**
- The intro no longer says authoring is by-hand-only or that no visual editor
  exists; it notes the visual editor is the default and raw JSON (described
  here) is also available, and still notes audio is future work.
- All field-level format documentation, examples, and the annotated example are
  **unchanged**.
- Cross-links to the README ("Using the Piano block", "What the front end
  shows") resolve to the correct (possibly renumbered) anchors.
- No pipeline/AC/Req/T references.
