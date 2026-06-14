# Code Plan Review — APPROVED

Reviewer: code-plan-reviewer (fresh). Iteration N=2. Verdict: **APPROVE**.

Plan reviewed: `3-plan/code-plan.md` (revised, commit `ba9a05f`, tasks T1–T10).
Worktree: `worktree-8-editor-ui`, HEAD `ba9a05f`. Prior verdict: `code-plan-review-1-rejected.md` (the 3 issues below).

## Verdict

The three rejection issues are genuinely fixed. The revision is surgical — `git diff d0c3bce ba9a05f -- 3-plan/code-plan.md` touches only T4/T5/T6 prose and snippet-comment text; nothing in the prior PASS surface was altered, so no regression slipped in. Approved.

## The 3 rejection issues — all FIXED

### Issue 1 — no commit sha `4f3ed90` baked into any shipped snippet — FIXED

Every `4f3ed90` occurrence in the revised plan now lives in **instruction prose telling the writer to drop/avoid it** ("MUST drop", "no commit sha", "never by citing the commit"), never inside a fenced `js` snippet the writer would copy verbatim. Confirmed mechanically: an `awk` sweep of every fenced code block in `code-plan.md` for `S5|S7|entry [AB]|4f3ed90` returns EMPTY. The three prior offending baked references are gone:
- `:601` snippet comment: `(4f3ed90's symmetric toggle)` → `(a section/measure label is a symmetric toggle)`.
- `:774` snippet comment: `collapsing it via 4f3ed90's symmetric toggle` → `collapsing it via the symmetric label toggle`.
- T6 step 3 `treeRow` JSDoc instruction: the `per 4f3ed90` clause removed.
- (Also: T6 Goal line dropped the parenthetical `4f3ed90` citation.)

### Issue 2 — T6 step 4 refreshes the `expandRow` JSDoc (no longer "leave as-is") — FIXED

Old step 4 read "Leave the `expandRow` JSDoc … as-is." New T6 step 4 reads "**Refresh the `expandRow` JSDoc … — do NOT leave it as-is**" and explicitly: drops the `S5` phase token (`:326`); drops the now-false "continues to click the chevron and remains valid for all callers" claim (`:328-329`); and describes the idempotent expand-only-when-collapsed / no-op-when-open behavior matching T5's body. T5 carries the same JSDoc-refresh instruction (plan line 213) with a "MUST happen exactly once across T5/T6" guard, and both tasks' acceptance bullets assert it. Premise re-confirmed live: `specs/editor.spec.js:326` carries `After S5 …` and `:328-329` literally asserts `expandRow continues to click the chevron and remains valid for all callers` — which T5's `aria-expanded` rewrite makes false, exactly the stale-comment-next-to-changed-code drift this run exists to kill.

### Issue 3 — T4 + T6 explicitly drop the leak tokens AND carry a grep acceptance gate — FIXED

- T4: new step 10 (shipped-artifact rule) plus steps 3 and 7 now instruct "Drop the `S7` and 'entry B'/'entry A' tokens." Acceptance adds `grep -nE 'S7|entry [AB]' specs/editor.spec.js` returns EMPTY after T4, and the whole-file `grep -nE 'S5|S7|entry [AB]|4f3ed90' specs/editor.spec.js` EMPTY after T4+T6.
- T6: new step 7 (leak-token sweep) requires `grep -nE 'S5|S7|entry [AB]|4f3ed90' specs/editor.spec.js` EMPTY for every region it owns; acceptance restates the whole-file-EMPTY-after-T4+T6 gate.

Ownership is exact and matches the live leak sites: T4 owns `:664` (`S7 entry B`) and `:1185` (`S7 … entry A`); T6 owns `:290`, `:326` (`S5` JSDocs) and `:770`, `:783` (`After S5` prose). No `4f3ed90` exists in the live file (it was only the proposed-comment leak the old plan would have introduced, now stripped), so the gate is satisfiable.

## Prior PASS re-confirmed (no regression)

The revision diff is confined to T4/T5/T6 instruction/comment text. Everything the iteration-1 verdict verified PASSED is untouched and still holds:
- B1–B5 coverage exact (B1→T4/T10, B2→T1, B3→T2, B4→T3/T5/T6, B5→T7/T8; gates T9/T10); the coverage table is unchanged.
- Load-bearing coords sane (the iteration-1 verification of `edit.js`, `SectionPanel.js`, `editor.scss`, `StructureTree.js`, and the e2e sites holds; the revision changed none of them). I re-confirmed the six live leak sites the new gates target exist verbatim.
- T10 e2e real-run recipe intact (build → alt-port `env:start` 8890/8891 → `WP_BASE_URL=http://localhost:8891 test:e2e` with env overrides on steps 2 and 3 → always-run `env:stop`), with the explicit STOP-and-report-blocker path (no silent skip) preserved.
- ⛔ validated rejections and 🟢 out-of-scope nice-to-haves still get no task (by design).
- Inline `minWidth: "4em"` stays inline (T2/T3); `src/editor/selection.js` and the measure-remove tests stay untouched (T1, T4).

## What to watch (non-blocking, writer's-confidence note)

T6's step numbering is slightly out of order (`5`, then `7` the leak sweep, then `6` the safe-sites) — cosmetic, the content is complete and unambiguous; not a defect.
