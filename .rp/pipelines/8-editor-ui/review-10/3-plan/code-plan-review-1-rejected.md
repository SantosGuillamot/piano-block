# Code plan review 1 — REJECTED

_Review of `.rp/pipelines/8-editor-ui/review-10/3-plan/code-plan.md` against the approved design (`2-design-doc/design-doc.md`) and spec (`1-spec/spec.md`), verified against the live tree on branch `worktree-8-editor-ui`._

## Verdict: REJECTED

The plan is complete in coverage, correctly ordered, buildable task-by-task, and has an honest test strategy. It is rejected for a single but load-bearing accuracy defect: the plan's own "Confirmed coordinate corrections carried into this plan" block asserts a **wrong file path** for five of the inspector leaf editors, and three tasks (T4, T6, T9) repeat that wrong path. Because the plan presents this as a *verified* correction, it is exactly the kind of authoritative coordinate a code-writer trusts without re-checking. A corrections section that introduces a new wrong path is worse than no correction at all.

This is fixable with a small edit. Everything else checks out and is recorded below as confirmed, so the next revision can be a targeted fix rather than a re-plan.

---

## Blocking finding

### F1 — The "inspector leaf editors are under `src/editor/inspector/`" correction is false for 5 of 8 files

**Where:** Plan line 14 (the "Confirmed coordinate corrections carried into this plan" bullet), and every task that cites these paths:
- Task 1 / Task 2 cite `src/editor/StructureTree.js` (correct) and `src/editor/inspector/SectionPanel.js` (correct).
- **Task 4** cites `src/editor/inspector/PitchList.js:43`, `src/editor/inspector/HandConfigEditor.js:164/168/169/178/142`, `src/editor/inspector/AnnotationList.js:57`, `src/editor/inspector/PitchEditor.js:69/80`.
- **Task 6** cites `src/editor/inspector/NotePanel.js:235` (correct) and `src/editor/inspector/MeasurePanel.js:136` (correct).
- **Task 9** cites `src/editor/inspector/PitchEditor.js:69,80` and `src/editor/inspector/HandConfigEditor.js:142,178`.

**Live truth (verified with `find src -name …`):**

| File | Plan says | Actually at |
|---|---|---|
| `PitchList.js` | `src/editor/inspector/` | **`src/editor/`** |
| `PitchEditor.js` | `src/editor/inspector/` | **`src/editor/`** |
| `HandConfigEditor.js` | `src/editor/inspector/` | **`src/editor/`** |
| `AnnotationList.js` | `src/editor/inspector/` | **`src/editor/`** |
| `ContextEditor.js` | `src/editor/inspector/` | **`src/editor/`** |
| `NotePanel.js` | `src/editor/inspector/` | `src/editor/inspector/` ✓ |
| `MeasurePanel.js` | `src/editor/inspector/` | `src/editor/inspector/` ✓ |
| `SectionPanel.js` | `src/editor/inspector/` | `src/editor/inspector/` ✓ |

Only **three** files (`NotePanel.js`, `MeasurePanel.js`, `SectionPanel.js`) live under `src/editor/inspector/`. The other five live directly under `src/editor/`. The plan's line-14 bullet enumerates all eight as "under `src/editor/inspector/`", which is wrong for five of them.

**Why this blocks (and is not just cosmetic):** the plan explicitly frames this block as the *resolved* path question — "the design has two stale paths; this plan uses the live ones" — and even correctly fixes `edit.js` and `SectionPanel.js` in the same block. A code-writer reasonably treats this section as the authoritative path source and will, for Task 4 in particular (the largest file-coordinate task), trust `src/editor/inspector/PitchList.js` etc. The per-task "re-confirm by grep on first touch" guardrail uses unique strings and *would* rescue a careful writer — but the plan has actively overridden that guardrail for these files by declaring the path already confirmed. The two safety nets contradict each other, and the wrong one is the more authoritative.

**Required fix (small):** correct the line-14 bullet to list the five `src/editor/` files separately from the three `src/editor/inspector/` files, and update the path prefix in Tasks 4, 6 (the two correct ones stay), and 9 accordingly:
- `src/editor/PitchList.js`, `src/editor/PitchEditor.js`, `src/editor/HandConfigEditor.js`, `src/editor/AnnotationList.js`, `src/editor/ContextEditor.js`
- `src/editor/inspector/NotePanel.js`, `src/editor/inspector/MeasurePanel.js`, `src/editor/inspector/SectionPanel.js`

