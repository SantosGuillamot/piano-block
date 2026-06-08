# Code-Plan Review — Review 3: APPROVED

**Verdict:** Approved.
**Reviewer:** code-plan-reviewer (review-3).
**Plan under review:** `3-plan/code-plan.md`.
**Against:** `2-design-doc/design-doc.md`, `1-spec/spec.md`, and the live `src/`.

## Rationale

The plan executes the approved design doc faithfully and is verified-accurate on every
load-bearing claim I checked against the live tree. The eight tasks are correctly ordered
for single-tree sequential execution, each independently committable with passing
`npm run test:unit` and clean `npm run lint`. Spec coverage is complete: every Requirement
(1–16) and Acceptance Criterion (1–13) is carried by some task's "Traces to" (Req 8 /
reordering is correctly absent as out-of-scope). The design's Key Decisions are all
honored — TreeGrid left workspace + second `ToolbarButton` toggle (KD 1–3); tree-driven
selection reusing the same kind-tagged tuples so `resolveSelection` / `decorateSelection` /
kind-gated panels light up unchanged (KD 5); removal of canvas click-to-select AND the
right `StructureList` (KD 5); `duplicateAt` deep-copy-after + three `onDuplicate*` handlers
+ lifted `onRemoveNote`, all routed through `commit` → `commitSong` (KD 7–9); additive
permissive `name` on section + measure (KD 10); inspector `TextControl` rename dropping the
key when blank (KD 11); pitch-name labels with octave deferred (KD 13); non-selecting
hand-group rows (KD 14).

## Verification performed (claims confirmed against live `src/`)

- **Boundary / minimal revert (the flagged item) — CONFIRMED.** `src/notation/svg.js`
  reads `interactive` defaulting to `false` (`renderSvg(model, { … interactive = false })`,
  line ~284) and emits `hitRect` / `data-hit` ONLY under `if (interactive)` (renderNote
  ~771, renderRest ~918). `src/view.js` and `src/render.php` never reference
  `interactive` / `hitRect` / `data-hit` (grep empty). Therefore dropping `interactive:
  true` at the `SongCanvas.js` `renderInto` call site (`SongCanvas.js:276`) makes the editor
  SVG byte-identical to the front end while leaving `svg.js` byte-stable — no `svg.js` edit
  needed. The `svg.test.js` describe `renderSvg — editor-only per-event hit-rect
  (interactive flag)` (lines 986–1051) exercises `renderSvg`'s unchanged API in isolation,
  so it stays green unedited. **The plan's minimal-revert choice and its reconciliation note
  (plan lines 31–56) are accurate and acceptable.** The inert gated `hitRect` / `HIT_RECT_*`
  / `interactive`-threading code remaining in `svg.js` is the design's explicit, declared
  trade (KD 6 / Risk R-2); requiring the full revert would force deleting/updating that
  whole describe block and many signatures for no front-end benefit — correctly deferred as
  optional cleanup. `render.spec.js:529` already asserts `[data-hit]` count 0 — verified, no
  edit (plan T7/T8 correctly say "verify, do not edit").
- **Schema delta is `name`-only — CONFIRMED.** `src/song/schema.js` has the `language`
  precedent and an unchanged `required` on `$defs.section` (`["measures"]`) and
  `$defs.measure` (none). T1's additive `name: { type: "string" }` with `required`
  untouched is correct. T1 adapts (not literally copies) the `language`-enum test shape in
  `schema.test.js:34` — the plan specifies `type: "string"` assertions, which is right.
