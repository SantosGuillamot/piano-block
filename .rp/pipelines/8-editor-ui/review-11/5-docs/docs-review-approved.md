# Docs Review — Review 11 (APPROVED)

Iteration N=1. doc-reviewer gate. Verdict: **APPROVE**.

Reviewed FULL review-11 doc batch. Doc change this run: `README.md` only, commit `29262cf` (two edits, both in "### 2. Build the song in the visual editor"). DT2 + DT3 verified-no-ops (no doc edit). Checked every claim against SHIPPED code/behavior on branch `worktree-8-editor-ui`, not plan intent.

## What me check

### DT1 (B4) — fresh block open with first section + first measure expanded — README:27

Me read seed in `src/edit.js`. `expanded` start with TWO key only:
`expansionKey({ sectionIndex: 0 })` + `expansionKey({ sectionIndex: 0, measureIndex: 0 })`. No hand key. No "Start a song" CTA anywhere.

README:27 say:
- "first section and its first measure already expanded" → match the two seed key EXACT. Accurate.
- "Right hand / Left hand rows — and the Add note button on each of them — reachable immediately, no chevron to expand first" → measure expanded make `HANDS.forEach` render hand rows; hand row hold "Add note" Button. Accurate.
- "Only that first section and first measure start open (the hand rows themselves are not auto-expanded...)" → EXACT; no hand key in seed. NO over-claim.
- "but their Add note button sits on the hand row, visible as soon as the measure is open" → Add note Button live in hand-row actions cell, render when measure expanded (before hand row itself expand). Correct — no under-claim, no over-claim.

DT1 accurate, scoped to fresh/freshly-inserted block, no over/under-claim. PASS.

### Keyboard correction (scope-expansion doc fix) — README:29

Old README claim "when the row is focused, ArrowRight / ArrowLeft remain additional ways to expand and collapse" — GONE. Replace with "the row's chevron remains an additional way to expand and collapse".

Me confirm:
- README no longer claim ArrowRight/ArrowLeft expand/collapse. Confirmed (diff show old clause removed).
- Removal justified against SHIPPED: 3 e2e arrow-key parity test are `test.skip` at `specs/editor.spec.js:1306`, `:1349`, `:1386`, all "tracked in #39". Source DO wire `onExpandRow`/`onCollapseRow` on `<TreeGrid>`, but shipped arrow-key path is a known parity GAP (skipped tests) — so doc correctly stop asserting it. Doc match shipped reality, not source intent.
- Symmetric label-toggle description PRESERVED: "a collapsed label selects the row and reveals (expands) its children, while an already-expanded label selects the row and collapses it" → match `RowLabelCell` in `src/editor/StructureTree.js` (label `onClick` fire `onSelect` + `onToggleExpanded`). Accurate.
- NO over-correction into "no keyboard path": label is a focusable `Button` (`variant="tertiary"`, get roving-tabindex `cellProps`), so Enter/Space toggle expansion — keyboard path STILL exist via label, and doc still describe the label toggle. Correct: not claim arrow keys, not claim zero keyboard path.

Keyboard correction accurate + not over/under-corrected. PASS.

### DT2 no-op (B1) — section-remove immediate/no-prompt/undo

`grep -niE 'confirm|dialog|prompt|OK'` on README.md, docs/song-format.md, AGENTS.md → only hits:
- README:33 "(no prompt)" + "reversed with the editor's normal undo" — ALREADY-CORRECT immediate/undo-reversible. Not stale confirm-dialog.
- README:39 "directly (no prompt)... recoverable with the editor's normal undo" — same, correct.
- docs/song-format.md:415 "forward-looking" — false hit, no remove claim.
- README:139 `init` hook line — false `OK`-substring hit, no dialog claim.

No stale confirm-dialog claim in any shipped doc. Shipped `StructureTree.js` doc-comment itself say "no confirm dialog... recoverable through WordPress's native undo". Verified-no-op correct. PASS.

### DT3 no-op (B2/B3/B5) — internal-source-only

- README:146 `src/editor.scss` File-layout row stay generic ("the workspace layout, structure tree, canvas, and selection highlight") — no `:first-child` / min-width citation. Accurate.
- README:142 `src/edit.js` File-layout row mention `onAddMeasure` the Section panel signals but document NO parameter default. Accurate.

Both row remain accurate, left unchanged. Verified-no-op correct. PASS.

## Adversarial checks

- ACCURACY: every doc claim match SHIPPED code (edit.js seed, StructureTree.js label/chevron/hand-row, e2e skip state). PASS.
- COMPLETENESS / DRIFT: scope-expansion add-note focus fix (StructureTree.js `useEffect` now target note row's `data-event-key` label, not measure label) is internal focus management — README describe NO post-add focus targeting, so no contradiction. e2e fixes are test code — no doc surface. No missed doc drift. PASS.
- NO over/under-claim: B4 claim only first-section + first-measure (not every row); keyboard note claim neither arrow keys NOR no-keyboard-path. PASS.
- LEAK CHECK: `grep -niE 'S5|S7|entry [AB]|4f3ed90|\.rp/|AC-[0-9]|Req [0-9]|\bT[0-9]+\b|\bB[1-5]\b'` on README.md + docs/song-format.md → CLEAN (no output). No pipeline token in shipped docs. PASS.
- VOICE: README section voice (bold-keyword density, em-dashes) and length preserved — DT1 fold into existing fresh-block paragraph, keyboard fix is in-place clause swap. PASS.

## Verdict

All claim accurate to shipped behavior. No over-claim, no under-claim, no drift, no leak, voice preserved. The two no-ops are genuine no-ops. **APPROVED.**
