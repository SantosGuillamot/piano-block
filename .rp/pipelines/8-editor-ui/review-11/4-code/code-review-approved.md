# Code Review — Review 11 (APPROVED)

**Verdict:** APPROVED (iteration 1, singleton terminator).
**Reviewer:** code-reviewer (adversarial).
**Diff reviewed:** `git diff 9fb6dfe..HEAD -- src specs` (base = review-10 tip `9fb6dfe`, current HEAD = all of review-11's code).
**Files (7):** `specs/editor.spec.js`, `specs/render.spec.js`, `src/edit.js`, `src/editor.scss`, `src/editor/StructureTree.js`, `src/editor/__tests__/Edit.test.js`, `src/editor/inspector/SectionPanel.js`.

## What was reviewed

The full review-11 batch: the planned findings B1–B5 (tasks T1–T8) **plus** the owner-authorized scope expansion that T10 surfaced when the Playwright e2e suite ran for the first time in this worktree.

### Planned work (B1–B5) — correct per spec

- **B1 (section-remove e2e drift, blocking).** Drift site 1: the OK-click is deleted, the stale ConfirmDialog comment is rewritten to the immediate/undo-reversible story, the test stays poll-only (`sections.length` → 2). Drift site 2: renamed to **"the Section panel Remove section button removes the section immediately"**; the OK-click is deleted; the page-scoped `await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0)` no-dialog guard is placed **after** the "Remove section" click and **before** the `sections.length` → 1 poll; the `page` fixture param is retained (used by `openSettingsSidebar` at `:1230`). The only surviving `name: "OK"` reference in the file is that guard. `grep -rnE 'ConfirmDialog|__experimentalConfirmDialog' src` is EMPTY — no dialog re-added.
- **B2 (stale SCSS prose).** Both the file-header comment and the `&__canvas` block comment drop the nonexistent "on-canvas add affordances" claim; the load-bearing `min-width: 0` rationale is kept verbatim. No selector/rule/value change.
- **B3 (`:first-child` comment + inline minWidth).** The comment now describes `:first-child` as the row's single leading control (three list-row users; PitchEditor/AnnotationEditor flatten Fragments into the HStack). The SCSS `min-width: 8em` value is unchanged. The inline `style={{ minWidth: "4em" }}` styles are KEPT inline (not moved to SCSS); the three `minWidth === "4em"` assertions pass (suite green).
- **B4 (first-run discoverability).** `edit.js:100` seeds the expansion Set with exactly `expansionKey({ sectionIndex: 0 })` and `expansionKey({ sectionIndex: 0, measureIndex: 0 })`, unconditionally, via the helper (no literal `"s0"`/`"s0m0"`). The e2e fallout is reconciled: `expandRow` is now idempotent (reads `aria-expanded`, clicks the chevron only when not `"true"`); the two keyboard tests get raw-chevron collapse inserts in the load-bearing order; the symmetric-label-toggle reds (`:580` re-open, `:757` collapse-before-label) are reconciled; the `Edit.test.js` `expandRow` helper gets the jsdom analog (skip when `aria-expanded === "true"`).
- **B5 (cheap simplifications).** B5.1: the dead `sectionIndex = working.sections.length - 1` default is dropped and the stale "default-to-last fallback" clause is folded out of the comment. B5.2: `keep` is derived from `OVERRIDE_KEYS` via `Object.fromEntries(...filter...)`, making `OVERRIDE_KEYS` (`SectionPanel.js:44`) the single source for both `projectOverrides` and `emitOverrides`; the following `emitSection({ ...keep, ...next })` is unchanged — identical behavior.

### Authorized scope expansion (judged on merit, minimal + correct)

T10 ran the e2e suite for the first time ever in this worktree and revealed 30 fails — almost all pre-existing test-code breakage unrelated to B1–B5. The owner authorized: (a) fix the pure test-code bugs, (b) ONE small production fix, (c) DEFER the keyboard ArrowRight/Left parity gap via 3 skips tracked in #39.

- **Test-harness fixes (no assertion weakened):**
  - `render.spec.js`: `await editor.clickBlockToolbarButton("Edit as JSON")` before filling the Song field (block defaults to visual mode). Real harness fix.
  - `editor.spec.js`: `rowChevron`/`expandRow` re-rooted to `editor.canvas.getByRole("button", …)`; `openRowAction` menu items queried on `page` (the `DropdownMenu` `Popover` portals to the main page document, not the canvas iframe) with the JSDoc updated to match; HandConfig disclosure opened via "Tempo & staves options" → "Right hand" in the two SelectControl tests; a `note.click({ force: true })` on the canvas-overlay negative-selection test (the `__canvas-svg` overlay intercepts pointer events — `force` makes the negative assertion meaningful rather than blocked by actionability, **strengthening** the test, not weakening it).
  - 3 keyboard ArrowRight/Left tests `test.skip`'d with #39 comments.
- **The ONE authorized production fix (`StructureTree.js`):** a `data-event-key={noteKey}` attribute on the note `<tr>`, plus an event-selection branch in the `focusRequest` useEffect that targets the leaf NOTE label by `data-event-key` (the enclosing measure stays `aria-current` for visual highlight). Confined to focus targeting; `eventKey` is already imported (`:74`); the `measureSelected` predicate and the `aria-current` highlight logic are untouched. No over-reach.

## Adversarial checks — all clear

- **No ⛔ rejection re-litigated:** no ConfirmDialog in `src` (grep empty); inline `minWidth: "4em"` stays inline; `src/editor/selection.js` untouched; the measure-remove e2e tests untouched.
- **AGENTS.md leak check:** `grep -rnE 'S5|S7|entry [AB]|4f3ed90|\.rp/|AC-[0-9]|Req [0-9]|\bT[0-9]+\b' src specs` returns EMPTY. The only internal-ref-shaped tokens left are the `#39` / `issues/39` GitHub references in the skip comments — explicitly allowed, not a leak.
- **No render/schema drift:** `git diff 9fb6dfe..HEAD` touches no `render.php`, no save/render, no `src/song/**` or `src/notation/**` — a published song renders byte-identically (cross-cutting constraint preserved).
- **Skips hide a genuine pre-existing gap, not a review-11 failure:** exactly 3 `test.skip`, all the keyboard ArrowRight/Left tests. The src diff contains zero `Arrow*`/`onKeyDown`/`onExpandRow`/`onCollapseRow` tokens — review-11 touched **no** keyboard wiring. The `onExpandRow`/`onCollapseRow` TreeGrid handlers are pre-existing and unchanged, so the ArrowRight/Left parity gap lives in pre-existing wiring, tracked in #39 — not a review-11-caused red being masked.
- **Over-reach check:** no production change beyond the one authorized StructureTree.js focus fix; no test weakened to hide a real failure.

## Final test state (verified)

- `npm run test:unit` → **699 passed / 699 total, 22 suites** (run locally this review; StructureTree.test.js and Edit.test.js green).
- e2e → **42 pass / 0 fail / 3 skip (45 total)** per RW4 + RW5; the 3 skips are exactly the keyboard ArrowRight/Left tests (#39). A full e2e re-run was not required and was not performed.

The spec required a **green e2e run**; the suite is green modulo 3 documented skips of a genuine pre-existing keyboard-parity gap, tracked in #39 — consistent with spec intent.

**APPROVED.**
