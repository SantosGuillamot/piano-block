# Doc plan — Review 2 (editor UI)

This plan turns the review-2 behavior changes that actually ship into discrete
documentation tasks. The scope is **author/contributor-facing prose only** — no
inline code-symbol docs (those ship with the phase-4 code) and no pipeline
references.

## What changed for a reader (the source of every task below)

Five user-observable changes ship this review:

1. **Note selection now works** — clicking a note/rest on the canvas selects it
   and drives the sidebar (a fix; the README already *describes* selection by
   clicking, so this only needs a light touch where prose implied the old, broken
   behavior or the click-keyboard mix).
2. **Add/remove note is now selection-contextual** and **the on-canvas add-grid
   is gone** — "Add note to right hand in measure 1" buttons and the end-of-score
   "Add measure" button no longer exist on the canvas; add-note lives in the Note
   panel (hand inferred), and section/measure management moves to a sidebar list.
3. **A sidebar Structure view** (`StructureList`) — a browsable list of all
   sections → measures, where you add/remove sections & measures, select one to
   edit its settings, and the canvas highlights/scrolls to it.
4. **A song-level note-language selector** (Spanish/English) in the Song panel
   that **converts** every note in the song and **stores** a new song-level
   `language` field. The field round-trips through raw JSON but the **front end
   does not consume it yet**.
5. **An editor-only `interactive` hit-rect** in the shared emit — a contributor
   architecture note (the front-end SVG is unchanged).

These map to the two docs that exist: `README.md` (primary — author workflow +
contributor file-layout/architecture) and `docs/song-format.md` (the schema field
only). No new doc files are warranted.

## Conventions for every task

- **Match the existing voice.** Both docs are dense, plain-prose, second-person
  ("you author…"); mirror their paragraph rhythm, bolded lead-ins, and table
  idiom. Do not introduce headings or sections beyond what a task names.
- **Stay inside the shipped behavior.** Document only what review-2 ships per the
  spec/design-doc/code-plan. In particular: the front end is **unchanged** and
  does **not** read `language`; do not imply otherwise.
- **No code symbols in prose.** Refer to UI by its visible labels ("Note
  language", "Structure", "Add note"), not component or function names — except in
  the contributor **File layout** / **build model** sections, which already name
  files (`SongCanvas`, `selection.js`, etc.) and where a new file name belongs.
- **Cross-link, do not duplicate.** `docs/song-format.md` stays the canonical
  field reference; `README.md` links to it rather than repeating field detail.
- **Commit format:** imperative, sentence case, no trailing period, agent name in
  parentheses — e.g. `Document the note-language field in song-format (doc-writer)`.
- **Single tree, sequential.** Tasks are dispatched one doc-writer at a time in
  the order below; each builds on the prior edits.

---

## D1 — README authoring workflow: selection-contextual add/remove + Structure view

**Goal.** Update the README's "Build the song in the visual editor" workflow so it
describes the review-2 authoring model: notes are added/removed from the Note
panel (hand inferred from the selection), sections and measures are managed in a
new **Structure** sidebar list (which also bootstraps the first note of an empty
measure), and the **on-canvas add-note / add-measure grid is gone**. Also reflect
that clicking a note to select it now works.

**Audience.** Authors using the block.

**Files.** `README.md`.

**Sections-scope.**
- `## Using the Piano block` intro paragraph (line ~19) — its "you add and select
  notes directly on it" claim must not promise on-canvas *adding* anymore (adding
  moved to the sidebar; the canvas is select-only).
