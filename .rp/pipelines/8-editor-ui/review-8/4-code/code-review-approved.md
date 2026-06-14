# Review 8 — Code review (iteration 2): APPROVED

**Verdict:** APPROVED.
**Diff reviewed:** `d139170..HEAD` (HEAD = `302c44a`), excluding `.rp/`.
**Suite state at HEAD (all re-verified in-env):** `npm run check` clean (67 files, no fixes); `npm run test:unit` = 22 suites / 684 tests pass; `npm run build` succeeds and emits both `build/index.css` (editor-only, 1.35 KiB source) and `build/style-index.css` (front-end). Working tree clean; HEAD identical to the fix commit `302c44a` (no stray edits).

Iteration 1 rejected on a single blocking defect: R1's always-run jsdom guard did not catch the literal production bug — stripping the `onExpandRow`/`onCollapseRow` props from `<TreeGrid>` left the always-run suite green, breaking the "tests green ≠ real component broken" meta-rule for the marquee Must-fix item. The T6 fix at `302c44a` ("Strengthen R1 always-run guard…", touching only `src/editor/__tests__/StructureTree.test.js` + `test/mocks/wordpress-components.js`) closes that hole. The blocker is fixed, no regression was introduced, and the 19/20 requirements + O1–O5 already verified in iteration 1 remain intact (production wiring untouched).

---

## Blocker resolved — R1 always-run guard now fails RED on the no-callback regression (verified)

**The fix.** The TreeGrid mock (`test/mocks/wordpress-components.js:466-487`) now *captures* the real `onExpandRow`/`onCollapseRow` props (instead of swallowing them into `_onExpandRow`/`_onCollapseRow`) and attaches them to the rendered `<table>` DOM node as `__onExpandRow`/`__onCollapseRow` via a `ref`. The rewritten guard (`src/editor/__tests__/StructureTree.test.js:628-654`, *"invokes onToggleExpanded with the row's expansion key when onExpandRow or onCollapseRow fires"*) grabs the treegrid node, builds a synthetic `<tr data-expansion-key>`, invokes both captured callbacks under `act(...)`, and asserts `calls.toggle` accumulates `["s0"]` then `["s0", "s0m0"]` — exercising the full wiring path: `__onExpandRow(row)` → `StructureTree.onExpandCollapseRow` → `expansionKeyOf(row)` → `onToggleExpanded(key)`. `calls.toggle` is populated by the harness's `onToggleExpanded: (key) => calls.toggle.push(key)` (`StructureTree.test.js:175`); `act` is imported from `react` (`:32`). The misleading attribute-presence-only test from iteration 1 is retired/renamed.

**RED-on-regression — independently reproduced (regressions applied to a clean tree, suite re-run, then `git checkout` reverted):**
- **Missing callbacks** (remove BOTH `onExpandRow`/`onCollapseRow` from `src/editor/StructureTree.js:583-584` — reproducing finding #1's original bug verbatim): the guard goes **RED** with `TypeError: treegrid.__onExpandRow is not a function` (`StructureTree.test.js:643`) → **1 failed, 31 passed**. Matches the orchestrator's reference result exactly.
- **Silent no-op callbacks** (`onExpandRow={() => {}}` / `onCollapseRow={() => {}}` — the silent no-op the design names as "the root cause of the bug"): the guard goes **RED** with `Expected ["s0"] / Received []` → **1 failed, 31 passed**. The no-op variant no longer slips through.
- **Restored** (`git checkout src/editor/StructureTree.js`): suite **green again** (32/32 in StructureTree; 684/684 full).

The guard now genuinely bites: it catches both the missing-prop and the silent-no-op forms of the original shipped accessibility bug, and (by asserting the exact key routed) also a wrong-key regression. The always-run gate — the one the spec demanded because the e2e (T20) is Docker-based and "may not run in-env" — now holds.

---

## No regression from the fix (verified)

- **Scope of the fix is exactly the two test/infra files** the commit claims (`git diff 302c44a` is empty; HEAD == fix commit). **Production wiring is untouched** — `StructureTree.js` still passes both callbacks to the shared `onExpandCollapseRow` (`:269-272`, `:583-584`); the `build` output is unaffected because the mock is a test-only module.
- **The mock change is generic and non-leaky.** `onExpandRow`/`onCollapseRow`/`onFocusRow` are destructured out of props, so they are **not** spread into `...rest` and never surface as rendered DOM attributes — no attribute pollution, so other suites' attribute/`aria-*`/byte assertions are unaffected. The two real callbacks live only as expando properties on the node (invisible to attribute queries). `aria-label` still flows through `...rest` unchanged, so the R2 accessible-name wiring is preserved (no `label`→`aria-label` remap reintroduced); `onFocusRow` is still swallowed (roving-tabindex deliberately left to e2e).
- **Both consumers of the TreeGrid mock pass:** `StructureTree.test.js` (32/32) and `Edit.test.js` — full suite 22/684 green.

---

## Iteration-1 findings re-confirmed intact (high level)

The fix touched only the test + mock, so the 19/20 requirements and all five IN-Optionals verified PASS in iteration 1 are undisturbed and remain in force here by reference (`code-review-1-rejected.md` §"Everything else — verified PASS"): R1 production wiring, R2 (RED-on-regression still confirmed via the unchanged `aria-label` flow), R3+R17 CSS split + admin color + dual build outputs (re-confirmed present), R4–R16, R18 provenance grep clean, R19, R20, and O1–O5. R16's element-icon guard and R2's accessible-name guard remain the two other RED-on-regression-verified meta-rule items; with R1 now joining them, all three always-run guardrails bite.

---

## Verdict

The lone iteration-1 blocker is fixed correctly and minimally, the fix introduces no regression, and the full batch (check + unit + build) is green. **APPROVED.**
