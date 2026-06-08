# Code Plan: Review 5 — Visible tree action buttons, add-section in block settings, small note highlight

This is a focused **editor-side polish** pass implementing the approved design's
KD1–KD4. Three sequential, independently-committable tasks, one code-writer each,
sharing a single working tree. Run all git **inside the worktree**
(`/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/8-editor-ui`,
branch `worktree-8-editor-ui`) — do **not** `cd` to the main repo.

## Boundary (applies to every task)

- Touch **only**: `src/editor/StructureTree.js`, `src/editor/inspector/SongPanel.js`,
  `src/editor/inspector/SectionPanel.js`, `src/edit.js`, `src/style.scss`, their
  `__tests__/*` files, and `specs/editor.spec.js` (the one Add-section e2e step).
- Do **NOT** touch `src/song/*`, `src/notation/*` (incl. `svg.js`), `src/view.js`,
  `src/render.php`, `src/editor/SongCanvas.js`, or the schema. No new dependency —
  `@wordpress/*` and stock CSS/SVG only (AC5).
- **Linter:** `npm run lint` (biome). **Unit gate:** `npm run test:unit` (NOT
  `npm test`, NOT `wp-scripts lint-js`). Baseline confirmed green:
  **624 tests / 20 suites**. Each task must leave both passing.
- Note the live tree: `StructureTree.js` lives directly in `src/editor/`
  (not a subfolder); the inspector panels live in `src/editor/inspector/`; all unit
  tests live in `src/editor/__tests__/`. (The design's line pointers are ~1 line off
  and omit `__tests__/`; the exact paths/anchors below are resolved against the live
  code.)

---

## Task 1 — Make the tree's per-row action buttons visible (`tertiary` → `secondary`)

**Goal.** The 8 per-row **action** buttons in the structure tree render as visible
bordered chips instead of the near-transparent `tertiary` icon style, while the
remove buttons keep their destructive read and the row label/disclosure buttons stay
quiet. (KD1.)

**Files.**
- `src/editor/StructureTree.js` (edit)
- `src/editor/__tests__/StructureTree.test.js` (no behavioral change expected; see
  Acceptance — the `@wordpress/components` mock swallows `variant`/`isDestructive`,
  so this task is test-neutral. Do **not** add CSS assertions.)

**Changes.**
- In `StructureTree.js`, change `variant="tertiary"` → `variant="secondary"` on
  **exactly these 8 action `Button`s** (live line anchors):
  - Section: **remove** `:212`, **duplicate** `:227`, **add-measure** `:241`
  - Measure: **remove** `:315`, **duplicate** `:336`
  - Hand "Add note": `:414`
  - Note: **remove** `:478`, **duplicate** `:506`
- The 3 remove buttons already carry `isDestructive` (`:218, :325, :490`) — **keep
  it**; do not add or remove `isDestructive` anywhere. In the real
  `@wordpress/components` Button, `variant="secondary"` + `isDestructive` compose to
  `is-secondary is-destructive`, preserving the destructive read.
- **Leave the 4 label/disclosure buttons `tertiary`** (`:193, :292, :400, :455`) —
  the intentional hierarchy (quiet label, visible actions). Do not touch them.
- No SCSS change is required for this task. No prop, JSDoc, or row-model change.

**Depends on.** Nothing (first task).

**Traces to.** Req 1 / AC1; KD1.

**Acceptance.**
- Exactly 8 `variant="secondary"` action buttons and exactly 4 remaining
  `variant="tertiary"` label buttons in `StructureTree.js` (verify by grep:
  `variant="tertiary"` count drops 12 → 4; `variant="secondary"` count is 8 plus any
  pre-existing — the trailing tree Add-section at `:543` still has `secondary` *until
  Task 2 removes it*, so during this task `secondary` count is 9; that footer button
  is untouched here).
- `npm run test:unit` still green (624/20) — the change is test-neutral (the mock
  swallows `variant`/`isDestructive`; `StructureTree.test.js` asserts row/label/handler
  behavior, not styling). `npm run lint` clean.

---

## Task 2 — Relocate "Add section" to the always-present `SongPanel`

**Goal.** Remove the **two** existing Add-section affordances (the tree footer button
and the `SectionPanel` button) and add a **single** Add-section control to the
always-present `SongPanel`, wired to the existing lifted `onAddSection` handler in
`edit.js`. SectionPanel keeps "Remove section". (KD2.)

