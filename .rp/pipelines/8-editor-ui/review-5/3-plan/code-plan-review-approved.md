# Code-plan review — Review 5 — APPROVED

**Verdict:** Approved. The code plan at `3-plan/code-plan.md` is complete, feasible,
and aligned with `1-spec/spec.md` and `2-design-doc/design-doc.md`. Every anchor in
the plan was resolved against the live `src/` and matches exactly. The three tasks are
sequenced for single-tree execution, each independently committable with its tests, and
the boundary holds.

## What was verified against live code

### Spec / AC coverage
- **Req 1 / AC1** — Task 1 ("Traces to. Req 1 / AC1; KD1").
- **Req 2 / AC2** — Task 2 ("Traces to. Req 2 / AC2; KD2").
- **Req 3 / AC3** — Task 3 ("Traces to. Req 3 / AC3; KD3").
- **Req 4 / AC4** — Task 3 traces to it via the no-front-end-change boundary; the
  closing gate's boundary audit enforces it.
- **Req 5 / AC5** — every task is `@wordpress/*`/stock-CSS-only; the closing gate
  asserts no `package.json` change.
All five Reqs and ACs are covered.

### T1 — buttons (`tertiary` → `secondary`)
- Live `StructureTree.js`: **12** `variant="tertiary"`, **1** `variant="secondary"`
  (the footer Add-section at `:543`), **3** `isDestructive` (`:218, :325, :490`).
- The **8** action buttons the plan flips are confirmed at exactly
  `:212, :227, :241, :315, :336, :414, :478, :506`; the **4** label/disclosure buttons
  that stay `tertiary` carry `className="…__tree-label"` at exactly
  `:193, :292, :400, :455`. The design doc's "7" is a stale undercount; the **plan's
  "8" is correct** (it counts the per-hand "Add note" the design's prose omits from its
  list). Removes keep `isDestructive`; none added/removed. Plan correctly marks the task
  test-neutral (the `@wordpress/components` mock swallows `variant`/`isDestructive`).

### T2 — add-section relocation
- Both existing Add-section affordances exist and are removed: tree footer
  (`StructureTree.js:542-548`) and `SectionPanel.js:145-147`; SectionPanel keeps
  Remove-section (`:148-154`). One Add-section is added to the always-present
  `SongPanel` (mounted unconditionally at `edit.js:520`, outside the
  `{resolvedSelection && …}` gate at `:511`), wired to the unchanged lifted
  `onAddSection` (`edit.js:240-249`). Prop threading is exact: drop from
  `<StructureTree>` (`:466`) and `<SectionPanel>` (`:516`), add to `<SongPanel>`
  (`:520`). `SongPanel`'s import block (`:23-29`) lacks `Button` — the plan adds it.
- **No other add-section path:** the only section-level append
  (`insertAt(sections, sections.length, newSection())`) is `edit.js`'s `onAddSection`;
  no other `insertAt`/`newSection` caller touches `sections`. After Task 2 the user can
  still add a section in every state, including nothing-selected.
- **All test touchpoints covered:** StructureTree.test.js (delete `:335-344`, drop
  `addSection` harness `:147/:167-169`), SectionPanel.test.js (delete describe
  `:256-265`, drop harness `:146/:157-159/:179` + `@return` `:130-131`),
  SongPanel.test.js (add a click/`buttonByText` test — confirmed the file has `act` from
  `react` at `:18`, `fieldByName`/`change` to mirror, and `renderPanel` at `:86-106`
  with no `onAddSection`, exactly as the plan states), Edit.test.js (retarget
  `:405-416`, drop `selectLoneNote` `:409`, fix comment `:407-408`), and the e2e
  (`specs/editor.spec.js`). The e2e retarget is sound: `openSettingsSidebar(editor,
  page)` (`:219`) returns the `sidebar` region; the test's fixture destructures only
  `{ editor }` (`:504-506`) so `page` must be added; the replacement mirrors the
  existing sidebar "Add note" click at `:479`; the target test spans `:504-563` with the
  Add-section step at `:535-540`.

### T3 — highlight (the crux): CSS-only
- `.is-selected` is at `style.scss:92-95` under `&__canvas-svg` (`:84`) with the outer
  doc-comment at `:88-91`. The rewrite is **CSS-only**: scoped recolor
  (`*:not([fill="none"]){fill}`, `line{stroke}`, `ellipse[fill="none"]{stroke}`,
  **never `<text>`**) + `outline: 0.125px` (1px ÷ SP_PX 8) + `outline-offset: 0.25px`.
- The scope is **correct against `svg.js`**: the open notehead is
  `el("ellipse", { … fill: isFilled ? INK : "none" })` (`:205-210`), so
  `*:not([fill="none"])` preserves its hole and `ellipse[fill="none"]{stroke}` rings it;
  font glyphs (clefs/rests/accidentals/flags) are `<text>` via `fontGlyph`
  (`el("text", …)` `:154`) with default `stroke:none`, so the deliberate avoidance of
  stroking `<text>` averts the fat ~8×-scaled glyph-outline bug. No JS change:
  `SongCanvas.decorateSelection` adds `.is-selected` to the note/rest `<g>` only
  (`SongCanvas.js:118`). No `svg.js`/`render.php`/`view.js`/schema change → front-end
  byte-identical (AC4). Task is test-neutral: `SongCanvas.test.js` asserts only
  `.is-selected` class placement/counts (`:135, :160, :192, :201`), never CSS.

### Boundary, ordering, gate
- Touched set is exactly `StructureTree.js`, `SongPanel.js`, `SectionPanel.js`,
  `edit.js`, `style.scss` + their `__tests__/*` + `specs/editor.spec.js`. No
  `src/song/*`/`src/notation/*`/`view.js`/`render.php`/`SongCanvas.js`; no new
  dependency. Excluded alternatives (`non-scaling-stroke`, `getBBox`, `box-shadow`) are
  explicitly barred in the closing gate.
- Dependencies are sound: T2 sequenced after T1 (same `StructureTree.js`); T3
  independent (CSS-only). Each task leaves both gates green.
- **Gate scripts confirmed:** `test:unit` = `wp-scripts test-unit-js`, `lint` =
  `biome lint .`. **Baseline confirmed green: 624 tests / 20 suites.**

## Non-blocking nits (optional; do not gate)
1. **T2 e2e** — the plan says "Open the sidebar once (use the existing
   `openSettingsSidebar(editor, page)` helper)" without spelling out
   `const sidebar = await openSettingsSidebar(editor, page);`, yet the next line
   references `sidebar`. Every other test in the file uses that exact idiom, so a
   code-writer will follow it; harmless.
2. **T2 SectionPanel.test.js** — the file's module doc-comment at `:9` still names
   "Add section"; the plan updates the `SectionPanel.js` module doc (`:20-24`) but does
   not mention this test-file comment. Trivial staleness inside an already-touched file;
   the code-writer may tidy it but it risks no test failure.

Neither nit changes behavior, breaks a test, or crosses the boundary, so neither blocks
approval.
