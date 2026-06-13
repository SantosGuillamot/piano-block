# Doc plan review — APPROVED (review 10)

_Adversarial review of `3-plan/doc-plan.md` against `3-plan/code-plan.md`, `2-design-doc/design-doc.md`, `1-spec/spec.md`, and the live `README.md` / `AGENTS.md` / `docs/`._

## Verdict: APPROVED

The plan documents exactly the two observable behaviors review-10 changes — no more, no less — at correct, verified locations, and records every no-edit decision with a sound reason so a later run does not invent drift.

## What I verified against the live tree

### The two planned edits are correct and necessary

- **Task 1 (R-TREE), `README.md:29`.** The live README contains the exact OLD wording the plan quotes: "… while clicking an already-expanded label **just selects it** (**collapsing stays on the row's chevron, or ArrowLeft when the row is focused**)." The shipped code drops the `if (!isExpanded)` guard (spec R-TREE line 46; code-plan Task 1), making the label a symmetric toggle. The README genuinely describes the superseded behavior and must change. The plan correctly preserves the collapsed-label "select + reveal" half (still true) and the chevron/keyboard mentions (additive fix), and leaves the hand-group sentence untouched.
- **Task 2 (R-DEL), `README.md:33` and `:39`.** Both sentences live: `:33` "removing a **section** first asks you to **confirm**, because it discards the whole section…"; `:39` "a convenience **Remove section** that, like the tree's section 'Remove', first asks you to **confirm** before discarding…". The shipped code removes both byte-identical `ConfirmDialog`s and their gating state (spec R-DEL lines 84–104; code-plan Task 2). Both sentences describe removed behavior and must change. The plan correctly keeps the "discards the whole section / all its measures and notes" detail (still true), re-frames it around native undo, and does not invent a new undo feature.
  - Note for the writer: `git grep "confirm before discarding"` returns no hit only because the live text bolds "confirm" (`**confirm** before discarding`), splitting the literal string. The clause plainly exists at `:39`; the plan already instructs re-confirmation by grep on touch. Not a defect.

### Every no-edit decision is correct (the heart of drift-resistance)

- **R-LR3 (Alteration→Note):** `git grep -i alteration README.md` → no hits. No edit needed. Correct.
- **R-JSON:** `README.md:65` is generic — "shows a clear error notice beneath the field when the content is not valid JSON or does not conform" — and never claimed "only the first error" (`git grep "first error|errors\[0\]|only the first"` → no hits). Already accurate for an all-errors notice. Correct.
- **R-FOCUS:** `git grep -i focus README.md` → only the structure-tree paragraph (selection/expansion, not DOM focus). No focus-behavior wording exists to update. Correct.
- **R-DOCS (canvas framing + stylesheet name):** README already says "display + highlight only" at every canvas mention (`:5`, `:19`, `:143`, etc.); `git grep -i interactive README.md` → only `:203`, which is the Forthcoming "interactive piano experience" (future audio), not the canvas. README `:131`/`:145–146` already attribute the workspace/flex layout to `editor.scss` and the `@font-face`-only role to `style.scss`. The stale `style.scss` mention being corrected is an in-code `edit.js` comment, not a README line. No README edit. Correct.
- **Developer file-layout rows (`:142–143`):** `git grep "ConfirmDialog|confirmOpen|pendingRemoveSection|confirm dialog" README.md` → no hits, so there is nothing to update there for the dialog/state removal. The plan's claim holds. Correct.
- **R-LR1/LR2 / R-INVALID / R-NUM / R-NOOP:** internal CSS / markup / rationale; not surfaced in the README. No doc task. Correct.

### Drift / scope / guardrails

- **In-code docstrings/comments out of scope here.** The `StructureTree` docstring, `RowLabelCell` JSDoc, `edit.js`/`editor.scss` framing comments, `edit.js` stylesheet-name fix, `songModel.js` CRITICAL trim, and R-NUM note are all written by the code phase (code-plan Tasks 1, 2, 3, 8, 9). The plan correctly does not re-edit them.
- **`docs/song-format.md` untouched.** Editor-side-only run; song format byte-identical (code-plan guardrail, line 19). Plan instructs confirm-don't-assume. Correct.
- **No deferred/rejected work documented as shipped.** R-FOLLOWUP issues and Stage-2 list-row are kept out; the README's "Forthcoming" section is left at its current altitude. Correct.
- **No `.rp/` leakage instructed.** `AGENTS.md` confirms the standalone-docs rule; the plan repeats it as a per-task guardrail and uses no requirement IDs / task numbers / "review N" in the prose it asks the writer to produce.
- **Task 3** is a sound no-op verification task with `git grep` acceptance gates, ensuring the absence of further edits is a recorded decision, not an oversight.

### Actionability

Each task has a clear what / where / audience / acceptance, with explicit "Do NOT" fences and re-confirm-by-grep instructions that survive line-number drift from Task 1's edit. Ordering (1 → 2 → 3) is correct.

## Conclusion

No missed doc change; no spurious (over-documentation) edit; no scope creep. Approved.