The intra-file line numbers for all of these are correct as written (verified — see below); only the directory prefix is wrong.

---

## Verified correct (carry forward unchanged into the next revision)

All of the following were checked against the live tree and are accurate; the revision needs only the F1 path fix.

**Coverage.** All 11 in-scope requirements are planned: R-TREE (T1), R-DEL (T2), R-FOCUS (T3), R-LR1/2/3 (T4), R-JSON (T5), R-NOOP (T6), R-INVALID + the `__experimentalVStack` mock (T7), R-DOCS (T8), R-NUM change-nothing (T9), R-FOLLOWUP (T10); the cross-cutting item is held as guardrails. Nothing out-of-scope (rejects, preserved prior-review wins, deferred follow-up *implementations*) is pulled in.

**Ordering / buildability.** The hard-ordered chains are correct and sufficient: 2→3 (shared `StructureTree.js` `@wordpress/element` import) and 3→5→8 (disjoint `edit.js` regions). The T2↔T3 import handoff is honest — T2 deletes the entire `import { useState } from "@wordpress/element"` line (no `@wordpress/element` import remains after T2, since `useState` was its only consumer — confirmed at `StructureTree.js:59`/`:301`), and T3 re-adds `import { useEffect, useRef }`. The split class-docstring (T2 writes the R-DEL half, T3 the focus half) correctly avoids documenting not-yet-present code. Each task ends on a compiling, test-green file.

**R-TREE (T1).** `RowLabelCell` `onClick` guard confirmed at `StructureTree.js:151-154`; the guard `if (!isExpanded) onToggleExpanded?.(rowKey)` is live. Hand-group label at `:490-497` is already symmetric (untouched — correct). "Exactly one test flips" holds: `StructureTree.test.js:388` (title), `:393` (comment), `:395` (`calls.toggle` `[]` → `["s0"]`); the sibling collapsed-section/measure/hand asserts at `:371/:384/:408/:418/:426` do not assert the expanded-no-collapse behavior, so none of them flips.

**R-DEL (T2).** `SectionPanel.js` `confirmOpen` at `:85`, `onClick={() => setConfirmOpen(true)}` at `:153`, `ConfirmDialog` at `:160-172`, imports at `:32`/`:39` — all confirmed; `useState` is used only by `confirmOpen`, so dropping the whole import line is correct. `StructureTree.js` `pendingRemoveSection` at `:301`, `onRemove` at `:369`, root `ConfirmDialog` at `:628-640`, `ConfirmDialog` import at `:50` — all confirmed. Tests: `SectionPanel.test.js` remove tests at `:255`/`:267` (OK-clicks `:259`/`:275`), cancel test "does not call onRemoveSection when the confirm dialog is cancelled" at `:279` (delete); `Edit.test.js` `onRemoveSection` at `:457`, "opens a ConfirmDialog" comment `:461`, OK-click `:463`. The `StructureTree.test.js` OK-click is live at **`:474`** (plan says `:477` — a ~3-line stale offset, within the declared non-frozen tolerance and grep-targeted, so not blocking), cancel test at `:481`.

**R-FOCUS (T3).** The mechanism is sound and matches the design: one `focusRequest {id, kind}` `useState` in `edit.js` (no new import — `useState` already at `:12`), 7 `"row"` bumps + 3 `"anchor"` bumps, one prop pass; a single `useEffect` + `treeRef` in `StructureTree`. All 10 bump-site coordinates verified in `edit.js`: `onAddNote` (`setSelection` `:195`), `onDuplicateSection` (`:330`), `onDuplicateMeasure` (`:349`), `onDuplicateNote` (`:375`), `insertSectionAt` (`:407`), `insertMeasureAt` (`:431`), `insertNoteAt` (`:466`); `onRemoveSection` end after `:232-234`, `onRemoveMeasure` after `:282`, `onRemoveNote` after `:312`. The "unconditional anchor bump vs. conditional `setSelection(null)`" subtlety is correctly load-bearing and correctly handled. The `…__tree` host div is at `StructureTree.js:620` (ref + `tabIndex={-1}` target — correct; not on `<TreeGrid>`). Test split is honest: DOM focus is e2e-only because `TreeGridCell` passes `{}` (verified `test/mocks/wordpress-components.js:539-544`), jest asserts only `aria-current`; `specs/editor.spec.js` has zero focus assertions today (only `.focus()` drivers at `:1317/:1352/:1384` — confirmed), so the `toBeFocused` assertions are net-new as stated.

