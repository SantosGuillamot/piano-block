# Review 6 — Code-plan Review (REJECTED, iteration 2)

_Adversarial re-review of `3-plan/code-plan.md` for review 6 of the Piano block editor-UI
feature (issue #8, PR #22), by code-plan-reviewer-r6. This re-review covers the revision at
commit `ad2852a` ("Revise code plan for select-only-label test fallout"), which responded to
the iteration-1 rejection (`code-plan-review-1-rejected.md`). Inputs: the approved
`1-spec/spec.md`, the approved `2-design-doc/design-doc.md`, the prior rejection, the revised
plan, and the baseline code on branch `worktree-8-editor-ui`._

## Verdict

**REJECTED.** The revision resolves **B1 fully**, **B3 fully**, all three SHOULD items (N1,
N2, N3), and adds the cross-helper chevron-locator bridge — all correct and verified against
the code. **B2 is resolved in mechanism but wrong in scope:** the plan's T4 enumeration of
"the four specific tests that change" and its explicit claim that **"No other `Edit.test.js`
test … changes"** are **factually false**. There is an entire `describe("Edit — structure
tree")` block (`Edit.test.js:513–574`) — not routed through `selectLoneNote` — whose tests at
lines **552** and **562** drill down by label-clicks that expect expansion, exactly the
breakage B2 is about. Taken literally, the plan tells the writer those tests don't change, so
they would be left red and T4's commit boundary would fail. This is a single, surgical
scoping correction; everything else in the revision is sound.

---

## Blocking issue

### B2-followup — T4: the "no other `Edit.test.js` test changes" claim is false; the `Edit — structure tree` describe block (lines 552, 562) also breaks under select-only labels

**Where.** T4 change #9 enumerates four tests (lines 305, 336, 357, 394) and the T4
Acceptance's last `Edit.test.js` bullet states: _"No other `Edit.test.js` test (JSON-mode,
empty-seed, invalid-routing, etc.) changes."_

**The problem.** `Edit.test.js` has a second cluster of tree-drill tests that the revision
overlooked — the `describe("Edit — structure tree")` block at lines 513–574, which uses
**inline `clickByText` chains, not `selectLoneNote`**:

- **`"selecting a tree measure row reveals the Measure and Section panels"` (line 552):**
  ```
  clickByText(container, "Section 1");   // expects EXPAND
  clickByText(container, "Measure 1");   // only present if Section 1 expanded
  ```
  Under DD4's select-only label, the first click selects without expanding, "Measure 1" is
  not rendered, and `clickByText(container, "Measure 1")` calls `.click()` on `undefined` →
  **throws**.

- **`"selecting a tree note row reveals all three per-level panels"` (line 562):**
  ```
  clickByText(container, "Section 1");
  clickByText(container, "Measure 1");
  clickByText(container, "Right hand");
  clickByText(container, "C");
  ```
  Same breakage — the whole chain depends on label-click-expands. **Throws.**

(The sibling test `"selecting a tree section row reveals only the Section panel"` at line 541
does a single `clickByText("Section 1")` and only asserts the Section panel, so it needs
selection but not expansion — it stays green. That is the only one of the three that is safe.)

These two tests do **not** go through `selectLoneNote`, so the plan's "Rewrite `selectLoneNote`"
instruction does not reach them, and the plan's enumeration + "no other test changes"
sentence actively tells the writer to leave them alone. Taken literally, T4's commit is red.

