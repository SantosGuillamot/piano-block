# Design doc review — Review 11 — APPROVED (re-review, review 2)

**Verdict: APPROVED.** This re-review of the revised design doc (commit `55f4dc1`) confirms the prior blocking finding (BF-1) is fully remedied, the required symmetric-toggle re-audit is complete and correct against the live code, and nothing the first review verified clean has regressed. The design is sound, faithful to the spec, and buildable.

The single defect that failed review 1 — the `:580` "survivor" misanalysis — is now correctly diagnosed and concretely remedied, and the root cause (the unreconciled `4f3ed90` symmetric label toggle) has been audited across every label-click site in the suite.

---

## BF-1 is fully fixed

The design no longer asserts `:580` "survives unchanged." Three load-bearing places now classify it correctly and consistently:

- §5.3 Hazard B table (`design-doc.md:240`): `:580`/`:601` is **RED on HEAD**, with the exact trace (`:593` `expandRow` opens `s0`; `:601` label click collapses `s0` via `4f3ed90`'s symmetric toggle; `:613` `openRowAction` on Measure 1 needs `s0` open → fails).
- The spec-deviation log (`:403`): records `:580` as a pre-existing HEAD red caused by `4f3ed90`, masked until now by the wp-env gap that kept the e2e suite from running.
- `AC-B4-c` (`:440`): pins the remedy.

**The remedy is verified sound against the live tree.** At `:601` the design replaces the bare collapsing `treeRow("Section 1").click()` with select-then-idempotent-re-open:
```js
await treeRow(editor, "Section 1").click();   // selects + (symmetric) collapses s0
await expandRow(editor, "Section 1");          // idempotent → re-opens s0
```
I confirmed the re-open genuinely fires: the label click removes `"s0"` from the `expanded` Set, so `StructureTree` re-renders the section `<tr>` with `isExpanded={false}` → `aria-expanded="false"` (`StructureTree.js:364-365`). Prong 1's idempotent `expandRow` branches on `(await row.getAttribute("aria-expanded")) !== "true"`, so against `"false"` it clicks the chevron and re-adds `"s0"`. `s0` is therefore open for `:613`'s Measure-1 row action. I also confirmed nothing else re-opens `s0` between `:601` and `:613`: `onSelect={setSelection}` at `edit.js:564` is bare (no `revealAncestors`), so the explicit re-open is necessary, not redundant. The stale `:586-588` "select-only" comment is correctly flagged for correction.

---

## The symmetric-toggle re-audit is complete and correct

The design audits all `treeRow(...).click()` label sites. I confirmed against the live file that there are **exactly six** such sites — `:547`, `:601`, `:774`, `:786`, `:804`, `:1222` — and the audit (§5.3 Hazard-B table, `design-doc.md:236-246`) covers every one. No site is missed.

Every classification verified against the live code:

| Site | Label | Classification | Verified |
| --- | --- | --- | --- |
| `:601` | "Section 1" | **RED on HEAD** | `:593` opens `s0`; `:601` collapses it; `:613` needs Measure 1 row → fails. Confirmed. |
| `:774` | "Section 1" | **RED under B4 only** | On HEAD `s0` starts collapsed → click opens it → `:780` Measure 1 visible ✓ (green on HEAD). Under B4 `s0` auto-open → click collapses → `:780` fails. Confirmed. |
| `:786` | "Measure 1" | **RED under B4 only** | Same dynamic at the measure level; green on HEAD, red under B4. Confirmed. |
| `:547` | "C" (note leaf) | **SAFE** | The note-leaf `Button.onClick` (`StructureTree.js:567-580`) calls only `onSelect` — no `onToggleExpanded` at all, so the click is purely select. Confirmed. |
| `:804` | "Section 1" | **SAFE** | Rename test; only needs the row selected for the panel. Expansion state is irrelevant to its assertions. Confirmed. |
| `:1222` | "Section 1" | **SAFE** | Drift-site-2; only needs the row selected for the panel, then removes the section. Confirmed. |

The `:757` remedy is sound: a raw `rowChevron("Section 1").click()` collapse inserted before `:774` and a raw `rowChevron("Measure 1").click()` collapse before `:786` make each label click open-and-select (collapse the auto-open row first). Targets and order are correct, and raw `rowChevron` (a toggle) is the right tool — the idempotent `expandRow` would no-op against the already-open row.

---

## JSDoc / prose reconciliation correct

- `treeRow` JSDoc (`specs/editor.spec.js:290-295`) currently still reads "SELECT-AND-REVEAL … never collapses" — stale, documenting the pre-`4f3ed90` behavior. The design rewrites it to the symmetric-toggle contract (selects **and** toggles expansion; note-leaf label clicks only select). Correct.
- The remaining "select-only" prose (`:21-26`, `:477`, `:542`, `:587`) is confirmed present in the live file as stale comments and is correctly classified comment-only / no-assertion-impact, listed separately from the load-bearing remedies so the two are not conflated.

---

## No regression — prior-clean items re-verified

A diff-in-spirit against review 1's "verified clean" list holds; all the following match the live tree and are unchanged in treatment from the prior approval:

- **Hazard A.** The 8-test blast-radius table (`:469`, `:530`, `:676`, `:1294`, `:1331`, `:1361`, `:1504`, `:1535`), Prong 1's idempotent `expandRow` (`aria-expanded`-gated, mirroring `rowChevron`'s `tr` + `.filter({ has: treeRow })` resolution), and Prong 2's raw-toggle collapse inserts for `:1294` (after `assertStructureTreeOpen` `:1305`, before the collapsed-premise assert `:1313`) and `:1331` (after `:1342` `expandRow("Section 1")`, before the measure-row locator `:1344`, order load-bearing). All confirmed against live `:1294-1328` and `:1331-1358` and `StructureTree.js:477-481`.
- **B1.** Drift site 1 (OK-click `:668-670`, stale comment `:663-664`, poll `:671-673`) and drift site 2 (test name `:1191`, header comment `:1185-1190`, inline comment `:1225`, OK-click `:1230-1232`, `page` param `:1193`, poll `:1235-1237`) confirmed; the two `name:"OK"` clicks are the only two in the file. The page-scoped `toHaveCount(0)` guard on the renamed test is correct. The alt-ports e2e run procedure (8890/8891, `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` on `env:start` and `test:e2e`, `WP_BASE_URL=http://localhost:8891`, build→env:start→test:e2e→env:stop) and the STOP-and-report-blocker path are intact.
- **B4 source seed.** `src/edit.js:100` is `useState(() => new Set())`; `expansionKey` imported at `:24`. The two-key unconditional seed is exactly as specified. `4f3ed90` confirmed to have touched only `StructureTree.js` (not `editor.spec.js`), validating the "never reconciled" premise.
- **B2 / B3 / B5.** `editor.scss:6-8`, `:20-27`, `:28-31`, `:106-107`; `SectionPanel.js:44`/`:55`/`:108-111`; `edit.js:245-248`. All confirmed unchanged and matching the design's coordinates.

---

## The green-e2e gate remains load-bearing

§8 and the deviation log make a **green** e2e run the merge gate for B1, and it now explicitly covers all three breakage sources — B1's confirm-dialog drift, B4's auto-expand ripple (Hazard A), and `4f3ed90`'s symmetric-toggle fallout (Hazard B) — all in the single `specs/editor.spec.js` suite. With `:580` (HEAD red) and `:757` (B4 red) now diagnosed and concretely remedied, the gate is achievable as written, and the STOP-and-report-blocker path (no silent skip) is intact. The defect that made the gate unmeetable in review 1 is resolved.

---

## Bottom line

BF-1 is fully remedied with a working, verified remedy; the symmetric-toggle re-audit is complete (all six label sites covered, every classification correct); and nothing previously clean regressed. Approved.