- `### 2. Build the song in the visual editor` (lines ~26–47), specifically:
  - The **"Add notes on the canvas."** paragraph (line ~29) — rewrite: the
    per-staff "Add note to right hand in measure 1" buttons and the end-of-score
    "Add measure" button are **removed**. Notes are added from the **Note** panel's
    **Add note** control, which adds to the **same hand as the current selection**
    (the hand is inferred — you are never asked to pick a hand) and inserts after
    the selected event. Sections and measures are added/removed in the new
    **Structure** list (see D2's panel bullet); adding the **first** note to an
    empty measure (where there is nothing to select) is done from that measure's
    row in the Structure list.
  - The **"Select a note (or rest) by clicking it on the staff"** paragraph (line
    ~31) — keep the click-to-select description (it now works in the real editor);
    keep the panels list but update the **Note** panel bullet to mention **Add
    note** alongside **Remove note**; the **Section** panel bullet's "Add section /
    Remove section" should be reframed as now living in the Structure list (see
    D2) — leave the Section *settings* in the Section panel.
  - The **"Add and remove across the model."** paragraph (line ~41) — rewrite to
    the new division of labor: **notes** are added/removed from the **Note panel**
    (hand inferred) and an empty measure's first note from the **Structure list**;
    **sections and measures** are added/removed from the **Structure list**;
    **chord pitches** still from the Note panel. Keep the "**Reordering is not
    available**" sentence (still true).

**Depends on.** None (first README task; D2 adds the Structure panel description it
references).

**Traces to.** Req 1–5; AC1–AC4. (Selection fix, selection-contextual add/remove,
canvas-grid removal.)

**Acceptance.**
- No README sentence claims you add notes or measures **on the canvas**, or
  references a per-staff "Add note to right hand in measure N" button or an
  end-of-score "Add measure" button.
- The README states add-note is in the **Note** panel with the **hand inferred
  from the selection** (no hand prompt), and that an empty measure's first note is
  added from the **Structure** list.
- Clicking a note to select it is described as working; the panels list still
  matches what the sidebar shows.
- Prose reads in the existing README voice; the `docs/song-format.md` cross-link
  is intact; no field-level detail is duplicated.

---

## D2 — README: document the sidebar Structure view

**Goal.** Add a short, self-contained description of the new **Structure** sidebar
panel to the README authoring workflow: it lists every section and, within each,
its measures (to measure depth — individual notes are not listed); you can add and
remove sections and measures, and selecting a section or measure makes its
settings editable in the sidebar **and highlights/scrolls to it on the canvas**.
Note that reordering is not provided.

**Audience.** Authors using the block.

**Files.** `README.md`.

**Sections-scope.**
- `### 2. Build the song in the visual editor` — add a new paragraph (placed with
  the other panel descriptions, around the **Song** panel paragraph at line ~37)
  describing the **Structure** panel:
  - It is **always present** in the sidebar (like the Song panel), so the whole
    song is browsable even with nothing selected.
  - It shows a **browsable list of every section and its measures** — to
    **measure depth**; individual notes are not listed (those stay edited via
    canvas selection).
  - From it you **add and remove sections** and **add and remove measures** within
    a section, and each measure row offers **Add note** to seed an empty measure's
    first note.
  - **Selecting** a section or measure row opens its **Section** / **Measure**
    settings panel and **highlights and scrolls to** that location on the canvas.
  - **No reordering** (consistent with the existing "Reordering is not available"
    note).
- The **Song panel** paragraph (line ~37) may gain a half-sentence noting the
  Structure panel sits alongside it as the other always-present panel; keep it
  brief.

**Depends on.** D1 (which references "the Structure list"; D2 supplies its full
description). Same file — sequential.

**Traces to.** Req 6–9; AC5–AC8. (Structure list: browse, add/remove sections &
measures, select-to-edit + canvas highlight.)

**Acceptance.**
- The README describes a **Structure** sidebar panel that is always present, lists
  sections → measures to measure depth, supports add/remove of sections and
  measures, and on selecting a row makes its settings editable and highlights the
  canvas.
- It states individual notes are **not** listed and that there is **no
  reordering**.
- The description is consistent with D1's workflow prose (no contradiction about
  where add/remove lives) and matches the README voice.

---

## D3 — README + song-format: document the song-level `language` field and selector