**Files.**
- `src/editor/StructureTree.js` (edit)
- `src/editor/inspector/SongPanel.js` (edit — gains the button + prop)
- `src/editor/inspector/SectionPanel.js` (edit — loses the button + prop)
- `src/edit.js` (edit — re-thread props)
- `src/editor/__tests__/StructureTree.test.js` (edit)
- `src/editor/__tests__/SongPanel.test.js` (edit — add a test)
- `src/editor/__tests__/SectionPanel.test.js` (edit)
- `src/editor/__tests__/Edit.test.js` (edit)
- `specs/editor.spec.js` (edit — the one Add-section e2e step)

**Changes — source.**
1. **`StructureTree.js`** — remove the trailing **Add-section** `Button` block
   (`:542-548`, inside the closing `<div className="…__tree">`), leaving just
   `<div className="…__tree"><TreeGrid …>{rows}</TreeGrid></div>`. Drop the now-unused
   `onAddSection` from the destructured props (`:128`) and its JSDoc line (`:108`).
   Do **not** touch the row model, the index-path Sets, `onSelect`/expansion wiring,
   or any per-row add (add-measure/add-note stay — they call different mutators).
2. **`SongPanel.js`** — add an `onAddSection` prop:
   - Add it to the destructured props (`:122`, `export function SongPanel({ song,
     system, onChange })` → `{ song, system, onChange, onAddSection }`).
   - Add a `@param {Function} props.onAddSection Lifted: append a section.` JSDoc line
     in the component's param block (~`:119`).
   - Import `Button` from `@wordpress/components` (the current import block at
     `:23-29` does **not** include `Button` — add it, keeping the import list sorted
     to satisfy biome).
   - Render an **"Add section"** `Button` (`variant="secondary"`, calling
     `onAddSection?.()`) inside the `PanelBody`. Place it after the existing
     `MetadataEditor`/context controls (a sensible "song-level structural action"
     spot, e.g. just before the closing `</PanelBody>` or right after the
     `<SelectControl>`/`NumberControl` block — match the SectionPanel idiom:
     `<Button variant="secondary" onClick={() => onAddSection?.()}>{__("Add section",
     "piano-block")}</Button>`). The panel stays a pure controlled component — the
     button only signals intent (no local mutation, no `onChange` for this action).
3. **`SectionPanel.js`** — remove its **"Add section"** `Button` (`:145-147`); **keep
   "Remove section"** (`:148-154`). Drop `onAddSection` from the destructured props
   (`:74`) and its JSDoc line (`:66`). Update the file's module doc-comment that
   mentions "**Add section** / **Remove section** buttons … through the lifted
   `onAddSection` / `onRemoveSection`" (`:21-24`) to drop the Add-section half (keep
   it accurate: only Remove-section remains).
4. **`edit.js`** — re-thread the single lifted `onAddSection` handler
   (`:240-249`, **unchanged**):
   - Remove `onAddSection={onAddSection}` from the `<StructureTree>` call-site
     (`:466`).
   - Remove `onAddSection={onAddSection}` from the `<SectionPanel>` call-site
     (`:516`).
   - Add `onAddSection={onAddSection}` to the `<SongPanel>` call-site (`:520`):
     `<SongPanel song={working} system={system} onChange={commit}
     onAddSection={onAddSection} />`.
   - Leave every other lifted mutator, the `resolvedSelection` gate around
     `SectionPanel` (`:511`), and the data flow untouched.

**Changes — tests.**
5. **`StructureTree.test.js`** —
   - DELETE the test `it("adds a section from the trailing Add section button", …)`
     (`:335-344`, inside the `describe("StructureTree — add/remove/duplicate", …)`).
   - Drop the `addSection: 0,` field from the `calls` object (`:147`) and the
     `onAddSection: () => { calls.addSection += 1; }` wiring in `renderTree`
     (`:167-169`). Leave every other handler/field intact.
6. **`SectionPanel.test.js`** —
   - DELETE the `describe("SectionPanel — add section", …)` block (`:256-265`).
   - Drop the `addSection` harness wiring in `renderPanel`: the `const addSection =
     { count: 0 };` declaration (`:146`), the `onAddSection: () => { addSection.count
     += 1; }` prop (`:157-159`), and `addSection,` from the returned handle
     (`:179`). Update the `renderPanel` JSDoc `@return` (`:130-131`) to drop
     `addSection`. Leave `removeSection` and all other wiring intact. (Verify no other
     test references `addSection` after this — grep the file.)
