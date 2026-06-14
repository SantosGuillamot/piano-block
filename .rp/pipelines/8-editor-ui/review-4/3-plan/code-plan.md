# Code plan: Review 4 — Structure-tree polish

Implements the approved design doc (KD1–KD8) for the editor-side polish pass. Every
task is independently committable in a single shared working tree, ordered so each
builds cleanly on the last. The change set is confined to four source files
(`src/edit.js`, `src/editor/StructureTree.js`, `src/editor/SongCanvas.js`,
`src/style.scss`), one helper file pruned for dead code (`src/editor/selection.js`),
and the unit tests that encode to-be-changed behavior.

## Conventions for every task

- **Boundary (KD8, hard rule).** Touch ONLY the files named in the task. NEVER touch
  `src/song/*`, `src/notation/*` (incl. `svg.js`), `src/view.js`, or `src/render.php`.
  Add NO new import and NO new dependency — every component referenced (`Button`,
  `TreeGrid*`, `InspectorControls`, the panels) is already imported.
- **Gates (run after every task).**
  - Linter: `npm run lint` (biome) — must be clean for the touched files.
  - Unit: `npm run test:unit` (= `wp-scripts test-unit-js`; NOT `npm test`, NOT
    `wp-scripts lint-js`) — must be green. Baseline confirmed at this tip:
    **629 tests / 20 suites passing**. A task that adds/removes tests changes the
    count; each task notes its expected direction.
- **Comment density.** Match the surrounding code, which carries dense explanatory
  doc-comments. Update any comment a change makes stale (the design doc calls out
  several explicitly).
- **Commit message format.** Imperative, sentence case, no trailing period, agent
  name in parentheses — e.g. `Flip structure tree open by default (code-writer)`.

---

## T1 — Tree open by default

**Goal.** The structure-tree panel is open the first time a Piano block is selected,
while the toolbar toggle still closes and reopens it and a manual close sticks for the
session (KD1 / Req 1 / AC1).

**Files.** `src/edit.js`; `src/editor/__tests__/Edit.test.js`; `specs/editor.spec.js`.

**Changes.**
1. `src/edit.js:102` — flip the initializer: `const [showTree, setShowTree] =
   useState(true);` (was `useState(false)`). That is the *entire* logic change — the
   toolbar toggle (`edit.js:386-393`) and render gate (`edit.js:432`) are complete and
   there is no `useEffect` that re-forces it, so a manual close already sticks.
2. Update the adjacent comment (`edit.js:98-102`) so "whether the left structure tree
   is shown" reads as *open by default*, editor-only, not persisted.
3. `Edit.test.js` — the `describe("Edit — structure tree")` block's first test,
   `"toggles the structure tree open and closed from the toolbar button"`
   (~lines 516-539), asserts the tree is **absent** until the Structure toggle is
   clicked. With open-by-default that precondition inverts. Update it to assert the
   tree is **present by default** (the `.wp-block-piano-block-piano__tree` element and
   a `[role="treegrid"]` are in the workspace on first render), then the first
   Structure click **closes** it (tree absent), and a second click **reopens** it
   (tree present). This pins AC1's full toggle cycle.
4. Audit the other `Edit.test.js` tests that open the tree with
   `click(buttonByText(container, "Structure"))` before drilling in — the
   `selectLoneNote` helper (~lines 385-391) and the
   `describe("Edit — structure tree")` selection tests (~lines 541-575), plus
   `onAddMeasure`/`seeds a note…` tests. With the tree now open by default, that first
   Structure click **closes** the tree, hiding the rows the test then tries to click,
   which will break them. **Remove the leading `click(... "Structure")` from every
   such test/helper** (the tree is already open), keeping the subsequent drill-down
   clicks. Verify by running the suite — every `Edit.test.js` test must stay green.
