# Code Plan Review 1 — REJECTED

Reviewer: code-plan-reviewer. Iteration N=1. Verdict: **REJECT**.

Plan reviewed: `3-plan/code-plan.md` (commit `d0c3bce`, tasks T1–T10).
Worktree: `worktree-8-editor-ui`, HEAD `d0c3bce`. Commit `4f3ed90` ("Make tree row labels toggle symmetrically") confirmed present.

## Summary

The plan is **feasible, complete, and well-aligned** on the B1–B5 mechanics. I verified every load-bearing coordinate against the live code (see "Verification" below) and they hold, modulo the ≤2-line drift the plan already authorizes via "re-confirm by reading/grepping." Coverage is exact (B1→T4/T10, B2→T1, B3→T2, B4→T3/T5/T6, B5→T7/T8; gates T9/T10); no out-of-scope nice-to-have or ⛔ rejection received a task; no ConfirmDialog is re-added; inline `minWidth:"4em"` stays inline; `selection.js` and the measure-remove tests stay untouched; the B1 e2e recipe (alt-ports 8890/8891, `WP_BASE_URL`, env overrides on steps 2 AND 3, cleanup, explicit STOP-and-report-blocker path) is correct.

It is rejected for **shipped-artifact leak violations the plan actively introduces or knowingly leaves**, which trip AGENTS.md ("Keep the development workflow out of shipped artifacts … Do not reference that workflow … in source code, comments") and the run's "no `.rp`/AC#/Req#/taskID leak into shipped code/tests" gate. The irony: a drift-fix run whose whole point is killing stale comments would ship a freshly-stale comment (Issue 2) and brand-new internal-history references (Issue 1).

`specs/editor.spec.js` is a shipped artifact (it ships in the repo and "should read as a standalone project"). It already carries 6 pre-existing pipeline-ID leaks (`S5`/`S7`/"entry A"/"entry B") at `:290`, `:326`, `:664`, `:770`, `:783`, `:1185`. The plan rewrites 5 of the 6 regions for B1/B4 reasons — so removing those leaks is essentially free and squarely in the blast radius — but the plan does not instruct it, knowingly leaves the 6th, and worse, **adds new `4f3ed90` commit-sha references** in its own suggested comment text.

## Issues (must-fix)

### Issue 1 — T6 bakes the commit sha `4f3ed90` into shipped test comments (AGENTS.md violation)

T6's suggested comment text instructs the writer to cite the internal commit `4f3ed90` in `specs/editor.spec.js` in at least three places:
- T6 step 1 snippet: `// expansion (4f3ed90's symmetric toggle), collapsing the s0 opened above.`
- T6 step 2 prose / `:757` snippet: `// opens-and-selects Section 1 (rather than collapsing it via 4f3ed90's`
- T6 step 3 (`treeRow` JSDoc rewrite): `... toggles its expansion (collapsing an open row), per 4f3ed90; ...`

A bare commit sha (whose commit message is "… (code-writer)") is a direct reference to the internal pipeline workflow's history — exactly what AGENTS.md confines to `.rp/`. The reconciled comments must describe the symmetric-toggle behavior in plain, standalone terms (e.g. "a section/measure label click selects the row and toggles its expansion, collapsing an open row") with **no `4f3ed90` reference anywhere** in shipped comments/JSDoc. Fix: strip `4f3ed90` from every T6 suggested snippet and from the corresponding instruction prose, and state explicitly that no commit sha may appear in the shipped file.

### Issue 2 — T6 step 4 leaves the `expandRow` JSDoc stale AND leaking, next to a body T5 rewrites

T6 step 4 (and design §5.4) says "Leave the `expandRow` JSDoc (currently `:324-332`) as-is." That JSDoc is the worst thing to leave:
- It carries an `S5` pipeline-phase leak at `:326`: "After S5 a collapsed section/measure label click also expands …" (AGENTS.md violation).
- It asserts implementation that T5 invalidates: "`expandRow` continues to click the chevron and remains valid for all callers" (`:328-329`). T5 rewrites the body to branch on `aria-expanded` and click the chevron **only when collapsed** — so "continues to click the chevron" becomes false the moment T5 lands. This is a stale-comment-next-to-changed-code drift, the exact defect class this run exists to fix.

Fix: T5 (or T6) must refresh the `expandRow` JSDoc — drop the `S5` token and the now-inaccurate "continues to click the chevron / remains valid for all callers" clause, and describe the idempotent behavior (expand only when collapsed; no-op when already open). Do not "leave it as-is."

### Issue 3 — T4/T6 prose-reconciliation steps do not instruct dropping the `S5`/`S7`/"entry A/B" leak tokens

