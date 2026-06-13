# Design doc review — Review 11 — REJECTED (review 1)

**Verdict: REJECTED.** The design is sound, faithful, and buildable for B1, B2, B3, B5, and for B4's source change and its `:1294` / `:1331` e2e remedies. It is rejected on a single, load-bearing defect in B4's e2e analysis: the design's treatment of the `:580` e2e test ("survives unchanged") is **factually wrong against the live code**, and it has a direct consequence on the run that gates B1 and B4 — the design's own merge gate ("the suite must run GREEN") cannot be met as written.

Everything else verified clean (evidence below). Fixing the `:580` defect — and re-checking whether the same already-shipped behavior change red-lights any other "survivor" — is all that stands between this doc and approval.

---

## Blocking finding

### BF-1 — The `:580` survivor analysis is wrong; `:580` is already RED on HEAD and the design neither diagnoses nor remedies it, so the gating e2e run cannot go green

**Where:** design-doc §5.3 (line 227: *"`:580` survives because its `:601` label-click re-opens `s0` before any measure-level op (fragile, by accident) — it needs no change but is re-confirmed in the real run."*) and the matching design-research claim (research line 397). Also the blast-radius table (§5.3, the `:580` row: *"label-click re-opens `s0` … none (re-confirm in run)"*).

**The claim:** at `specs/editor.spec.js:580` (`"the structure tree adds, removes and duplicates sections and measures"`), the `:601` `treeRow(editor, "Section 1").click()` label-click **re-opens** `s0`, so the test survives B4's auto-expand seed unchanged.

**Why it is wrong (verified against the live tree):**

1. **The label click is an UNCONDITIONAL symmetric toggle, not "select-and-reveal."** `RowLabelCell`'s label `Button.onClick` at `src/editor/StructureTree.js:156-159` is:
   ```js
   onClick={() => {
       onSelect?.();
       onToggleExpanded?.(rowKey);
   }}
   ```
   `onToggleExpanded` runs on **every** click regardless of expansion state. Clicking the label of an **open** section **collapses** it.

2. **This is a recent, unreconciled behavior change.** `git log -S` shows the label click was changed from select-and-reveal to symmetric toggle in commit **`4f3ed90` "Make tree row labels toggle symmetrically (code-writer)"**. Before `4f3ed90` the handler was `onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey);` (never collapses); `4f3ed90` dropped the `if (!isExpanded)` guard. **`4f3ed90` did NOT touch `specs/editor.spec.js`**, and the only later spec commit (`38d4aaa`) merely *appended* new tests at `:1390+` — it did not reconcile `:580`/`:601`. The `treeRow` JSDoc at `specs/editor.spec.js:290-295` still says *"never collapses — collapse stays on the chevron and ArrowLeft,"* which is now **stale**: it documents the pre-`4f3ed90` behavior. The design-research itself flagged this drift (research line 152: *"the label `Button` `onClick` … also toggles symmetrically; its JSDoc claims 'select-and-reveal, never collapse' — a doc/code drift"*) — then contradicted that flag in the `:580` survivor analysis by treating the `:601` click as a re-open.

3. **`:580` structurally depends on `s0` staying OPEN after `:601`.** After the `:601` label-click, the test (`:613-621`) calls `openRowAction(editor, "Actions for Measure 1 of section 1", "Duplicate")`, which clicks the **Measure 1 row's actions trigger** (`openRowAction`, `specs/editor.spec.js:360-363`). That trigger is only rendered when `s0` is expanded (measure rows render only when `sectionExpanded` — `StructureTree.js`, the section-level `if (!sectionExpanded) return;` before the `measures.forEach`). Between `:601` and `:613` nothing re-opens `s0`: `onSelect` is bound to bare `setSelection` (`edit.js:564`, no `revealAncestors`), and the `:603-605` "Add measure" button calls `onAddMeasure` (`edit.js:248-267`), which only `commit`s — it does not touch expansion.