5. `specs/editor.spec.js` (e2e) — the `openStructureTree` helper
   (`specs/editor.spec.js:261-263`) clicks the block-toolbar "Structure" button on the
   premise (its doc-comment, `:255-259`) that the tree is **hidden by default**. With T1
   flipping `showTree` to `useState(true)` the tree is **already open** on insert, so
   each `openStructureTree(editor)` call (`:408`, `:468`, `:512`, `:574`, `:611`) would
   now **close** it — breaking the very next `await expect(structureTree(editor))
   .toBeVisible()` (`:409`) and every following `treeRow(...).click()`. **Remove every
   `openStructureTree(editor)` call** (the tree is open by default) — or repurpose the
   helper into a no-op / assert-already-open — and **rewrite its `:255-259` doc-comment**
   so "hidden by default" reads as *open by default* (still closeable/reopenable via the
   toggle). Also fix the `structureTree` helper's trailing comment (`:270`, "Only present
   once `openStructureTree` has toggled it on") to reflect open-by-default. Optionally, in
   the first such test, assert the tree is present immediately on insert without the toggle
   and that the toolbar button now **closes** then **reopens** it (the AC1 cycle); not
   required, but the call sites above MUST be fixed so the suite is not left broken.

**Depends on.** none.

**Traces to.** Req 1 / AC1; KD1; R2 (open-by-default `Edit.test.js` and `editor.spec.js`
updates).

**Acceptance.**
- `npm run test:unit` green; `Edit.test.js` count unchanged (tests rewritten in place,
  none added/removed).
- The updated toggle test asserts: tree present on mount → click closes → click
  reopens.
- No `Edit.test.js` test relies on a leading Structure click to *open* the tree.
- No `openStructureTree(editor)` call remains in `specs/editor.spec.js` (or it is a
  verified no-op/assert-already-open), and its doc-comment (and `structureTree`'s
  trailing comment) describe the tree as open by default. The e2e spec no longer
  encodes the now-false "hidden by default" precondition.
- `npm run lint` clean.

---

## T2 — Indented tree hierarchy

**Goal.** Tree rows are visually indented by depth (section → measure → hand → note),
driven by the `level` prop the component already controls — no dependence on the
runtime `aria-level` DOM attribute (KD2 / Req 2 / AC2).

**Files.** `src/editor/StructureTree.js`; `src/style.scss`.

**Changes.**
1. `StructureTree.js` — on the **label `TreeGridCell` of each of the four row kinds
   only** (section, measure, hand, note — NOT the action-button cell), set an inline
   `--pb-tree-depth` CSS custom property computed from that row's `level`:
   `style={{ "--pb-tree-depth": level - 1 }}` → section=0, measure=1, hand=2, note=3.
   The `level` is the literal already passed to each `TreeGridRow` (`level={1|2|3|4}`);
   use the same number on the cell. Put the style on the `TreeGridCell` element (not
   the inner `Button`), so indentation is a property of the row's label column. If
   `TreeGridCell` does not forward `style`, set it on the label `Button` via its
   `cellProps` spread target instead (the `Button` is the cell's only child and fills
   it) — pick whichever the component honors; the SCSS selector in step 2 must target
   the element that actually carries the var.
2. `style.scss` — under `&__tree` (the tree rail block, `style.scss:52-57`), add one
   rule consuming the var, e.g. a class/element selector matching the label cell:
   `padding-left: calc(var(--pb-tree-depth, 0) * 1.5em);`. Keep the default `0` so a
   var-less element is flush-left. Add a short comment explaining the depth-indent and
   that the depth number comes from JS (`level`) while the unit lives here.
3. Add/extend the doc-comment near `isExpanded`/the row-building loop noting the label
   cell carries `--pb-tree-depth` for the depth indent.

**Depends on.** T1 (same file region untouched, but keep a clean sequential base).

**Traces to.** Req 2 / AC2; KD2.

**Acceptance.**
- Each label cell (section/measure/hand/note) carries `--pb-tree-depth` = `level - 1`;
  the action-button cell does not.
- One SCSS rule scopes the `padding-left` to the tree rail and reads the var with a
  `0` default.