7. **`SongPanel.test.js`** — ADD a test asserting the Add-section button calls the
   lifted `onAddSection`. This file currently has **no** click/button-by-text helper,
   so add small local helpers near the existing `fieldByName`/`change`:
   - a `buttonByText(container, text)` that finds a `<button>` whose `textContent`
     === `text` (mirroring `StructureTree.test.js`'s finder), and
   - a `click(node)` that dispatches a `click` Event inside `act` (mirror the existing
     `change` helper's `act` usage; the file already imports `act` from `react`).
   - The `renderPanel` harness (`:86-106`) does **not** pass `onAddSection`. Either
     extend `renderPanel` to forward an optional `onAddSection` (preferred — keeps the
     re-render closure consistent), or render `SongPanel` directly in the new test
     with a recording `onAddSection`. Add:
     `describe("SongPanel — add section", () => { it("calls the lifted onAddSection
     handler", () => { …render with a counter… click(buttonByText(container, "Add
     section")); expect(count).toBe(1); }); });`
     Assert **only** that the lifted handler fired (and, optionally, that no
     `onChange` emission resulted — the button signals intent only).
8. **`Edit.test.js`** — RETARGET the existing
   `it("onAddSection appends an empty-but-conformant section through commit", …)`
   (`:405-416`):
   - **Drop the `selectLoneNote(container);` precondition** (`:409`) — the Add-section
     button now lives in the always-present SongPanel, reachable with nothing
     selected. (Removing the selection precondition is fine; the SongPanel renders
     unconditionally.)
   - Keep `click(buttonByText(container, "Add section"));` and the
     append-through-commit assertions (`:412-415`) **unchanged** — they already assert
     `sections` grows to 2 with a conformant new section.
   - Update the inline comment (`:407-408`) that says "The Section panel (reachable
     once an event is selected) drives the lifted onAddSection handler" to reflect the
     always-present SongPanel home.
9. **`specs/editor.spec.js`** — the e2e step at `:535-540` clicks
   `treeAction(editor, "Add section")` (scoped to the structure tree, which no longer
   has the button). Retarget it to the **sidebar** SongPanel button. This test
   (`"the structure tree adds, removes and duplicates sections and measures"`,
   `:504-563`) does **not** currently open the settings sidebar, so:
   - Open the sidebar once (use the existing `openSettingsSidebar(editor, page)`
     helper — add `page` to the test's fixture destructure at `:504-506`), and
   - Replace `await treeAction(editor, "Add section").click();` with a sidebar-scoped
     click: `await sidebar.getByRole("button", { name: "Add section", exact: true
     }).click();` (mirroring the existing sidebar "Add note" pattern at `:479`).
   - Leave the surrounding measure/section assertions and the other `treeAction(…)`
     steps unchanged. Update the inline comment (`:535-536`) that says
     "(the tree's footer 'Add section')" to "(the Song panel's 'Add section' in the
     settings sidebar)".
   - This e2e is chromium-only and not part of `npm run test:unit`; do not run it as
     the gate, but keep it self-consistent (it should still describe a valid flow).

**Depends on.** Task 1 (same `StructureTree.js`; commit Task 1 first so the footer-
button removal applies cleanly on top of the variant change).

**Traces to.** Req 2 / AC2; KD2.

**Acceptance.**
- No "Add section" button remains in `StructureTree.js` or `SectionPanel.js`; exactly
  one exists in `SongPanel.js`. `onAddSection` flows `edit.js → SongPanel` only (grep
  `onAddSection` in `src/`: present in `edit.js` and `SongPanel.js`; **absent** in
  `StructureTree.js` and `SectionPanel.js`).
- `SectionPanel.js` still renders "Remove section" (`onRemoveSection`).
- `npm run test:unit` green: 20 suites; the new SongPanel test passes; the deleted
  StructureTree/SectionPanel Add-section tests are gone; the retargeted Edit test
  passes. Net unit count: −1 (StructureTree) −1 (SectionPanel) +1 (SongPanel) = **623
  tests** (the Edit test is retargeted, not added/removed). Treat the suite-green +
  per-file pass as the gate; the exact total may differ if helpers add incidental
  coverage — the binding requirement is **all green** with the touchpoints above
  resolved.
- `npm run lint` clean (esp. the new `Button` import in `SongPanel.js` keeps the
  import list sorted).

---

## Task 3 — Make the selected-note highlight small and subtle (CSS-only)

**Goal.** Replace the magnified `outline` `.is-selected` rule with a CSS-only highlight
that is thin at the displayed scale: a scale-invariant **recolor floor** (primary,
cross-engine incl. Safari) plus an enclosing **`outline: 0.125px`** hairline
reinforcement. No JS, no `svg.js`/`render.php`/`view.js`/schema change → front-end
byte-identical. (KD3 — the crux.)

**Files.**
- `src/style.scss` (edit — the `.is-selected` rule only)

**Changes.**
- In `src/style.scss`, replace the current `.is-selected` rule (`:92-95`, nested under
  `&__canvas-svg` at `:84`):
  ```scss
  .is-selected {
      outline: 1px solid #007cba;
      outline-offset: 1px;
  }
  ```
  with the combined recolor-floor + hairline rule:
  ```scss
  .is-selected {
      /* Cross-engine FLOOR: recolor the selected event's ink. Fill wherever fill is
         the paint (filled heads, dots, text glyphs, rest bodies); :not([fill="none"])
         preserves an OPEN notehead's hole. Stroke ONLY already-stroked geometry —
         stems/ledgers <line> and the open-notehead ring — NEVER <text> (default
         stroke:none; a forced stroke would render a fat ~8x-scaled outline around the
         glyph). Color-only => no layout shift; editor-only (class added by SongCanvas
         post-render; view.js never sets it) => front-end SVG byte-identical (AC4). */
      *:not([fill="none"]) { fill: #007cba; } /* filled heads, dots, text, rest bodies */
      line { stroke: #007cba; }               /* stems + ledger lines */
      ellipse[fill="none"] { stroke: #007cba; } /* open-notehead ring (keeps its hole) */

      /* Enclosing hairline (Chrome/Firefox; may no-op on Safari for a <g>, hence the
         recolor floor above). Outline lengths resolve in the staff-space user system,
         which the root viewBox scales 1 sp -> SP_PX (8) CSS px, so divide by 8:
         0.125 sp x 8 = ~1 CSS px line, 0.25 sp x 8 = ~2 CSS px gap. COUPLED to
         SP_PX=8 by design (this one commented line must be re-divided if SP_PX is
         retuned). */
      outline: 0.125px solid #007cba;
      outline-offset: 0.25px;
  }
  ```
- Keep the existing **outer** doc-comment above `.is-selected` (`:88-91`, "The
  selected note/rest group, decorated after each draw…") — it remains accurate; the
  inner comments above explain the new recolor/hairline mechanics. Adjust the outer
  comment's "The outline is drawn on the SVG `<g>`…" phrasing only if it now reads as
  contradicting the recolor floor (optional, light touch; do not over-edit).
- **No other selector** in `style.scss` changes. The highlight color stays `#007cba`
  (the existing value). Match the surrounding file's tab indentation and comment
  density.
- **No JS change** — `SongCanvas.decorateSelection` still only adds the `.is-selected`
  class. Do **not** touch `SongCanvas.js`, `svg.js`, `view.js`, `render.php`, or the
  schema.

**Depends on.** Independent of Tasks 1–2 (different file). Sequence it last so each
commit builds cleanly; could also go first, but last keeps the JS/tests churn (Tasks
1–2) and the CSS change in separate commits.

**Traces to.** Req 3 / AC3 (and Req 4–5 / AC4–AC5 via the no-front-end-change
boundary); KD3.

**Acceptance.**
- The `.is-selected` rule contains the three scoped recolor selectors
  (`*:not([fill="none"]) { fill }`, `line { stroke }`, `ellipse[fill="none"] {
  stroke }`) — **never** a `<text>` or wildcard `* { stroke }` — plus
  `outline: 0.125px solid #007cba;` and `outline-offset: 0.25px;`. No `1px` outline
  remains.
- `npm run test:unit` still green (the CSS change is test-neutral; `SongCanvas.test.js`
  asserts only `.is-selected` class placement, not CSS — confirm it passes
  unchanged). `npm run lint` clean.
- Boundary holds: `git status`/`git diff --name-only` for this commit shows **only**
  `src/style.scss`. `svg.js`/`render.php`/`view.js`/schema untouched → front-end SVG
  byte-identical (AC4).

---

## Closing gate (after Task 3)

- `npm run test:unit` green across all 20 suites; `npm run lint` clean.
- Boundary audit: the union of changed files across the three commits is exactly the
  allowed set — `StructureTree.js`, `SongPanel.js`, `SectionPanel.js`, `edit.js`,
  `style.scss`, their `__tests__/*`, and `specs/editor.spec.js`. No `src/song/*`,
  `src/notation/*`, `src/view.js`, `src/render.php`, or `SongCanvas.js`. No new
  dependency (no `package.json` change).
- Excluded alternatives were not introduced: no `vector-effect: non-scaling-stroke`,
  no `getBBox`, no `box-shadow`.