**Required fix (T4 change #9 and Acceptance).**
- Correct the scoping claim: the `describe("Edit — structure tree")` block at lines 552 and
  562 also drills via label-click-expands and **must** be re-pointed through the same expand
  helper (chevron click, or a seeded `expanded` Set), exactly like `selectLoneNote`. Add these
  two tests to the enumerated change list. Line 541 (`"…section row reveals only the Section
  panel"`) stays unchanged (selection-only).
- Reframe the rule generally rather than test-by-test: **every `Edit.test.js` site that today
  reaches a child row by clicking an ancestor label must switch to the expand helper, because
  the select-only label no longer expands.** That is the durable statement; the line-number
  list is an aid, not the spec. (Concretely the breaking sites are `selectLoneNote` at 386–391
  and the inline chains at 552 and 562; the safe sites are single-label selection clicks like
  541.)

**Note — `selectLoneNote` has more callers than the plan implies (not blocking, but tighten).**
The revision names four tests, but `selectLoneNote(container)` is called at lines 342, 360,
396, 419, 436, 466, 503 — **seven** call sites (the "onRemoveNote …" tests at 462/481 are two
of the unnamed ones). This is **not** a correctness gap — reworking the single `selectLoneNote`
helper fixes all seven callers at once, and the plan does say "Rewrite `selectLoneNote`" — but
the Acceptance's four-item enumeration undersells the blast radius and pairs badly with the
false "no other test changes" sentence. Folding the fix above (state the general rule; the
helper rework covers all its callers) resolves both.

---

## What the revision fixed correctly (verified against the code)

- **B1 (isRTL mock) — RESOLVED.** T3 now adds `test/mocks/wordpress-i18n.js` to its Files and
  a change #4 adding `const isRTL = () => false;` + the export; T3 Acceptance asserts the i18n
  mock exports a callable `isRTL`; T4 change #1 records the dependency and that jest exercises
  the LTR branch (`chevronRightSmall`) while RTL is e2e-only. `() => false` matches the real
  package's no-RTL-locale default, so the LTR branch is the correct one to exercise. This is a
  test-only mock change, no production dep. Correct and complete.

- **B3 (e2e drill-down via chevron) — RESOLVED.** T7 now has a change #2 that re-points the
  drill-down chains (lines 470–473, 410–415, 585–595) through an `expandRow` helper, splits
  select-and-expand label clicks into explicit expand + select, requires a stable tree-scoped
  chevron locator, reasons about the not-a-button chevron and the discovery-only validation,
  and updates the `treeRow` JSDoc to drop "label toggles expansion." T7 Acceptance updated to
  match. The hand-row Add-note reachability (must `expandRow` to the hand level first) is
  called out in change #4. Correct and complete.

- **Cross-helper chevron-locator bridge — ADDED and feasible.** T4 change #5 now requires a
  stable locator hook on the chevron (e.g. a `wp-block-piano-block-piano__tree-expander`
  class on the `<span aria-hidden="true" onClick=…>` wrapping the `<Icon>`), shared by B2's
  jest `expandRow` and B3's e2e `expandRow`, avoiding brittle `nth`/`data-icon`-only
  selectors. **Verified the jest half works:** the components-mock `Icon` is
  `({ icon, size, ...rest }) => createElement("span", { "data-icon": true, ...rest })`
  (`wordpress-components.js:323–324`) — it spreads `...rest`, so a `className` and `onClick`
  on the chevron reach the jsdom DOM and are clickable. Sound.

- **N1 (onAddNote seed-not-select) — RESOLVED.** T5 change #3 now states the seed (not the
  selection) reveals the new node since auto-reveal-on-select is dropped, and explicitly
  leaves `onAddNote`'s missing `kind` tag as-is (out of scope). The T5 Files note also clarifies
  T4 already did the helper rework so T5 only extends. Correct.

- **N2 (pin "Advanced" label) — RESOLVED.** T2 Acceptance now requires the tiered
  `ContextEditor` `Advanced` `ToolsPanel` to carry `label={ __("Advanced", "piano-block") }`
  verbatim and keep the Note-language select outside `ContextEditor`, citing
  `SongPanel.test.js:263–274`. Correct.

- **N3 (TreeGridCell `{}` render-prop) — RESOLVED.** T3's DropdownMenu stub bullet now states
  `TreeGridCell`/`TreeGridItem` call their render-prop child with `{}`, so `ref`/`tabIndex`/
  `onFocus` are `undefined` in jest by construction, the spread is harmless, and T4 unit tests
  must assert structural outcomes only (roving tabindex is e2e-only). Matches the mock
  (`wordpress-components.js:402–407, 419–420`). Correct.

- **Everything carried from iteration 1 still holds:** the CRITICAL explicit-depth splice
  (T1), the @wordpress/icons externalized mapping (T3), the SongPanel per-member tiering (T2),
  `aria-current` preservation (T4), the recolor-only highlight + byte-identical publish (T6),
  and the boundary audit (T7) are all intact and correct.

---

**VERDICT: REJECTED.** One blocking fix, narrowly scoped to T4 change #9 / Acceptance:

- **B2-followup (T4):** correct the false "no other `Edit.test.js` test changes" claim — the
  `describe("Edit — structure tree")` tests at lines **552** and **562** also drill via
  label-click-expands and break under the select-only label; add them to the rework, and state
  the general rule (every `Edit.test.js` site that reaches a child row by clicking an ancestor
  label must move to the expand helper) rather than relying on the incomplete line-number
  enumeration. Fold in the `selectLoneNote`-has-seven-callers note while doing so.

B1, B3, N1, N2, N3, and the chevron-locator bridge are all correctly resolved; nothing else
needs to change. This is the only remaining gap, and it is a precise edit to one task block.
