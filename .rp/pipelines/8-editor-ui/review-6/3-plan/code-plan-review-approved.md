# Review 6 — Code-plan Review (APPROVED)

_Adversarial review of `3-plan/code-plan.md` for review 6 of the Piano block editor-UI
feature (issue #8, PR #22), by code-plan-reviewer-r6. Approval is of the revision at commit
`3dedc0c` ("Extend Edit.test.js drill-down rework to all ancestor-label sites"), the third
iteration after two rejections (`code-plan-review-1-rejected.md`,
`code-plan-review-2-rejected.md`). Inputs: the approved `1-spec/spec.md`, the approved
`2-design-doc/design-doc.md` (+ its `design-doc-review-approved.md`), the two prior
rejections, the revised plan, and the baseline code on branch `worktree-8-editor-ui`
(`src/editor/`, `src/edit.js`, `src/style.scss`, `test/mocks/`, `src/**/__tests__/`, the
Playwright specs)._

## Verdict

**APPROVED.** The plan implements every design decision (DD1–DD10 + DD-CSS) and satisfies
every spec requirement (R-A1…R-E8); its task sequencing keeps the unit suite and `npm run
build` green at every commit boundary; the Depends-on edges are real and sufficient; each
task's Acceptance is objectively checkable against named tests, grep assertions, and
build/check commands; and the load-bearing feasibility claims verify true against the branch.
All blocking issues raised across the two prior iterations are resolved, each confirmed
against the actual code rather than taken on faith.

## How the three review iterations converged

- **Iteration 1 (rejected):** three blocking defects, all from adopting the DD4 select-only
  label without propagating its test-harness fallout — B1 (T4 imports `isRTL`, the i18n mock
  lacks it → every tree render throws), B2 (`Edit.test.js` drill-down breaks under select-only
  labels but T4 excluded it and asserted it green), B3 (the e2e drill chains assume
  label-click-expands).
- **Iteration 2 (rejected):** B1, B3, N1, N2, N3, and a cross-helper chevron-locator bridge
  all correctly fixed and verified; B2 fixed in mechanism but mis-scoped — the plan's "four
  tests change / no other test changes" claim missed the `describe("Edit — structure tree")`
  inline chains at lines 552 and 562 (and undercounted `selectLoneNote`'s callers).
- **Iteration 3 (this approval):** the B2 scoping is corrected to a **general rule** ("any
  `Edit.test.js` site that reaches a child row by clicking an ancestor label moves to the
  expand helper"), names the previously-missed sites (552, 562), names the safe single-select
  sibling (541), and corrects the seven-caller framing for `selectLoneNote`. The change #9
  body and the T4 Acceptance now agree.

## Blocking issues — all resolved (verified against the code)

- **B1 — `isRTL` mock (T3).** T3 adds `test/mocks/wordpress-i18n.js` to its Files and a change
  #4 adding `const isRTL = () => false;` + the export; T3 Acceptance asserts the i18n mock
  exports a callable `isRTL`. Verified the mock currently exports only `__`/`_x`/`sprintf`, so
  the addition is necessary; `() => false` matches the real package's no-RTL-locale default,
  so jest exercises the correct LTR chevron branch (`chevronRightSmall`), RTL being
  runtime/e2e-only. T4 change #1 records the dependency. Resolved.

- **B2 — `Edit.test.js` drill-down under select-only labels (T4 change #9 + Acceptance).** The
  general rule now covers every ancestor-label-expands site. Verified against `Edit.test.js`:
  the breaking sites are `selectLoneNote` (386–391, with seven callers at 342/360/396/419/436/
  466/503), the inline per-hand Add-note chain (312–314), and the `describe("Edit — structure
  tree")` inline chains at 552 (`Section 1`→expand, `Measure 1`→select) and 562 (`Section 1`/
  `Measure 1`/`Right hand`→expand, `C`→select); the safe single-select sibling is 541. All are
  now named correctly and routed to the expand helper (chevron click or seeded `expanded`
  Set), with downstream assertions unchanged. Resolved.

- **B3 — e2e drill-down via chevron (T7 change #2).** T7 re-points the drill chains (lines
  470–473, 410–415, 585–595) through an `expandRow` helper, splits select-and-expand label
  clicks into explicit expand + select, requires a stable tree-scoped chevron locator, reasons
  about the not-a-button chevron and the discovery-only validation, and corrects the `treeRow`
  JSDoc to drop "label toggles expansion." Resolved.

## SHOULD items — all folded in

- **N1 (T5 change #3):** states the seed (not the selection) reveals a new deep node since
  auto-reveal-on-select is dropped, and leaves `onAddNote`'s pre-existing missing `kind` tag
  as-is (out of scope). Matches `edit.js:229` vs `:355/369/394`.
- **N2 (T2 Acceptance):** pins the tiered `ContextEditor` `Advanced` `ToolsPanel` `label` to
  exactly `"Advanced"` and keeps the Note-language select outside `ContextEditor`, citing
  `SongPanel.test.js:263–274`. Matches the test (the ToolsPanel mock maps `label`→`aria-label`).
- **N3 (T3 stub bullet):** states `TreeGridCell`/`TreeGridItem` call their render-prop child
  with `{}`, so `ref`/`tabIndex`/`onFocus` are `undefined` in jest, the spread is harmless,
  and T4 unit tests assert structural outcomes only. Matches `wordpress-components.js:402–407,
  419–420`.

## Cross-helper chevron-locator bridge (added in iteration 2) — feasible

T4 change #5 requires a stable locator hook on the chevron (e.g. a
`wp-block-piano-block-piano__tree-expander` class on the `<span aria-hidden="true" onClick=…>`
wrapping the `<Icon>`), shared by the jest `expandRow` (B2) and the e2e `expandRow` (B3),
avoiding brittle positional selectors. Verified the jest half works: the components-mock
`Icon` is `({ icon, size, ...rest }) => createElement("span", { "data-icon": true, ...rest })`
(`wordpress-components.js:323–324`), spreading `...rest`, so a `className` and pointer
`onClick` on the chevron reach the jsdom DOM and are clickable.

## Coverage — every requirement lands in a task (spot-checked)

- **R-A1 / R-A2 / R-A3** (TreeGrid foundation, native per-row `DropdownMenu`, non-focusable
  stock chevron, carets gone) → T4, with the boundary audit in T7. The CRITICAL correctness
  point — `edit.js` feeds the same `resolvedSelection` (carrying `eventIndex`) to Note +
  Measure + Section panels (`edit.js:455–472`), so the splice must dispatch by caller-declared
  depth, never deepest-coord-wins — is carried verbatim in T1 and is right.
- **R-B1 / R-B2** (single `expanded` Set, no veto, auto-reveal dropped; coordinate-derived
  keys) → T4 (tree) + T5 (`edit.js`), with a shared `expansionKey` to prevent drift.
- **R-B3 / R-B4** (inspector de-dup; meaningful net reduction) → T1 (clamp/splice/omit
  consolidation; the three typed splice faces each destructure only their own coords) + T2
  (`SongPanel` composes `ContextEditor`, dropping the ~60-line fork, with the per-member
  tiering prop). The duplication is byte-for-byte as claimed (`clampInt` 3×, `toNumber`/
  `toBoundedInt` 2×, the three emit-splice chains, the SongPanel↔ContextEditor fork).
- **R-C1 / R-C2 / R-C3** (level-driven `[aria-level]` indent; recolor-only highlight, no
  scale-coupled number; layout-glue only) → T6, with `SongCanvas` untouched so the emitted
  SVG stays byte-identical. The source lines match (`--pb-tree-depth` at `style.scss:65`, the
  ÷8 outline + comment at `:98–112`, the 16em rail at `:54`, `@font-face` at `:16`).
- **R-D1 / R-D2 / R-D3** (inline placement; stacked panels kept; one primary action locus per
  action) → preserved/handled across T4/T5/T7.
- **R-E1…R-E8** (byte-identical publish; only existing `@wordpress/*`; full build/edit; valid
  by construction; field reachability; per-kind settings; raw-JSON unchanged; keyboard parity)
  → preserved by the panel-test regression net (T1/T2), the recolor-only highlight + untouched
  `render.spec.js` (T6/T7), the externalized `@wordpress/icons` mapping with no new dep (T3/T7
  audit), and the every-row-element-stays-a-TreeGrid-focusable composition (T4) proven by e2e
  (T7).

## Sequencing — green at every boundary

T1→T2 (behavior-preserving inspector de-dup, guarded by unchanged panel tests) → T3 (test
scaffolding only; mocks unused until T4, so the suite count is unchanged) → T4 (the
select-only-label rewrite ships WITH its full `Edit.test.js`/`StructureTree.test.js` rework in
the same commit, so its boundary is green) → T5 (`edit.js` state collapse + mutation-site
seeding) → T6 (CSS rework matching the delivered DOM) → T7 (e2e migration + final integration
check + boundary audit). The Depends-on edges are real, and a fresh code-writer could execute
any one task from its own block.

---

**VERDICT: APPROVED.** All three blocking issues (B1 isRTL mock, B2 `Edit.test.js`
drill-down scope, B3 e2e chevron drill-down) and all three SHOULD items (N1/N2/N3) are
resolved and verified against the code; coverage of DD1–DD10 + DD-CSS and R-A1…R-E8 is
complete; sequencing keeps the suite and build green at every commit; and every task's
acceptance is objectively checkable. The plan is ready for the code phase.