**Goal.** Document the new song-level note-language feature end to end, split
correctly across the two docs:
- In **`docs/song-format.md`**: a new top-level **`language`** field — its allowed
  values (`"spanish"` / `"english"`), that it is **stored** in the song and
  **round-trips** through raw-JSON editing and validates, and the explicit boundary
  note that **the front end does not consume it yet** (it is editor-side display
  only this iteration).
- In **`README.md`**: the author-facing **Note language** selector in the Song
  panel — switching it **converts** all note names in the song to the chosen
  language and stores the choice; an existing song with no `language` infers its
  initial language from its note spellings, and a new/empty song defaults to
  English.

**Audience.** `docs/song-format.md` → song authors / format readers (contributors
too). `README.md` → authors using the block.

**Files.** `docs/song-format.md`, `README.md`.

**Sections-scope.**

*`docs/song-format.md`:*
- `## Top-level shape` (lines ~12–17) — add `language?` to the
  `song := { metadata?, defaults?, language?, sections }` shape line and the
  bullet list, marking it optional.
- Add a short **`language`** subsection (a sibling to `## metadata`, placed near
  the top-level/metadata area) covering:
  - **Values:** `"spanish"` and `"english"` (these exact strings — *not* ISO
    `es`/`en`).
  - **Optional & additive:** absent is valid; consistent with the format's
    "additive growth, no `version` field" stance — so reference / fit the existing
    `## Additive growth (no version field)` framing rather than restating it.
  - **What it means:** it records the note-name **language the song is written
    in**, used by the **editor** to display note names and to convert them on
    switch. Cross-reference the existing `## Note-name systems (English and
    Spanish)` section (do not duplicate the C↔do table).
  - **Front-end boundary (important):** the **front end does not read `language`
    yet** — a published page renders the song's notes exactly as before regardless
    of this field; consuming it is future work. State this plainly.
  - **Round-trips & validates:** it is stored verbatim in the `song` JSON, survives
    raw-JSON editing, and validation accepts the two values (an out-of-vocabulary
    value is flagged informationally but, like all raw-JSON validation, never
    blocks saving — fit the doc's existing validation framing).
- The `## Additive growth (no version field)` section may get a one-line mention of
  `language` as the latest additive optional field (optional; keep proportional).

*`README.md`:*
- `### 2. Build the song in the visual editor`, the **"Note names"** paragraph
  (line ~47) — extend it: the **Song** panel now has a **Note language** selector
  (English / Spanish). Switching it **converts every note name** in the song to
  the chosen language and **stores** the choice in the song; an existing song with
  no stored language **infers** it from the note spellings it already uses, and a
  brand-new song defaults to **English**. Link to the new `language` field in the
  song-format reference. Keep the existing "a song keeps the system it was written
  in / controls follow that system" sentence consistent (the stored field is now
  what pins the system; conversion is the new capability).

**Depends on.** D2 (same README file, sequential). Independent of D1/D2 content
otherwise — touches the Note-names paragraph and the Song panel.

**Traces to.** Req 10–15; AC9–AC12. (Stored `language` field, selector, conversion,
initial-language inference/default, round-trip, front-end-unchanged boundary.)

**Acceptance.**
- `docs/song-format.md` documents a top-level optional **`language`** field with
  values **`"spanish"` / `"english"`**, states it is stored/round-trips/validates,
  and **explicitly says the front end does not consume it yet** (rendering is
  unchanged).
- The top-level shape line includes `language?`.
- `README.md` describes the **Note language** selector in the Song panel,
  including that switching **converts** notes and **stores** the choice, and the
  **inference for existing songs / English default for new songs**, and links to
  the song-format `language` entry.
- No claim that the published page shows the language or changes rendering.
- Neither doc duplicates the C↔do equivalence table; the README defers field
  detail to the reference.

---

## D4 — Contributor docs: file layout, architecture note, and tests

**Goal.** Update the README's **For contributors** section to match the review-2
editor architecture: the new `StructureList` in the editor file-layout, the
canvas's new **select-only** role (on-canvas add affordances removed), the
editor-only **`interactive` hit-rect** architecture note (the front-end SVG is
unchanged / byte-identical), and a mention that the schema gained the additive
`language` field. Keep it proportional — contributor-level, not a re-spec.

