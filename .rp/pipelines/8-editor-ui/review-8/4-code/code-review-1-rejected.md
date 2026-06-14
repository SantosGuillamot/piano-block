# Review 8 — Code review (iteration 1): REJECTED

**Verdict:** REJECTED.
**Diff reviewed:** `d139170..HEAD` (HEAD = `4ee4cdb`), excluding `.rp/`.
**Suite state at HEAD:** `npm run check` clean; `npm run test:unit` = 22 suites / 684 tests pass; `npm run build` succeeds and emits both `build/index.css` (editor-only) and `build/style-index.css` (front-end). All independently re-verified.

The batch is overwhelmingly correct: 19 of the 20 numbered requirements and all five IN-Optionals are implemented faithfully, render byte-identity holds, scope boundaries are respected, and the two atomic mock+production pairs landed cleanly. One defect, however, breaks the single most important guarantee this review exists to protect — the "tests green ≠ real component broken" meta-rule — for the marquee Must-fix item (R1). That is rejection-worthy on its own terms because the review prompt's explicit charge is: *"Try to construct a way the bug could regress with the suite still green — if you can, reject."* I can, for R1.

---

## Issue 1 (BLOCKING) — R1's always-run jsdom guard does not catch the literal production bug

**Requirement:** R1 / A1 (unit) and the cross-cutting verification meta-rule (spec.md §"verification meta-rule"; design-doc §"Test strategy", R1 bullet): the always-run jsdom guardrail must fail RED on the exact regression the old mock masked — namely a `<TreeGrid>` rendered with no (or no-op) `onExpandRow`/`onCollapseRow` callbacks, which is the original shipped bug from finding #1. The design states verbatim that the always-run pins "(a)+(b) make a no-callback ... regression fail in the always-run suite even though the mock cannot drive real arrows."

**Defect:** They do not. The test intended to be guard "(b)" is mislabeled and asserts the wrong thing.

- **File/line:** `src/editor/__tests__/StructureTree.test.js:628-645`, the test `it("passes non-no-op onExpandRow and onCollapseRow to the treegrid", …)`. Its body never inspects `onExpandRow`/`onCollapseRow` at all — it only re-queries the rows carrying `data-expansion-key` and asserts the attribute is present and non-empty. That is a duplicate of the assertion already made by `…:596-615` ("carries data-expansion-key on each expandable row…"). The callback wiring is never exercised.
- **Root cause:** the TreeGrid mock (`test/mocks/wordpress-components.js:466-478`) deliberately swallows `onExpandRow`/`onCollapseRow` into `_onExpandRow`/`_onCollapseRow` and never invokes them, so nothing in the always-run suite touches the callback path. Only the e2e (T20) drives it.

**Empirically demonstrated** (regressions applied to a clean tree, full suites re-run, then reverted):
- Removing **both** `onExpandRow={onExpandCollapseRow}` and `onCollapseRow={onExpandCollapseRow}` from the `<TreeGrid>` in `src/editor/StructureTree.js:583-584` — i.e. reproducing finding #1's original bug verbatim — leaves `StructureTree.test.js` + `selection.test.js` + `Edit.test.js` **all green (84/84)** and `npm run check` clean.
- Pointing both callbacks at `() => {}` (the silent no-op the design calls out as "the root cause of the bug") also leaves the `…:628` test **green**.

For contrast, the analogous guards for the other two meta-rule items **were** verified RED-on-regression and pass:
- R2: reverting `aria-label` → `label` makes `StructureTree.test.js:649` go RED (verified).
- R16: flipping any production `icon={plus}`/`icon={trash}` back to a string makes `src/editor/__tests__/icons.test.js` go RED (verified).

So R1 is the lone hole, and it is the highest-stakes one (a Must-fix accessibility bug whose always-run net is the safety the spec demanded). The e2e (T20, `specs/editor.spec.js:1130-1226`) is correct and does drive real Arrow keys — but it is Docker-based and "may not run in-env," so the always-run gate is the one that must hold, and it does not.

**Fix (re-dispatch T6):** make the always-run jsdom guard actually exercise the callback wiring so a no-op / missing-callback regression fails RED. Cheapest faithful options:
1. Have the TreeGrid mock expose the passed `onExpandRow`/`onCollapseRow` (e.g. stash them where the test can reach them, or render them onto the table via a ref/test hook), then in the test build a synthetic `<tr data-expansion-key="s0">`, invoke the captured `onExpandRow(syntheticRow)`, and assert the component's `onToggleExpanded` spy fired with `"s0"`. This closes the gap end-to-end (covers no-op, missing, and wrong-key regressions) and matches the design's stated intent.
2. At minimum, capture the props the component passes to `<TreeGrid>` and assert `onExpandRow`/`onCollapseRow` are functions that are not the mock/default no-op and route through `onToggleExpanded`. (Pure attribute-presence is insufficient — that is the current bug.)

