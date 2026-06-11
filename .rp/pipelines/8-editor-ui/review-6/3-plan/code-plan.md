# Review 6 Code Plan — Simplify the editor UI with Gutenberg-native components and styles

_Implementation plan for review 6 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Derived from the approved `1-spec/spec.md` and `2-design-doc/design-doc.md` (plus the two non-blocking notes in `2-design-doc/design-doc-review-approved.md`). A fresh code-writer can execute any one task from its own block without reading the others._

## How to use this plan

- **Sequential, one shared working tree.** Tasks run strictly in the order T1 → T7, each committed before the next starts, on branch `worktree-8-editor-ui` in the pipeline worktree at `/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/8-editor-ui`. The order is chosen so the unit suite and `npm run build` stay green at every commit boundary.
- **Test-driven, code + tests together.** Each task commits its source change and the test change that proves it in the same commit. The full unit suite (currently **642 tests**) and `npm run build` MUST pass at every task boundary. Run `npx jest` and `npm run build` before committing; run `npm run check` (Biome) and fix any lint/format before committing.
- **E2e cannot run here.** A wp-env port conflict blocks Playwright in this environment. The e2e specs (`specs/editor.spec.js`, `specs/render.spec.js`) are kept consistent **by construction** and validated only via Playwright test **discovery** (`npx playwright test --list`), never execution. `render.spec.js` MUST stay byte-untouched (it pins the byte-identical-publish invariant, R-E1/AC-E1).
- **Commit format:** imperative mood, sentence case, no period, your agent name in parentheses — e.g. `Consolidate inspector clamp and splice helpers (code-writer)`.
- **Never touch published output.** No change to the song schema, `render.php`, `src/view.js`, `src/svg.js`, the notation renderer, the `@font-face` "PB Music" block in `style.scss`, or any `data-*` selection hook. R-E1/AC-E1/AC-C2/AC-E1 forbid it.

## Order rationale (one sentence)

Consolidate the pure inspector helpers first (T1–T2, behavior-preserving, guarded by the unchanged panel tests), then add the test-harness stubs the tree redesign needs (T3), then rebuild the TreeGrid row and its tests (T4) before flipping `edit.js` to the single expansion model (T5), then strip the CSS the new row no longer needs (T6), and finish by migrating the e2e specs and running the full integration check (T7) — so the editor stays functional and the suite stays green after every commit.

## Baseline facts the tasks rely on (verified on-branch)

- `@wordpress/*` packages are **not** installed (`devDependencies` lists only Biome, e2e-utils, env, scripts). The build externalizes them via `@wordpress/scripts`' `DependencyExtractionWebpackPlugin`; jest maps the exercised ones to hand-written mocks (`test/mocks/wordpress-components.js`, `-i18n.js`, `-block-editor.js`) via `jest.config.js` `moduleNameMapper`. **`@wordpress/icons` is neither installed nor mocked nor mapped today, and `src/` imports it nowhere** — the redesign is the first use, so T3 adds its mock + mapping.
- The components mock has **no** `DropdownMenu`/`MenuGroup`/`MenuItem`/`Dropdown`/`Navigator` export today (T3 adds `DropdownMenu`/`MenuGroup`/`MenuItem` stubs).
- The mock's `Button` already swallows `icon`/`variant`/`isDestructive` and exposes `label`→`aria-label`; `Icon` renders a `<span data-icon>` swallowing `icon`/`size`. `TreeGridCell`/`TreeGridItem` call a render-prop child with `{}` (no roving-tabindex simulation); `TreeGridRow` maps `level`/`positionInSet`/`setSize`/`isExpanded` to the `aria-*` attributes.
- `edit.js` is the single owner of `working` + `commit` and of all four structural mutators; they already take direct coordinates. It feeds the **same** full `resolvedSelection` (carrying `eventIndex` even for measure/section kinds) to Note + Measure + Section panels simultaneously (`edit.js:491-517`) — the reason the splice consolidation (T1) MUST dispatch by caller-declared depth, never "deepest coord wins."
- Selection is already coordinate tuples (`selection.js`), never the index-path string. The index-path strings (`s0/m1/rightHand/e2`) exist **only** to key the two expansion Sets.

---

## T1 — Consolidate inspector clamp, splice, and omit helpers

**Goal.** Eliminate the duplicated inspector mechanism (R-B3) with **zero** visible behavior change: clamp/parse helpers exist once, three typed splice faces replace the three per-panel emit-splice chains, and the omit-when-empty rule lives in two shared helpers. This is pure plumbing; the panel tests are the regression net and MUST pass unchanged.

**Files.**
- `src/editor/songModel.js` (add exports)
- `src/editor/inspector/emit.js` (add exports)
- `src/editor/inspector/NotePanel.js`, `MeasurePanel.js`, `SectionPanel.js` (consume new helpers; delete local copies)
- `src/editor/PitchEditor.js`, `src/editor/HandConfigEditor.js` (consume shared `clampInt`; delete local copies)
- `src/editor/ContextEditor.js` (consume shared `toNumber`/`toBoundedInt`; delete local copies — but **leave** its draft/projection logic in place; that move is T2)
- `src/editor/inspector/SongPanel.js` (consume shared `toNumber`/`toBoundedInt`; **leave** its forked draft/projection — that is T2)
- `src/editor/__tests__/songModel.test.js`, `src/editor/__tests__/annotations.test.js` or a new `src/editor/__tests__/emit.test.js` for the extracted-helper direct tests (see Acceptance)

**Changes.**

1. **`songModel.js` — clamp/parse helpers (their numeric bounds already live here).** Add and export:
   - `clampInt(raw, min, max)` — body identical to the three current copies (`Math.round(Number(raw))`, `min` when non-finite, else clamp to `[min,max]`).
   - `toNumber(raw)` — finite number or `null` for empty/invalid (body from `ContextEditor`/`SongPanel`).
   - `toBoundedInt(raw, min)` — `Math.max(min, Math.round(parsed))` or `null` (body from `ContextEditor`/`SongPanel`).
2. **`songModel.js` — three typed splice faces over one private `replaceAt`-down-the-path core.** Add and export:
   - `setSectionAt(song, { sectionIndex }, nextSection)` → `{ ...song, sections: replaceAt(song.sections, sectionIndex, nextSection) }`.
   - `setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure)` → rebuild section.measures then section, splice section.
   - `setEventAt(song, { sectionIndex, measureIndex, hand, eventIndex }, nextEvent)` → rebuild hand → measure → section, splice section.
   - **CRITICAL (carry verbatim into the code comment): each face destructures ONLY its own coordinates.** A stray deeper coord (e.g. an `eventIndex` present on the selection handed to `setSectionAt`) is structurally ignored. Do **not** write a single "deepest-coord-wins `setAtPath`" — `edit.js` passes the same full `resolvedSelection` to all three panels, so a depth-inferring splice would mis-splice `nextSection` at the event coord and corrupt the song (design §4.3 CRITICAL note; reviewer confirmed this is the single most important correctness point). Implement each as a thin face; an internal shared `replaceAt`-chain helper is optional but the three public faces are mandatory and each must take only its own coords.
3. **`inspector/emit.js` — omit helpers (emit policy already lives here alongside `emitBlock`).** Add and export:
   - `omitEmpty(obj, key, value)` — returns a new object with `key` set when `value` is truthy and has ≥1 own key, else `key` deleted. This is the exact body shared by `emitBlock`/`ContextEditor.emitMember`/`SongPanel.emitContextMember`. Refactor `emitBlock` to call it (or share the body) so the rule has one home.
   - `omitFalsy(obj, key, value)` — returns a new object with `key` set when `value` is truthy (after `.trim()` for string names — match the current `value.trim()` check in `changeName`), else `key` deleted. This is the `changeName`/`changeBarline`/`changeOptional` scalar variant. Note `changeOptional`'s "0 dots drops the key" is the falsy-scalar case (`0` is falsy), so `omitFalsy` covers it; preserve that exactly.