**Audience.** Contributors.

**Files.** `README.md`.

**Sections-scope.**
- `### File layout` table (lines ~133–153):
  - `src/edit.js` row (line ~138) — light touch: the editor now also owns the
    lifted structural mutators and the kind-tagged selection; keep the row's
    altitude (one or two clauses, not a rewrite).
  - `src/editor/` row (line ~139) — update the description: the canvas
    (`SongCanvas`) is now **selection + decoration only** (the on-canvas
    add-note / add-measure affordances are **removed**); the sidebar now includes
    a **Structure** browser (`StructureList`, sections → measures with
    add/remove/select) alongside the Song / Note / Measure / Section panels; the
    selection helpers now carry a `kind` (section / measure / event). Mention the
    new file name `StructureList` here.
  - `src/notation/` row (line ~144) — note that `svg.js` now emits a per-event
    **editor-only** transparent hit-rect when an `interactive` flag is set, and
    that the front-end emit (no flag) is **unchanged / byte-identical**.
- A short **architecture note** in the contributor prose (e.g. near the
  `### The build model` or a sentence appended where the editor/front-end split is
  discussed) explaining the **`interactive` hit-rect**: the editor needs a
  reliable pointer target for selecting a note (an SVG `<g>`'s painted children
  leave gaps), so the editor renders one invisible, pointer-hittable rect per
  event **behind a new `interactive` flag**; the front end (`view.js`) does **not**
  pass the flag, so the published SVG is byte-identical and selection stays an
  editor-only concern. Keep it to a few sentences in the existing contributor
  voice.
- `### The song format and validator` → the **Additive growth** paragraph (line
  ~185) or the schema description — add `language` to the list of additive optional
  fields the format has grown (one clause), consistent with D3's song-format edit.
- The **Tests** paragraph (line ~193) — if it enumerates editor coverage, add a
  brief mention that the new Structure list, selection-contextual add/remove,
  language conversion, and the editor-only hit-rect / front-end-parity are covered;
  keep proportional (do not invent test names).

**Depends on.** D1–D3 (consistency: file-layout/architecture prose must match the
author-facing behavior already documented). Same file, sequential, and last so it
reconciles the contributor view with the workflow edits.

**Traces to.** Req 1 (hit-rect fix), 4–9 (Structure/canvas split), 10/15 (schema
`language` + front-end boundary), 19; AC12, AC15. Design KD1 (interactive flag),
KD3 (`StructureList`).

**Acceptance.**
- The `src/editor/` file-layout row names **`StructureList`** and describes the
  canvas as **selection + decoration only** (no on-canvas add affordances).
- The contributor docs contain a brief, accurate **`interactive` hit-rect**
  architecture note stating the front-end SVG is **unchanged / byte-identical**
  (front end omits the flag).
- The schema's additive-fields prose mentions **`language`** (one clause),
  consistent with the song-format reference.
- `src/edit.js` and `src/notation/` rows are updated at their existing altitude
  (no over-expansion), and `render.php` / `view.js` rows correctly still say the
  front end is unchanged.
- No contributor sentence contradicts the author-facing workflow from D1–D3.

---

## Task summary (order)

1. **D1** — README authoring workflow: selection-contextual add/remove + remove
   the on-canvas add-grid (and confirm click-to-select works).
2. **D2** — README: document the always-present **Structure** sidebar view.
3. **D3** — `docs/song-format.md` **`language`** field (values, stored,
   round-trips, front-end-unchanged) **+** README **Note language** selector
   (converts + stores + inference/default).
4. **D4** — Contributor docs: `StructureList` in file layout, canvas
   select-only, the editor-only **`interactive` hit-rect** architecture note, and
   the additive `language` schema mention.

All four edit only `README.md` and (D3 only) `docs/song-format.md` — the two docs
that already exist; no new doc files. Each is a single committable doc change in
the existing voice, dispatched one doc-writer at a time in order.
