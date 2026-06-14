# Doc plan review — Review 2 (editor UI): APPROVED

**Verdict:** Approved.
**Reviewer:** doc-plan-reviewer (review-2)
**Plan reviewed:** `3-plan/doc-plan.md`
**Reference artifacts:** `1-spec/spec.md`, `2-design-doc/design-doc.md`, `3-plan/code-plan.md`, current `README.md`, current `docs/song-format.md`.

## Summary

The doc plan accurately and completely documents the review-2 changes that actually
ship, holds the drift-sensitive front-end boundary firmly, and stays proportional to
the two existing docs. Each task names concrete files, audience, and section scope
with line anchors that I verified against the live `README.md` and
`docs/song-format.md`. The four tasks are correctly ordered for sequential
single-tree edits (D1 → D2 → D3 → D4). No new doc files, no inline code-symbol docs
(except in the contributor File-layout / build-model sections that already name
files), and no pipeline references. Approved.

## Coverage check (every required review-2 change is documented)

- **Click-to-select works** — D1 (author workflow) + D4 (contributor: canvas is now
  selection-only). ✓
- **Selection-contextual add/remove note + on-canvas add-grid removed** — D1 rewrites
  the "Add notes on the canvas" paragraph (README line 29) and the "Add and remove
  across the model" paragraph (line 41); D4 updates the `src/editor/` file-layout row
  (line 139), which today literally names the "on-canvas add-note / add-measure
  affordances" being removed. ✓
- **Sidebar Structure view (sections → measures, add/remove, select-to-edit, canvas
  highlight)** — D2 (full author-facing description) + D4 (`StructureList` in file
  layout). Measure-depth-only and no-reordering are both called out. ✓
- **Song-level `language` selector (converts + stores + infers/defaults)** — D3 README
  half (Note language selector, conversion, English default for new songs, inference
  for existing songs). ✓
- **New `language` schema field in `docs/song-format.md`** — D3 (top-level shape line
  + dedicated `language` subsection: values `"spanish"`/`"english"`, optional/additive,
  round-trips, validates). ✓

## Drift-resistance (the load-bearing check)

The "stored + round-trips but the front end does not consume it yet" boundary is
stated repeatedly and unambiguously, exactly where a future reader could be misled:
- Preamble line 26 and Conventions line 41 ("the front end is **unchanged** and does
  **not** read `language`; do not imply otherwise").
- D3 `docs/song-format.md` "Front-end boundary (important)" bullet and acceptance
  ("**explicitly says the front end does not consume it yet**").
- D3 README acceptance ("**No claim that the published page shows the language or
  changes rendering**").
- D4 ("front-end SVG **unchanged / byte-identical**"; `render.php` / `view.js` rows
  verified to still say the front end is unchanged).

The plan also catches a real latent contradiction: D3 reconciles the existing README
sentence "a song keeps the system it was written in" with the new conversion
capability, rather than leaving it to read as false. Good drift-catch.

## Proportionality, scope, and ordering

- Files limited to `README.md` (D1, D2, D4, and D3's README half) and
  `docs/song-format.md` (D3 only) — the two docs that exist; no invented docs.
- The `interactive` hit-rect is correctly scoped to **contributor** prose (D4); the
  preamble flags it as a contributor architecture note, not a user-observable claim.
  In-scope and proportional.
- KD5 carry-overs (conformant-by-construction, raw-JSON-never-blocks, WordPress-only
  deps) are correctly given **no** dedicated doc task — they are reader-invisible
  internals; the existing prose already covers the never-blocks stance. Not a gap.
- Line anchors verified accurate against the current docs (README 19, 26–47, 29, 31,
  37, 41, 47, 133–153 file-layout rows 135/138/139/144, 185, 193; song-format
  top-level shape line 16, `## Additive growth` and `## Note-name systems` referenced
  by heading). No stale anchors found.
- Depends-on chain is correct and matches single-tree sequential editing.

## Non-blocking observations (no action required)

- D4's acceptance includes verifying the `render.php` / `view.js` file-layout rows
  "still say the front end is unchanged." Those rows are not in D4's edit scope; this
  is a verify-no-change guard, not an edit, and is fine as written.

## Decision

All four tasks (D1–D4) are complete, drift-resistant, proportional, and correctly
ordered. **Approved** with no required changes.
