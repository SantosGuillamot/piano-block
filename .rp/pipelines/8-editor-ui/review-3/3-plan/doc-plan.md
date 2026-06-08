# Doc Plan — Review 3: Left-sidebar structure tree as the selection surface

This plan documents the review-3 behavior changes that actually ship, against the
authoritative spec (`../1-spec/spec.md`), the design doc (`../2-design-doc/design-doc.md`),
and the code plan (`../3-plan/code-plan.md`). It is **proportional**: only the two
author-facing docs that already exist — `README.md` (primary) and `docs/song-format.md` —
are touched. No new docs, no inline code-symbol/API reference, no pipeline references.

Tasks run **sequentially against a single shared tree**, in the order listed. Each is one
doc-writer's unit of work and is independently committable. The writer edits prose only —
no source changes.

## What actually changes for readers (the behavior delta to document)

1. **A left structure tree becomes how the author navigates and selects.** A toggleable
   panel **beside the canvas** (left of it, inside the block's own editor area) shows
   **Section → Measure → {Right hand, Left hand} → Note**, with sections and measures
   expand/collapse. Selecting a node **highlights** the matching element on the canvas and
   **opens that node's settings** in the existing right inspector (Song / Note / Measure /
   Section panels). The tree is toggled by a toolbar button.
2. **The canvas is now display + highlight only.** Clicking the staff **no longer selects** —
   the canvas reflects the selection (highlight) but does not produce it.
3. **Add / remove / duplicate at every level** (sections, measures, notes), plus **rename**
   of sections and measures (an editable, persisted name). **Duplicate** is a deep copy
   inserted immediately after the original. **Reordering is still not available.**
4. **Review-2's right-sidebar Structure list is gone**, superseded by the left tree. Every
   doc reference to that right-inspector "Structure" list/panel must be removed or re-pointed
   at the left tree.
5. **A new optional song-level `name` field on sections and measures** — like `language`:
   optional, additive, stored, round-trips through raw-JSON editing, validates without
   blocking saving, and the **front end ignores it** (rendering unchanged). Documented in
   `docs/song-format.md`.

## Drift-resistance bar (the rule every task must respect)

- The `name` field — exactly like `language` — is **stored + round-trips** but is **NOT
  consumed by the front end yet**. Documentation must state this plainly and must NOT imply
  `name` affects the published rendering, audio, or anything beyond the editor labels.
- The front-end render contract is **unchanged**: `render.php` and the SVG rendering are
  untouched; a published page renders a given song exactly as before. Do not document any
  front-end behavior change.
- **Reordering remains out of scope** — do not describe move-up/move-down anywhere.
- **Canvas click-to-select is removed, not relocated** — do not describe the canvas as a
  selection surface anywhere.

---

## DT1 — README: status blurb + "What the block does today" (selection model shift)

**Goal.** Update the two top-of-README overviews so the editor is described as
**tree-driven selection + a display-only canvas**, not a canvas-first click-to-select
surface. The block still stores one song and renders it as sheet music on the front end —
only the *editing/selection model* changes.

**Audience.** Anyone landing on the repo: site owners, evaluators, contributors skimming.

**Files.** `README.md`.

**Sections-scope.**
- The blockquote **Status** paragraph (around line 5).
- **What the block does today** (the intro paragraph and its three bullets, around
  lines 7–15).

**Changes.**
- Reframe "canvas-first visual editing UI … the rendered sheet-music staff is itself the
  editing surface — you select notes on it" to: the author **navigates and selects through a
  structure tree** (a toggleable panel **beside the canvas**) and adjusts settings in the
  **block settings sidebar**; the **canvas is the live render with selection highlighting**
  (display + highlight only — clicking the staff no longer selects). Keep "raw-JSON editing
  remains available."
- In the bullets, replace "the rendered sheet-music staff is the single interactive
  surface, so you select notes on it" with the tree-selects / canvas-highlights split. Keep
  the dynamic-block / front-end-render bullet unchanged in substance (front end is
  unchanged).
