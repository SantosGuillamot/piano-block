# Review 8 — Docs review (iteration 1): REJECTED

**Verdict:** REJECTED
**Iteration:** N=1
**Scope reviewed:** the cumulative final `README.md` state (diff against base `d139170`,
which includes code-task **T19** commit `d392551` and doc-task pass `3461c0e`), plus
`docs/song-format.md` and `AGENTS.md`, all verified against the shipped source tree.

## Defect (blocking) — `emit.js` mischaracterized as an "SVG-emit helper"

**File / line:** `README.md:143` (the `src/editor/` file-layout row).

**What it says (introduced by doc commit `3461c0e`):**
> …the invalid-state fallback, **the SVG-emit helper (`emit.js`)**, and the reused leaf
> field-editors…

**Why it is wrong (verified against shipped code):** `src/editor/emit.js` is **not** an
SVG-emit helper. It exports `omitEmpty` and `omitFalsy` — the inspector field-editor
"omit-when-empty / omit-when-blank" helpers. Its own docblock opens: *"Shared emit
helpers for the canvas-first inspector panels … `omitEmpty` … `omitFalsy` …"*. It
contains **zero** SVG code (grep for `svg`/`renderSvg` in the file returns nothing), and
every one of its importers pulls only the omit helpers:

- `src/editor/ContextEditor.js` → `omitEmpty`
- `src/editor/MetadataEditor.js` → `omitFalsy`
- `src/editor/inspector/{NotePanel,SectionPanel,MeasurePanel}.js` → `omitFalsy`
- `src/editor/inspector/SongPanel.js` → `omitEmpty`

The actual SVG-emit layer is `src/notation/svg.js`, which the **same table** already
correctly labels "the thin SVG-emit layer that turns the model into an `<svg>` DOM tree"
(`README.md:149`). The README now contains two different "SVG-emit" claims, only one of
which is true; the `src/editor/emit.js` one contradicts the shipped file.

**This is a regression introduced by the docs phase, not a pre-existing error.** The base
`d139170` `src/editor/` row did **not** mention `emit.js` at all. Doc commit `3461c0e`
*added* the phrase "the SVG-emit helper (`emit.js`)". The doc plan (D3) only asked the
writer to (a) stop attributing the accessible-name helper solely to the editor layer and
(b) account for the moved `emit.js` path; in adding an `emit.js` mention the writer
attached a false role to it. This fails D3's core acceptance ("every file-layout claim in
README is TRUE") and the review's primary accuracy test.

## What must change

In `README.md:143`, replace the false role with an accurate one (or drop the `emit.js`
mention entirely, matching the base row, since D3 did not require naming it). An accurate
description is the inspector-panel **omit helpers** (`omitEmpty` / `omitFalsy`) that the
field editors share — e.g. "…the invalid-state fallback, the shared inspector omit
helpers (`emit.js`)…", or simply omit the parenthetical. Do **not** call `emit.js` an
SVG-emit helper; SVG emit is `src/notation/svg.js`.

## Everything else PASSES (verified against shipped code)

For the record, the rest of the documentation is accurate and complete — the single
defect above is the only blocker:

**Accuracy vs shipped code (file-layout / build-model):**
- `src/editor.scss`, `src/song/accessibleName.js`, `src/notation/dom.js`,
  `src/editor/emit.js` all **exist**; `src/editor/accessibleName.js` and
  `src/editor/inspector/emit.js` do **not** exist (moved) — matches the README.
- `src/block.json` contains **both** `"editorStyle": "file:./index.css"` and
  `"style": "file:./style-index.css"` (lines 17–18); the row says so.
- `src/index.js` imports **both** `./style.scss` and `./editor.scss` (lines 4–5); the row
  says "imports both stylesheets."
- `src/style.scss` is front-end/shared (only `@font-face` + the wrapper
  `border`/`padding`/`color` rules); `src/editor.scss` is editor-only (workspace / tree /
  `[aria-level]` indent / canvas / `.is-selected`) — matches the README.
- Build emits all four artifacts: `build/index.css`, `build/style-index.css`, and both
  `-rtl` variants exist — consistent with the build-model bullet.
- `src/song/accessibleName.js` is named in the `src/song/` grouping and is React-free
  (imports only `@wordpress/i18n`); `src/notation/dom.js` is named in the `src/notation/`
  row and is React-free (imports only `./constants.js` + `./glyphs.js`, **not**
  `@wordpress/element`) — matches the README's "React-free shared width/font helpers."
- The `src/editor/` row no longer attributes the accessible-name helper to the editor
  layer ("now lives in `src/song/` … not the editor layer") — correct.

**Completeness (D1, D2, D4, D5):**
- **D1 (R5):** No "no new runtime dependency" and no ajv-"first" phrasing remain (grep:
  zero). The row acknowledges `@wordpress/icons` as a bundled `@wordpress/*` runtime
  dependency; `package.json` still lists `@wordpress/icons` (`^10.32.0`) and no dependency
  was added/removed. The validator's "zero-dependency / no `ajv`" / schema-as-data
  narrative is intact.
- **D2 (R8):** Grep of `README.md` for `interactive` / `hit-rect` / `hitRect` returns no
  dead-feature references; the "now-dormant `interactive` hit-rect" `###` section is gone;
  the Tests paragraph drops the hit-rect clause and now reads "verified without a browser,
  with the front-end SVG emit pinned byte-identical." The only "interactive" hit is the
  unrelated "richer interactive piano experience" Forthcoming prose, which is fine.
  Cross-checked: `src/notation/svg.js` / `constants.js` contain no `interactive` /
  `hitRect` / `HIT_RECT_*` symbols.
- **D4 (R1/R2):** Correctly a no-op — the README's structure-tree prose (line 29) says
  "expandable and collapsible" with **no** keyboard-specific ("arrow", "Left/Right", "for
  free") or accessible-name claim about the tree, so nothing needed changing.
- **D5:** `docs/song-format.md` and `AGENTS.md` are unchanged since base and contain no
  review-8 terms (grep: zero) — no-op justified.

**Scope discipline:**
- The doc commit `3461c0e` touches **only `README.md`** (no source/test edits).
- No pipeline internals (`.rp/`, task IDs, `R#`/`O#`/`AC#`/`KD`, "review N") appear in
  shipped README text (grep: zero).
- The song format / front-end behavior is described as unchanged.

## Summary

A single, clear-cut accuracy regression introduced this run blocks approval: `README.md`
calls `src/editor/emit.js` an "SVG-emit helper," but the shipped file is the inspector
omit-helper module (`omitEmpty` / `omitFalsy`) with no SVG code. Fix that one phrase (or
drop the parenthetical) and the documentation will be accurate and complete.
