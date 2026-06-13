# Review 8 — Documentation plan

An ordered list of documentation tasks (D1…D5) for the docs phase, which runs **after**
review-8's code lands. Each task documents only what review-8's shipped code changes
genuinely require. Review-8 is, by design, **behavior-preserving** (accessibility/CSS/
component-prop fixes plus internal reuse/simplification); the front-end render, the song
format, and the authoring workflow are unchanged. So the doc surface that moves is small:
the README's dependency framing (the `@wordpress/icons` claim), the README references to
the now-deleted `interactive` hit-rect feature, and the README file-layout / build-model
notes that enumerate the source tree the CSS split and helper extractions reshaped.

The only live documentation surfaces in the repo are:

- `README.md` — the contributor-and-user landing doc (status blurb, "Using the Piano
  block" workflow, "For contributors" build model + file-layout table + scripts + song
  format/validator narrative, "Forthcoming").
- `docs/song-format.md` — the author-facing song-format field reference.
- `AGENTS.md` — pipeline-hygiene guidance for automated contributors.

Of these, **only `README.md` requires changes.** `docs/song-format.md` and `AGENTS.md`
are unaffected by review-8 (verified below in D5 / the Out-of-scope note).

The **Traces to** fields are planning-only. No pipeline reference (`.rp/`, task IDs,
`R#`/`O#`, `AC#`, `T#`, "review N") may appear in shipped documentation text. Where a
task edits doc prose that carries such a reference, it strips it — but review-8's docs
work touches only `README.md`, which carries no pipeline tags today, so this is a
guard, not an expected edit.

---

## D1 — Correct the runtime-dependency claim in `README.md`

- **Goal.** Stop the README asserting the project has **no runtime dependency**, and stop
  calling `ajv` the project's *first* runtime dependency. Acknowledge `@wordpress/icons`
  as a **bundled `@wordpress/*` runtime dependency** that ships in the editor bundle —
  while keeping the validator's *zero-dependency / schema-as-data* narrative intact (that
  narrative is about the validator, not the whole project, and remains true). The
  dependency itself is correct and stays in `package.json`; only the wording changes.
- **Audience.** Contributor.
- **Files.** `README.md`.
- **Sections-scope.**
  - The `src/editor/` file-layout row (currently ~line 143): drop / reword the trailing
    "(no new runtime dependency)" parenthetical. The companion phrase "Built only on
    `@wordpress/*` packages" stays true and may remain (`@wordpress/icons` **is** a
    `@wordpress/*` package — it is simply *bundled* rather than externalized), but the
    "no new runtime dependency" claim must go; reword to acknowledge the bundled
    `@wordpress/icons` dependency.
  - "The song format and validator" subsection (~line 179): reword the "`ajv` would be
    the editor bundle's **first** runtime dependency" framing so it no longer calls ajv
    the *first* dependency (the bundle already has `@wordpress/icons`). Keep the
    surrounding "schema-as-data + a purpose-built walker (no `ajv`)" / "zero-dependency
    validator" narrative — it describes the **validator's** lack of dependencies and is
    still accurate; do not weaken it.
- **Depends on.** none.
- **Traces to.** R5; A5.
- **Acceptance.**
  - `README.md` no longer contains the phrase "no new runtime dependency" (grep returns
    zero matches) and no longer calls ajv the "first" runtime dependency.
  - The README explicitly acknowledges `@wordpress/icons` as a bundled `@wordpress/*`
    runtime dependency (it appears in `package.json` `dependencies`); cross-check against
    the shipped `package.json` that `@wordpress/icons` is still listed and that no
    dependency was added or removed by the docs change.
  - The validator's "zero-dependency" / "no `ajv`" narrative is still present and intact
    (the `src/song/validate.js` row's "zero-dependency validator/walker" wording and the
    "(no `ajv`)" walker discussion remain).

## D2 — Remove the dead `interactive` hit-rect from `README.md`

