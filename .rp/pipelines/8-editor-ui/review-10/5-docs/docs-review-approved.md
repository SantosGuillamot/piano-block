# Docs review — Review 10 (APPROVED)

_Piano block editor UI, Issue #8, PR #22, branch `worktree-8-editor-ui`. Adversarial batch review of the documentation tasks D1–D3 against the doc plan, spec, design, and the **shipped code**._

**Verdict: APPROVED.**

**Scope reviewed:** `git diff 7b2fc36 HEAD -- README.md docs/` — the doc phase changed **only `README.md`** (3 insertions / 3 deletions, the two rewritten sentence clusters). `docs/song-format.md` was untouched. Commits in range: `5ed989d` (D1), `428d962` (D2); D3 made no edit, as planned.

## D1 — Symmetric tree-label toggle (`5ed989d`)

Accurate and complete. Verified against the shipped `RowLabelCell` (`src/editor/StructureTree.js:156-159`): the label `Button` `onClick` is the unconditional `onSelect?.(); onToggleExpanded?.(rowKey);` — no `if (!isExpanded)` guard. The README clause at `:29` now states that clicking a section/measure label always selects the row and **flips** its expansion (a collapsed label selects + reveals; an already-expanded label selects + collapses), exactly matching the code.

- No remaining sentence restricts collapse to the chevron / ArrowLeft; the old "just selects it … collapsing stays on the row's chevron, or ArrowLeft" wording is gone (confirmed by grep).
- The collapsed-label select + reveal behavior is preserved.
- The chevron and ArrowRight / ArrowLeft are kept as **additional** ways (the fix is additive), correctly framed.
- The hand-group-row sentence ("clicking one only toggles its expansion") is unchanged, as required.
- Voice matches the surrounding dense bold-lead-in / em-dash prose. No `.rp/` leakage.

## D2 — Immediate deletes, no confirm (`428d962`)

Accurate and complete. Verified against the shipped code: no `ConfirmDialog` / `confirmOpen` / `pendingRemoveSection` remains anywhere in `src/` (grep clean). Both delete entry points fire directly — `SectionPanel.js:150` ("Remove section" → `onRemoveSection?.(sectionIndex)`) and `StructureTree.js:393` / the row "Remove" `MenuItem` (`onRemove?.()` → `onRemoveSection?.(sectionIndex)`).

- No "asks you to confirm" / "confirm before discarding" wording survives anywhere in the README — neither the tree paragraph (`:33`) nor the Section panel bullet (`:39`). `git grep -i confirm README.md` returns nothing.
- The "removing a section discards the whole section — all its measures and notes" information is preserved and now tied to undo, not a confirm prompt.
- No new-undo-feature claim — the prose says reversal happens via "the editor's normal undo," correctly framing native undo as pre-existing.
- No `ConfirmDialog` / `confirmOpen` / `pendingRemoveSection` leaked as developer-facing detail.

## D3 — No-further-drift verification (no commit)

The no-edit decisions are correct against the live README:

- **R-JSON** (`README.md:65`): the error-notice description is already generic ("shows a clear error notice … when the content is not valid JSON or does not conform") and never claimed "only the first error" — accurate for an all-errors notice. No edit needed.
- **R-DOCS canvas framing**: "display + highlight only" / "display-only" / "the live render with selection highlighting" appears at every canvas mention (`:5`, `:19`, `:142`, `:143`). The single "interactive" hit (`:203`, "interactive piano experience") refers to **future audio**, not the canvas. Correct.
- **R-DOCS stylesheet attribution**: `:131`, `:145-146` correctly attribute the editor layout/flex rules to `src/editor.scss` and the `@font-face`-only role to `src/style.scss`. Correct.
- **R-LR3 "Alteration"**: absent from the README (grep clean). No field-label or width prose to update.
- **R-FOCUS**: no DOM-focus wording in the README; the only "focus" hit (`:29`, "when the row is focused") is about keyboard expansion, not focus management. Correct.

No stale prose was left and no spurious edit was made.

## Guardrails

- **No `.rp/` leakage**: no requirement IDs, task numbers, "review N", or pipeline references in the README. (The `:88` "## Requirements" hit is the README's own end-user section heading — a benign false positive.)
- **`docs/song-format.md` untouched** by review-10: no commit in `7b2fc36..HEAD` touches it; the only changed file in range is `README.md`.
- **Voice**: both rewrites match the surrounding bold-lead-in, em-dash, single-paragraph register.

All three tasks accurately reflect the shipped code, are complete, drift-free, and clean.