- Do **not** introduce the word "List View" as a product name (it is *like* the List View,
  but it is the block's own in-canvas tree, not Gutenberg's global List View) — describe it
  as a "structure tree / outline panel beside the canvas." Keep it short.

**Depends on.** None (first task).

**Traces to.** Spec Req 1–5, 13; AC1–AC3. Design Overview, KD 1–5.

**Acceptance.**
- The status blurb and "What the block does today" no longer describe the canvas as the
  click-to-select surface; they describe the left structure tree as the selection surface
  and the canvas as display + highlight only.
- No claim that the front-end rendering changed. No mention of reordering. No "Gutenberg
  List View" product naming.

---

## DT2 — README: rewrite "Using the Piano block" authoring workflow (the core rewrite)

**Goal.** Rewrite the end-to-end authoring workflow so it matches the shipped review-3 UI:
the **left structure tree** is how you browse, select, and structurally edit the song; the
**right inspector** configures the selected node; the **canvas** highlights. Cover
add/remove/**duplicate** at every level, **rename** of sections and measures, the note/
chord/rest tree labels, and the toggle. Remove every reference to the old right-sidebar
**Structure** list/panel and to canvas click-to-select. This is the largest doc task.

**Audience.** Authors using the block in the editor.

**Files.** `README.md`.

**Sections-scope.** All of **Using the Piano block**:
- The section intro (around line 19).
- **2. Build the song in the visual editor** (lines 26–49), including its sub-paragraphs:
  "Add notes from the sidebar," "Select a note," the Note/Measure/Section panel list, the
  "Song panel always present" paragraph, "Browse and build the structure," "Progressive
  disclosure," "Add and remove across the model," the valid-song paragraph, the live-render
  paragraph, "Note names," and "When a song can't be edited visually."
- Leave **1. Insert the block**, **3. Edit the raw JSON instead**, and **4. What the front
  end shows** structurally intact (3 and 4 describe unchanged behavior — touch only if a
  sentence cross-references the old Structure list or canvas-click selection; see DT3 for
  the file-layout/contributor edits and DT4 for song-format).

**Changes.**
- **Intro + opening of step 2:** the author **navigates and selects through a structure
  tree** — a **toggleable panel beside the canvas** (left of the staff) showing
  **Section → Measure → Right hand / Left hand → Note**, with sections and measures
  expandable/collapsible — and configures the selected node in the **block settings
  sidebar**. A **toolbar button toggles the tree** open/closed. The canvas **highlights and
  scrolls to** the selection and re-renders live; **clicking the staff no longer selects.**
- **Selecting:** selecting a **section / measure / note** node in the tree highlights it on
  the canvas and opens its **Section / Measure / Note** settings panel in the right
  inspector (the **Song** panel is always present). State that the **right-hand / left-hand
  group rows are organizational** (they expand a measure's two event lists and host
  "Add note"); they do not have their own settings panel and selecting them does not change
  the right inspector. Replace the old "select a note by clicking it on the staff (tab +
  Enter/Space)" affordance with "select it in the tree."
- **Tree labels:** sections and measures show their **name** when set, else a positional
  label ("Section 1", "Measure 1"); a note row shows its **pitch name** (in the song's
  note-name language — e.g. "do"/"C"), a **chord** shows its pitches, and a **rest** shows
  "rest." (No octave in the label — do not promise one.)
- **Structural operations from the tree:** at **every level** the author can **add, remove,
  and duplicate** — sections, measures, and notes (a note is added under a hand group of a
  measure). **Duplicate makes a deep copy inserted immediately after the original**
  (duplicating a section copies its measures and notes and its name; a measure copies both
  hands and its name; a note copies its pitches and properties). The empty-measure
  first-note seeding is now done by the **per-hand "Add note"** in the tree, not a Structure
  list row.
- **Rename:** sections and measures have an **editable, persisted name**; document the
  affordance as the **Name field in the Section / Measure inspector panel** (the chosen
  affordance per the design — `TextControl`, blank clears the name back to the positional
  fallback). The name shows in the tree and survives save/reload and a raw-JSON round-trip.
  Link the field to `docs/song-format.md` `name` (anchor added by DT4) — i.e. point readers
  at the format reference for the stored field, without repeating field-level detail.
- **Right inspector unchanged otherwise:** keep the description of the **Note / Measure /
  Section** panels (type/duration/pitches, the *Advanced* disclosure, Add/Remove note, the
  override fields) and the always-present **Song** panel (title/composer, tempo, time
  signature, the *Advanced* defaults, **Note language** selector). The progressive-
  disclosure paragraph stays. **Note names** stays as-is (it already correctly describes the
  `language` field); only adjust any sentence that said you select notes on the canvas.
- **Remove every reference to the right-sidebar Structure list/panel.** Specifically rewrite:
  the "Add notes from the sidebar" paragraph's "use that measure's row in the Structure
  list" → the tree's per-hand "Add note"; the **Browse and build the structure** paragraph
  (it describes the now-removed always-present right "Structure" panel listing sections →
  measures with add/remove/select) → replace wholesale with the left tree's
  browse/select/structure behavior; the **Add and remove across the model** paragraph's
  "sections and measures are added and removed from the Structure list" → "from the tree";
  the Section-panel bullet's parenthetical "(Adding and removing whole sections now lives in
  the Structure list …)" → the tree.
- **Reordering:** keep the explicit "Reordering is not available — there are no move
  controls" statement (now phrased relative to the tree).
- **Conformant-by-construction:** keep the "every control only lets you produce a valid
  song" paragraph (still true — all tree ops + renames + settings edits route through the
  re-validation guard); no timing check, unchanged.
- **"When a song can't be edited visually":** unchanged in substance (empty → fresh seeded
  staff; non-empty invalid → fix in raw JSON). Verify no sentence here references the
  removed canvas-click or Structure list.

**Depends on.** DT1 (consistent framing of the selection model).

**Traces to.** Spec Req 1–10, 13, 14, 15; AC1–AC9, AC11. Design KD 1–5, 8, 11–14;
"Interfaces and Data Flow."

**Acceptance.**
- The workflow describes the **left structure tree** as the way to browse, select, and run
  add/remove/duplicate; the **canvas** as highlight-only; the **right inspector** as where
  the selected node (incl. **rename**) is configured.
- Add/remove/**duplicate** at **every level** and **rename** of sections/measures are
  documented; duplicate is described as deep-copy-after-original; the tree's note/chord/rest
  and name-or-positional labels are documented (no octave promised).
- **No remaining reference** to the right-sidebar Structure list/panel or to selecting notes
  by clicking the canvas (tab + Enter/Space on the staff). No reordering described. No
  Gutenberg "List View" product naming.
- Steps 1, 3, 4 remain accurate and unchanged except for any stale cross-reference removed.

---

## DT3 — README: file-layout table + contributor notes (editor internals & the removed surfaces)

**Goal.** Bring the **For contributors** material in line with review-3: the new
`StructureTree`/left workspace is the selection surface; canvas click-to-select and the
right-sidebar `StructureList` are removed; the editor-only `interactive` hit-rect is no
longer used by the editor (minimal revert — it stays in `svg.js` but the editor no longer
passes it); the deferred octave-in-labels; and the `name` schema addition. Keep these notes
proportional — contributor orientation prose, **not** an API reference.

**Audience.** Contributors reading the README's build/architecture section.

**Files.** `README.md`.

**Sections-scope.**
- **For contributors → File layout** table rows for `src/edit.js` and `src/editor/`
  (lines ~140–142).
- **The editor-only `interactive` hit-rect** subsection (lines ~156–158).
- **The song format and validator → Additive growth (no `version` field)** paragraph
  (line ~191) — add `name` alongside `language` as the latest additive option.
- **Tests** paragraph (line ~199) — adjust the e2e/unit summary to the new selection
  surface (tree-driven selection; canvas-click and Structure-list e2e replaced; the
  `interactive`/byte-identity svg unit test note is now "dormant but present").

**Changes.**
- **`src/edit.js` row:** it owns the editor-only **`showTree` toggle + expanded-path state**
  and the **structural mutators** (add/remove/**duplicate** section/measure/note,
  rename via the panels) that the **left structure tree** drives; the kind-tagged selection
  (section/measure/event) is editor-only UI state; the canvas no longer produces selection.
  Drop language implying the canvas is the selection surface.
- **`src/editor/` row:** describe the **`StructureTree`** (the left, toggleable structure
  tree that is the **selection surface** and hosts add/remove/duplicate at every level plus
  per-hand "Add note") rendered in a **`__workspace`** layout beside `SongCanvas`. State
  that **`SongCanvas` is now display + highlight only** (no hit-testing / click-to-select)
  and that the **right-sidebar `StructureList` was removed** (superseded by the tree). Keep
  the selection-helpers / invalid-state / leaf-editor mentions; keep "only `@wordpress/*`
  packages, no new runtime dependency."
- **`interactive` hit-rect subsection:** update to reflect the **minimal revert** — with
  click-to-select removed, the editor (`SongCanvas`) **no longer passes `interactive`**, so
  the editor SVG is now byte-identical to the front end; the **flag and hit-rect remain in
  `svg.js`** (defaulting off) but are **dormant/unused**. Be careful and precise here: do
  NOT say `svg.js` was changed or the flag was deleted (it was not — minimal revert). Keep
  the subsection short; consider retitling its thrust to "the now-dormant editor `interactive`
  hit-rect" while keeping the same heading text if a rename would churn anchors.
- **Additive growth paragraph:** add `name` (optional editor-side label on sections and
  measures) next to `language` as the newest additive optional field — **stored, round-trips,
  front end does not read it.** Mirror the `language` sentence's shape.
- **Tests paragraph:** update the e2e summary — selection now flows through the **tree**
  (toggle + tree rows), the **canvas-click selection and the right Structure-list** e2e are
  replaced by tree-driven add/remove/**duplicate**/rename and an **AC3 "canvas click does
  not select"** assertion; note the svg unit test for the `interactive` flag/byte-identity
  is now exercising a **dormant** capability (still green). Keep it a summary, not a
  test-by-test list.