**R-LR (T4).** Intra-file coordinates all correct (paths wrong per F1): `alignment="flex-start"` at `PitchList.js:43`, `HandConfigEditor.js:164`, `AnnotationList.js:57`; collapsing `NumberControl`s at `PitchEditor.js:69`/`:80` and `HandConfigEditor.js:178`; visible label "Alteration note" at `HandConfigEditor.js:168`, scoped aria-label at `:169`. The exclusion of `HandConfigEditor.js:142` (octave-shift) from R-LR2 is correct. R-LR2 is genuinely jest-assertable (mock `NumberControl` spreads `...rest` incl. `style` onto the `<input>` — confirmed `:117-137`); R-LR1 alignment correctly e2e-only (HStack swallows `alignment` — confirmed `:203-209`).

**R-JSON (T5).** `{errors[0]}` at `edit.js:522` (inside the `:520-524` Notice); `Edit.test.js:309` is `expect(notice.textContent).toBe(errors[0])`. The plan's contingency — extend the fixture if `INVALID_SONG` yields only one error so `errors.length > 1` is meaningful — correctly addresses that the existing test asserts only `errors.length > 0`.

**R-NOOP (T6).** `annotations ?? undefined` confirmed at `NotePanel.js:235` and `MeasurePanel.js:136`; `AnnotationList` collapses empty → `undefined` (`AnnotationList.js:48`), so the change is a true no-op. Paths here happen to be correct.

**R-INVALID (T7).** `VStack` is absent from `src/` and `test/` (confirmed) — the mock prerequisite is real. `HStack` mock at `:203-209`; the `__experimentalHStack: HStack` export at `:612` shows the experimental-only precedent the plan mirrors for `__experimentalVStack`. `InvalidState.js`: import at `:17`, outer `<div>` `:30`/`:49`, redundant `<p>` `:32-37`, `<ul>` `:38-44` — all confirmed.

**R-DOCS (T8).** Canvas-framing at `edit.js:48-49` ("an interactive sheet-music `SongCanvas` the author both reads and edits on"), `editor.scss:6-7` ("the surface the author both reads and / selects notes on"), `editor.scss:106` ("The interactive canvas wrapper") — all confirmed; there is correctly no second `edit.js` site. `edit.js:533` "`style.scss` lays them out as a flex row" confirmed (the flex rule is the `&__workspace` block at `editor.scss:38-43`). `songModel.js` CRITICAL prose runs `:328-335` (the `@param` block starts `:337`) — the plan's `:328-335` is right and it correctly flags the design's `:328-339` as over-reaching; reference-backs at `:354`/`:382` confirmed (leave unchanged).

**R-NUM (T9).** All 7 sites confirmed: `PitchEditor.js:69,80`; `ContextEditor.js:127` (bpm) + `:149` (beats); `HandConfigEditor.js:142,178`; `NotePanel.js:179`. The plan changes nothing and the T4↔T9 non-conflict (T4 adds `style`, not the margin prop) is correctly called out.

**R-FOLLOWUP (T10).** Verified against the live repo: no `follow-up` label exists; issue **#35** is OPEN, unlabelled, titled "Editor: highlight the selected section/measure on the sheet-music canvas" — an exact match for the spec's canvas-highlight follow-up. The plan's ruling (create label, relabel #35, file the 3 *other* items = 4 total, never a 4th new issue) is the correct realization of the spec's "four issues" (the spec's item #2 = #35) and of acceptance criterion #10. The verification gate (`gh issue list --label follow-up` shows 4) is correct. No deferred work is implemented.

---

## Required for approval

Apply the F1 path fix (line-14 bullet + Tasks 4/6/9 path prefixes) so the plan's stated coordinate corrections match the live tree. No other change is required; the rest of the plan is approved on the merits above.
