# Doc plan — Review 10: Tree-collapse fix, list-row styling, and Gutenberg/simplification polish

_Piano block editor UI, [Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22. Branch `worktree-8-editor-ui`. This plan covers the **documentation** that review-10's shipped code requires, derived from the approved [spec](../1-spec/spec.md), [design doc](../2-design-doc/design-doc.md), and [code plan](../3-plan/code-plan.md), and grounded against the live `README.md`._

## How to use this plan

The doc phase runs **one fresh `doc-writer` per task**, after the code phase has landed, so each task documents what actually shipped (not what was planned). Every task re-reads the changed source on the branch before editing prose, and runs `git grep` for the old wording it is replacing to confirm the touch point still exists and is unique. Documentation is **README-only** this run: the in-code docstrings/comments (the `StructureTree` class docstring, the `RowLabelCell` JSDoc, the `edit.js`/`editor.scss` canvas-framing comments, the `songModel.js` CRITICAL trim, the R-NUM rationale note) are written **by the code phase** as part of their own tasks (code-plan Tasks 1, 2, 3, 8, 9) and are **out of scope here** — do not re-edit them.

**Audience.** The README serves two audiences in one file: an **end-user / author** audience (the "Using the Piano block" walkthrough, §17–86) and a **developer / contributor** audience (the "For contributors" reference, §124–199). Each task below names which audience its edit serves.

**Drift-resistance — only document what review-10 changes.** The README has already been refreshed by prior reviews (review 8/9) to say the canvas is "display + highlight only" everywhere and to describe the structure-tree select-and-reveal behavior. Review-10 flips exactly **two** observable behaviors that the README currently describes the OLD way (R-TREE and R-DEL). The other in-scope changes either are not mentioned in the README at all, or are already worded generically/correctly — those get **no doc task** (Task 3 records why, so a later run does not invent drift).

**Cross-cutting guardrails (every task):**
- **No `.rp/` leakage.** Per `AGENTS.md`, never reference the pipeline, its artifacts, requirement IDs (`R-TREE`), task numbers, or "review N" in the README. The README must read as a standalone project.
- **Match the surrounding prose.** The README uses bold lead-ins, em-dashes, and dense single-paragraph descriptions. New wording must match that voice, not introduce a bullet list or a different register mid-paragraph.
- **No behavior invented.** Document only what the shipped code does. If, on re-read, the code differs from this plan's assumption, document the code and flag the discrepancy — do not document the plan.
- **Keep `docs/song-format.md` untouched.** Review-10 is editor-side only; the song format/schema is byte-identical, so the format reference needs no change. Confirm (don't assume) before concluding.

---

## Task ordering

The two content tasks (1, 2) edit **different, non-overlapping sentences of the same README paragraph cluster** (`README.md:29` for Task 1; `:33` and `:39` for Task 2), so they can run in either order; if run in the same pass, re-confirm line numbers after the first edit shifts them. Task 3 is a verification/no-op task that must run **after** Tasks 1 and 2 (it confirms the absence of further drift once the two known edits are in). **Recommended order: 1 → 2 → 3.**

---

## Task 1 — README: symmetric tree-label toggle (the label now collapses too)

**What changed (shipped code to reflect).** The section/measure tree-row label `Button` now toggles expansion in **both** directions: clicking a collapsed label selects + expands (unchanged), and clicking an already-expanded label now selects **and collapses** it (new — previously an expanded label only re-selected, and collapse was reachable only via the chevron or ArrowLeft).

**Audience.** End-user / author (the authoring walkthrough).

**Where.** `README.md:29`, the "**Browse and select with the structure tree.**" paragraph. The exact clause to rewrite (re-confirm by `git grep` for it, since prior tasks may shift the line):

> … clicking a **collapsed** section or measure label both selects the row and **reveals** (expands) its contents, so a single click opens the panel and drills in, while clicking an already-expanded label just selects it (collapsing stays on the row's chevron, or ArrowLeft when the row is focused).

**Change.** Rewrite the clause so it describes the **symmetric toggle**: a click on a section/measure label selects the row and **flips** its expansion either way — a collapsed label selects and expands (reveals its contents); an already-expanded label selects and **collapses** it. The chevron and the ArrowLeft/ArrowRight keyboard paths still expand/collapse and may be mentioned as additional ways, but they are **no longer the only way to collapse**. Keep the surrounding sentences (selecting opens the sidebar panel; note selection highlights the canvas; "clicking the staff does not select"; hand-group rows only toggle) **unchanged** — only the collapsed-vs-expanded label clause moves.

**Do NOT.**
- Do not touch the hand-group-row sentence ("clicking one only toggles its expansion") — that behavior is unchanged and already correct.
- Do not remove the mention that the chevron and keyboard still work — the fix is additive (the label now also collapses), it does not remove those paths.

**Acceptance criteria.**
- The paragraph states that clicking an expanded section/measure label **collapses** it (the label is a symmetric toggle), not that it "just selects it."
- No remaining README sentence says collapse is reachable only via the chevron / ArrowLeft.
- The collapsed-label "select + reveal" behavior is still described (it is preserved in the code).
- No `.rp/` reference; voice matches the surrounding paragraph; `docs/song-format.md` untouched.

**Dependencies.** Code-plan Task 1 (R-TREE) shipped.

---

## Task 2 — README: destructive deletes are immediate (no confirm dialog; rely on undo)

**What changed (shipped code to reflect).** Section removal no longer shows a confirm dialog. **All four** delete sites — section, measure, note, and pitch — now fire **immediately**, and every delete (including a whole section and its subtree) is reversible with the editor's normal **undo**. Both the tree's section "Remove" menu item and the Section panel's "Remove section" button now remove directly.

**Audience.** End-user / author (the authoring walkthrough).

**Where.** Two sentences in the README author walkthrough — re-confirm each by `git grep`, as Task 1 may shift line numbers:

1. `README.md:33`, the "**Add, remove, and duplicate from the tree.**" paragraph:
   > **Remove** behaves differently by row level: removing a **section** first asks you to **confirm**, because it discards the whole section — all of its measures and their notes — in one step; removing a **measure** or a **note** happens **immediately** (no prompt) and, like every edit, can be reversed with the editor's normal **undo**.
2. `README.md:39`, the **Section panel** bullet:
   > … a convenience **Remove section** that, like the tree's section "Remove", first asks you to **confirm** before discarding the section and everything in it.

**Change.**
- **`:33`** — Rewrite the "**Remove** behaves differently by row level…" sentence so that **all** removals (section, measure, note) happen **immediately, with no confirm prompt**, and **every** removal — including a section, which discards the whole section and all its measures and notes in one step — is reversible with the editor's normal **undo**. The "discards the whole section" detail stays (it is still true and useful), but it is now framed as "undo restores it," not "you are asked to confirm."
- **`:39`** — Rewrite the **Remove section** clause so it removes the section **directly** (like the tree's section "Remove"), with no confirm step; recoverable via undo.

**Do NOT.**
- Do not leave any "asks you to confirm" / "confirm before discarding" wording in the README — both sentences must drop it.
- Do not document the `ConfirmDialog` removal, `confirmOpen`, or `pendingRemoveSection` as developer-facing detail — the README's developer file-layout rows (`README.md:142–143`) never mentioned them (confirmed by `git grep`), so there is **nothing to update there**, and the rationale lives in the in-code `StructureTree` class docstring (written by code-plan Task 2), not the README.
- Do not claim a new undo feature exists — native editor undo already worked; the change is only that delete no longer pre-confirms.

**Acceptance criteria.**
- The README no longer says section removal "asks you to confirm" anywhere (neither the tree paragraph nor the Section panel bullet).
- The README states all removals are immediate and reversible via the editor's undo.
- The "removing a section discards the whole section / all its measures and notes" information is preserved (now tied to undo, not to a confirm prompt).
- No `.rp/` reference; voice matches the surrounding prose; `docs/song-format.md` untouched.

**Dependencies.** Code-plan Task 2 (R-DEL) shipped.

---

## Task 3 — Verify no further README drift (no-edit confirmation task)

**Goal.** Confirm that the remaining review-10 changes need **no** README edit, so the doc phase neither leaves stale prose nor invents an unnecessary task. This task **edits nothing** unless a `git grep` surprise turns up; it produces a short confirmation in the doc-writer's report. Run it **after** Tasks 1 and 2.

**Audience.** N/A (verification).

**Items to confirm (each already checked against the live README at plan time; re-confirm on the shipped tree):**

- **Inspector "Alteration note" → "Note" label (R-LR3).** The README does **not** mention "Alteration" or that field label (`git grep -i alteration README.md` → no hits). No doc task.
- **List-row layout / min-width / `alignment="center"` (R-LR1/LR2).** Internal CSS/layout detail; the README does not describe field widths or the trash-icon alignment. No doc task.
- **JSON-mode error notice now lists every error (R-JSON).** The README's raw-JSON section (`README.md:65`) already describes the notice **generically** — "shows a clear error notice … when the content is not valid JSON or does not conform" — and never claimed "only the first error." It is already accurate for an all-errors notice; no edit needed. (Tighten only if, on re-read, the shipped copy contradicts it — it should not.)
- **Invalid-state markup tidy: drop `<p>`, wrap in `VStack` (R-INVALID).** Not user-observable and not described in the README. No doc task.
- **Post-mutation focus management (R-FOCUS).** The README contains **no** focus-behavior wording (`git grep -i focus README.md` → only the structure-tree paragraph, which is about selection/expansion, not DOM focus). The "auto-selecting it" / "select the new node" wording (`README.md:33`, `:142`) stays correct (add/duplicate still selects the new row). No doc task.
- **Canvas framing → "display + highlight only" (R-DOCS, in-code).** The README **already** says the canvas is "display + highlight only" / "the live render with selection highlighting" at every mention (`:5`, `:12`, `:19`, `:29`, `:142`, `:143`, `:203`); `git grep -i interactive README.md` finds only `:203`'s "interactive piano experience," which refers to **future audio**, not the canvas. The R-DOCS comment fixes live in `src/edit.js` / `src/editor.scss` (code-plan Task 8). No README edit.
- **Stylesheet-name fix `style.scss` → `editor.scss` (R-DOCS, in-code).** The README's "build model" already correctly attributes the editor layout/flex rules to `src/editor.scss` and the `@font-face`-only role to `src/style.scss` (`:131`, `:145–146`). The stale `style.scss` mention being corrected is an in-code `edit.js` comment, not a README line. No README edit.
- **`songModel.js` CRITICAL doc-block trim, R-NUM rationale, R-NOOP `?? undefined` (R-DOCS / R-NUM / R-NOOP).** All in-code only; none surfaced in the README. No doc task.
- **`docs/song-format.md`.** Editor-side-only run; the song format/schema is byte-identical. Confirm no change is needed (it is not).

**Acceptance criteria.**
- A `git grep` over the shipped README confirms: no "confirm"/"confirm dialog" survives for section removal (Task 2 done), no "collapse only via chevron/ArrowLeft" survives (Task 1 done), and none of the above items left stale prose.
- The doc-writer's report explicitly states that the remaining changes needed no README edit (with the one-line reason per item), so the absence of those tasks is a recorded decision, not an oversight.
- If any item unexpectedly does have stale README prose on the shipped tree, the doc-writer documents the shipped behavior in the smallest matching edit and notes the deviation from this plan — rather than silently skipping it.

**Dependencies.** Tasks 1 and 2.

---

## Out of scope for this doc plan

- **In-code docstrings and comments.** The `StructureTree` class docstring and `RowLabelCell` JSDoc refresh, the `edit.js`/`editor.scss` canvas-framing comment fixes, the `edit.js` stylesheet-name fix, the `songModel.js` CRITICAL trim, and the R-NUM rationale note are all written by the **code phase** (code-plan Tasks 1, 2, 3, 8, 9). They are not README content and are not re-edited here.
- **`docs/song-format.md`.** Unchanged — the run is editor-side only and the song format is byte-identical.
- **The follow-up tracking issues (R-FOLLOWUP).** Filed in the code phase as GitHub issues; deferred features are **not** documented as shipped capabilities. The README's "Forthcoming" section already lists the deferred areas (audio, richer notation) at the right altitude and needs no per-issue update.
- **Test-author comments using "interactive"/"reads and edits"** (in test files) — not user-facing docs; optional in-code polish handled, if at all, by the code phase.