- `StructureTree.test.js` is unaffected (it asserts `aria-level` via the mock and
  locates buttons by text/label, not by inline style) — suite stays green, count
  unchanged.
- `npm run test:unit` green; `npm run lint` clean.

---

## T3 — Theme the per-row action buttons

**Goal.** The per-row add / remove / duplicate buttons use standard editor button
chrome instead of rendering as bare/white glyphs (KD3 / Req 3 / AC3).

**Files.** `src/editor/StructureTree.js`.

**Changes.**
1. Add `variant="tertiary"` to every **per-row action** `Button` that currently passes
   an `icon` but no `variant`:
   - section row: Remove (`icon="trash"`, keep `isDestructive`), Duplicate
     (`icon="admin-page"`), Add measure (`icon="plus"`) — `StructureTree.js:182-219`;
   - measure row: Remove (keep `isDestructive`), Duplicate — `:280-316`;
   - hand row: Add note (`icon="plus"`) — `:375-381`;
   - note row: Remove (keep `isDestructive`), Duplicate — `:436-484`.
2. **Keep** `isDestructive` on every remove button (it tints; it is not chrome).
3. **Do NOT** change the trailing "Add section" `Button` — it stays
   `variant="secondary"` as the one prominent primary-add affordance
   (`StructureTree.js:500-506`). **Do NOT** touch the label/disclosure buttons — they
   already carry `variant="tertiary"`.

**Depends on.** T2 (same file).

**Traces to.** Req 3 / AC3; KD3.

**Acceptance.**
- Every icon-only per-row action button now passes `variant="tertiary"`; removes keep
  `isDestructive`; the trailing Add section stays `secondary`.
- `StructureTree.test.js` locates buttons by `aria-label`/text and asserts handler
  wiring, not variant — suite stays green, count unchanged.
- `npm run test:unit` green; `npm run lint` clean.

---

## T4 — Remove the section/measure canvas highlight (+ prune dead helper)

**Goal.** Selecting a section or a measure decorates nothing on the canvas; the note
highlight is unchanged. The now-dead `measureNumbersForSection` helper is pruned
(KD4 + OQ1 / Req 4 / AC4).

**Files.** `src/editor/SongCanvas.js`; `src/style.scss`; `src/editor/selection.js`;
`src/editor/__tests__/SongCanvas.test.js`; `src/editor/__tests__/selection.test.js`;
`specs/editor.spec.js`.

**Changes.**
1. `SongCanvas.js` `decorateSelection` (`:114-163`) — remove the **section branch**
   (`if (selection.kind === "section") { … }`, `:119-133`) and the **measure branch**
   (`if (selection.kind === "measure") { … }`, `:144-151`). Keep:
   - the early `if (!selection) return;` guard;
   - the shared `globalMeasureNumber` null-guard / `measureNumber` computation
     (`:135-142`) — still needed by the event branch;
   - the **event branch** (`:153-162`, the `is-selected` note highlight) verbatim.
   After this, only an `"event"` selection decorates; a section/measure selection
   computes `measureNumber` then falls through to the event query, which won't match a
   non-event selection — confirm a section/measure selection adds **no** class. (If
   simpler, gate the event branch on `selection.kind === "event"` so the intent reads
   cleanly; functionally equivalent since `selectionQuery` needs `hand`/`eventIndex`.)
2. `SongCanvas.js` — drop the now-unused `measureNumbersForSection` from the
   `./selection.js` import (`:36-40`); keep `globalMeasureNumber` and `selectionQuery`.
   Update the component's stale doc-comments that describe the `is-active-*` branches:
   the file header SELECTION-decoration paragraph (`:11-23`), the `decorateSelection`
   doc-block (`:96-113`), and the SVG-host inline comment (`:248-251`) — each must
   describe only the `is-selected` event highlight now, with section/measure decoration
   gone (note a better section/measure indication is a later follow-up).