Also rename/retire the misleading `…:628` test so its name matches what it asserts (or fold it into the real callback assertion).

**Task ID to re-dispatch:** **T6** (it owns the `<TreeGrid>` callback wiring and the `StructureTree.test.js` keyboard-wiring guard). The production wiring in `StructureTree.js` is correct and need not change; only the always-run guard must be strengthened (and, if option 1 is taken, the TreeGrid mock in `test/mocks/wordpress-components.js`).

---

## Everything else — verified PASS (no action required)

Recorded so the re-dispatch stays surgical and nothing already-correct is disturbed.

- **R1 production wiring (correct):** `StructureTree.js` passes both callbacks to one shared `onExpandCollapseRow` handler (`:269`) that reads `expansionKeyOf(row)` and routes to `onToggleExpanded`; every expandable row (section/measure/hand) carries the kebab-literal `data-expansion-key`; leaf note rows carry none (`StructureTree.test.js:617-626` verified, and the regression that strips a row's `data-expansion-key` correctly goes RED). The pure read-side mapping (`expansionKeyOf` → key) is pinned in `selection.test.js:285+`. The wiring is right; only the callback guard is weak.
- **R2 (accessible name):** `aria-label={__("Song structure",…)}` on `<TreeGrid>`; dead `label` prop gone; the TreeGrid mock (`wordpress-components.js:466-478`) no longer maps `label`→`aria-label` and spreads `…rest`; RED-on-regression verified.
- **R3 + R17 (CSS split + admin color):** `src/editor.scss` holds workspace/tree/canvas/`.is-selected`; `style.scss` retains only `@font-face` + wrapper border/padding/color; `index.js` imports both; `block.json` keeps `"style"` and adds `"editorStyle": "file:./index.css"`. Build output byte-confirmed: `style-index.css` carries no editor classes; `index.css` carries them plus `var(--wp-admin-theme-color, #007cba)`. `.is-selected` is recolor-only; `__canvas` trimmed to `flex: 1 1 auto; min-width: 0`; `__song-input` hook and stale comments gone; `[aria-level]` `@for` indent preserved.
- **R4 (control props):** controls opt into `__next40pxDefaultSize`; no `__nextHasNoMarginBottom` on any `NumberControl`; the `edit.js` `TextareaControl` has `__nextHasNoMarginBottom`.
- **R5 (README dependency wording):** no longer claims "no new runtime dependency" nor calls ajv the "first" runtime dependency; acknowledges bundled `@wordpress/icons`; validator zero-dependency narrative intact.
- **R6 (`updateHandEvents`):** empty-hand rule encoded once (empty/`null` → key deleted = `undefined`, never `[]`); composes on `setMeasureAt`; full unit coverage in `songModel.test.js` (grow / grow-missing / shrink-to-empty / shrink-non-last / null / immutability); `Edit.test.js`'s empty-hand integration pin (`rightHand` → `toBeUndefined`) unchanged and green.
- **R7 (RowActionsMenu) + Guardrail B:** one module-local `RowActionsMenu` replaces 3 copies; `toggleProps` forwarded to `DropdownMenu`; children are a render function (`{({ onClose }) => …}`) — the mock's null-on-non-render-fn canary stays armed; `RowLabelCell` folds the section+measure twins (select-only, `aria-current`), hand/note cells left explicit.
- **R8 (dead `interactive` removed) + render parity:** `interactive`, `hitRect`, `HIT_RECT_WIDTH_SP`, `HIT_RECT_VERTICAL_MARGIN_SP`, and `data-hit` are all gone from `src/notation/` production; the five render fns drop the trailing param; a surviving flagless `renderSvg(model)` no-`data-hit` assertion remains (`svg.test.js`); README interactive/hit-rect sections removed, byte-identical point kept.
- **R9 (extracted shared helpers) + React-free:** `src/song/accessibleName.js` (imports only `@wordpress/i18n`) and `src/notation/dom.js` (imports only `./constants.js` + `./glyphs.js`, no `@wordpress/element`, uses `container?.clientWidth ?? 0`); old `src/editor/accessibleName.js` deleted; both `view.js` and `SongCanvas.js` import the shared modules and no longer define them locally; the `NARROW_*` consts moved into `dom.js`; the per-surface `ResizeObserver` wiring is **not** unified (verified: `SongCanvas.js` keeps its React `useEffect`/`ResizeObserver`, `view.js` keeps its imperative one).
- **R10 (kind stamp + compat delete):** the `resolveSelection` defaulting/compat block, its docs, and the compat test are gone (`selection.js:184` reads `const { kind } = selection;`); every `setSelection({…})` producer in `edit.js` stamps `kind` (events/sections/measures), `setSelection(null)` clears excepted.
- **R11 (parse once):** `accessibleName` memo reuses `working` (no second `JSON.parse`); `isInvalid = song.trim() !== "" && errors.length > 0`.
- **R12 (omit unify + emit re-home):** `MetadataEditor` uses `omitFalsy`; local `withField` gone; `emit.js` moved to `src/editor/emit.js` exporting only `omitEmpty`/`omitFalsy` (emitBlock/emitMember inlined); no production cross-`inspector/` import; new whitespace-only-Title drop test present (`SongPanel.test.js`).
- **R13 (annotations collapse):** both `NotePanel` and `MeasurePanel` drop the `annotations` key through the omit helpers. Minor nit (non-blocking): the two surfaces still use slightly different surface forms (`changeOptional("annotations", undefined)` vs `omitFalsy(measure, "annotations", undefined)`) — both behave identically and route through the helpers, so R13's intent is met; tidy only if T16 is otherwise reopened.
- **R14 / R15 / O2:** `HandConfigEditor` uses shared `replaceAt`/`removeAt`/`insertAt`; single exported `NONE_OPTION`; `ALTER_KEY_OPTIONS` derived from `noteNameOptions("english")`; one `HANDS` export with `STAVES` derived from it; `notation/layout.js`'s own `HANDS` array left untouched (layer boundary respected).
- **R16 + O1 (element icons + project-wide guard):** production swaps to `icon={plus}`/`icon={trash}` (+`isDestructive`), AddButton's redundant inner `label` dropped (text child kept); no string-slug icons remain in production; icons mock exports element sentinels incl. `trash`; default `Icon`/`Button`/`DropdownMenu` mocks render element icons / nothing for strings; `icons.test.js` mounts all five icon-bearing components and is RED-on-regression (verified); realIcons test + two-project jest config + React-dedup mapper deleted; single flat jest config.
- **R18 (comments + provenance):** project-wide provenance grep over non-test `src/` (`\bT[0-9]|\bAC[0-9]|\bKD |Req [0-9]|\(R[0-9]|R-REG`) returns **zero**; stale `EventRow`/`MeasureEditor`/`BarlineControl`/`SectionEditor`/`repairPath`/`SongPreview` references gone.
- **R19:** `ContextEditor` no longer accepts `heading` or renders `<h3>`; `SectionPanel` no longer passes it.
- **R20 (`ancestorKeys`):** exported from `selection.js`; three-key reveals in `edit.js` route through it; byte-identity pinned (`s0`/`s0m1`/`s0m1rightHand`/`s0m1rightHande0`) in `selection.test.js`.
- **O3 / O4 / O5:** sprintf label composition in `HandConfigEditor`; `newRest` + `BPM_MIN_EXCLUSIVE` deleted (BPM keeps `min={1}`); `toNumber`/`measureCoords`/`serializeSong` de-export handled per the per-symbol rule; dead `ToggleControl`/`TreeGridItem` mocks removed; `Flex`/`HStack` spacing applied.
- **Orchestrator decisions both sound:** R10 fully landed in T1 (compat gone, edit.js stamps `kind`) with no untagged-selection regression; T19's README edits correct (file-layout doc work is correctly left to phase 5).
- **Scope discipline:** song schema, `render.php`, front-end SVG, and `package.json`/lockfile unchanged; prior-review wins (toggleProps roving-tabindex, select-only label, single expansion `Set`, `[aria-level]` indent, recolor-only highlight, raw-JSON mode) preserved.

---

## Re-dispatch summary

- **T6** — strengthen the R1 always-run jsdom guard (and the TreeGrid mock if needed) so a missing / no-op `onExpandRow`/`onCollapseRow` regression fails RED in the always-run suite; rename the misleading `StructureTree.test.js:628` test. Production wiring in `StructureTree.js` is already correct — do not change it. Keep the e2e (T20) as-is.

No other task needs re-dispatch.