4. **Rewire the panels and leaf editors to import the shared helpers and delete every local copy:**
   - `NotePanel.js`: delete local `clampInt`; import from `songModel`. Replace `emitEvent`'s inline `replaceAt` chain with `setEventAt(song, selection, nextEvent)` then `onChange(...)` — keep the `onChange` sink. Rewrite `changeOptional` to use `omitFalsy(event, key, value)` then `emitEvent(...)`; keep `changeType`'s pitch cross-field rule verbatim. The `annotations` undefined-branch inside the `AnnotationList` `onChange` and the `resetAll` destructure stay as-is (they are not the omit idiom — they are bulk drops).
   - `MeasurePanel.js`: replace `emitMeasure`'s chain with `setMeasureAt(song, selection, nextMeasure)`. Rewrite `changeName` (string, trim) and `changeBarline` (scalar) to `omitFalsy`. The `resetAll` and `AnnotationList` undefined-branch stay.
   - `SectionPanel.js`: replace `emitSection`'s chain with `setSectionAt(song, selection, nextSection)`. Rewrite `changeName` to `omitFalsy`. Keep `emitOverrides` / `projectOverrides` / `resetAll` as-is (T1 does not touch the ContextEditor composition).
   - `ContextEditor.js`: delete local `toNumber`/`toBoundedInt`; import from `songModel`. **Keep** `emitMember`, `projectTempo`, `projectTimeSignature`, the drafts, `editTempo`/`editTimeSignature` (T2 owns those). `emitMember` MAY be rewritten to call `omitEmpty` (its body is the same omit-empty rule) — that is a clean micro-dedup within T1's scope.
   - `PitchEditor.js`, `HandConfigEditor.js`: delete local `clampInt`; import from `songModel`.
   - `SongPanel.js`: delete local `toNumber`/`toBoundedInt`; import from `songModel`. `emitContextMember` MAY call `omitEmpty`. **Keep** its forked drafts/projection (T2 removes the fork).

**Depends on.** Nothing (first task).

**Traces to.** R-B3 (clamp helpers once in `songModel.js`; one splice mechanism with three typed faces; one omit helper), R-B4 (named duplicated mechanism removed), R-E4 (valid-by-construction emit preserved — same conformant projections, just relocated). Design §4.3 (DD7), §2.3 (`edit.js` feeds the same selection to all panels), reviewer note on the explicit-depth splice.

**Acceptance.**
- All existing inspector panel tests pass **unchanged**: `NotePanel.test.js`, `MeasurePanel.test.js`, `SectionPanel.test.js`, `SongPanel.test.js`, `contextControls.test.js`, `pitches.test.js`, `annotations.test.js`, `songModel.test.js`. (R-B3 is visual-change-independent, so these are the proof the de-dup changed no behavior.)
- Add direct unit tests for the extracted helpers (new or appended): `clampInt` (in/at/below/above bounds, non-numeric → `min`), `toBoundedInt` (empty → `null`, rounds + floors at `min`), `setSectionAt`/`setMeasureAt`/`setEventAt` (each splices at its own depth AND **ignores a stray deeper coord** — e.g. `setSectionAt(song, { sectionIndex:0, measureIndex:9, eventIndex:9 }, next)` still replaces only `sections[0]`), `omitEmpty` (sets when non-empty, deletes when empty/`{}`/falsy), `omitFalsy` (sets when truthy/non-blank, deletes when `""`/`0`/whitespace-only).
- `grep` confirms `clampInt` is defined exactly **once** (in `songModel.js`) and `toNumber`/`toBoundedInt` exactly once each (in `songModel.js`); the three panel emit-splice `replaceAt` chains are gone.
- `npx jest` green (642+ tests; the new helper tests add to the count), `npm run build` succeeds, `npm run check` clean.

---

## T2 — Make SongPanel compose ContextEditor instead of forking it

**Goal.** Remove the ~60-line verbatim fork of `ContextEditor`'s draft/projection logic (`projectTempo`/`projectTimeSignature` + `tempoDraft`/`timeDraft` `useState` + `editTempo`/`editTimeSignature`) from `SongPanel` by having `SongPanel` **compose** `ContextEditor` over `defaults` — while preserving `SongPanel`'s exact current visible layout. Behavior-preserving (R-B3); the `SongPanel` tests are the regression net.

**Files.**
- `src/editor/ContextEditor.js` (add a layout/tiering prop)
- `src/editor/inspector/SongPanel.js` (compose `ContextEditor`; delete the fork)
- `src/editor/__tests__/SongPanel.test.js`, `src/editor/__tests__/contextControls.test.js` (extend only as needed for the new prop; the existing pinned-layout assertions MUST still pass)

**Changes.**

1. **`ContextEditor` gains a tiering/layout prop.** **IMPORTANT (from the design-doc-review non-blocking note 1 — this is harder than "a disclosure prop"):** `SongPanel`'s layout is finer-grained than `SectionPanel`'s coarse all-or-nothing "Section overrides" `ToolsPanelItem`. `SongPanel` shows the **common** tempo bpm / beats / beatType directly visible, while `beatUnit` and **each** hand config are **separate** `ToolsPanelItem`s inside an `Advanced` `ToolsPanel`, each with its own `hasValue`/`onDeselect`, plus a `resetAll`. The new prop MUST let `ContextEditor` render its members in **two tiers** — common-visible (tempo bpm, beats, beatType) vs per-member advanced-disclosed (`beatUnit`, `rightHand`, `leftHand`) — and emit per-member, **not** wrap the whole editor in one coarse `ToolsPanelItem`. Concretely, give `ContextEditor` a prop (e.g. `layout="flat" | "tiered"` or a render-arrangement prop) such that:
   - `layout="flat"` (default) preserves today's `ContextEditor` output exactly (used by `SectionPanel`'s composition, unchanged) — bpm, beatUnit, beats, beatType, both hand configs rendered flat in order, as it is now.
   - `layout="tiered"` renders bpm/beats/beatType directly, then a `ToolsPanel` "Advanced" holding `beatUnit` + each hand config as separate `ToolsPanelItem`s with per-member `hasValue`/`onDeselect` and a `resetAll` — reproducing `SongPanel.js:204-277` precisely.
   - The draft/projection/emit logic (`tempoDraft`/`timeDraft`, `editTempo`/`editTimeSignature`, `projectTempo`/`projectTimeSignature`, `emitMember`) stays in `ContextEditor`, shared by both layouts.
2. **`SongPanel` composes.** Replace the forked tempo/time/hand-config block with `<ContextEditor context={defaults} layout="tiered" onChange={ (next) => emitBlock(song, "defaults", next, onChange) } />`. Delete `SongPanel`'s local `projectTempo`/`projectTimeSignature`/`tempoDraft`/`timeDraft`/`editTempo`/`editTimeSignature`/`emitContextMember`. **Keep** `SongPanel`'s own non-context controls outside `ContextEditor`: `MetadataEditor`, the **Note language** `SelectControl` (it is NOT inside `Advanced` today — `SongPanel.test.js` pins this), and the **Add section** `Button`. The note-language control must stay directly visible, above/outside the `ContextEditor`'s Advanced panel.
   - **Subtlety to verify against the test:** today `SongPanel`'s `resetAll` also clears `beatUnit` + both hands in one emission, and `Note language` lives outside `Advanced`. After composing, the `Advanced` `ToolsPanel` (now rendered by `ContextEditor` in tiered mode) owns tempo/time/hand `resetAll`; `Note language` stays a sibling of `ContextEditor`, not inside it. Confirm `SongPanel.test.js` (the assertion that note language is NOT in `Advanced` while `beatUnit` IS) still passes.
3. **Do not change `SectionPanel`.** It keeps composing `ContextEditor` with the default flat layout inside its coarse "Section overrides" `ToolsPanelItem` — unchanged from T1.

