# Design-doc review — review-4 (Structure-tree polish): APPROVED

**Verdict:** Approved. The design doc is complete, sound, aligned with the spec, and
buildable against the live `src/` — two code-writers would build the same thing.

## What was verified (against live code, not just the doc's own claims)

### Coverage — every Req/AC 1–9 has a design decision
- **Req 1 / AC1** — KD1. `edit.js:102` is `useState(false)`; `edit.js:12` imports only
  `useMemo, useState` (verified: `grep -c useEffect src/edit.js` → 0), so nothing
  re-forces the tree open and a manual close already sticks. The flip to `useState(true)`
  is the whole change. "Open by default = on mount, not persisted" is consistent with
  `mode`/`selection`/`expandedPaths` and satisfies AC1's session-scoped wording.
- **Req 2 / AC2** — KD2. Rows pass explicit `level={1..4}` (StructureTree.js:156/250/354/407);
  no SCSS rule reads depth today, so rows are flush-left. The chosen `level`-prop +
  inline `--pb-tree-depth` CSS var (primary) avoids any runtime-`aria-level` DOM
  assumption; the `[aria-level="N"]` selector is correctly noted as the fallback.
- **Req 3 / AC3** — KD3. Label/disclosure buttons already carry `variant="tertiary"`;
  the per-row action `Button`s (StructureTree.js:182-217/280-315/375-382/436-485) pass an
  `icon` with **no** `variant`, so they render bare — exactly as described. Adding
  `variant="tertiary"` (keeping `isDestructive` on removes) is the right fix.
- **Req 4 / AC4** — KD4. `SongCanvas.decorateSelection` (SongCanvas.js:114-163) has the
  section branch (119-133), measure branch (144-151), the **shared** `measureNumber`
  computation (135-142, also consumed by the event branch), and the event branch
  (153-162). Removing only the section + measure branches and the matching
  `.is-active-*` CSS (style.scss:85-98), keeping `.is-selected`, is correct.
- **Req 5 / AC5** — KD5. The sole rule is style.scss:80-83 (`outline: 2px / offset 2px`);
  reducing to `1px / 1px` is a clean single-rule change.
- **Req 6 / AC6** — KD6. Source order in `InspectorControls` is Song(458) → Note(464) →
  Measure(474) → Section(483) — the reverse of AC6; panels render in JSX order (no
  priority prop). Reordering to Note → Measure → Section → Song with **every gate
  verbatim** produces the exact per-kind sets AC6 specifies. Confirmed `Edit.test.js`
  asserts panel *presence* (`panelByTitle … not.toBeNull`), not DOM order, so the
  reorder changes no test contract — as the doc claims.
- **Req 7 / AC7** — KD7. Analyzed in depth below.
- **Req 8–9 / AC8–AC9** — KD8. None of the four target files is on the front-end render
  path; no new import is introduced (the components are all already imported,
  StructureTree.js:35-42); the indent is CSS/inline-style only. Boundary clean by
  construction.

### The crux (KD7 Option B) — checked adversarially, holds on both halves of AC7
Root cause is confirmed exhaustively against live code: `isExpanded` (StructureTree.js:130-132)
is `manual OR isSelectionAncestor`; the `|| isSelectionAncestor` term is the **sole**
re-reveal mechanism; there is no `useEffect` in `edit.js`; `setExpandedPaths` is written
only in `onToggleExpanded`. The section/measure label `onClick` does **both**
`onToggleExpanded(path)` and `onSelect({…})` (StructureTree.js:168-171/262-269), and
`onSelect` is `setSelection` (edit.js:439), so a collapse click re-selects the node and
re-adds its own path to the ancestor set — the OR then re-expands it. Exactly AC7's bite.

Option B —
`isExpanded = isSelectionAncestor(path, selection) ? !collapsedOverride.has(path) : expandedPaths.has(path)`,
with the toggle writing the override for an ancestor-of-selection row and `expandedPaths`
otherwise — is correct on both required behaviors:
- **(a) Manual collapse of a selection-ancestor sticks.** After clicking the ancestor
  section row, `isSelectionAncestor("s0", {kind:"section", sectionIndex:0})` is `true`
  (a node is its own ancestor), so the row is governed by the override branch; the toggle
  added `"s0"` to `collapsedOverride`, so `isExpanded("s0") = !true = false`. Holds whether
  the post-click selection is the section itself (the select-and-toggle case) or the
  original note under it — in both, `"s0"` is in the live ancestor set.
- **(b) A newly-selected node's ancestors still auto-reveal when not overridden.** With no
  override entry, `isExpanded(ancestor) = true ? !false : … = true`. The existing
  "auto-expands the selection's ancestors" test (StructureTree.test.js:418-438) exercises
  this with empty Sets and stays green under B.

The read-side routing in `isExpanded` (live `isSelectionAncestor`) is what guarantees
correctness, so the doc's "lives in edit.js or StructureTree is a shaping detail" is
acceptable: the contract (ancestor row → override write; read routes by live ancestry; the
two Sets govern disjoint regimes) is stated explicitly and is what a planner needs.

**Option A's footgun is accurately recorded.** `onSelect` is `setSelection` and the
selection literal (StructureTree.js:170) is fresh per click; React bails only on `Object.is`,
so a value-equal new reference always re-renders and any effect keyed on `selection`
re-runs. A seed effect keyed on `selection` would re-add the path the toggle just deleted —
reintroducing the bug. The doc's requirement that Option A key on a *derived
ancestor-identity string* (seeding from `resolvedSelection`) is the correct caveat, and B
sidesteps it entirely (pure render, no effect, no dep-key). The B-over-A justification is sound.

### Boundary — all changes editor-side
The four target files (`edit.js`, `editor/StructureTree.js`, `editor/SongCanvas.js`,
`style.scss`) are all editor-only. None of `src/render.php`, `src/view.js`, `src/song/*`,
`src/notation/*` (incl. `svg.js`) is touched by any KD; the SVG emit and its `data-*` hooks
are untouched, so the front end renders byte-identically (AC8). No new dependency — every
referenced component is already imported and the indent is CSS/inline-style only (AC9).

### Other items — feasible, correct, accurate
- OQ1: `measureNumbersForSection` (selection.js:185) is consumed in production only by the
  removed section branch (SongCanvas.js:120) — verified via grep; it genuinely becomes dead
  code after KD4. Prune-or-leave is correctly non-blocking.
- R1 (collapse fix) and R2 (tests encoding to-be-changed behavior) are real and accurately
  scoped: `SongCanvas.test.js` has `is-active-measure`/`is-active-section` decoration tests
  (lines 180/198/218) whose assertions must invert; `Edit.test.js` opens the tree by clicking
  "Structure" (lines 311/386/456), reflecting today's closed-on-mount default that Req 1
  flips. The doc flags both as plan/code work, not design blockers — correct.

## Rationale
Every requirement and acceptance criterion maps to a concrete, localized, editor-side
decision with file:line evidence that matches the live `src/`. The one change with real
logic — the collapse fix — has a correct root-cause analysis and a fix (Option B) that
provably satisfies both halves of AC7 while sidesteps the accurately-characterized Option A
footgun; the recorded alternative is gated by the right caveat. The boundary and dependency
constraints hold by construction (no front-end file touched, no new import). Risks, the open
question, and the test-update implications are reasonable and accurate. The doc is
unambiguous enough that two code-writers would build the same thing. Approved.