3. `style.scss` — remove the `.is-active-measure, .is-active-section` rule and the
   `.is-active-section { outline-color }` override (`style.scss:85-98`) and the
   explanatory comment block (`:85-89`). Keep the `.is-selected` rule (T5 reshapes it).
4. `selection.js` — **delete** the `measureNumbersForSection` export and its
   doc-comment (`selection.js:173-194`). Keep `measureCoords`, `globalMeasureNumber`,
   `resolveSelection`, `selectionQuery` (all still consumed).
5. `selection.test.js` — delete the `describe("measureNumbersForSection", …)` block
   (`:348-359`) and drop `measureNumbersForSection` from the import (`:21-27`).
6. `SongCanvas.test.js` — update the file header (`:1-19`) to drop the `is-active-*`
   mention, and **remove the four `is-active-*` tests** that now encode removed
   behavior:
   - `"decorates the one measure group with is-active-measure for a measure selection"`
     (~`:180-196`);
   - `"decorates every measure group of a section with is-active-section"`
     (~`:198-216`);
   - `"decorates a later section's lone measure with is-active-section"`
     (~`:218-230`);
   - `"decorates nothing for a stale measure or section selection"` (~`:232-256`).
   Also fix the two `scrollIntoView` tests (~`:258-295`), which currently drive a
   `kind: "measure"` selection and assert `.is-active-measure` — those assertions are
   now invalid. Re-target both to an **event** selection (a valid one decorates
   `.is-selected`; the scroll spy is no longer wired since the measure-scroll branch is
   gone). If the event branch no longer calls `scrollGroupIntoView` at all, the
   "scrolls … into view" test no longer has a behavior to assert — **delete it**, and
   convert the "does not throw when scrollIntoView is absent" test into a plain "an
   event selection decorates `.is-selected` without throwing" smoke (or delete it if
   redundant with the existing `"decorates exactly the selected group"` test). Keep the
   remaining event-highlight and no-add-affordance tests intact.
   - **Note on `scrollGroupIntoView`/`scrollIntoView` helper:** after removing the
     section/measure branches, `scrollGroupIntoView` (`SongCanvas.js:90-94`) has no
     caller. If the event branch is left non-scrolling (matching today), **also prune
     `scrollGroupIntoView`** and its doc-comment so no dead helper remains; remove the
     two scroll tests accordingly. Do not add scrolling to the event branch — that is
     out of scope.
7. `specs/editor.spec.js` (e2e) — the test "selecting structure-tree rows reveals the
   right panels and highlights the canvas" asserts the now-removed canvas decoration:
   `editor.canvas.locator('[data-measure].is-active-section')` (`:585`) and
   `editor.canvas.locator('[data-measure].is-active-measure')` (`:596`). After T4 removes
   the section/measure branches and the `.is-active-*` CSS those classes are never
   applied, so both assertions fail. **Drop both `is-active-*` assertions** (the section
   one at `:584-586`, the measure one at `:595-597`) and the stale highlight prose in the
   surrounding comments (`:576-590`) that describes the section/measure highlight — mirror
   the unit-side `SongCanvas.test.js` treatment (section/measure selection now decorates
   nothing). **Keep the panel-reveal half** of the test intact: the Section-row click
   still asserts Section visible / Measure+Note absent, and the Measure-row click still
   asserts Measure+Section visible / Note absent. Keep any `is-selected` event-highlight
   assertion if present (there is none in this test). Rename the test title if it still
   claims it "highlights the canvas."

**Depends on.** T3 (independent files, but sequential base). Order T4 before T5 so the
`.is-selected` rule is reshaped once on a settled SCSS block.

**Traces to.** Req 4 / AC4; KD4; OQ1 (prune `measureNumbersForSection`); R2
(`SongCanvas.test.js` `is-active-*` updates).

**Acceptance.**
- A `kind: "section"` or `kind: "measure"` selection adds no canvas class; a
  `kind: "event"` selection still adds exactly one `.is-selected` (existing
  `"decorates exactly the selected group"` test stays green).
