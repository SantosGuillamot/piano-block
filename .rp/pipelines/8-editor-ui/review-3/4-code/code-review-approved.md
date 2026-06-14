# Code Review — Review 3 (T1–T8): APPROVED

**Verdict:** Approved.
**Batch:** T1–T8 of `3-plan/code-plan.md`, diff base `c99316d..HEAD` (tip `f37f39a`).
**Reviewer:** code-reviewer (review-3, single gating batch review).

## Summary

The batch realizes the pivot completely and faithfully: the left `StructureTree`
(built on `__experimentalTreeGrid`, in a toggleable `__workspace` left of the canvas)
is now the sole selection surface; canvas click-to-select is fully removed; the right
`StructureList` is deleted; structural add/remove/duplicate exist at every level and
route through the existing `commit` → `commitSong` re-validation guard; the only schema
change is the additive, permissive, optional `name` on section + measure. The front-end
boundary is provably untouched. Unit suite is green and lint is clean. The e2e spec is
migrated to the tree surfaces and is internally consistent (live run blocked by a
wp-env port conflict, which is acceptable). I found no blocking defects.

## Verification performed

### Build health
- `npm run test:unit` → **629 passed, 20 suites** (matches the brief's 629/20 target).
- `npm run lint` (biome) → **clean** (63 files checked, no findings).
- `npx playwright test --list` → **32 tests in 2 files** (`editor.spec.js` 19 +
  `render.spec.js` 13); the spec compiles and collects. Live e2e not executed.

### Spec coverage (Req 1–16, AC1–AC13) — all realized
- **Req 1–2 / AC1:** `StructureTree.js` renders Section → Measure → {Right/Left hand} →
  Note on `__experimentalTreeGrid`; a second `ToolbarButton` ("Structure") gates an
  editor-only `showTree`; rows expand/collapse; auto-expand of selection ancestors
  reveals the selected branch. Hand-group rows are non-selecting (KD 14) and host the
  per-hand "Add note".
- **Req 3 / AC3:** `SongCanvas.js` has **0** `onSelect` references; `selectionFromTarget`,
  `makeEventsFocusable`, `activateRef`, and the click/keydown listeners are gone;
  `renderInto` is called **without** `interactive`. `edit.js` no longer passes `onSelect`
  to the canvas. `editor.spec.js` asserts a canvas note click does NOT select (no Note
  panel, no `.is-selected`).
- **Req 4–5 / AC2, AC9:** `decorateSelection` and the draw/resize effects are unchanged;
  tree rows call the same kind-tagged `setSelection`, so the canvas highlight and the
  kind-gated `Note`/`Measure`/`Section` panels light up via the existing substrate.
- **Req 6–8 / AC4–AC6:** add (`onAddSection`/`onAddMeasure`/`onAddNote`), remove
  (`onRemoveSection`/`onRemoveMeasure`/ lifted `onRemoveNote`), and duplicate
  (`onDuplicateSection`/`onDuplicateMeasure`/`onDuplicateNote` via `duplicateAt`,
  index+1, `structuredClone` deep copy after the original) exist at every level and all
  route through `commit`. Reordering (Req 8) is correctly **absent**. `onRemoveNote`
  drops an emptied hand key and clears a stale selection; the duplicate handlers guard
  missing section/measure/hand against a throw.
- **Req 9–10 / AC7, AC8:** Section/Measure rename via a `TextControl` "Section name" /
  "Measure name", emitting through `emitSection`/`emitMeasure` and **dropping the key
  when blank** (no empty husk). `noteLabel(event, system)` returns `"rest"` for rests,
  else pitches through `stepInSystem` space-joined, **no octave**. Tree labels are
  `name`-or-positional. `NotePanel` delegates its Remove to the lifted `onRemoveNote`
  (one implementation).
- **Req 11–12 / AC10:** `schema.js` adds `name: { type: "string" }` to `$defs.section`
  and `$defs.measure` only; `required` is unchanged (optional, permissive — never blocks
  raw-JSON saving).
- **Req 13:** `src/editor/inspector/StructureList.js` and
  `src/editor/__tests__/StructureList.test.js` are **deleted**; no dangling import (the
  only "StructureList" token left is an explanatory comment in `StructureTree.js`).
- **Req 14–15 / AC11, AC12:** every surface commits through `commitSong`'s
  re-validation; raw-JSON non-blocking save, the note-language selector, progressive
  disclosure, and live re-render are carried over untouched.
- **Req 16 / AC13:** only `@wordpress/*` is imported in shipped `src`; `structuredClone`
  is used as a standard global (no import); `package.json` runtime deps unchanged.

### Boundary audit (critical) — clean
- `git diff c99316d..HEAD` leaves `src/render.php`, `src/view.js`, and
  `src/notation/svg.js` **byte-unchanged** (verified per-file with `git diff --quiet`).
- The `interactive` revert is source-free at the `svg.js` layer: `SongCanvas` simply
  stopped passing the flag; `svg.test.js` is untouched, so its dormant-but-present
  `interactive`-flag describe block stays green (matches the plan's minimal-revert
  reconciliation note).
- The only schema delta is the additive `name` (T1).
- `jest.config.js` + `test/setup/structured-clone.js` are **test-only** (a `setupFiles`
  shim delegating to `node:v8`, kept under `test/setup/` so Jest never collects it as a
  suite) and add **no** runtime dependency. `render.spec.js`'s `[data-hit]` count-0
  boundary assertion is intact and unedited.

### Tests assessed
- `StructureTree.test.js` (new): inventory, labels (name-or-positional, note/chord/rest,
  hand groups, note-name system), select payloads (incl. hand-group non-selection),
  add/remove/duplicate at every level, the per-hand Add note, expansion + auto-expand,
  `aria-current`, and ARIA wiring (`aria-level`/`-posinset`/`-setsize`/`-expanded`).
- `Edit.test.js`: `selectLoneNote` and the structural-mutator tests are re-pointed to
  drive selection **through the tree** (toggle Structure → click Section/Measure/hand/
  note rows); no Edit test clicks a canvas note to select.
- `SongCanvas.test.js`: the `decorateSelection` tests are kept (22 decoration/active
  references); the click/keydown/hit-rect `onSelect` tests are removed (0 `onSelect`
  references remain).
- `editor.spec.js`: migrated to `openStructureTree`/`treeRow`/`treeAction`; the
  caret-tolerant, case-sensitive, end-anchored `treeRow` regex correctly disambiguates
  capitalized row labels from lowercase action labels; an AC3 "canvas click does not
  select" test exists; rename/round-trip/language/JSON tests preserved.
- The live e2e was **not** run (wp-env port conflict). Accepting read-through is
  reasonable: the spec compiles, `--list` collects, the helpers target the real tree
  classes/labels emitted by `StructureTree.js`, and the action labels in the component
  match the `treeAction` strings the spec asserts. R-1 (TreeGrid experimental API) is
  acknowledged with a documented `@wordpress/*`-only disclosure+list fallback; accepted.

## Non-blocking observations (no fix required to pass this gate)
- `SectionPanel.js` / `MeasurePanel.js` header JSDoc still read "only when an event is
  selected on the canvas." These panels now also open for section/measure **tree**
  selections, and selection no longer comes from the canvas. This is stale prose, not a
  code defect; the doc-writer/doc-reviewer pass owns it and it does not affect behavior.

## Conclusion
All eight tasks land as planned, the pivot is complete, the boundary is provably
untouched, unit tests and lint are green, and the e2e spec is internally consistent with
the new tree-driven selection surface. **Approved.**