- **Goal.** The `interactive` flag, `hitRect`, and the hit-rect constants are deleted from
  `src/notation/` by review-8's code. The README must no longer describe a capability that
  no longer exists in the source. Remove every README reference to the `interactive` flag /
  per-event hit-rect, and keep the "the editor SVG is byte-identical to the front end's"
  point — which is now **unconditional** (no flag to qualify it).
- **Audience.** Contributor.
- **Files.** `README.md`.
- **Sections-scope.**
  - The `src/notation/` file-layout row (~line 148): drop the `svg.js` sub-clause that
    describes the "opt-in `interactive` flag … one transparent per-event **hit-rect**".
    Reword the `svg.js` description to the plain "thin SVG-emit layer that turns the model
    into an `<svg>` DOM tree", and keep the "front-end emit … byte-identical" framing as an
    unconditional statement (no longer "passes **no** flag").
  - The "The now-dormant `interactive` hit-rect" subsection (~lines 158–160): delete the
    subsection **in full**, including its `### …` heading. (Confirm no other README
    section links to this heading; the headings list shows nothing links to it.)
  - The "Tests" narrative in the song-format/validator subsection (~line 201): drop the
    clause "including the `interactive` hit-rect appearing under the flag while the
    flag-less front-end emit stays byte-identical; that flag is now a **dormant**
    capability …". Replace with wording that the `src/notation/` suite verifies the
    musical geometry without a browser, with the front-end SVG emit pinned byte-identical.
    Keep the rest of the Tests paragraph (validator suite, e2e coverage) unchanged.
- **Depends on.** none. (Independent of D1; both edit `README.md` but disjoint sections.)
- **Traces to.** R8 (README tail); A8.
- **Acceptance.**
  - Grep of `README.md` for `interactive` / `hit-rect` / `hitRect` returns **zero**
    matches.
  - The "now-dormant `interactive` hit-rect" `###` heading no longer exists in the
    headings outline.
  - The README still states the editor and front-end SVG are byte-identical (now
    unconditional), and the Tests paragraph still describes the validator and renderer
    suites and the e2e coverage.
  - Cross-check against shipped code: `src/notation/svg.js` and `src/notation/constants.js`
    contain no `interactive` / `hitRect` / `HIT_RECT_WIDTH_SP` /
    `HIT_RECT_VERTICAL_MARGIN_SP` symbols (so the README no longer describes anything that
    exists). `render.php` and the front-end render narrative are otherwise unchanged.

## D3 — Reconcile the `README.md` file-layout table + build-model with the reshaped source tree

- **Goal.** Review-8 reshapes the `src/` tree: it adds `src/editor/editor.scss` (editor-only
  styles, emitted as `build/index.css` and wired via `editorStyle`), splits the front-end /
  shared rules into `src/style.scss`, adds `src/song/accessibleName.js` (shared
  accessible-name helper) and `src/notation/dom.js` (React-free shared width/font helpers),
  and **moves** `emit.js` to `src/editor/emit.js`. The README's build-model bullet and
  file-layout table enumerate this tree and must match the shipped layout. Update only the
  rows/bullets that review-8 actually changes; do not re-document unchanged rows.