**Depends on.** DT2 (consistent terminology for the tree/canvas split).

**Traces to.** Spec Req 1–3, 11–13, 16; AC1–AC3, AC10, AC13. Design KD 1, 3, 5, 6, 10;
"Components" (New/Changed/Removed); code-plan T1, T6, T7, the Reconciliation note.

**Acceptance.**
- The `src/edit.js` and `src/editor/` rows describe `StructureTree` + `__workspace` as the
  selection surface, the canvas as display + highlight only, and the `StructureList` as
  removed.
- The `interactive` hit-rect note states the **minimal revert** accurately: editor no longer
  passes the flag (editor SVG now byte-identical to the front end); the flag/hit-rect remain
  in `svg.js` but dormant. No false claim that `svg.js` changed or the flag was deleted.
- Additive-growth paragraph lists `name` like `language` (stored, round-trips, front end
  ignores it). Tests paragraph reflects tree-driven selection and the dormant-svg note.
- No reordering described; no API/symbol reference beyond orientation-level naming.

---

## DT4 — docs/song-format.md: document the optional `name` field (like `language`)

**Goal.** Document the new optional **`name`** property on **sections** and **measures** in
the song-format reference, modeled on the existing `language` section: optional/additive,
stored, round-trips, validated permissively, and **ignored by the front end**. Add it to the
relevant shape blocks and the additive-growth note. Keep the front end / authoring prose
honest to the drift-resistance bar.