- `measureNumbersForSection` and (if pruned) `scrollGroupIntoView` no longer exist;
  no file imports them. `npm run lint` flags no unused import/var.
- `SongCanvas.test.js` and `selection.test.js` updated; suites green. Net unit count
  **decreases** (four+ `SongCanvas` tests and two `selection` tests removed).
- `specs/editor.spec.js` no longer asserts `[data-measure].is-active-section` (`:585`)
  or `[data-measure].is-active-measure` (`:596`), and the surrounding comments no longer
  describe a section/measure highlight; the panel-reveal assertions in that test are
  retained. The e2e spec no longer encodes the removed highlight behavior.
- `npm run test:unit` green; `npm run lint` clean.

---

## T5 — Shrink the note highlight

**Goal.** The selected-note outline is a subtle, smaller outline (KD5 / Req 5 / AC5).

**Files.** `src/style.scss`.

**Changes.**
1. `style.scss` `.is-selected` rule (now at `:80-83` after T4) — reduce
   `outline: 2px solid #007cba; outline-offset: 2px;` to
   `outline: 1px solid #007cba; outline-offset: 1px;`. Keep the WP admin blue
   `#007cba`. Update the adjacent comment if it characterizes the outline weight.

**Depends on.** T4 (operates on the settled SCSS block with `.is-active-*` already
removed).

**Traces to.** Req 5 / AC5; KD5.