- **Helper substrate — CONFIRMED.** `songModel.js` has `insertAt`/`removeAt`/`replaceAt`
  with tolerate-and-copy out-of-range behavior, so T3's `duplicateAt = insertAt(list, index
  + 1, structuredClone(list[index]))` with the matching out-of-range guard is consistent.
  `noteNames.js` owns `stepInSystem` (canonicalizing) and does NOT yet import `__` — T2
  correctly adds that single `@wordpress/*` import. `selection.js` exports
  `resolveSelection` and the coord helpers; `decorateSelection` lives in `SongCanvas.js`
  (both plan and design reflect this).
- **Panels / emit idiom — CONFIRMED.** `SectionPanel.emitSection` and
  `MeasurePanel.emitMeasure` exist as T4 describes; `emit.js` carries the drop-when-empty
  `emitBlock` idiom. `MeasurePanel`'s body is entirely inside `ToolsPanel`, so T4's note to
  add the name `TextControl` OUTSIDE the ToolsPanel is correct. `NotePanel.removeEvent`
  matches the lifted-`onRemoveNote` description (drops the hand key when emptied; signals
  via `onRemove?.()`).
- **Mocks — CONFIRMED.** `test/mocks/wordpress-components.js` already exports a DOM-honest
  `TextControl` (T4 needs no mock change) but has NO `__experimentalTreeGrid*` exports — T6
  correctly adds them. `test/mocks/wordpress-i18n.js` `sprintf` supports both bare and
  positional (`%1$d`) forms, so T6's positional action labels render under test.
- **Test-path corrections — CONFIRMED.** `StructureList.test.js` really lives at
  `src/editor/__tests__/StructureList.test.js` (T6's note that the design's
  `inspector/__tests__/…` citation is stale is right). The Edit/SongCanvas/e2e test names
  the plan re-points all exist: `Edit.test.js` `"seeds a first note from the Structure
  list…"` (305), `"onAddMeasure targets the section the Structure list fires for"` (447),
  the canvas-click `selectLoneNote` helper (382) and the `kind-tagged panel gating` (389) /
  `lifted structural mutators` (400) describes; `editor.spec.js` `structureRow` helper, the
  `Add note to measure 1 of section 1` / `Add measure to section 1` labels, the
  `"clicking a note off its ink (in-column gap) still selects it"` hit-rect e2e (404), and
  the `"selecting Structure rows reveals the right panels and highlights the canvas"`
  test (523) it folds the AC3 assertion into.
- **Tooling — CONFIRMED.** `package.json`: `lint` = `biome lint .`, `test:unit` =
  `wp-scripts test-unit-js`. The plan never invokes `npm test` or `wp-scripts lint-js`.

## Ordering / commit-green soundness

Each task ends green and is independently committable. Two sequencing seams were checked
closely and are sound:

1. **StructureList removal (T6).** T6 deletes `StructureList.js` + `StructureList.test.js`
   AND re-points the StructureList-driven Edit tests to the tree IN THE SAME TASK — no
   dangling import, no orphaned test.
2. **Canvas-click removal (T7).** Through T6 the plan deliberately keeps
   `onSelect={setSelection}` on `SongCanvas`, so the canvas-click `selectLoneNote`-based
   tests (`kind-tagged panel gating`, `lifted structural mutators`) keep passing. T7 removes
   canvas click-to-select AND re-points / folds those `selectLoneNote` tests in the same
   task. No green gap between tasks.

## Minor, non-blocking observations (for the code-writers, not rejection grounds)

- **T5 duplicate-handler coverage placement** is left as an explicit either/or (test the
  three `onDuplicate*` directly in T5 via a minimal driver, OR cover them via the tree in
  T6). Both are acceptable; the handlers must exist and be committed in T5 regardless, which
  the plan states. The author should pick one and ensure each duplicate path has at least
  one assertion of deep-copy-after-original + `validateSong(persisted) === []` by end of T6.
- **T6 action-label uniqueness:** the plan already flags the `exact`-name collision concern
  (mirroring the e2e `structureRow` `exact` use). The author must keep section/measure/note
  add/remove/duplicate labels distinct (the positional ordinals make this achievable) so
  unit and e2e `getByRole({ name, exact })` lookups never collide — called out, just
  emphasizing.
- **`name` test (T1/T4):** an existing-song-without-`name`-stays-valid assertion is implied
  by the permissive walker; T1's acceptance already requires no regression in
  `validate.test.js`. Fine as written.

None of these change the verdict.

## Conclusion

The plan is complete against the spec, faithful to the design, technically feasible on the
live tree, correctly ordered for sequential single-tree execution, and accurate on the
front-end boundary (minimal `interactive` revert leaves `svg.js` byte-stable and the
front end unchanged). **Approved — no task IDs require rework.**