**Audience.** Authors and integrators writing/reading raw song JSON.

**Files.** `docs/song-format.md`.

**Sections-scope.**
- **`defaults` and `sections`** — the `section := { … }` shape block (lines ~71–78): add
  `name?` with a one-line comment.
- **`measures`** — the `measure := { … }` shape block (lines ~89–96): add `name?` with a
  one-line comment.
- A short **`name`** subsection (mirroring the **`language`** subsection's structure, lines
  ~48–62) — placed near `language` or directly under the section/measure shape discussion,
  wherever it reads cleanly — covering: what it is (an optional editor-side label), that
  it's optional/additive (absent is valid), stored + round-trips through raw JSON, validated
  as a string (permissive, never blocks saving), and **the front end does not consume it
  yet** (rendering unchanged). Cross-link the README authoring workflow (the rename
  affordance) the way `language` links it.
- **Additive growth (no `version` field)** (line ~402) — add `name` alongside `language` as
  a latest additive optional field.

**Changes.**
- In the `section :=` and `measure :=` blocks add `name?,  // optional editor-side label;
  see "name"` (match the existing comment idiom — e.g. how `language?` / `tempo?` are
  commented). Keep `measures` (for section) and the existing required members unchanged;
  `name` is optional.
- New **`name`** subsection: anchorable as `#name` (so DT2/DT3 can link it). State exactly,
  like `language`:
  - **Optional and additive** — absent is valid; an older song without it stays conformant.
  - **What it means** — a free-text label the **visual editor** shows in the structure tree
    for that section/measure; when unset the tree falls back to a positional label
    ("Section 1", "Measure 1"). It is editable from the **Section / Measure** inspector
    panel (link the README workflow).
  - **Front end does not consume it yet** — the published front end **ignores `name`**; a
    page renders the song exactly as before regardless of this field, and storing or
    changing it changes nothing about the rendered notation. (Same wording shape as
    `language`'s "Front end does not consume it yet.")
  - **Stored, round-trips, and validates** — stored verbatim, survives raw-JSON editing
    unchanged; validation accepts a string `name`; like all raw-JSON validation it is
    informational and **never blocks saving**. (A non-string `name` is a type error — but
    still never blocks saving.)
- In **Additive growth**, extend the "latest such additive option" sentence to include
  `name` (the optional section/measure label) alongside `language`, reusing the same
  "absent is valid, the front end does not read it" framing.
- Optionally show `name` once in a tiny JSON snippet in the new subsection (a section and a
  measure each carrying a `name`), matching the doc's snippet style. Do **not** add `name`
  to the big **Annotated example song** (keep that example stable and focused).

**Depends on.** DT2, DT3 (so README links/anchors are settled), though it edits a different
file; ordered last to keep cross-links coherent. The `#name` anchor it creates is what DT2
(rename affordance) and DT3 (additive-growth) link to — if DT2/DT3 added the link with a
provisional anchor, DT4 must make the anchor real and matching.

**Traces to.** Spec Req 9, 11, 12; AC7, AC10. Design KD 10, 11, 15; code-plan T1, T4.

**Acceptance.**
- `name?` appears in both the `section :=` and `measure :=` shape blocks with a short
  comment; the new **`name`** subsection documents it exactly like `language` (optional/
  additive, stored, round-trips, validated permissively/never-blocking, **front end ignores
  it**).
- Additive-growth note lists `name` alongside `language`.
- No claim that `name` affects the published rendering, audio, or any front-end behavior;
  no front-end change implied; reordering not mentioned.
- The annotated example song is unchanged.

---

## Task summary

| # | Title | Files | Depends on |
|---|---|---|---|
| DT1 | README status blurb + "What the block does today" (selection model shift) | `README.md` | — |
| DT2 | README "Using the Piano block" workflow rewrite (tree-driven; remove Structure list + canvas-click) | `README.md` | DT1 |
| DT3 | README file-layout table + contributor notes (`StructureTree`/`__workspace`, removed canvas-click + `StructureList`, dormant `interactive`, `name` schema) | `README.md` | DT2 |
| DT4 | docs/song-format.md: document optional `name` on sections/measures (like `language`) | `docs/song-format.md` | DT2, DT3 |

**Out of scope (do not document as shipped):** reordering (still deferred); canvas
click-to-select (removed, not relocated); the front end consuming `name`/`language` or
showing them on the page; any `render.php` / SVG render change; octave in tree note labels;
inline-tree rename (the rename affordance that ships is the Section/Measure inspector Name
field); any new doc file, inline code-symbol API reference, or pipeline reference.