**Acceptance.**
- `.is-selected` is `outline: 1px solid #007cba; outline-offset: 1px;`.
- No unit-test contract change (CSS pixel values aren't asserted) — suite green, count
  unchanged.
- `npm run test:unit` green; `npm run lint` clean.

---

## T6 — Most-specific-first inspector panel order

**Goal.** The block-settings panels render most-specific-first — Note → Measure →
Section → Song for a note; Measure → Section → Song for a measure; Section → Song for
a section; Song only when nothing is selected — with every existing gate verbatim
(KD6 / Req 6 / AC6).

**Files.** `src/edit.js`.

**Changes.**
1. `edit.js` `<InspectorControls>` (`:457-492`) — reorder the JSX children so they
   render in this source order, **moving `SongPanel` from first to last** and keeping
   every gate expression unchanged:
   1. `NotePanel` — gate `resolvedSelection?.kind === "event"`.
   2. `MeasurePanel` — gate `resolvedSelection?.kind === "event" ||
      resolvedSelection?.kind === "measure"`.
   3. `SectionPanel` — gate `resolvedSelection` (truthy).
   4. `SongPanel` — always (no gate).
   Carry each panel's existing props verbatim. Only order changes; no gate, prop, or
   handler is altered.
2. Rewrite the gating comment (`edit.js:459-463`) to describe the new most-specific-
   first order (Note → Measure → Section → Song) and that the gates still produce the
   exact per-kind sets.

**Depends on.** T1 (same file; keep sequential).

**Traces to.** Req 6 / AC6; KD6.

**Acceptance.**
- `InspectorControls` source order is NotePanel → MeasurePanel → SectionPanel →
  SongPanel; gates unchanged.
- `Edit.test.js` asserts panel **presence** by kind, not DOM order, so its
  `kind-tagged panel gating` and `structure tree` selection tests stay green
  (note→all four, measure→Measure/Section/Song, section→Section/Song, none→Song).
- `npm run test:unit` green; `npm run lint` clean.

---

## T7 — Collapse fix: collapsed-override veto (Option B)

**Goal.** Manually collapsing a tree node that contains the current selection is
respected — it does not immediately re-expand — while a newly-selected node's
un-overridden ancestors still auto-reveal (KD7 / Req 7 / AC7). This is the only task
with real logic.

**Files.** `src/edit.js`; `src/editor/StructureTree.js`;
`src/editor/__tests__/StructureTree.test.js`.

**Changes.**
1. `edit.js` — add a second editor-only Set beside `expandedPaths`
   (`edit.js:103`): `const [collapsedOverride, setCollapsedOverride] =
   useState(() => new Set());`. Give it the same immutable add/delete toggle shape as
   `onToggleExpanded` (`:107-117`): an `onToggleCollapsedOverride(path)` that builds a
   fresh Set and adds the path when absent / deletes it when present. Extend the
   editor-only-state comment (`:98-103`) to describe the second Set as the manual-
   collapse veto over auto-reveal, also index-path-keyed best-effort (same wart as
   `expandedPaths`, not new).
2. `edit.js` — thread the new Set and its toggle into `<StructureTree>` (`:432-449`)
   exactly as `expandedPaths` / `onToggleExpanded` are threaded:
   `collapsedOverride={collapsedOverride}`,
   `onToggleCollapsedOverride={onToggleCollapsedOverride}`.
3. `StructureTree.js` — accept the two new props in the destructure (`:108-124`) and
   document them in the JSDoc (`:87-106`).
4. `StructureTree.js` — change `isExpanded` (`:130-132`) from the bare-OR form to the
   veto form, **keeping the live `isSelectionAncestor` call**:
   ```js
   const isExpanded = (path) =>
       isSelectionAncestor(path, selection)
           ? !(collapsedOverride?.has(path) ?? false)
           : (expandedPaths?.has(path) ?? false);
   ```
   Drop the bare `|| isSelectionAncestor` OR. Update the comment above it (`:127-129`)
   and the file-header "Expansion is derived" paragraph (`:28-33`) to describe the new
   rule: an ancestor of the selection is revealed *unless* its path is in
   `collapsedOverride`; a non-ancestor follows `expandedPaths` as before. The two Sets
   govern disjoint regimes, so they never conflict.
5. `StructureTree.js` — route each disclosure toggle to the correct Set by whether the
   row is an ancestor of the current selection. In each label-`Button` `onClick` that
   currently calls `onToggleExpanded?.(path)` (section `:168-171`, measure `:262-269`,
   hand `:365`), replace the bare toggle with a small local dispatcher, e.g.:
   ```js
   const toggleRow = (path) =>
       isSelectionAncestor(path, selection)
           ? onToggleCollapsedOverride?.(path)
           : onToggleExpanded?.(path);
   ```
   defined once near `isExpanded`, and call `toggleRow(path)` from each row's onClick
   (keeping the section/measure rows' accompanying `onSelect?.(…)` call). On an
   ancestor row this **adds** the path to the override on the (collapsing) click and
   **deletes** it on the re-expanding click (plain toggle semantics over the override
   Set); on a non-ancestor row it writes `expandedPaths` exactly as today. (Putting the
   routing in `StructureTree`, which already owns `isSelectionAncestor`, keeps `edit.js`
   a dumb two-Set owner — the design doc leaves this placement to the plan; this is the
   chosen shaping.)
6. **Caution for the writer (decisive per KD7).** Do NOT seed any Set from the
   selection and do NOT add a `useEffect` — Option B is pure render. The fresh-object-
   literal re-selection on a collapse click (`onToggleExpanded` + `onSelect` fire
   together) is exactly why the bare OR re-expanded; the veto Set neutralizes it
   because `isExpanded` is recomputed from current props every render and the override
   wins for an ancestor path. Keep `isSelectionAncestor` live (not snapshotted) so the
   auto-reveal of a *newly* selected branch and index-path-staleness immunity are
   retained verbatim.
7. `StructureTree.test.js`:
   - The existing `renderTree` helper (`:131-179`) wires `onToggleExpanded`; add
     `collapsedOverride` (default `new Set()`) and an `onToggleCollapsedOverride`
     recorder (`calls.toggleOverride`) to its prop set, defaulting `collapsedOverride`
     so existing tests need no change.
   - The existing `"auto-expands the selection's ancestors even with an empty
     expandedPaths"` test (`:418-438`) stays valid (empty override ⇒ ancestor still
     auto-expands) — keep it; confirm it still passes.
   - The existing `"toggles a section's manual expansion when its row is clicked"`
     test (`:409-416`) clicks Section 1 with **no selection** — so Section 1 is not a
     selection ancestor and the click still routes to `onToggleExpanded` (`calls.toggle
     === ["s0"]`). Keep it; confirm green. (If it is changed to a selected-ancestor
     case it would route to the override instead — leave it as the non-ancestor case.)
   - **Add the AC7 test (R1).** Render with a leaf selection (e.g. the left-hand chord
     `s0/m0/leftHand/e0`) so `s0`, `s0/m0`, `s0/m0/leftHand` auto-reveal. Assert the
     ancestor rows + the leaf are visible. Then **click an ancestor row** (e.g.
     "Measure 1") — assert `onToggleCollapsedOverride` fired with that ancestor's path
     (`s0/m0`) and `onToggleExpanded` did **not**. Then **re-render with that path in
     `collapsedOverride`** (the controlled-component analog of the parent applying the
     toggle) and assert the collapsed ancestor's descendants (the hand rows and the
     leaf) are now **hidden** while the ancestor row itself stays visible — i.e. the
     manual collapse beat the auto-reveal.
   - **Add the un-overridden-reveal half of R1.** With a *different* leaf selected and
     an **empty** `collapsedOverride`, assert that leaf's ancestors still auto-reveal
     (the override only vetoes paths it contains) — this guards against a regression
     that suppresses all auto-reveal.

**Depends on.** T6 (edit.js; keep sequential). T2/T3 (StructureTree.js).

**Traces to.** Req 7 / AC7; KD7; R1 (AC7 pinning test + un-overridden-reveal test).

**Acceptance.**
- `isExpanded` is the veto form (`ancestor ? !override : manual`); the bare
  `|| isSelectionAncestor` OR is gone; `isSelectionAncestor` is still called live.
- No `useEffect` is added to `edit.js`; no Set is seeded from the selection.
- Disclosure toggles route to `collapsedOverride` for selection-ancestor rows and to
  `expandedPaths` otherwise; section/measure rows still also `onSelect`.
- New AC7 test passes (manual collapse of a selection ancestor stays collapsed); the
  un-overridden-reveal test passes; the existing auto-expand test still passes.
- `npm run test:unit` green; net `StructureTree.test.js` count **increases** by the
  two added tests; `npm run lint` clean.

---

## Cross-cutting acceptance (end state)

- All four touched source files (`edit.js`, `StructureTree.js`, `SongCanvas.js`,
  `style.scss`) plus the pruned `selection.js` reflect KD1–KD7; no front-end file
  (`render.php`, `view.js`, `notation/*`, `song/*`) is touched (KD8 / AC8).
- No new import or dependency anywhere (AC9). `npm run lint` clean across the repo.
- `npm run test:unit` green. Expected net movement from the 629-test baseline: −several
  (T4 removes `is-active-*`/`measureNumbersForSection`/scroll tests) and +2 (T7 adds
  the AC7 + un-overridden-reveal tests); the suite count stays 20.
- The e2e suite (`specs/editor.spec.js`, run via `wp-env`, not part of the per-task
  `npm run test:unit` gate) is updated in lock-step under R2: T1 removes the stale
  `openStructureTree` toggle calls / fixes its doc-comment for open-by-default, and T4
  drops the `is-active-*` highlight assertions and their comments. No new e2e behavior is
  required beyond reflecting open-by-default and the removed highlight. T6's panel reorder
  does not touch the e2e suite (its panel assertions test presence by kind via
  `toBeVisible`/`toHaveCount`, not DOM order), so it is correctly left out of e2e scope.
- Manual editor verification (out of unit scope, for the verify phase): tree open on
  selecting a block; rows indent by depth; per-row action buttons themed; selecting a
  section/measure highlights nothing while a note shows a thin outline; panels render
  most-specific-first; manually collapsing a selected note's ancestor stays collapsed.