- **Audience.** Contributor.
- **Files.** `README.md`.
- **Sections-scope.** "For contributors" → "The build model" (~line 131) and "File layout"
  table (~lines 137–156):
  - **SCSS build-model bullet (~line 131).** Today: "Styles are authored in `src/style.scss`
    and compiled to `build/style-index.css`." Update to reflect the **two** stylesheets:
    front-end / shared styles in `src/style.scss` → `build/style-index.css` (the `style`
    handle), and **editor-only** styles in `src/editor.scss` → `build/index.css` (the
    `editorStyle` handle), so editor-only CSS is not shipped to the front end. State which
    file holds what (front-end/shared: `@font-face` + wrapper rules; editor-only: workspace
    / tree / canvas / selection-highlight rules).
  - **`src/block.json` row (~line 140).** Today says it wires "the editor script,
    stylesheet, and server render". Update to note it wires **both** a front-end stylesheet
    (`style`) **and** an editor-only stylesheet (`editorStyle`).
  - **`src/index.js` row (~line 141).** Today: "registers the block and imports the styles".
    Update to "imports both stylesheets" (front-end/shared + editor-only).
  - **`src/style.scss` row (~line 145).** Today: "Placeholder styling (editor + front end)".
    Update to "front-end / shared styling only" (`@font-face` + the wrapper rules), and
    **add a new row** for `src/editor.scss` ("editor-only styling — workspace, structure
    tree, canvas, and selection highlight; emitted to `build/index.css` and enqueued via
    `editorStyle`").
  - **`src/editor/` row (~line 143).** The prose summary mentions "accessible name" among
    the editor's reused helpers. After review-8, the accessible-name helper lives in
    `src/song/accessibleName.js` (shared with the front end), and `emit.js` is now at
    `src/editor/emit.js`. Reconcile the row so it no longer attributes the accessible-name
    helper solely to the editor layer (it is now a `src/song/` shared module). (This row
    also carries the R5 dependency parenthetical handled in D1; if D1 has already landed,
    leave that wording as D1 set it — D3 only touches the helper-enumeration prose.)
  - **`src/editor/` and `src/song/` helper mentions.** Add `src/song/accessibleName.js` to
    the `src/song/` grouping (alongside `normalizeStep.js` / `schema.js` / `validate.js`) as
    the shared editor + front-end accessible-name derivation, and add `src/notation/dom.js`
    to the `src/notation/` row (~line 148, edited by D2) as the React-free shared
    width/font helpers used by both `SongCanvas` and `view.js`. Keep these descriptions at
    the table's existing altitude (one-line role summaries), not file-by-file inventories.
- **Depends on.** D2 (the `src/notation/` row at ~line 148 is also edited by D2 to drop the
  `interactive` clause; D3 adds `dom.js` to that same row — sequence D3 after D2 so both
  edits land cleanly in one final row). D1 (the `src/editor/` row's dependency parenthetical
  is D1's; D3 only edits the helper-enumeration prose of that row).
- **Traces to.** R3, R9, R12 (file-layout accuracy for the shipped tree); A3, A9, A12.
- **Acceptance.**
  - Every path the updated table/bullets name exists in the shipped tree, and every
    review-8 path that the table's altitude warrants is represented:
    - `src/editor.scss` exists and is described as editor-only styling → `build/index.css`
      via `editorStyle`; `src/style.scss` is described as front-end / shared only.
    - `src/block.json` actually contains both `"style": "file:./style-index.css"` **and**
      `"editorStyle": "file:./index.css"` (cross-check the shipped `block.json`), and the
      row says so.
    - `src/index.js` imports both `./style.scss` and `./editor.scss` (cross-check the
      shipped `index.js`), and the row says it imports both stylesheets.
    - `src/song/accessibleName.js` exists (cross-check) and is named in the `src/song/`
      grouping; the old `src/editor/accessibleName.js` no longer exists and is not named.
    - `src/notation/dom.js` exists (cross-check) and is named in the `src/notation/` row.
    - `src/editor/emit.js` exists (cross-check) and `src/editor/inspector/emit.js` does
      not (the row prose does not imply emit lives under `inspector/`).
  - `npm run build` (already run by the code phase) emits both `build/style-index.css` and
    `build/index.css` (+ their `-rtl` variants), consistent with the build-model bullet's
    claim — confirm the build artifacts exist if the build is runnable.
  - No file-layout row names a path that does not exist in `src/` after review-8.

## D4 — Reconcile any `README.md` editor keyboard / accessible-name wording (verify-and-only-if-needed)

- **Goal.** Review-8 makes the structure tree's **keyboard expand/collapse** (Arrow
  Left/Right) real and gives the tree a real **accessible name** ("Song structure"). If any
  user- or accessibility-facing README prose describes the tree's keyboard interaction or
  its accessible name, reconcile it so it matches the now-working behavior. **This task is a
  verification gate first:** today the README's "Using the Piano block" workflow describes
  sections/measures as "expandable and collapsible" but makes **no** keyboard-specific or
  accessible-name claim, so there is likely **nothing to change**. The `StructureTree`
  docblock's false "Left/Right works for free" claim is **code**, corrected by the code
  phase — it is **out of scope here**.
- **Audience.** End-user / contributor.
- **Files.** `README.md` (only if a claim is found).
- **Sections-scope.** "Using the Piano block" → "Build the song in the visual editor"
  (~lines 25–51), specifically the structure-tree description (~line 29: "expandable and
  collapsible").
- **Depends on.** none.
- **Traces to.** R1, R2 (reconcile-only); A1, A2.
- **Acceptance.**
  - Grep the README for keyboard-interaction or accessible-name claims about the tree
    (e.g. "arrow", "keyboard", "accessible name", "Left/Right", "for free"). If **none**
    exist, record that no change is required and make **no edit** — the existing
    "expandable and collapsible" wording is already accurate and behavior-neutral about
    *how* expansion happens.
  - If a claim **is** found, it accurately reflects the shipped behavior: keyboard users
    expand/collapse rows with Arrow Right/Left, and the tree is reachable by its accessible
    name "Song structure". No claim states keyboard expansion works "for free" or via the
    chevron only.
  - No `StructureTree` docblock or code comment is edited by this task (that is the code
    phase's job).

## D5 — Confirm `docs/song-format.md` and `AGENTS.md` need no change (no-op gate)

- **Goal.** Explicitly confirm — not assume — that review-8 requires **no** change to the
  author-facing song-format reference or to `AGENTS.md`. Review-8 is editor/notation-
  internal and behavior-preserving; the song format/schema, `render.php`, and the front-end
  render are byte-identical, and `AGENTS.md` carries only pipeline-hygiene guidance with no
  file-layout or architecture content. This task produces **no edit** unless the gate below
  fails.
- **Audience.** End-user (song-format.md) / contributor (AGENTS.md).
- **Files.** `docs/song-format.md`, `AGENTS.md` (expected: no edits).
- **Sections-scope.** Whole-file verification scan of each.
- **Depends on.** none.
- **Traces to.** Hard boundaries (song format / `render.php` / front-end unchanged); the
  global parity gate.
- **Acceptance.**
  - `docs/song-format.md`: a grep for review-8-relevant terms (`interactive`, `hit-rect`,
    `@wordpress/icons`, `runtime dependency`, `editorStyle`, `editor.scss`, `emit.js`,
    `accessibleName`, `notation/dom`, and any `src/…` path the CSS split or helper moves
    touched) returns **zero** matches — confirming the author-facing format reference names
    none of the surfaces review-8 changed. No edit is made.
  - `AGENTS.md`: contains no file-layout table, no architecture/dependency claims, and no
    reference to the `interactive` feature or the CSS/helper layout — so review-8 changes
    nothing it states. No edit is made.
  - If either gate unexpectedly fails (a relevant term is found), the doc-writer reports it
    and scopes the minimal correction rather than inventing broader work.

---

## Out of scope for the docs phase

- **In-code docblocks, comments, and pipeline-provenance tags.** The `StructureTree`
  docblock's keyboard claims, the stale-comment fixes (`EventRow`, `MeasureEditor`/
  `BarlineControl`, `SectionEditor`, `repairPath`, `SongPreview`), and the project-wide
  provenance-tag sweep are all **code-phase** work (handled there, not in narrative docs).
- **The song format / `render.php` / front-end behavior.** Unchanged and byte-identical;
  no doc edit (confirmed in D5).
- **The deferred Optional items** (ToolsPanel-inside-PanelBody restructure; the wrapper's
  dashed placeholder border). Not shipped by review-8, so nothing to document.
- **`package.json` itself.** The `@wordpress/icons` dependency is correct and stays;
  review-8 changes its *description in the README*, not the dependency. D1 only cross-checks
  `package.json` for accuracy; it does not edit it.
- **`docs/song-format.md` field-level content and `AGENTS.md`.** Verified no-op (D5).