**Trace (current symmetric-toggle code), both worlds:**

- **Current HEAD, no B4:** mount → `s0` collapsed → `:593` blind `expandRow` opens `s0` → `:601` label toggle **collapses** `s0` → `:613` Measure-1 actions trigger not rendered → **FAIL**. So `:580` is **already red on HEAD**, broken by `4f3ed90`, independent of B4.
- **With B4 (auto-expand + idempotent `expandRow`):** mount → `s0` auto-open → `:593` idempotent no-op (stays open) → `:601` label toggle **collapses** `s0` → `:613` **FAIL**. B4 does not fix it.

(For contrast, under the **pre-`4f3ed90`** select-and-reveal behavior the design implicitly assumes, `:601`'s `if (!isExpanded)` would skip the toggle on the already-open `s0`, leaving it open and `:613` passing — which is the world the design's "re-opens `s0`" sentence describes. That world no longer exists.)

**Consequence (why this blocks):** the design makes the **real, green e2e run** the merge gate for B1 — and the same run re-confirms B4 (§2.4, §8, AC-B1-c). `:580` lives in the same `specs/editor.spec.js` suite, so it runs in that gate. A red `:580` means the suite cannot go green; the code phase following this design would either be forced into the STOP-and-report-blocker path or be left fixing an **undesigned** test, having been told `:580` "needs no change." The whole point of this run's gating discipline (run green, no false-green) is undermined by an enumerated "survivor" that is actually a failure.

**What the design must do (either is acceptable; pick one and design it concretely):**
- **(a) Remedy `:580` in this run.** Reconcile the test with the symmetric-toggle behavior — e.g. drive the section open via its **chevron** (`rowChevron`/idempotent `expandRow`) and select the section without collapsing it, or re-open `s0` after the `:601` selection, so the Measure-1 actions trigger at `:613` is rendered. Whatever the fix, keep it consistent with the now-true "label toggles symmetrically" contract and update the stale `treeRow` JSDoc (`:290-295`) if the design relies on it.
- **(b) Explicitly diagnose `:580` as a pre-existing failure** caused by `4f3ed90` (not by B4), decide in/out of scope with rationale, and — if out of scope — say how the gating run reconciles a known-red test (the gate cannot be "suite green" while a known test is red). Do **not** leave the doc asserting `:580` "survives unchanged."

Additionally: because the root cause is a shipped-but-unreconciled behavior change (`4f3ed90`), the design should **re-audit every test it labels a "survivor" or "no-op fix"** for the same hazard — any test whose flow relies on a section/measure **label** click *not* collapsing an open row is now suspect. The eight enumerated breakers were traced carefully; the one survivor was not, and it is the one that broke. Confirm the drill-down survivors are genuinely safe under symmetric toggle (the idempotent `expandRow` uses the **chevron**, so they should be — but state it, given the miss here).

---

## Verified clean (for the re-review — do not re-litigate)

All of the following were checked against the live worktree tree and hold:

- **B1 sites exact.** Drift site 1: OK-click at `specs/editor.spec.js:668-670` (the `:669` line), comment `:663-664`, poll `:671-673`. Drift site 2: test name `:1191`, header comment `:1185-1190`, inline comment `:1225`, OK-click `:1230-1232`, `page` param `:1193`, `openSettingsSidebar(editor, page)` at `:1220`, poll `:1235-1237`. The two `name:"OK"` clicks are the only two in the file. The `toHaveCount(0)` page-scoped guard, placed after the "Remove section" click and before the poll, on the renamed test only, is correct and is the right regression anchor.
- **B1 e2e run procedure correct.** Alt ports 8890/8891 (main repo holds 8888/8889; 8890/8891 free per research), `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` overrides on `env:start` and on `test:e2e` (reboot-safety for the `webServer` fallback boot), `WP_BASE_URL=http://localhost:8891` as Playwright's navigation target, build→env:start→test:e2e→env:stop ordering. The "run green or STOP-and-report-blocker, no silent skip" requirement is present and correctly framed as B1's gate.
- **B4 source change correct.** `src/edit.js:100` is `useState(() => new Set())`; `expansionKey` imported at `:24`; `onToggleExpanded` (`:109-119`) is a real `has ? delete : add` toggle. The two-key unconditional seed via `expansionKey({sectionIndex:0})` + `expansionKey({sectionIndex:0, measureIndex:0})` is exactly as specified; the unconditional rationale (membership-only Set, inert keys, no closure over `song`) is sound.
- **B4 Prong 1 (`expandRow` idempotent) sound.** `expandRow` (`:337-339`) is a blind chevron click today. `aria-expanded` is reliably present: the local mock renders `aria-expanded={isExpanded === undefined ? undefined : isExpanded}` (`test/mocks/wordpress-components.js:516-535`, `:531`) with `data-expansion-key` on the **same** `<tr>` via `...rest`; `StructureTree` passes `isExpanded` + `data-expansion-key` on the same `<tr>` for section (`:359-365`) and measure (`:420-427`) rows. The new row locator mirrors `rowChevron`'s `tr` + `.filter({ has: treeRow })` resolution (`:317-321`). (The real-component `tree-grid/row.tsx` contract is web-verified, not locally greppable — `@wordpress/components` is a webpack external; this is acceptable.)
- **B4 Prong 2 (`:1294` + `:1331`) correct, including the load-bearing order.** `:1294` does not use `expandRow`; it hard-asserts the collapsed-seed premise at `:1312-1313` (`sectionRow` visible, `treeRow("Measure 1")` count-0) — the insert after `assertStructureTreeOpen` (`:1305`) collapsing `s0` is right. `:1331`: `expandRow("Section 1")` at `:1342`, measure-row locator `:1344-1347`, asserts measure visible `:1348` and `Right hand` count-0 `:1349`; inserting the `Measure 1` collapse **after** `:1342` (section stays open so the measure row is still rendered to receive the click) is correct and the order is genuinely load-bearing. Hand rows gate on `if (!measureExpanded) return;` then `HANDS.forEach` (`StructureTree.js:477-481`), confirming `:1349`. Using raw `rowChevron(...).click()` (not idempotent `expandRow`) for both collapses is right.
- **B2 sites comment-only.** `src/editor.scss:6-8` ("on-canvas add affordances sit beside it"), `:106-107` ("the SVG host plus the add affordances", with the load-bearing `min-width:0` rationale to keep). `selection.js` untouched is correctly out of scope.
- **B3 sites comment-only + inline 4em kept.** `:20-27` ("the SelectControl+NumberControl pair in HandConfig") rewritten to a single leading control; `min-width: 8em` value at `:28-31` kept. The three inline `style={{ minWidth: "4em" }}` are at exactly `HandConfigEditor.js:193`, `PitchEditor.js:79`, `PitchEditor.js:91`, asserted by `pitches.test.js:216`, `:231`, `contextControls.test.js:421` — all confirmed; keep-inline is correct.
- **B5 correct.** B5.1: `edit.js:248` dead default `= working.sections.length - 1`, stale comment `:245-247`; `onAddMeasure` only `commit`s. B5.2: `OVERRIDE_KEYS` at `SectionPanel.js:44`, projection loop at `:55`, rest-destructure at `:109`, `emitSection({...keep, ...next})` at `:110`; the `Object.fromEntries(...filter...)` derivation is behavior-identical and `omitEmpty`/`omitFalsy` correctly rejected as wrong-shape.
- **Out-of-scope / rejections** correctly designed for nothing; prior-review wins (no re-added confirm dialog, inline `minWidth`, etc.) preserved.

---

## Bottom line

One fix gates approval: correct the `:580` treatment (remedy it, or diagnose-and-scope it honestly) so the design's "run the suite green" gate is actually achievable, and re-audit the other survivors for the same symmetric-toggle hazard. The rest of the doc is approvable as-is.