The plan rewrites these leak-bearing regions but only specifies the *behavioral* swap, not the leak removal — a literal writer could keep "After S5 …" while only changing the clause after it:
- T6 step 3 — `treeRow` JSDoc `:290` ("After S5 …"): instruct dropping `S5`.
- T6 step 2 — `:770` and `:783` ("After S5 …"): instruct dropping `S5`.
- T6 step 5 — the `:21-26`, `:477`, `:542`, `:587` "select-only" prose: confirm none re-introduces an `S#` token.
- T4 step 3 / step 7 — `:664` ("S7 entry B") and `:1185-1190` ("S7 … entry A"): T4's example rewrites are already clean (no `S7`), so this is low-risk, but the task should still state that `S7`/"entry A/B" must not survive.

Fix: add an explicit instruction to T4 and T6 that every rewritten comment must drop all pipeline-phase/commit references (`S5`, `S7`, "entry A/B", `4f3ed90`, "review N", etc.) per AGENTS.md, so the shipped file reads as a standalone project. After T4+T6, a `grep -nE 'S5|S7|entry [AB]|4f3ed90|review [0-9]' specs/editor.spec.js` must return nothing.

## Verification performed (these all PASSED — for the writer's confidence)

- Source coords confirmed live: `edit.js:24` imports `expansionKey`; `edit.js:100` = `useState(() => new Set())`; `edit.js:248` dead default; `SectionPanel.js:44` `OVERRIDE_KEYS`, `:109` rest-destructure, `:141` caller passes explicit `sectionIndex`; SCSS file-header `:6-9`, `:first-child` comment `:21-27`, `&__canvas` `:106-107`; `StructureTree.js:156-159` symmetric label toggle, `:364-365`/`:426-427` `isExpanded`+`data-expansion-key` on the same `<tr>`, `:477` `if (!measureExpanded)`, `:481` `HANDS.forEach`.
- Unit assertions confirmed: `pitches.test.js:216`/`:231` and `contextControls.test.js:421` assert `minWidth === "4em"`; inline `4em` at `HandConfigEditor.js:193`, `PitchEditor.js:79`/`:91`; `SectionPanel.test.js:279`/`:289` + `Edit.test.js:503` pass explicit `sectionIndex`; `SongCanvas.test.js:172/175/178` negative guard asserts hook classes ABSENT.
- `aria-expanded` signal for Prong 1: confirmed on the mock `test/mocks/wordpress-components.js:531` and via the real `__experimentalTreeGridRow` imported at `StructureTree.js:62` and fed `isExpanded` at `:148`. Idempotent helper is feasible; the row locator mirrors the working `rowChevron` (`:317-322`).
- e2e coords (minor ≤2-line drift, all within "re-confirm" tolerance): two and only two `name:"OK"` *clicks* — `editor.canvas`-scoped at `:668-670`, `page`-scoped at `:1232`; drift-site-1 comment at `:662-664`, poll→2 at `:671-673`; dedicated test name `:1191`, `page` param `:1191-1193`, header `:1185-1190`, inline stale `:1225`, OK-click `:1230-1232`, "Remove section" click `:1226`, `openSettingsSidebar` `:1220`, poll→1 `:1235-1237`; `expandRow` `:337-339` (blind chevron, no aria check); `:1294` keyboard test uses no `expandRow`, `assertStructureTreeOpen` `:1305`, count-0 premise `:1313`; `:1331` `expandRow("Section 1")` `:1342`, measure-row locator `:1345-1347`, `Right hand` count-0 `:1349`; `:580` test, `expandRow` `:593`, bare label click `:601`, `openRowAction("Measure 1")` `:616-620`; `:757` test, label clicks `:774`/`:786`, `toBeVisible` `:780`; safe sites `:547`/`:804`/`:1222` select-only; drill-down `expandRow` users at `:469`/`:530`/`:676`/`:1361`/`:1504`/`:1535` all confirmed; measure-remove `:647-661` has no OK-click.
- Coverage/scope: B1–B5 all tasked; ⛔ rejections + 🟢 nice-to-haves have no task (only "no task by design" disclaimers at plan `:5`, `:415`); no ConfirmDialog re-added; `4em` stays inline; `selection.js` and measure-remove tests untouched; T10 e2e recipe correct with STOP-and-report-blocker (no silent skip).

## What an APPROVE needs

Re-spin the plan to: (1) strip `4f3ed90` from all T6 suggested snippets/instructions; (2) make T5/T6 refresh the `expandRow` JSDoc (drop `S5`, drop "continues to click the chevron / remains valid", describe the idempotent behavior) instead of leaving it; (3) add an explicit T4/T6 instruction that every rewritten comment drops all pipeline/commit references so a post-edit `grep` for `S5|S7|entry [AB]|4f3ed90` over `specs/editor.spec.js` is empty. Everything else is sound.
