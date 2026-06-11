# Review 6 — Code-plan Review (REJECTED, iteration 1)

_Adversarial review of `3-plan/code-plan.md` for review 6 of the Piano block editor-UI
feature (issue #8, PR #22), by code-plan-reviewer-r6. Inputs: the approved `1-spec/spec.md`,
the approved `2-design-doc/design-doc.md` (+ its `design-doc-review-approved.md`), the plan
under review, and the baseline code on branch `worktree-8-editor-ui` (`src/editor/`,
`src/edit.js`, `src/style.scss`, the `test/mocks/`, the unit `__tests__/`, and the Playwright
specs). Lenses: coverage, sequencing, feasibility against the code, acceptance quality._

## Verdict

**REJECTED.** The plan is close — coverage of DD1–DD10 + DD-CSS and R-A1…R-E8 is complete
and the §"Coverage check" matrix is accurate; the single most important correctness point
(the explicit-depth splice in T1) is carried verbatim and is right; T1, T2, T3-the-icons-
half, and T6 are feasible and well-specified; T2 correctly handles the SongPanel tiering
subtlety and the load-bearing "Note language NOT in Advanced" test. But there are **three
concrete blocking defects**, all the same root omission seen three ways: the plan adopts the
DD4 **select-only label** (correctly) but does not propagate its consequences into the test
harness. As written, T4's commit boundary would be **red**, violating the plan's own
green-at-every-boundary invariant. Each fix is small and local; the plan structure is sound.

---

## Blocking issues (each tied to a task ID)

### B1 — T3/T4: the `isRTL` mock is missing; T4's `StructureTree` import throws in jest

**Where.** T4 change #1: "add `isRTL` from `@wordpress/i18n` (for the RTL chevron)." T3 is
the task whose entire job is "add the test-harness stubs the tree redesign needs."

**The problem.** `@wordpress/i18n` is mapped in `jest.config.js` to
`test/mocks/wordpress-i18n.js`, which exports **only** `__`, `_x`, `sprintf` — there is **no
`isRTL`** (verified: `grep isRTL` across `src/ test/ specs/` returns nothing; the mock file
has 25 lines and three exports). When the rewritten `StructureTree.js` does
`import { isRTL } from "@wordpress/i18n"` and calls `isRTL()` at render time to pick the
collapsed-chevron icon, `isRTL` is `undefined` and the call throws
`TypeError: isRTL is not a function`. That throw happens on **every** render of the
redesigned tree, so it fails the entire rewritten `StructureTree.test.js` **and**
`Edit.test.js` — i.e. T4's commit boundary is red, not green.

**Why the plan misses it.** T3's "Files" and "Changes" add `wordpress-icons.js`, the
`jest.config.js` mapping, and the `DropdownMenu`/`MenuGroup`/`MenuItem` component stubs, but
say nothing about `@wordpress/i18n`. The plan's own "Baseline facts" section enumerates the
mocks but never checks the i18n mock's surface against T4's new `isRTL` import.

**Required fix (T3, and reflect in T4).** In T3, add `isRTL` to `test/mocks/wordpress-i18n.js`
(e.g. `const isRTL = () => false;` plus `isRTL` in `module.exports`) so the import resolves
and the LTR branch is exercised in jest. Add it to T3's Files list and Acceptance ("the i18n
mock now exports `isRTL`"). In T4's change #1, note that the `isRTL` import depends on this
T3 addition. (Alternatively, if the writer decides the RTL handling is not worth a mock,
T4 must not import `isRTL` at all and must hard-code the LTR chevron — but then DD4's
"RTL-aware" chevron is dropped and that deviation should be stated. Adding the one-line mock
is the cleaner path and keeps DD4 intact.)

### B2 — T4: select-only labels break `Edit.test.js`, which T4 excludes from its files yet asserts green

**Where.** T4 change #5 (label `Button` is "select only, NO toggle") and T4's `edit.js`
bridge note #8: "Confirm `Edit.test.js` still passes (it should…)… prefer to keep
`Edit.test.js` changes out of T4." T4's Acceptance: "`Edit.test.js` passes."

**The problem.** `Edit.test.js` drives the tree by **clicking label rows to expand them**.
Its `selectLoneNote` helper (lines 386–389) and the "seeds a note from the structure tree's
per-hand Add note" test (lines 305–334) do:

```
clickByText(container, "Section 1");   // expects this to EXPAND the section
clickByText(container, "Measure 1");   // only visible if Section 1 expanded
clickByText(container, "Right hand");  // only visible if Measure 1 expanded
```

Today the label `onClick` calls `toggleRow(...)` **then** `onSelect(...)`
(`StructureTree.js:194–197`), so clicking the label expands-and-selects, surfacing the child
rows. T4 makes the label **select-only** — the toggle moves to the non-focusable chevron. So
after T4, `clickByText(container, "Section 1")` selects without expanding, "Measure 1" never
renders, and the next `clickByText(container, "Measure 1")` calls `.click()` on `undefined`
and throws. This breaks at minimum: the test at line 305, and every test using
`selectLoneNote` (lines 336 and 357). T4's commit is therefore red.

Worse, `Edit.test.js`'s helpers cannot drive the new disclosure: `treeRowButton`/`clickByText`
(lines 109–118) select **`button`** elements and caret-strip the text; the new chevron is a
non-focusable `<span>`/`<Icon>` sibling (the components-mock `Icon` renders `<span data-icon>`),
so there is no button to click for expansion. This is a genuine rework of `Edit.test.js`'s
drill-down helper (add an expand-the-row helper that clicks the chevron span, or seed the
`expanded` Set / call the bridge so children render), not the "minimal assertion" touch T4
anticipates.

**Required fix (T4).** Add `src/editor/__tests__/Edit.test.js` to T4's Files. Specify that
T4 must update `Edit.test.js`'s tree-drill helpers for select-only labels: expansion now
happens via the chevron (a non-focusable `<span data-icon onClick>`), so the test must locate
and click the chevron to reveal child rows (or drive expansion through the `expanded` Set
passed in the T4 bridge), and the `selectLoneNote` / "seeds a note" / "clears a stale
selection" flows must be rewritten accordingly. T4's Acceptance must list the specific
`Edit.test.js` tests that change (the ones routing through `selectLoneNote` and the per-hand
Add-note flow), not just "`Edit.test.js` passes."

### B3 — T7: the e2e drill-down chains assume label-click-expands; the migration never re-points them at the chevron

**Where.** T7 changes #1–#3 cover the row-label locator, the DropdownMenu action helper, and
the hand-row Add-note button — but not the **navigation** chains.

**The problem.** `specs/editor.spec.js` drills into the tree the same way `Edit.test.js`
does — by clicking label rows to expand:

```
await treeRow(editor, "Section 1").click();   // expand section
await treeRow(editor, "Measure 1").click();   // expand measure
await treeRow(editor, "Right hand").click();  // expand hand
await treeRow(editor, "C").click();           // select the note
```

(e.g. lines 470–473, and the kind-gating walk at 583–595.) Under DD4's select-only label,
`treeRow(editor, "Section 1").click()` selects but no longer expands, so "Measure 1" is not
present to click and the chain fails. T7's migration list addresses the action menu and the
plain-name locator but is silent on the fact that **expansion now requires clicking the
chevron** (or otherwise revealing the row) before the child `treeRow` is queryable. Even
under discovery-only validation, the spec must encode the correct interaction model so it is
coherent against the delivered DOM (and so a later run is meaningful); leaving the drill-down
chains as-is contradicts T4's behavior.

**Required fix (T7).** Add an explicit migration step: the row drill-down must expand via the
chevron affordance (the non-focusable disclosure element T4 renders beside the label),
because the label is now select-only. Specify how to locate the chevron in Playwright (it is
not a button — likely a `[data-icon]`/`aria-hidden` element with a pointer `onClick`; the
writer must pick a stable locator, e.g. a tree-scoped CSS/test-id, and reason about it the
same way T7 already asks for the DropdownMenu portal). Update `treeRow`'s JSDoc note that the
row label no longer toggles. (Hand-group rows still toggle on their button click per T4, so
that one stays as a button click.)

---

## Non-blocking observations (the writer SHOULD address; not gating)

- **N1 (T4/T5): `onAddNote`'s auto-selection lacks a `kind` tag — confirm the seed and the
  tree's `isExpanded` still line up.** In `edit.js`, `onAddNote` sets
  `setSelection({ sectionIndex, measureIndex, hand, eventIndex })` (line 229) with **no**
  `kind`, whereas `onDuplicateNote`/`onDuplicateMeasure`/`onDuplicateSection` set `kind`
  (lines 355/369/394). T5 seeds ancestor keys at these three sites — that is independent of
  the `kind` tag and is fine. But since auto-reveal-on-select is dropped, the new note is
  visible **only** because of the seed; the writer should keep `onAddNote`'s existing
  selection shape as-is (do not "fix" the missing `kind` in this review — it is a pre-existing
  quirk and out of scope) and rely solely on the T5 seed for visibility. A one-line note in
  T5 that the seed (not the selection) is what reveals the new node would prevent a writer
  from assuming auto-reveal still helps here.

- **N2 (T2): pin the tiered `Advanced` `ToolsPanel` label to exactly `"Advanced"`.**
  `SongPanel.test.js:263–274` asserts `[aria-label="Advanced"]` exists and does NOT contain
  the Note-language select (the ToolsPanel mock maps `label`→`aria-label`). When
  `ContextEditor` renders `layout="tiered"`, its advanced `ToolsPanel` must carry
  `label={ __("Advanced", …) }` verbatim, and `SongPanel` must keep the Note-language select
  a sibling **outside** `ContextEditor`. T2 already describes both; just make "the tiered
  `Advanced` ToolsPanel's `label` is exactly `Advanced`" an explicit T2 acceptance bullet so
  the writer cannot rename it and silently break the pinned assertion.

- **N3 (T3): the components mock calls `TreeGridCell`'s render-prop child with `{}`.** The
  mock's `TreeGridCell` invokes `children({})` (line 406), so the `{ ref, tabIndex, onFocus }`
  T4 forwards to the `DropdownMenu` `toggleProps` and to the hand-row Add-note `Button` are
  all `undefined` under test. The T3 `DropdownMenu` stub spreads `toggleProps` onto the
  trigger, which is harmless when those are `undefined`, and the `Button` mock already
  swallows unknown props — so this works, but T3 should state it explicitly (the roving-
  tabindex props are `undefined` in jest by construction; the real wiring is e2e-only) so the
  writer does not try to assert on `ref`/`tabIndex` in a unit test.

---

## What I verified as correct (so the rework stays scoped)

- **Baseline duplication is exactly as T1/T2 claim.** `clampInt` is defined 3× (`NotePanel.js:73`,
  `PitchEditor.js:98`, `HandConfigEditor.js:196`); `toNumber`/`toBoundedInt` 2× (`ContextEditor.js:54/63`,
  `SongPanel.js:51/60`); `emitBlock` lives in `inspector/emit.js` with the omit-empty body T1
  consolidates; the three emit-splice chains and the SongPanel↔ContextEditor fork are present.
- **The CRITICAL explicit-depth splice is carried right.** `edit.js:455-472` passes the same
  `resolvedSelection` (carrying `eventIndex`) to Note+Measure+Section panels; T1's three typed
  faces each destructure only their own coords, structurally preventing the mis-splice. The
  reviewer-flagged "never a deepest-coord-wins setAtPath" instruction is reproduced verbatim.
- **`@wordpress/icons` is absent from `src/`, `package.json`, and the mocks** — T3's first-use
  mock + `^@wordpress/icons$` mapping is the correct approach, and the build externalizes it
  via `DependencyExtractionWebpackPlugin` so no runtime dep is added (R-E2 holds).
- **The components mock has no `DropdownMenu`/`MenuGroup`/`MenuItem`** (it stops at
  `__experimentalTreeGridItem`, lines 437–440) — T3's stub additions are needed and correctly
  scoped; the DOM-honest "render children unconditionally" approach matches the existing
  TreeGrid/ToolsPanel mock convention.
- **T2's SongPanel tiering** matches design-doc-review note 1: `SongPanel` is per-member
  (`beatUnit` + each hand config as separate `ToolsPanelItem`s in `Advanced`), not
  SectionPanel's coarse wrap; the plan correctly requires the prop to reproduce per-member
  tiering and pins the "Note language NOT in Advanced" test.
- **`aria-current` preservation (design-doc-review note 2)** is explicitly required in T4
  change #5 and its Acceptance, and `StructureTree.test.js:491–502` pins it — covered.
- **T6 CSS** matches the source exactly: `--pb-tree-depth` (`style.scss:65`), the
  `outline: 0.125px`/`outline-offset: 0.25px` + ÷8/`SP_PX` comment (`:98–112`), the
  `width: 16em` rail (`:54`), and `@font-face` (`:16`). `SongCanvas.decorateSelection` adds
  `is-selected` (`:118`) and is untouched — recolor-only highlight is sound and byte-identical
  publish holds. `SongCanvas` imports `SP_PX` for width math only (`:31`), unrelated to the
  highlight, and stays.
- **T7's `render.spec.js` byte-untouched** and the boundary audit (no `privateApis`/`lock`/
  `PrivateListView`, no new dep, no published-output change) are correct and complete.

---

**VERDICT: REJECTED.** Fix before re-submission:

- **B1 (T3, reflect in T4):** add `isRTL` to `test/mocks/wordpress-i18n.js` (T4 imports it;
  the mock omits it, so the rewritten tree throws in jest).
- **B2 (T4):** add `Edit.test.js` to T4's Files and rework its tree-drill helpers for
  select-only labels (expansion now via the non-focusable chevron, not the label click);
  enumerate the specific `Edit.test.js` tests that change in Acceptance.
- **B3 (T7):** add a migration step re-pointing the e2e drill-down chains to expand via the
  chevron (the select-only label no longer expands), with a stable chevron locator.

The three SHOULD items (N1 `onAddNote` seed-not-select note; N2 pin the `Advanced` label;
N3 state the `{}` render-prop in jest) are non-gating polish. Everything else in the plan is
sound and need not change.