**Depends on.** T1 (shared `toNumber`/`toBoundedInt` already imported into both files; T2 then deletes `SongPanel`'s forked projection that T1 left in place).

**Traces to.** R-B3 (draft/projection logic no longer copied into `SongPanel`; lives once in `ContextEditor`), R-B4, R-E4 (conformant tempo/timeSignature emit preserved), R-E5 (every Song-panel field — bpm, beatUnit, beats, beatType, both hand configs, note language, metadata title/composer — stays reachable). Design §4.3 (DD7 draft/projection → composed), design-doc-review non-blocking note 1 (the prop must reproduce per-member tiering, not the coarse wrap).

**Acceptance.**
- `SongPanel.test.js` passes **unchanged**, including the assertion pinning that the note language is NOT inside `Advanced` while `beatUnit` is (the layout-tier proof).
- **The tiered `Advanced` `ToolsPanel`'s `label` is exactly `"Advanced"` (N2).** `SongPanel.test.js:263–274` asserts `[aria-label="Advanced"]` exists (the ToolsPanel mock maps `label`→`aria-label`) and does NOT contain the Note-language select. So when `ContextEditor` renders `layout="tiered"`, its advanced `ToolsPanel` must carry `label={ __("Advanced", "piano-block") }` **verbatim** (do not rename it), and `SongPanel` must keep the Note-language select a sibling **outside** `ContextEditor`. Renaming the label silently breaks the pinned assertion.
- `contextControls.test.js` (the `ContextEditor` tests) passes; if the default `layout="flat"` is the existing behavior, no existing assertion changes. Add focused tests for `layout="tiered"`: bpm/beats/beatType visible at top level, `beatUnit`/`rightHand`/`leftHand` inside `Advanced`.
- `SectionPanel.test.js` passes unchanged.
- `grep` confirms `projectTempo`/`projectTimeSignature`/`tempoDraft`/`editTempo` appear only in `ContextEditor.js` (the fork is gone from `SongPanel.js`).
- `npx jest` green, `npm run build` succeeds, `npm run check` clean.

---

## T3 — Add the test-harness stubs the tree redesign needs (icons mock, DropdownMenu, jest mapping)

**Goal.** Prepare the jest harness so T4 can be test-driven: add a `@wordpress/icons` mock + jest mapping (first use of that package), add `isRTL` to the existing `@wordpress/i18n` mock (T4's RTL-aware chevron imports it), and add `DropdownMenu`/`MenuGroup`/`MenuItem` stubs to the components mock. **No `src/` change** — this task touches only test scaffolding, so the suite stays green (no production behavior changes; the new mock exports are unused until T4).

**Files.**
- `test/mocks/wordpress-icons.js` (new)
- `jest.config.js` (add `^@wordpress/icons$` → the new mock to `moduleNameMapper`)
- `test/mocks/wordpress-components.js` (add `DropdownMenu`, `MenuGroup`, `MenuItem` stub exports)
- `test/mocks/wordpress-i18n.js` (add an `isRTL` export — the mock today exports **only** `__`/`_x`/`sprintf`)

**Changes.**

1. **`test/mocks/wordpress-icons.js`** — export the icon identifiers the redesign uses as inert sentinels (the real package exports icon components/objects; the components mock's `Icon` already swallows `icon`, so any value works). Export at least: `moreVertical`, `chevronRightSmall`, `chevronDownSmall`, `chevronLeftSmall` (and `Icon` is already in the components mock). Each can be a trivial value (e.g. `const moreVertical = "moreVertical";` or a no-op component) — the mock only needs the import to resolve and the value to be passed through `<Icon icon={...}>` / `<DropdownMenu icon={...}>` harmlessly.
2. **`jest.config.js`** — add to `moduleNameMapper`: `"^@wordpress/icons$": path.join(__dirname, "test/mocks/wordpress-icons.js")`. Mirror the existing entries' shape.
3. **`test/mocks/wordpress-components.js`** — add **DOM-honest** stubs so T4's structural assertions (open the menu, read its `label`, find a kind-gated `MenuItem`, click it) work without simulating focus management:
   - `DropdownMenu({ label, icon, toggleProps, children })` — render a real `<button>` trigger carrying `aria-label={label}` and spreading `toggleProps` (so `ref`/`tabIndex`/`onFocus` and any others pass through to the DOM button), then render `children` (the menu content) directly in the DOM so its `MenuItem`s are queryable. A trivial always-rendered-content stub is sufficient and is the standard approach for these mocks (the real focus-trap/open-close is left to e2e, exactly as the TreeGrid mock leaves roving tabindex to e2e). Document this in the mock's JSDoc (mirror the existing TreeGrid mock comments: "simulates no focus trap; e2e covers the composition"). **(N3) The components mock's `TreeGridCell`/`TreeGridItem` call their render-prop child with `{}`** (`children({})`), so the `{ ref, tabIndex, onFocus }` T4 forwards into `toggleProps` (and into the hand-row Add-note `Button`) are all `undefined` under jest by construction. That is harmless — spreading `undefined` props is a no-op and the `Button` mock already swallows unknown props — but it means the **roving-tabindex wiring is e2e-only**: T4's tests must NOT assert on `ref`/`tabIndex`/`onFocus`; the real focusable composition is proven by T7's e2e (R-E8). State this in the mock JSDoc and keep the T4 unit assertions to structural outcomes (the trigger's `aria-label`, the gated `MenuItem`s, the fired handlers).
   - `MenuGroup({ label, children })` — render `children` (a wrapping `<div>` is fine); `label` MAY be ignored or rendered.
   - `MenuItem({ onClick, isDestructive, children, ...rest })` — render a `<button type="button" onClick aria-label={label ?? undefined}>{children}</button>`, swallowing `isDestructive` (like `Button` does). The visible text (children) is how T4's tests locate it.
   - Add all three to the `module.exports` object.
4. **`test/mocks/wordpress-i18n.js`** — add an `isRTL` export. The mock today exports **only** `__`/`_x`/`sprintf` (verified: `grep isRTL` across `src/ test/ specs/` returns nothing), but T4's rewritten `StructureTree.js` does `import { isRTL } from "@wordpress/i18n"` and calls `isRTL()` at render time to pick the collapsed-chevron icon (LTR `chevronRightSmall` vs RTL `chevronLeftSmall`). Without the export, `isRTL` is `undefined` and the call throws `TypeError: isRTL is not a function` on **every** render of the redesigned tree — failing the entire rewritten `StructureTree.test.js` AND `Edit.test.js` (T4's commit would be red). Add `const isRTL = () => false;` (the real package returns `false` when no RTL locale is loaded, which is exactly this no-locale test default) and include `isRTL` in `module.exports`. This exercises the LTR chevron branch in jest; the RTL branch is e2e/runtime-only (mirroring the existing mock's "no-translation-loaded" stance for `__`/`_x`). This is a test-only mock change; it does not introduce a production dependency (DD4's RTL-aware chevron stays intact in `src/`).

**Depends on.** Nothing functional, but sequenced after T1/T2 (which leave the suite green) and before T4 (which consumes these stubs). Place it here so T4's commit can include passing tree tests.

**Traces to.** Design §6.2 (test-harness caveat: the mock has no `DropdownMenu`/`Navigator`; jest proves structural outcomes with a `DropdownMenu` stub added; a11y/keyboard rests on core's pattern + e2e), R-E2 (the icons used — `moreVertical`/`chevronRightSmall`/`chevronDownSmall`/`chevronLeftSmall` — all ship in `@wordpress/icons`; this confirms the mapping the build externalizes).

**Acceptance.**
- `npx jest` green and **unchanged in count** (642+; no test references the new stubs yet, so nothing breaks).
- A throwaway check (or a tiny smoke test, optional) confirms `require("@wordpress/icons")` resolves in jest, the components mock now exports `DropdownMenu`/`MenuGroup`/`MenuItem`, and the i18n mock now exports `isRTL` (a callable returning `false`).
- `npm run build` still succeeds (no `src/` change). `npm run check` clean (lint the new mock).
- No production code changed — `git diff --stat` shows only `test/` (the new icons mock, the components mock, the i18n mock) and `jest.config.js`.

---

## T4 — Rebuild the StructureTree row: DropdownMenu, stock chevron, select-only label, single Set, coordinate keys

**Goal.** Re-native the structure surface: each row becomes two `TreeGridCell`s mirroring core's List View — a select-only label cell with a non-focusable stock chevron, and an actions cell holding one kind-gated `DropdownMenu` (hand rows: one direct "Add note" `Button`). Delete the caret glyph, the index-path string state, the dual-Set expansion logic (`isSelectionAncestor`, the disjoint `isExpanded`/`toggleRow`, `collapsedOverride`), the `--pb-tree-depth` inline style, and `TreeGridItem`. `StructureTree` becomes a **single-`expanded`-Set** controlled component. Rewrite `StructureTree.test.js` for the new shape. **This task changes `StructureTree`'s props** (one `expanded` Set + one `onToggleExpanded` replace the two Sets + two toggles, and `collapsedOverride`/`onToggleCollapsedOverride` are dropped) — so it must update the **call site in `edit.js` minimally** to keep the editor rendering, but the full `edit.js` state collapse is T5.

> **Sequencing note for the writer.** To keep the suite + build green at this task's commit while `edit.js`'s own state collapse waits for T5: change `StructureTree`'s signature to the single-Set props now, and in `edit.js` pass a **derived** single Set + single toggle into `StructureTree` without yet removing `edit.js`'s `collapsedOverride` state. Simplest green-keeping bridge: in `edit.js`, keep `expandedPaths`/`onToggleExpanded` as-is and pass `expanded={expandedPaths}` `onToggleExpanded={onToggleExpanded}` to the new `StructureTree`, and **stop passing** `collapsedOverride`/`onToggleCollapsedOverride`/the auto-reveal (the new tree ignores them). The `collapsedOverride` state in `edit.js` is then dead but harmless until T5 deletes it. (T5 removes the dead state and adds the mutation-site ancestor seeding.) Do NOT leave `edit.js` calling props the new `StructureTree` no longer accepts.

**Files.**
- `src/editor/StructureTree.js` (rewrite the row composition + expansion model)
- `src/edit.js` (minimal call-site update only — see sequencing note)
- `src/editor/__tests__/StructureTree.test.js` (rewrite for the new row shape + single Set)
- `src/editor/__tests__/Edit.test.js` (rework its tree-drill helpers for select-only labels — see change #9; this is NOT a "minimal assertion" touch, it is a real helper rework, because the select-only label no longer expands the row)

**Changes.**

1. **Imports.** Add `DropdownMenu`, `MenuGroup`, `MenuItem`, `Icon` from `@wordpress/components`; add `moreVertical`, `chevronRightSmall`, `chevronDownSmall`, `chevronLeftSmall` from `@wordpress/icons`; add `isRTL` from `@wordpress/i18n` (for the RTL-aware collapsed chevron). **`isRTL` depends on T3's addition to `test/mocks/wordpress-i18n.js`** — that mock exported only `__`/`_x`/`sprintf` before T3, so without T3's `isRTL` export the call `isRTL()` at render time throws `TypeError: isRTL is not a function` and reds out the whole tree suite. T3 adds `const isRTL = () => false;`, so jest exercises the LTR branch (`chevronRightSmall`); the RTL branch (`chevronLeftSmall`) is e2e/runtime-only. Drop the `__experimentalTreeGridItem as TreeGridItem` import (no longer used). Keep `TreeGrid`/`TreeGridRow`/`TreeGridCell`.
2. **Delete the hand-rolled mechanism:**
   - `caret()` (the `▸`/`▾` glyph helper) — gone (R-A3).
   - `isSelectionAncestor()` and the disjoint-regime `isExpanded`/`toggleRow` — gone (R-B1). Replace with `const isExpanded = (key) => expanded.has(key)` — a single lookup, no ancestor test, no veto.
   - The `--pb-tree-depth` inline `style={{ "--pb-tree-depth": N }}` on every label `Button` (4 sites) — gone (R-C1; CSS moves to `[aria-level]` in T6). `TreeGridRow` keeps `level={1..4}` so the rendered `aria-level` drives indentation.
   - All `data-path` attributes on rows — gone (no longer needed for addressing).
3. **Props.** New signature: `{ song, selection, system, expanded, onToggleExpanded, onSelect, onRemoveSection, onDuplicateSection, onAddMeasure, onRemoveMeasure, onDuplicateMeasure, onAddNote, onRemoveNote, onDuplicateNote }`. Drop `expandedPaths`, `collapsedOverride`, `onToggleCollapsedOverride`. (`expanded` is the single Set; `onToggleExpanded(key)` toggles one membership.)
4. **Coordinate-derived keys (R-B2).** Add a small `expansionKey(coords)` helper (or inline builders) producing the per-row string from coordinates: section `` `s${si}` ``, measure `` `s${si}m${mi}` ``, hand `` `s${si}m${mi}${hand}` ``. Use the same string for the React `key` of those rows. Notes are leaves (never expandable, never in the Set) — their React key is `` `s${si}m${mi}${hand}e${ei}` ``. These are derived inline at render, never stored. (Any consistent unique scheme is fine; keep it readable and collision-free across measures.)
5. **Row composition — two `TreeGridCell`s per row, mirroring core's List View** (design §3.3, DD3):
   - **Contents cell** (render-prop `(cellProps) => …`): forward `cellProps` to the single focusable. For section/measure rows, the focusable is the **select-only** label `Button` (`{...cellProps}`, `variant="tertiary"`, `aria-current={selected ? "true" : undefined}` — **preserve `aria-current`**, design-doc-review note 2; `onClick={() => onSelect?.({ kind, ...coords })}` — select only, NO toggle). Beside the label `Button`, render a **non-focusable** stock chevron for expandable rows: an `<Icon>` (or a `<span aria-hidden="true">` wrapping `<Icon>`, mirroring core's `ListViewExpander`) with `icon={ expanded ? chevronDownSmall : (isRTL() ? chevronLeftSmall : chevronRightSmall) }`, an `onClick` (pointer-only) routing to `onToggleExpanded(key)`, **no `tabIndex`, no role** — it is a visual cue, not a tab stop (R-A3, R-E8; keyboard expand/collapse stays TreeGrid's Left/Right arrows). **Give the chevron a stable locator hook** (a class such as `wp-block-piano-block-piano__tree-expander` on the chevron element, or wrap it in a `<span aria-hidden="true" className="…__tree-expander" onClick=…>`) so both jest (`Edit.test.js`'s expand helper, T4 change #9) and the e2e drill-down (`expandRow`, T7 change #2) have a deterministic non-`nth` selector for it — the chevron is not a button, so without a stable class/test-id the tests would have to fall back to brittle positional selectors. (The components mock's `Icon` renders `<span data-icon ...rest>` and spreads `...rest`, so the `className` and `onClick` reach the DOM in jest too.) For **note** rows (leaves), the contents-cell focusable is the label `Button` showing `noteLabel(event, system)` with `aria-current`, `onClick` → `onSelect({ kind: "event", ... })`, and **no** chevron.
   - For **hand-group** rows (non-selecting, organizational): the contents-cell focusable is a `Button` (`{...cellProps}`) that toggles expansion on click (`onClick={() => onToggleExpanded(handKey)}`) and shows the hand label, with the same non-focusable chevron beside it. It never calls `onSelect` (KD 14; preserved). `aria-expanded` is carried by the `TreeGridRow`'s `isExpanded` (mock maps it); the label `Button` MAY also keep `aria-expanded` for parity with today, but rely on `isExpanded` on the row for the `aria-expanded` attribute.
   - **Actions cell** (render-prop `({ ref, tabIndex, onFocus }) => …`): for section/measure/note rows, render **one** `DropdownMenu` with `icon={ moreVertical }`, `toggleProps={{ ref, tabIndex, onFocus }}` (this is how the roving tabindex reaches the trigger — mirror `block-editor/.../list-view/block.js`), and `label={ sprintf( __( 'Actions for %s', 'piano-block' ), <ordinal> ) }` reusing the per-row ordinal labels already computed (section `Section %d`, measure `Measure %1$d of section %2$d`, note `Note %1$d of %2$s of measure %3$d of section %4$d` — reuse the sprintf forms, or a compact ordinal that keeps the tests' "Actions for Section 2"-style names; pick the exact ordinal text and pin it in the test). Inside, a `MenuGroup` with kind-gated `MenuItem`s:
     - **Section:** Duplicate (`onClick → onDuplicateSection(si)`), Add measure (`onClick → onAddMeasure(si)`), Remove (`isDestructive`, `onClick → onRemoveSection(si)`).
     - **Measure:** Duplicate (`onDuplicateMeasure(si, mi)`), Remove (`isDestructive`, `onRemoveMeasure(si, mi)`).
     - **Note:** Duplicate (`onDuplicateNote(si, mi, hand, ei)`), Remove (`isDestructive`, `onRemoveNote(si, mi, hand, ei)`).
   - For **hand-group** rows, the actions cell is a single direct `Button` (NOT a one-item `DropdownMenu`): `icon` optional, `variant="secondary"`, `label={addNoteLabel}` (reuse the existing full `Add note to %1$s of measure %2$d of section %3$d` label verbatim — design §3.3 and the e2e spec depend on it), `onClick → onAddNote(si, mi, hand)`. Forward the cell's render-prop `{ ref, tabIndex, onFocus }` to this `Button` so it stays a roving-tabindex focusable.
6. **Keep the inherent work** (R-B4 names it inherent, NOT a failure to simplify): the recursive flatten of sections → measures → hands → notes into the ordered `rows` array, each `TreeGridRow` carrying `level`/`positionInSet`/`setSize`/`isExpanded`. The flatten still skips descendants of a collapsed row (`if (!isExpanded(key)) return;`).
7. **Wrapper.** Keep the `<div className="wp-block-piano-block-piano__tree">` wrapper and the `<TreeGrid label={...}>` — the inline placement and the e2e `.__tree` locator depend on it (design §3.1; the toolbar "Structure" toggle stays in `edit.js`).
8. **`edit.js` minimal bridge** (full collapse is T5): pass `expanded={expandedPaths}` and `onToggleExpanded={onToggleExpanded}` to `StructureTree`; **stop passing** `collapsedOverride`/`onToggleCollapsedOverride`. Leave `edit.js`'s own state untouched otherwise (T5 collapses it).
9. **Rework `Edit.test.js`'s tree-drill helpers for the select-only label (REQUIRED — T4's commit is red without it).** `Edit.test.js` today drives the tree by **clicking label rows to expand them**: its `treeRowButton`/`clickByText` helpers (lines 109–118) find a **`button`** and caret-strip its text, and `selectLoneNote` (lines 386–391) plus the "seeds a note from the structure tree's per-hand Add note" test (lines 305–334) do `clickByText(container, "Section 1")` → `clickByText(container, "Measure 1")` → `clickByText(container, "Right hand")` (→ `clickByText(container, "C")`), each expecting the prior click to **expand** so the next child row renders. Today that works because the label `onClick` calls `toggleRow(...)` then `onSelect(...)` (expands-and-selects). **After T4 the label is select-only** (toggle moved to the non-focusable chevron), so `clickByText(container, "Section 1")` selects without expanding, "Measure 1" never renders, and the next lookup returns `undefined` and `.click()` throws. The chevron is a non-focusable `<span>`/`<Icon>` sibling (the components mock's `Icon` renders `<span data-icon ...rest>`, and it spreads `...rest` so the chevron's pointer `onClick` is present in the DOM and clickable in jest) — it is **not** a `button`, so `treeRowButton`/`clickByText` cannot reach it. Required rework:
   - Add an **expand helper** that reveals a row's children by clicking the chevron span, e.g. `expandRow(container, label)` that locates the row's label `button` by its plain text (no caret strip — carets are gone after T4) and then finds the sibling chevron `[data-icon]` element with an `onclick`/pointer handler and clicks it inside `act`. (Alternatively, drive expansion through the `expanded` Set: render with a seeded `expanded` Set containing the ancestor keys so the deep rows already render, then click only the leaf label to select — pick one approach and apply it consistently; the chevron-click approach matches how `Edit` actually wires the tree and exercises `onToggleExpanded`.)
   - Update `treeRowButton`/`clickByText`: drop the caret-strip regex (labels are plain text now); `clickByText` keeps selecting a label `button` by exact text (now used **only** for selection clicks, not expansion).
   - Rewrite `selectLoneNote` (lines 386–391) to **expand then select**: expand Section 1, then Measure 1, then Right hand (via the expand helper or a seeded `expanded` Set), then click the "C" note label to select it.
   - Rewrite the "seeds a note from the structure tree's per-hand Add note" test (line 305): expand Section 1 → Measure 1 → Right hand via the expand helper (so the hand-group row's "Add note" button is reachable), then click that `Add note to Right hand of measure 1 of section 1` button as today. (Note: the hand-group **label** still toggles on click per T4 — it is the non-selecting expander — so for the hand-group level either the label click OR the chevron click expands; pick the same mechanism the helper uses everywhere for consistency.)
   - The downstream assertions in those tests (panel gating, persisted-song shape, `validateSong` empty) are **unchanged** — only the drill-down mechanics change.

**Rewrite `StructureTree.test.js`** (design §6.2):
- Update `renderTree` to pass the single `expanded` Set (rename from `expandedPaths`; drop `collapsedOverride`/`onToggleCollapsedOverride` and the `toggleOverride` recorder). Seed `expanded` with the coordinate-derived keys for the new scheme (e.g. `new Set(["s0", "s0m0", "s0m0rightHand", "s0m0leftHand"])` — match whatever `expansionKey` produces).
- Row-label finder: drop the caret-strip regex; the label text is now the plain name (no `▸`/`▾`). `selectButtonByText` becomes an exact text match on the label `Button` (the chevron is a sibling `<Icon>`/`<span>`, not part of the button's text).
- **Inventory / labels / select / a11y-wiring** assertions: keep them (the row inventory, `aria-level`/`-posinset`/`-setsize`/`-expanded`, `name`-or-positional labels, `noteLabel`, kind-tagged select payloads, hand-row-does-not-select). These are the R-E8 keyboard/a11y anchor and survive the redesign.
- **Single-Set expansion** assertions: replace the dual-Set/`collapsedOverride`/auto-reveal tests with single-Set ones — clicking a section/measure/hand chevron calls `onToggleExpanded(key)` with the coordinate key; `isExpanded` is pure membership; **no** auto-reveal (a selection with an empty `expanded` Set does NOT reveal ancestors — auto-reveal is dropped, design §4.1). The old "auto-expands the selection's ancestors" and "routes a selection-ancestor's collapse to the override" tests are **removed** (that mechanism is gone); add a test that an empty `expanded` Set hides descendants regardless of selection.
- **Select-only label** assertion: clicking a section/measure label calls `onSelect` and does **NOT** toggle expansion (the toggle now lives on the chevron). Add a test that clicking the chevron toggles and clicking the label selects (the §3.4 split). The hand-row label still toggles (it is the non-selecting expander).
- **`aria-current`** assertion: keep the test pinning the selected row's label carries `aria-current="true"` and unselected rows do not (design-doc-review note 2).
- **Row-action menu** assertions: replace the per-row icon-button-label lookups with: find the row's `DropdownMenu` trigger by its `label` (`"Actions for Section 2"` etc.), confirm the kind-appropriate `MenuItem`s render (the `DropdownMenu` mock renders its children, so the items are queryable by visible text), click the `MenuItem` and assert the handler fired with the right coords. The hand-row "Add note" stays a direct button found by its full `addNoteLabel` (locator unchanged in shape).

**Depends on.** T3 (the `DropdownMenu`/`MenuGroup`/`MenuItem` + icons mocks must exist for the rewritten tests to import and render).

**Traces to.** R-A1 (TreeGrid + Row/Cell, no privateApis), R-A2 (native per-row `DropdownMenu`, per-row accessible name, `isDestructive` remove, hand-row lone Add-note stays a Button), R-A3 (non-focusable stock chevron; carets gone), R-B1 (single `expanded` Set, no veto, auto-reveal dropped), R-B2 (coordinate-derived keys; index-path string state gone), R-C1 (no `--pb-tree-depth` injection; `level`→`aria-level` drives indent), R-D3 (row menu = one primary action locus), R-E2 (all components/icons ship in WP), R-E8 (every interactive row element stays a TreeGrid focusable; chevron non-focusable; `aria-current` preserved). Design §3.3 (DD3), §3.4 (DD4), §4.1 (DD5), §4.2 (DD6), §6.2; design-doc-review notes 1-not-applicable-here, 2 (`aria-current`).

**Acceptance.**
- The rewritten `StructureTree.test.js` passes: row inventory + `aria-level`/`-posinset`/`-setsize`/`-expanded` intact; labels carry no caret glyph; section/measure/note select payloads correct; hand row does not select; single-Set toggle on the chevron with the coordinate key; **no** auto-reveal; select-only label; `aria-current` on the selected row; per-row `DropdownMenu` with kind-gated `MenuItem`s firing the right handlers; hand-row "Add note" direct button fires `onAddNote`.
- `grep` of `StructureTree.js` confirms: no `▸`/`▾`, no `caret`, no `isSelectionAncestor`, no `collapsedOverride`, no `--pb-tree-depth`, no `data-path`, no `TreeGridItem`, no `s${...}/m${...}` slash-path strings stored in state. `DropdownMenu`/`MenuGroup`/`MenuItem` and the chevron `<Icon>` are present.
- `Edit.test.js` passes **with its drill-down helpers reworked for select-only labels** (change #9). Specifically, these tests — which previously expanded by clicking labels — now expand via the chevron (or a seeded `expanded` Set) and still pass:
  - `"seeds a note from the structure tree's per-hand Add note and opens the Note panel"` (line 305) — expands Section 1 → Measure 1 → Right hand, then clicks the per-hand `Add note` button; the new note is selected and all three panels open.
  - `"inserts a contextual note right after the selected event in the same hand"` (line 336, via `selectLoneNote`) — selects the lone C note, then the Note panel's contextual Add note.
  - `"clears a stale selection after a raw edit removes the selected event"` (line 357, via `selectLoneNote`) — selects the lone note, then the stale-selection fallback.
  - `"shows all three per-level panels for an event-kind tree selection"` (line 394, via `selectLoneNote`).
  - The `treeRowButton`/`clickByText` helpers (lines 109–118) drop the caret-strip regex; `selectLoneNote` (lines 386–391) becomes expand-then-select. No other `Edit.test.js` test (JSON-mode, empty-seed, invalid-routing, etc.) changes.
- `npx jest` green, `npm run build` succeeds (real `@wordpress/components`/`@wordpress/icons` resolve via build externalization), `npm run check` clean.

---

## T5 — Collapse edit.js to a single expansion Set and seed ancestors at the mutation site

**Goal.** Finish the single-expansion model in `edit.js`: replace `expandedPaths` + `collapsedOverride` + their two toggles with one `expanded` Set + one `onToggleExpanded`, delete the now-dead `collapsedOverride` state and `onToggleCollapsedOverride`, and add the **one-line ancestor-seed** at the three mutators that auto-select a new deep node (the only place auto-reveal still matters, since auto-reveal-on-select is dropped). Keep `showTree` and all four mutators.

**Files.**
- `src/edit.js`
- `src/editor/__tests__/Edit.test.js` (extend for the single-Set state + the mutation-site seeding, if `Edit.test.js` covers expansion; otherwise the StructureTree tests already cover the tree side). **T4 already reworked `Edit.test.js`'s drill-down helpers for the select-only label (T4 change #9)**, so T5 only **extends** the suite for the seeding behavior; it does not re-do the helper rework. The expand helper T4 added is what T5's seeding tests reuse (or they seed the `expanded` Set directly), and because **auto-reveal-on-select is dropped**, a deep new node from add/duplicate is visible **only** because of the T5 mutation-site seed — not because the selection reveals it (see N1 below).

**Changes.**

1. **Rename + collapse state.** Replace `const [expandedPaths, setExpandedPaths] = useState(() => new Set())` and `const [collapsedOverride, setCollapsedOverride] = useState(() => new Set())` with a single `const [expanded, setExpanded] = useState(() => new Set())`. Delete `onToggleCollapsedOverride` entirely. Keep `onToggleExpanded` but rename its setter to `setExpanded` and its docstring to describe one Set (the immutable add/delete shape is unchanged). Update the big state-comment block (`edit.js:98-110`) to describe one expansion Set, no veto, no auto-reveal.
2. **Pass the single Set to `StructureTree`.** `expanded={expanded}` `onToggleExpanded={onToggleExpanded}` (drop the bridge from T4; remove the dead `expandedPaths` references).
3. **Mutation-site ancestor seeding (design §4.1, F2's "trivial add-ancestors").** Auto-reveal-on-select is dropped, so only the mutators that auto-select a **new, possibly-hidden** node need to reveal it. Add a one-line seed of the new node's ancestor expansion keys into `expanded` at the same commit, at exactly these three sites (and only these — the others select shallow nodes already visible or rely on the new node being reachable):
   - **`onAddNote`** (selects a new event at `{ si, mi, hand, eventIndex }`): add the section key, measure key, and hand key (`s${si}`, `s${si}m${mi}`, `s${si}m${mi}${hand}` — match `expansionKey`) to `expanded` so the new note's branch is open.
   - **`onDuplicateMeasure`** (selects a new measure): add the section key (so the section is open and the new measure row is visible).
   - **`onDuplicateNote`** (selects a new event): add the section, measure, and hand keys.
   - `onDuplicateSection` selects a section (top-level, always visible) — **no seed needed**. `onAddMeasure`/`onAddSection` do not change the selection — no seed.
   - Implement the seed as a small local helper, e.g. `setExpanded((current) => new Set([...current, ...ancestorKeys]))`, called right after `commit(...)`/`setSelection(...)` in those three mutators. Use the **same key derivation** the tree uses (factor `expansionKey` into a shared module — e.g. export it from `selection.js` or `songModel.js` — and import it in both `edit.js` and `StructureTree.js`, OR duplicate the one-line builders if a shared home is awkward; prefer a shared `expansionKey` to avoid drift, since both sides must agree on the key string).
   - **The seed (not the selection) is what reveals the new node (N1).** Because auto-reveal-on-select is dropped (T4), setting the selection no longer opens ancestors — the **only** reason the new deep node renders is this seed. Leave the existing selection shapes as-is: `onAddNote` sets `setSelection({ sectionIndex, measureIndex, hand, eventIndex })` with **no `kind`** today (whereas `onDuplicateNote`/`onDuplicateMeasure`/`onDuplicateSection` carry a `kind`). Do **not** "fix" the missing `kind` on `onAddNote` — it is a pre-existing quirk, out of scope for this review, and the seeding works independently of the `kind` tag. The seed reveals the branch; the selection (with whatever shape it already has) lands the panels on the new node.
4. **Delete dead references.** Remove any remaining `expandedPaths`/`collapsedOverride` symbols. Confirm `StructureTree` is called only with the single-Set props.

**Depends on.** T4 (`StructureTree` already accepts the single-Set props; T5 removes the `edit.js` bridge and the dead `collapsedOverride` state, and adds the seeding).

**Traces to.** R-B1 (single expansion model in `edit.js`, no veto Set; auto-reveal collapses to "add ancestors to the one Set" at the mutation site only), R-B2 (the seeded keys are the same coordinate-derived strings), R-B4 (dual-Set mechanism removed), R-E3 (add/duplicate still reveal + select the new node so the author lands on it), R-E8 (expansion still drives `isExpanded`/`aria-expanded`). Design §4.1 (DD5), §4.4 (DD9 — `edit.js` UI-state goes 4 pieces → 2: `showTree` + one Set).

**Acceptance.**
- `Edit.test.js` passes; if it covers expansion or the add/duplicate auto-select, extend it to assert the new node's ancestors end up in `expanded` after `onAddNote`/`onDuplicateMeasure`/`onDuplicateNote` (and that the deep new node is therefore rendered by the tree). If `Edit.test.js` does not reach that, add a focused test or rely on the StructureTree single-Set tests plus a small `edit.js`-level test.
- `grep` of `edit.js` confirms: no `expandedPaths`, no `collapsedOverride`, no `onToggleCollapsedOverride`, no `setCollapsedOverride`; exactly one `expanded` Set + one `onToggleExpanded`.
- Manual reasoning check (state the writer records in the commit body): adding/duplicating a deep node opens its branch (seeded) and selects it; clicking a visible row selects without auto-revealing anything (auto-reveal dropped).
- `npx jest` green, `npm run build` succeeds, `npm run check` clean.

---

## T6 — Rework the editor CSS to layout-glue: level-driven indent, recolor-only highlight, drop the fixed rail

**Goal.** Reduce the editor region of `style.scss` to layout-glue: replace `--pb-tree-depth` indentation with an `[aria-level]` rule (R-C1), delete the scale-coupled hairline outline + its `SP_PX`/÷8 comment leaving the recolor-only highlight (R-C2), and replace the fixed 16em `&__tree` rail with a flex max-width ceiling + truncation (R-C3). The `@font-face` block and the front-end SVG are untouched (R-E1).

**Files.**
- `src/style.scss` (editor region only, lines ~24-115; never the `@font-face` at ~16-22)

**Changes.**

1. **Level-driven indentation (R-C1).** Delete the `&__tree { … &-label { padding-left: calc(var(--pb-tree-depth, 0) * 1.5em) } }` indent rule. Replace with an attribute-keyed rule on the rendered `aria-level` — core's own idiom (a `@for` loop × a grid unit). Concretely, inside `&__tree` (or scoped to the treegrid), add a rule like: `[aria-level="1"] .wp-block-piano-block-piano__tree-label { padding-left: 0 }`, `[aria-level="2"]…{ 1.5em }`, `[aria-level="3"]…{ 3em }`, `[aria-level="4"]…{ 4.5em }` — or a `@for $i from 1 through 4` SCSS loop computing `($i - 1) * 1.5em`. The depth now derives from the row's own `aria-level` (emitted by `TreeGridRow`'s `level`), with zero JS injection. Keep the `&-label` class on the label `Button` (it is the indent target and is still rendered by T4).
2. **Recolor-only highlight (R-C2, DD8).** In `&__canvas-svg .is-selected`: **keep** the three recolor lines (`*:not([fill="none"]) { fill: #007cba }`, `line { stroke: #007cba }`, `ellipse[fill="none"] { stroke: #007cba }`) and their explanatory comment about which paint to recolor. **Delete** the enclosing hairline rule `outline: 0.125px solid #007cba; outline-offset: 0.25px;` AND the `SP_PX`/÷8 explainer comment block that justifies those numbers. No length-bearing CSS decoration remains on the scaled `<g>`, so no scale-coupled magic number survives. (Do NOT substitute `filter: drop-shadow` or any other length-bearing decoration — the design proved those are equally scale-coupled.) The `.is-selected` class is still added by `SongCanvas.decorateSelection` post-render (unchanged in T-nothing — `SongCanvas.js` is not touched), and `view.js` never sets it, so the emitted SVG stays byte-identical.
3. **Layout-glue, drop the fixed rail (R-C3).** Delete the `&__tree { flex: 0 0 auto; width: 16em; min-width: 12em; max-width: 40% }` rail sizing. Replace the tree column with layout-glue: `&__tree { flex: 0 1 auto; max-width: <ceiling> }` (pick a sensible ceiling, e.g. `24em` or `40%` — the value is load-bearing: it caps the shrink-to-fit table so a long note label cannot starve the canvas; document why in the comment) plus, on the label cell, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` so a long label truncates rather than widening the column (the same construction List View uses). Keep the `&__workspace` flex row (`display:flex; flex-direction:row; gap; align-items:flex-start`), the `&__canvas` (`flex:1 1 auto; min-width:0`), and `&__canvas-svg` (`min-width:280px; overflow-x:auto`) rules — all legitimate layout-glue. Keep the pre-existing dashed-border block scaffold (`border:1px dashed; padding; color`) — it is out of scope. No bespoke component styling, no fixed-width rail.

**Depends on.** T4 (the rows now render `aria-level` without `--pb-tree-depth`, and the `&-label` class is still present), T5 (state collapse complete, so the editor is in its final shape). Placing CSS after the JS means the new selectors match the delivered DOM.

**Traces to.** R-C1 (level-driven indent via `[aria-level]`, no inline var), R-C2 (no scale-coupled magic number; recolor-only highlight still works), R-C3 (layout-glue only; no fixed bespoke rail; `@font-face` untouched), R-E1/AC-C2/AC-E1 (highlight stays an editor-only post-render class; emitted SVG byte-identical). Design §5.1, §5.2 (DD8), §5.3.

**Acceptance.**
- `grep` of `style.scss` confirms: no `--pb-tree-depth`, no `SP_PX`/`0.125px`/`0.25px`/`outline`/divide-by-8 comment in `.is-selected`, no `width: 16em` fixed rail. Present: an `[aria-level]`-keyed indent rule, the three recolor lines, a `max-width` ceiling + `text-overflow: ellipsis` on the label, the `@font-face` block unchanged.
- `git diff src/style.scss` touches only the editor region; the `@font-face` block (lines ~16-22) and the front-end SVG output are unchanged.
- `SongCanvas.test.js` (which pins the `is-selected` decoration is added) passes unchanged — `SongCanvas.js` is not modified.
- `npx jest` green, `npm run build` succeeds (SCSS compiles), `npm run check` clean.

---

## T7 — Migrate the e2e specs and run the final integration check

**Goal.** Update `specs/editor.spec.js` to the redesigned row (DropdownMenu actions, no caret regex, select-only label, hand-row direct "Add note"), keep `specs/render.spec.js` byte-untouched, validate both via Playwright **discovery** (not execution — wp-env port conflict), and run the full integration check (`npm run build`, `npx jest`, `npm run check`) plus a boundary audit confirming no forbidden imports and no published-output change.

**Files.**
- `specs/editor.spec.js` (migrate the structure-tree interactions)
- `specs/render.spec.js` (MUST stay untouched)

**Changes.**

1. **Row label locator (`treeRow`).** Drop the caret-tolerant end-anchored regex; the label text is now plain. Match the row's select button by its exact trailing name (still scoped to `structureTree(editor)` and still case-sensitive so it never matches the lowercase action labels). **Update the `treeRow` JSDoc**: drop the caret-prefix explanation AND record that, after DD4, **clicking a section/measure/note row label SELECTS only — it no longer toggles expansion** (the today-true "Clicking a section/measure/note row toggles its expansion and drives the kind-tagged selection" sentence is now wrong and must be rewritten). Expansion now happens via the chevron affordance — see change #2. (Hand-group rows are the exception: their label still toggles, per T4 — the hand row is the non-selecting expander.)
2. **Re-point the drill-down chains to expand via the chevron (REQUIRED — B3; the select-only label no longer expands).** `specs/editor.spec.js` today drills into the tree by clicking label rows to expand: e.g. lines 470–473 `treeRow(editor, "Section 1").click()` → `treeRow(editor, "Measure 1").click()` → `treeRow(editor, "Right hand").click()` → `treeRow(editor, "C").click()`, and the kind-gating walk at lines 585–595 (`treeRow(editor, "Section 1").click()` then `treeRow(editor, "Measure 1").click()`). Under DD4's select-only label, `treeRow(editor, "Section 1").click()` **selects but does not expand**, so the child row ("Measure 1") is not present to click and the chain fails. Add an **expand helper** that opens a row by clicking its chevron, e.g. `expandRow(editor, name)`:
   - The chevron is **not a button** (it is a non-focusable disclosure element T4 renders beside the label: a `[data-icon]`/`aria-hidden="true"` span/`<Icon>` carrying the pointer `onClick`). Pick a **stable, tree-scoped locator** for it — e.g. scope to the row by its `aria-level`/label, then select the disclosure element by a tree-scoped CSS/test-id (reason about it the same way change #3 reasons about the DropdownMenu portal). If T4 leaves no stable hook, the spec note must flag that T4 should add one (e.g. a class like `…__tree-expander` or a test id on the chevron span) so the e2e has a deterministic locator — coordinate this with T4's row composition (change #5) rather than relying on a brittle `nth`/`data-icon`-only selector.
   - Rewrite the drill-down chains so expansion goes through `expandRow` and only the **final** click selects: e.g. the note-select walk becomes `expandRow(editor, "Section 1")` → `expandRow(editor, "Measure 1")` → `expandRow(editor, "Right hand")` → `treeRow(editor, "C").click()`; the kind-gating walk (585–595) becomes `expandRow(editor, "Section 1")` then `treeRow(editor, "Section 1").click()` to **select** the section (assert Section panel), then `expandRow` (if needed) + `treeRow(editor, "Measure 1").click()` to select the measure. (Where a chain previously relied on one label click doing both select-and-expand, split it into an explicit `expandRow` + a `treeRow(...).click()` select.)
   - **Hand-group rows still toggle on their label/button click** per T4, so for the hand level either `expandRow(editor, "Right hand")` (chevron) OR a `treeRow(editor, "Right hand").click()` works to expand — use `expandRow` everywhere for a single consistent interaction model.
   - Because e2e is **discovery-only** here (wp-env port conflict), this change is validated by `npx playwright test --list` (well-formedness) and by being coherent against the delivered DOM so a later real run is meaningful — leaving the chains as label-clicks would contradict T4's behavior even though discovery would still pass.
3. **Row actions (`treeAction`).** The per-row icon buttons are gone; actions are now in a `DropdownMenu`. Replace `treeAction(editor, "Remove section 2")` / `"Duplicate measure 1 of section 1"` / `"Duplicate section 1"` / `"Remove measure 3 of section 1"` / `"Remove section 3"` usages with: open the row's actions `DropdownMenu` by its `label` (`"Actions for Section 2"` etc. — match the exact ordinal text T4 chose), then click the `MenuItem` by its visible name ("Remove", "Duplicate", "Add measure"). Add a helper, e.g. `openRowActions(editor, ordinalLabel)` that clicks the `DropdownMenu` trigger, returning the open menu's locator for the `MenuItem` click. Keep these scoped to the tree where the trigger lives. **Note:** the menu popover may render outside the tree container (WordPress popovers portal to the body) — locate the trigger inside `structureTree` but the `MenuItem` on `editor.canvas`/page as appropriate; the writer must reason about the portal and pick the right scope (validated by discovery + by mirroring how other WP e2e specs query `DropdownMenu` items).
4. **Hand-row "Add note".** Stays a direct button — `treeAction(editor, "Add note to Right hand of measure 1 of section 1")` (or via a tree-scoped `getByRole("button", { name, exact })`) is **unchanged** (T4 keeps the full `addNoteLabel` verbatim). The Note panel's own `"Add note"` (exact, sidebar-scoped) is also unchanged. (Note: the hand-row "Add note" lives in the actions cell and is only reachable once the hand row is revealed — so the chains that use it must `expandRow` down to the hand level first, per change #2; e.g. line 410–415's `Add note` walk becomes `expandRow(editor, "Section 1")` → `expandRow(editor, "Measure 1")` → `expandRow(editor, "Right hand")` → click the Add-note button.)
5. **`is-selected` assertion.** Unchanged — the recolor floor keeps the class (T6 kept the recolor lines; `SongCanvas` still adds it). The "clicking a note on the canvas does not change selection / no is-selected" test stays valid.
6. **`.__tree` + "Structure" toggle.** Unchanged — placement stays inline (design §3.1), the toolbar "Structure" toggle stays (T4/T5 keep `showTree`), so `structureTree(editor)`, `assertStructureTreeOpen`, and the toggle assertions remain valid.
7. **`render.spec.js`.** Do **not** edit it. It pins the published SVG byte-for-byte (R-E1/AC-E1).
8. **Final integration check + boundary audit** (record results in the commit body):
   - `npm run build` succeeds.
   - `npx jest` green (count ≥ 642 + the helper/tree tests added across T1-T5).
   - `npm run check` (Biome) clean.
   - `npx playwright test --list` discovers both specs without syntax/import errors (proves the migrated spec is well-formed; execution is blocked by the env port conflict — note this in the commit body).
   - Boundary audit (grep): **no** import of `PrivateListView`, `privateApis`, `lock(`, `unlock(`, `__dangerousOptInToUnstableAPIsOnlyForCoreModules`, or `@wordpress/block-editor` private bundle anywhere in `src/` (R-A1/AC-A1); **no** new entry in `package.json` `dependencies` (R-E2 — `@wordpress/icons` is build-externalized, not installed); **no** change to `render.php`, `src/view.js`, `src/svg.js`, the notation renderer, the schema, the `@font-face` block, or any `data-*` hook (R-E1/AC-E1). Confirm `git diff --stat` against the review-6 base touches only editor-UI files + tests + CSS editor region.

**Depends on.** T4, T5, T6 (the e2e migration must match the delivered DOM, CSS, and labels).

**Traces to.** R-A2/R-A3/R-D3 (e2e drives the native menu + plain labels), R-E1/AC-E1 (`render.spec.js` untouched; SVG byte-identical), R-E3/AC-E3 (full build/edit + canvas highlight at parity), R-E7/AC-E7 (raw-JSON mode unchanged — its e2e stays valid), R-E8/AC-E8 (keyboard/roving-tabindex incl. the `DropdownMenu` trigger inside a `TreeGridCell` — the e2e is the composition's only real proof, since the jest mock does not exercise roving tabindex). Design §6.2 (test strategy, e2e migration list).

**Acceptance.**
- `specs/editor.spec.js` parses and is discovered by `npx playwright test --list`; every structure-tree interaction is migrated to the new row (no caret regex; **drill-down chains expand via the chevron, not the now-select-only label** — the lines 470–473, 410–415, and 585–595 walks are re-pointed through `expandRow`; DropdownMenu actions; hand-row direct Add note; `is-selected` and `.__tree`/Structure-toggle assertions intact). The `treeRow` JSDoc no longer claims the label toggles expansion.
- `specs/render.spec.js` is byte-identical to the review-6 base (`git diff` empty for it).
- Final check passes: `npm run build` succeeds, `npx jest` green, `npm run check` clean, `npx playwright test --list` lists both specs.
- Boundary audit clean: no forbidden private-API import, no new runtime dependency, no published-output change.

---

## Coverage check — every spec requirement lands in a task

| Spec req | Task(s) |
|---|---|
| R-A1 (TreeGrid, no privateApis) | T4 (compose on TreeGrid), T7 (boundary audit) |
| R-A2 (native row menu, per-row label, isDestructive) | T4 |
| R-A3 (stock disclosure, no glyphs) | T4 |
| R-B1 (single expansion, no veto) | T4 (tree side), T5 (`edit.js` side) |
| R-B2 (index-path strings removed) | T4 (coordinate keys), T5 (shared `expansionKey`) |
| R-B3 (inspector de-dup) | T1 (clamp/splice/omit), T2 (SongPanel composes ContextEditor) |
| R-B4 (meaningful net reduction) | T1-T6 (every named mechanism removed) |
| R-C1 (level-driven indent) | T4 (drop inline var), T6 (`[aria-level]` rule) |
| R-C2 (no scale-coupled number; highlight works) | T6 |
| R-C3 (layout-glue only, no fixed rail) | T6 |
| R-D1 (placement: inline) | T4 (keep `.__tree` wrapper), preserved in T5/T6/T7 |
| R-D2 (inspector shape: stacked panels) | preserved (no task changes the kind-gated panels' shape) |
| R-D3 (rationalize action entry points) | T4 (row menu = one primary locus; NotePanel add/remove = deliberate secondary) |
| R-E1 (byte-identical publish) | T6 (recolor-only, SongCanvas untouched), T7 (render.spec untouched + audit) |
| R-E2 (only existing `@wordpress/*`) | T3 (icons via externalized mapping), T7 (no new dep) |
| R-E3 (full build/edit + highlight) | T1-T6 preserve capability; T7 e2e parity |
| R-E4 (valid by construction) | T1 (conformant emit preserved), T2, panel tests as net |
| R-E5 (no field-reachability regression) | T1/T2 (panels + leaf editors unchanged in reach); buried-field watchlist is the panel-test anchor |
| R-E6 (per-kind settings on selection) | preserved (pure render in `edit.js`, untouched) |
| R-E7 (raw-JSON unchanged) | preserved (JSON mode untouched); T7 e2e pins it |
| R-E8 (keyboard/a11y ≥ today) | T4 (every row element a TreeGrid focusable; chevron non-focusable; `aria-current` kept), T7 (e2e composition proof) |

## Invariants every task must hold (carry into each commit)

- **642 unit tests (plus tests added by the task) and `npm run build` green at the commit.** No red boundary.
- **No published-output change.** Never touch the song schema, `render.php`, `src/view.js`, `src/svg.js`, the notation renderer, the `@font-face` block, or any `data-*` hook.
- **No forbidden imports.** No `PrivateListView`, `privateApis`, `lock`/`unlock`, `__dangerousOptInToUnstableAPIsOnlyForCoreModules`. Public `__experimental*` exports are allowed (already shipped).
- **No new runtime dependency.** `@wordpress/icons` is build-externalized like every other `@wordpress/*` package; it is added to the jest mock + mapping (T3), never to `package.json` `dependencies`.
- **`render.spec.js` stays byte-untouched.**
