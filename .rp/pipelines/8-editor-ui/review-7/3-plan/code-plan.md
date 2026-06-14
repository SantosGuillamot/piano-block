# Review 7 Code Plan — Fix the invisible row actions, adopt the Gutenberg block-menu model, polish tree alignment/separation

_Code plan for review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Derived from the approved `1-spec/spec.md` and `2-design-doc/design-doc.md` (with `2-design-doc/design-doc-research.md` and `2-design-doc/design-doc-review-approved.md` for depth). Every decision is settled upstream; this plan only sequences and scopes the work. A genuine contradiction with the spec/design is a blocker, not a judgment call._

## How to use this plan

Five strictly-sequential tasks (T1 → T5), each sized for one focused code-writer session, each leaving the suite green and the editor functional at its commit boundary. Work them in order: each `Depends on` is the task(s) that must already be committed. Each task block is self-contained — Goal / Files / Changes / Depends on / Traces to / Acceptance — so a code-writer needs only the named files, the spec/design, and the on-branch source.

**Baseline (verified on `worktree-8-editor-ui` at the start of this plan, commit `ae3db86`):** `npm run test:unit` → **21 suites, 669 tests, all green**; `npm run build` → green; `npm run check` (Biome) → clean. wp-env/Docker CANNOT run here, so the Playwright e2e stays **consistency-by-construction** (T5) plus Playwright discovery — it is updated for honesty, never executed (this is exactly how review 6's regression escaped, so it is NOT this environment's primary guard; T1 + T4 carry the in-environment verification).

**Commit format (every task):** imperative mood, sentence case, no trailing period, your agent name in parentheses — e.g. `Fix invisible row actions and harden the menu mock (code-writer)`.

**Three non-blocking implementation notes from the design-doc approval — fold these into the named tasks (do NOT re-decide them):**
1. **(T4) The real-icon test uses the suite's own render harness.** The unit suite renders via `react-dom/client` `createRoot` + `act` with `globalThis.IS_REACT_ACT_ENVIRONMENT = true` — NOT `@testing-library/react` (absent from `node_modules`). Write the real-icon test on that existing `render`/`act` harness (copy the pattern from `StructureTree.test.js:40-55`). `@wordpress/jest-console` fails any test that calls `console.log`, so leave NO stray `console.log` in the committed file.
2. **(T4) Pick ONE un-mapping recipe and smoke-check it.** §5.2 offers two ways to un-map `@wordpress/icons` to the real package: (a) a dedicated jest config/project that DROPS `^@wordpress/icons$` from `moduleNameMapper`, OR (b) file-local `jest.unmock("@wordpress/icons")` + `jest.mock("@wordpress/icons", () => jest.requireActual("@wordpress/icons"))`. Pick one. Before relying on it, confirm `plus` resolves to a REAL element with a one-line `isValidElement(plus) === true` smoke check (delete the scaffolding once the real assertions pass). Recipe (a) is the one the design-doc reviewer reproduced end-to-end; (b) is plausible but was not run — if you choose (b) and it does not resolve real icons, fall back to (a).
3. **(T2) The positional handlers pass an explicit `kind` to `setSelection`.** Each of the six new handlers calls `setSelection({ kind, …coords })` with the inserted node's kind spelled out (`"section"` / `"measure"` / `"event"`), the more-explicit form §3.2 specifies — not the untagged tuple the legacy append `onAddNote` relies on (`resolveSelection` would default it, but the design wants it explicit).

## Order rationale (one line)

T1 fixes the regression and locks in the two in-environment guards on the *current* item set (proving the review-6 gap is closed in isolation); T2 then reshapes to the block menu with positional inserts and the SectionPanel re-home (shipping its unit-test fallout with it); T3 polishes CSS; T4 adds the real-icon guard against the now-final tree; T5 migrates the e2e for consistency — each boundary keeps the suite green and the editor working.

---

## T1 — Fix the invisible row actions and harden the menu mock

**Goal.** Make the per-row actions menu actually render (render-function `DropdownMenu` children) and the hand-row "Add note" show a real glyph (`icon={plus}`), and harden the test harness so "tests green + row actions invisible" becomes impossible at the unit layer — WITHOUT yet changing the menu's item set. This isolates the regression fix (R-REG1, R-REG2) and the toggle contract guard (R-REG3a) so they are verified before the menu reshape (T2) muddies the diff. After T1 the editor's three-dots menus render and work, the hand-row button shows a plus, and a regression back to plain-element children turns the suite red.

**Files.**
- `src/editor/StructureTree.js` (edit)
- `test/mocks/wordpress-components.js` (edit — harden the `DropdownMenu` mock)
- `test/mocks/wordpress-icons.js` (edit — add a `plus` string sentinel so the new import resolves)
- `src/editor/__tests__/StructureTree.test.js` (edit — add the toggle-presence assertion; the existing item assertions stay green because item names are unchanged)

**Changes.**
1. **`StructureTree.js` — convert all three per-row `DropdownMenu` children to a render function**, KEEPING the current item sets verbatim for now (section `:202-215` = {Duplicate, Add measure, Remove}; measure `:287-303` = {Duplicate, Remove}; note `:434-460` = {Duplicate, Remove}). For each, change only the cell's `children` from the plain `<MenuGroup>…</MenuGroup>` element to `({ onClose }) => (<MenuGroup>…</MenuGroup>)`, and wrap each existing `MenuItem` `onClick` so it dismisses after acting: `onClick={() => { onDuplicateSection?.(sectionIndex); onClose(); }}` (and likewise for every item, preserving the existing `?.` optional-chaining and the exact coordinate args). The `TreeGridCell` wrapper and the `DropdownMenu`'s `icon={moreVertical}` / `toggleProps={{ ref, tabIndex, onFocus }}` / `label` stay **byte-for-byte** — only `children` changes (per §3.1, the render-fn-vs-plain choice affects only `renderContent`, never the toggle/roving-tabindex path, so R-KEEP4 holds). Destructure just `{ onClose }` from the render-function arg (core's idiom).
2. **`StructureTree.js` — hand-row "Add note" glyph (R-REG2, §3.4).** Add `plus` to the `@wordpress/icons` import (`:53-58`, alongside `chevronDownSmall`/`chevronLeftSmall`/`chevronRightSmall`/`moreVertical`). Change the hand-row `Button`'s `icon="plus"` string (`:365`) to `icon={plus}` (element). Everything else on that `Button` stays — `variant="secondary"`, its `label` (the `addNoteLabel` sprintf), `onClick`.
3. **`test/mocks/wordpress-icons.js` — add a `plus` sentinel.** Add `const plus = "plus";` and export it, so the new `import { plus }` resolves in the main (string-sentinel) suite. (The real-icon test in T4 overrides this locally; the main suite keeps the inert sentinel — the components `Icon`/`Button` mocks swallow `icon`, so the string is harmless here.)
4. **`test/mocks/wordpress-components.js` — harden the `DropdownMenu` mock (R-REG3a, §5.1).** Replace the always-render mock body (`:347-364`) with one that mirrors core's guard:
   ```js
   const DropdownMenu = ({ label, children, controls, toggleProps = {}, icon: _icon, ...rest }) => {
     if (!controls?.length && typeof children !== "function") {
       return null; // byte-mirrors core's `if ( ! controls?.length && ! isFunction( children ) ) return null;`
     }
     return createElement(
       "div",
       rest,
       createElement("button", { type: "button", "aria-label": label, ...toggleProps }),
       typeof children === "function"
         ? children({ isOpen: false, onToggle: () => {}, onClose: () => {} })
         : children,
     );
   };
   ```
   - `onClose` MUST be a real no-op function (the production `() => { handler(); onClose(); }` calls it — verified it does not throw). `isOpen`/`onToggle` are passed for fidelity; no existing test reads them, so `false`/no-op are safe.
   - The function child renders into the SAME wrapping `<div>` as the toggle, so the existing find-trigger-then-query-items traversals survive verbatim: `StructureTree.test.js`'s `buttonByLabel(...).closest("div")` → `selectButtonByText(menuDiv, "…")` (`:402-411`), and `Edit.test.js`'s `clickRowAction` which does `fieldByName(container, menuLabel).closest("td")` (`:151-156`) — the items render inside the `<td>` from `TreeGridCell`, so `.closest("td")` still resolves. Re-run both suites to confirm.
   - Update the mock's doc-comment (`:326-345`) so it explains the new guard (it now mirrors core's `return null`, the whole reason the regression is now catchable) instead of the old "renders unconditionally" prose.
5. **`StructureTree.test.js` — add a toggle-presence assertion (R-REG3a belt-and-suspenders, §5.1/§5.2).** Add ONE test asserting that a representative row at each level (section, measure, note) renders its action-menu **toggle** button by its `"Actions for …"` `aria-label` — under the hardened mock this assertion FAILS if children regress to plain elements (the component renders `null` → no toggle). Reuse the existing `buttonByLabel` helper. NO `children`-typeof / props-introspection assertion (it would re-test what the hardened mock already enforces, with worse readability — §5.1).

**Depends on.** Nothing (first task; baseline is green).

**Traces to.** R-REG1, R-REG2, R-REG3a; preserves R-KEEP3, R-KEEP4 (toggle/roving-tabindex path untouched). AC-REG1 (second bullet — render-function children), AC-REG2, AC-REG3 (first bullet — hardened mock + toggle-presence assertion).

**Acceptance.**
- `npm run test:unit` → still **21 suites, 669 tests** green (item names unchanged; the only new test is the toggle-presence assertion, so the count may rise by the number of new `it` blocks you add — note the new total in your report). `StructureTree.test.js` and `Edit.test.js` pass with the hardened mock because `StructureTree.js` now passes function children.
- `npm run build` green; `npm run check` clean.
- Sanity-check the guard works: temporarily revert ONE per-row `DropdownMenu` back to plain-element children locally → the suite goes red (item assertions + the new toggle-presence assertion) → restore. (Do NOT commit the revert; this is a manual confirmation only.)
- The hand-row `Button` source reads `icon={plus}` (element), never the string `"plus"`.

---

## T2 — Adopt the block-menu model with positional inserts and the SectionPanel "Add measure" re-home

**Goal.** Reshape every section/measure/note row's menu to the Gutenberg block-settings model — **Duplicate, Add before, Add after** in a primary group and **Remove** isolated in a destructive group (R-MENU1) — wire the six positional-insert handlers in `edit.js` (R-MENU2), and re-home the orphaned "Add measure" capability to a `SectionPanel` button (R-KEEP6, §3.3 — the owner-visible consequence). This task changes the menu's *interaction shape*, so its unit-test fallout (StructureTree.test.js AND Edit.test.js) ships in the SAME commit (the review-6 lesson). After T2 the editor offers positional inserts at all three levels, a zero-measure section is recoverable from the Section panel, and the suite is green on the new item set.

**Files.**
- `src/edit.js` (edit — add six handlers, rewire `<StructureTree>` props, pass `onAddMeasure` to `<SectionPanel>`)
- `src/editor/StructureTree.js` (edit — reshape item sets, swap props, drop the tree "Add measure" item)
- `src/editor/inspector/SectionPanel.js` (edit — add the "Add measure" button + prop)
- `src/editor/__tests__/StructureTree.test.js` (edit — item names, new positional-insert assertions, drop the tree "Add measure" test)
- `src/editor/__tests__/Edit.test.js` (edit — retarget the "Add measure" click to the SectionPanel button; add positional-insert assertions)
- `src/editor/__tests__/SectionPanel.test.js` (edit — assert the new "Add measure" button signals `onAddMeasure`)

**Changes.**
1. **`edit.js` — six positional-insert handlers (R-MENU2, §3.2).** Add, modeled on `onDuplicateMeasure` (`:354-371`, the closest template — immutable splice + `commit` + `setSelection` + `revealAncestors`):
   - `onAddSectionBefore(sectionIndex)` / `onAddSectionAfter(sectionIndex)`
   - `onAddMeasureBefore(sectionIndex, measureIndex)` / `onAddMeasureAfter(sectionIndex, measureIndex)`
   - `onAddNoteBefore(sectionIndex, measureIndex, hand, eventIndex)` / `onAddNoteAfter(sectionIndex, measureIndex, hand, eventIndex)`

   Each handler: compute `target = index` (before) or `index + 1` (after) — `index` being the row's own coordinate at that depth; `insertAt(list, target, newX())` at the right depth, rebuilding `section → sections` (and `measure → measures` for measures, `measure[hand]` for notes) immutably exactly as the duplicate handlers do — the delta from `onDuplicateMeasure` is `duplicateAt(list, i)` → `insertAt(list, target, newX())` and selecting `target` (not `i+1`); then `commit(nextWorking)` (re-validates, R-KEEP5); then `setSelection({ kind, …coords with the inserted index = target })` with an **explicit `kind`** (note 3 above); then `revealAncestors(...)` the new node's ancestor keys — **none** for a section (mirroring `onDuplicateSection`); `expansionKey({ sectionIndex })` for a measure; `expansionKey({ sectionIndex })` + `expansionKey({ sectionIndex, measureIndex })` + `expansionKey({ sectionIndex, measureIndex, hand })` for a note. Keep the same stale-coordinate guards the duplicate handlers use (a missing section/measure/hand is a no-op, never a throw). Factories: `newSection()` / `newMeasure()` / `newNote()` (already imported / available from `songModel.js`; `newSection`/`newMeasure`/`newNote` are exported — `insertAt`, `newMeasure`, `newNote`, `newSection` are already imported in `edit.js:25-33`). A thin internal `insertNodeAt(list, target, factory)` helper MAY back the six to avoid copy-paste, but the **prop surface stays six named handlers** (§3.2 — static `MenuItem` `onClick`s, no runtime `where` to thread).
2. **`edit.js` — rewire `<StructureTree>` (§3.1/§3.2).** Add the six new handler props to the `<StructureTree …>` invocation (`:460-475`) and to the component's destructured prop list. **Drop the `onAddMeasure` tree prop** (`:469` and the JSDoc `:116` and the destructure `:133`) — the section menu no longer calls it. Keep `onDuplicate*` / `onRemove*` / `onAddNote` wired as today.
3. **`edit.js` — pass `onAddMeasure` to `<SectionPanel>` (§3.3).** `onAddMeasure` (`:261`) is **unchanged** (it still appends `newMeasure()` and commits; its `sectionIndex = working.sections.length - 1` default is harmless because the panel passes an explicit `sectionIndex`). Add `onAddMeasure={onAddMeasure}` to the `<SectionPanel … />` render (`:511-518`).
4. **`StructureTree.js` — reshape the item sets (R-MENU1, §3.1).** In each of the three render-function menus (now render functions after T1), set the items to, in order:
   ```jsx
   <MenuGroup>
     <MenuItem onClick={() => { onDuplicateX?.(coords); onClose(); }}>{__("Duplicate", "piano-block")}</MenuItem>
     <MenuItem onClick={() => { onAddXBefore?.(coords); onClose(); }}>{__("Add before", "piano-block")}</MenuItem>
     <MenuItem onClick={() => { onAddXAfter?.(coords); onClose(); }}>{__("Add after", "piano-block")}</MenuItem>
   </MenuGroup>
   <MenuGroup>
     <MenuItem isDestructive onClick={() => { onRemoveX?.(coords); onClose(); }}>{__("Remove", "piano-block")}</MenuItem>
   </MenuGroup>
   ```
   wrapped in a fragment (two sibling `MenuGroup`s — core's pattern). Labels are EXACTLY `"Add before"` / `"Add after"`. The item set is identical in shape at all three levels; only the coordinate args differ (section `sectionIndex`; measure `(sectionIndex, measureIndex)`; note the 4-tuple `(sectionIndex, measureIndex, hand, eventIndex)`). **Remove the old "Add measure" `MenuItem`** from the section menu — it is NOT part of the set and must not linger. No `label`/`role` on the `MenuItem`s (the text children are the accessible name); the toggle markup stays byte-unchanged.
5. **`StructureTree.js` — swap the props (§3.1).** In the destructured prop list and the JSDoc, **drop `onAddMeasure`** and **add** `onAddSectionBefore`, `onAddSectionAfter`, `onAddMeasureBefore`, `onAddMeasureAfter`, `onAddNoteBefore`, `onAddNoteAfter` (alongside the kept `onDuplicate*` / `onRemove*` / `onAddNote`).
6. **`SectionPanel.js` — add the "Add measure" button (§3.3).** Add `onAddMeasure` to the destructured props (`:69`) and JSDoc. Add a `variant="secondary"` `Button` calling `onAddMeasure?.(sectionIndex)`, labelled `__("Add measure", "piano-block")`, modelled on the existing "Remove section" `Button` placement (`:135-141`). (Not destructive; place it near the panel's bottom alongside Remove section.)
7. **`StructureTree.test.js` — update item names + add positional-insert assertions.**
   - In `renderTree` (`:152-182`), drop the `addMeasure` recorder + the `onAddMeasure` prop; add recorders + props for the six new handlers (`addSectionBefore`, `addSectionAfter`, `addMeasureBefore`, `addMeasureAfter`, `addNoteBefore`, `addNoteAfter`, each pushing its coord tuple).
   - In "StructureTree — row actions" (`:396-482`): keep the Duplicate/Remove assertions (item names unchanged); **delete** the "adds a measure to a section from the section DropdownMenu" test (`:417-426`) — that item is gone. **Add** tests that clicking "Add before" / "Add after" on a representative section, measure, and note row fires the matching new handler with the right coords (use the existing `buttonByLabel(...).closest("div")` → `selectButtonByText(menuDiv, "Add before")` pattern). Assert "Remove" is still found by name (the `isDestructive` flag only adds a class).
8. **`Edit.test.js` — retarget the "Add measure" click + add positional-insert assertions.**
   - The "onAddMeasure targets the section the structure tree fires for" test (`:490-502`) clicks the tree-menu "Add measure" (`buttonByText(container, "Add measure")`). That item is gone from the tree; **retarget** it to the new SectionPanel "Add measure" button — but `SectionPanel` renders only when a section/measure/event is selected, so the test must first select a section row (e.g. `clickByText(container, "Section 1")`) to reveal the panel, then click its "Add measure" button. Keep the same persisted-song assertions (the section gains a second `{}` measure; the song validates). (The button's visible text "Add measure" is unique once the tree item is gone, so `buttonByText` still resolves it — to the panel button now.)
   - The `clickRowAction`-driven duplicate tests (`:596-639`) keep working under the hardened mock (function children render the items into the `<td>`). No change needed beyond confirming green.
   - OPTIONAL: add an Edit-level positional-insert assertion (e.g. a measure "Add after" via `clickRowAction(container, "Actions for Measure 1 of section 1", "Add after")` then assert the section has two measures, the new one at index 1, the song validates, and the Measure panel opened on the new node) — this exercises the full `edit.js` → tree → commit path end-to-end. Recommended but the dedicated structural assertions live in `StructureTree.test.js` (props) + this file (commit path).
9. **`SectionPanel.test.js` — assert the new button.** Add a test that the "Add measure" `Button` is present and, when clicked, calls the `onAddMeasure` prop with the selection's `sectionIndex`. (Mirror the existing "Remove section" button test in that file.)

**Depends on.** T1 (the render-function children + hardened mock must already be in place — this task edits the render functions T1 created, and the hardened mock is what keeps the reshaped item assertions honest).

**Traces to.** R-MENU1, R-MENU2, R-MENU3 (hand-row "Add note" untouched), R-KEEP5 (every insert routes through `commit`), R-KEEP6 (SectionPanel "Add measure" keeps the capability reachable). AC-MENU1, AC-MENU2, AC-MENU3, AC-KEEP5, AC-KEEP6. **Owner-visible (§3.3, §8):** the section row menu loses "Add measure"; the Section inspector panel gains an "Add measure" button — surface this in the task report.

**Acceptance.**
- `npm run test:unit` → all green (note the new total; the row-actions and Edit/SectionPanel suites change). Every per-row menu offers exactly {Duplicate, Add before, Add after} + isolated {Remove}; no "Add measure"/"Move"/"Copy"/styles items in any tree menu.
- A positional insert at index `i`: "Add before" lands the new node at `i`, "Add after" at `i+1`; the resulting song validates (`validateSong(...) === []`); the new node is auto-selected with its ancestors revealed (assert via the existing `panelByTitle`/`countTreeRows`/`rowExpanded` helpers in `Edit.test.js`).
- `edit.js` contains the six named insert handlers, each routing through `commit` and using `insertAt`/`newX()`.
- A zero-measure section (reachable by removing a section's last measure) still shows an "Add measure" button in the Section panel that re-seeds it.
- `npm run build` green; `npm run check` clean.

---

## T3 — Align the chevrons and separate the tree from the canvas (CSS)

**Goal.** Center the disclosure chevrons against the row labels (Recipe A, R-POLISH1) and give the tree/canvas boundary breathing room plus a hairline rule (R-POLISH2) — all in `src/style.scss`, logical properties only, no markup change. Purely visual; no unit test asserts computed styles, so this task ships no test fallout and keeps the suite green by construction.

**Files.**
- `src/style.scss` (edit)

**Changes.**
1. **Chevron-label alignment — Recipe A (R-POLISH1, §3.5).** Inside `&__tree`:
   - Make the **label cell** a flex line: `[role="gridcell"]:first-child { display: flex; align-items: center; }`. Key off `:first-child` so the **actions cell** (the second `<td>`, holding the `DropdownMenu`) is never flexed/indented — the label cell is uniformly first at every row level (section/measure/hand/note).
   - Add a new `&-expander` rule making the chevron a fixed `$icon-size` (24px) square that centers its `<Icon>`: `display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none;`.
   - **Move** the per-level indent off `&-label`'s `padding-left` onto `padding-inline-start` on the first gridcell, keyed by `[aria-level]`, KEEPING the `1.5em` unit (R-KEEP3 — do not switch to px). Replace the current `@for $i from 1 through 4 { [aria-level="#{$i}"] &-label { padding-left: ($i - 1) * 1.5em; } }` (`:66-70`) with `@for $i from 1 through 4 { [aria-level="#{$i}"] [role="gridcell"]:first-child { padding-inline-start: ($i - 1) * 1.5em; } }`. `&-label` keeps **only** its truncation rules (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` — `:74-78`). No `TreeExpander` markup change in `StructureTree.js`.
2. **Tree/canvas separation (R-POLISH2, §3.6).** Logical properties only (RTL-safe; do NOT use `border-right`/`padding-right`):
   - On `&__tree` (`:56`): add `border-inline-end: 1px solid #ddd; /* core's $gray-300, the standard editor border gray */` and `padding-inline-end: 1em;` (keeps the hairline off the right-edge labels, inside the border).
   - On `&__workspace` (`:42-47`): bump `gap: 1em` → `gap: 1.5em` (space outside the border, between the rule and the canvas).
   - Color is the commented `#ddd` literal (the file's existing zero-import / literal-hex style — it already hardcodes `#007cba` at `:113-115`). The `@use "@wordpress/base-styles/colors"` → `colors.$gray-300` form is an explicitly-allowed alternative but NOT the default; do not adopt the optional `$gray-100` panel shade.

**Depends on.** T2 (so the final two-cell row structure — label cell + actions cell — is settled before the `:first-child`/`:nth` CSS targets it). T3 has no functional coupling to T2, but ordering it after keeps the CSS pinned to the final markup.

**Traces to.** R-POLISH1, R-POLISH2, R-KEEP1 (editor-side only; no published-output change), R-KEEP3 (`[aria-level]` indent idiom + `1.5em` unit preserved). AC-POLISH1, AC-POLISH2.

**Acceptance.**
- `npm run build` green (the SCSS compiles; the `style-index.css` artifact still emits).
- `npm run test:unit` → unchanged green (no test asserts computed styles).
- `npm run check` clean.
- Inspect `style.scss`: the label cell is a flex line keyed on `[role="gridcell"]:first-child`; a `&-expander` 24px square rule exists; the per-level indent is `padding-inline-start` on the first gridcell (not `padding-left` on `&-label`); `&__tree` has `border-inline-end: 1px solid #ddd` + `padding-inline-end: 1em`; `&__workspace` gap is `1.5em`; no `border-right`/`padding-right` anywhere; `TreeExpander` markup in `StructureTree.js` is unchanged.

---

## T4 — Add the real-icon guard (real `@wordpress/icons` + React-dedup mapper)

**Goal.** Close root-cause #2's verification gap (R-REG3b): a unit test that renders the tree with the REAL `@wordpress/icons` and asserts the row-action / chevron / **and especially the hand-row Add-note** icons are actual inline `<svg>` — so the `icon="plus"` string regression (now fixed in T1) can never silently return. This needs a test-only six-module React-dedup `moduleNameMapper` in `jest.config.js` (a HARD prerequisite; no runtime dependency). The Add-note `plus` is THE canary — `moreVertical` and the chevrons are already real elements and would pass even on the broken branch.

**Files.**
- `jest.config.js` (edit — add the six-module React-dedup `moduleNameMapper`)
- `src/editor/__tests__/StructureTree.realIcons.test.js` (NEW)

**Changes.**
1. **`jest.config.js` — the React-dedup `moduleNameMapper` (HARD PREREQUISITE, §5.2).** Add, to the existing `moduleNameMapper` block (`:20-32`), mappings resolving all SIX React entrypoints to the single top-level copy:
   ```
   ^react$, ^react/jsx-runtime$, ^react/jsx-dev-runtime$, ^react-dom$, ^react-dom/client$, ^scheduler$  → the top-level copy (require.resolve each)
   ```
   - This is non-optional and must be the WHOLE set: a PARTIAL mapping is actively dangerous (mapping only `react` while `react-dom` stays nested-18 throws `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`). The split is real: `@wordpress/icons@10.32.0` nests its own React 18.3.1; top-level is 19.2.7; the icon SVGs compile to `react/jsx-runtime` `_jsx(...)`, and without the full dedup `isValidElement(realPlus)` is `false` (a `$$typeof` Symbol-identity mismatch, not a version-number problem). `react/jsx-runtime` is non-optional because `@wordpress/babel-preset-default` uses `runtime: 'automatic'`.
   - jest's `moduleNameMapper` matches by import specifier globally, so `^react$ → top-level` redirects even the `import … from "react"` inside `@wordpress/icons` — that is why the six-entrypoint mapper dedups the icons' internal React without a nested-path map.
   - Test-only; adds NO runtime dependency (R-KEEP2). The base jest layers do NOT dedup React, so this project `jest.config.js` is the only place to add it.
   - **Smoke-confirm the mapper does not break the existing suite:** after adding it, run `npm run test:unit` — all existing 600+ tests must stay green (they already run on the top-level React; the mapper only changes which copy resolves for the nested packages).
2. **`StructureTree.realIcons.test.js` (NEW, R-REG3b, §5.2) — written on the suite's `createRoot`+`act` harness (note 1 above).**
   - **Un-map `@wordpress/icons` to the REAL package** for this file only, via the ONE recipe you pick (note 2 above): either run the file under a dedicated jest config that drops `^@wordpress/icons$` from `moduleNameMapper`, OR file-local `jest.unmock("@wordpress/icons")` + `jest.mock("@wordpress/icons", () => jest.requireActual("@wordpress/icons"))`. **Before the real assertions, smoke-check** `expect(isValidElement(plus)).toBe(true)` so you know the un-mapping resolved real elements (delete the scaffolding after — and leave no `console.log`, jest-console fails on it).
   - **Swap in an element-rendering `Icon` mock** for this file: `({ icon }) => isValidElement(icon) ? cloneElement(icon) : null` (mirrors the real `Icon`'s `cloneElement(icon)`). This renders a real inline `<svg>` for an element and **nothing** for a string (`isValidElement("plus")` is false — and you cannot `cloneElement` a string, so this exercises the same path the string would break on). Keep the rest of the components mock (the `DropdownMenu`/`TreeGrid`/`TreeGridCell` stand-ins pass children through untouched, so the real SVGs flow through the mocked table).
   - **Confine the un-map + custom `Icon` to THIS file's overrides** so the main suite's string-sentinel `@wordpress/icons` mock + inert `Icon` mock are untouched (no risk to the 600+ existing tests).
   - **Render the tree** (reuse the `fixtureSong` + `render` pattern from `StructureTree.test.js`, with an `expanded` Set that reveals a hand row so the Add-note button is present) and assert:
     - **THE canary (root-cause #2 guard):** the hand-row Add-note button surfaces a real inline `<svg>` (e.g. the button/cell `querySelector("svg")` is truthy) — this is the assertion that goes RED for `icon="plus"` and GREEN for `icon={plus}`. Make it explicit and comment it as the root-cause-#2 canary.
     - For completeness: the chevron and the row-action toggle (`moreVertical`) areas also contain real inline `<svg>` (these already passed pre-fix — they prove the harness renders real icons, but they are NOT the regression guard).

**Depends on.** T1 (the `icon={plus}` fix must be committed so the canary is GREEN — otherwise this test would land red), T2 (the menu is final, so the rendered tree the test asserts against is settled), and ideally T3 (CSS is irrelevant to this jsdom test, but keeping T4 after T3 means the tree it renders is fully final).

**Traces to.** R-REG3b, R-KEEP2 (no runtime dep; the mapper is test-only). AC-REG3 (second bullet — real inline `<svg>`, no runtime dependency added).

**Acceptance.**
- `npm run test:unit` → all green INCLUDING the new `StructureTree.realIcons.test.js`; the existing suites stay green under the new `moduleNameMapper` (note the new suite/test totals in your report).
- The canary works: temporarily revert the hand-row `Button` to `icon="plus"` (string) locally → the Add-note `<svg>` assertion goes red → restore. (Manual confirmation; do NOT commit the revert.)
- `jest.config.js` maps all six React entrypoints to the top-level copy; no runtime dependency was added (`package.json` `dependencies` unchanged — still only `@wordpress/icons`).
- The new test file contains no `console.log`.
- `npm run build` green; `npm run check` clean.

---

## T5 — Migrate the e2e specs for consistency (cannot run here)

**Goal.** Keep the Playwright specs honest-by-construction for the new menu (R-REG3c): item names, the section-grow path via the SectionPanel button, a positional-insert test, and the ordinal-shift re-mapping. These CANNOT run in this environment (wp-env/Docker unavailable) and never ran (which is how review 6's regression escaped) — they are NOT this environment's primary guard. Verify by construction and Playwright discovery only.

**Files.**
- `specs/editor.spec.js` (edit)

**Changes.**
1. **Menu-item names (§5.3).** Change the tree-menu item assertions to "Duplicate" / "Add before" / "Add after" / "Remove" (DROP "Add measure" from the tree-menu assertions). Keep `{ exact: true }` (already used by `openRowAction`, `:355-362`) so "Add before"/"Add after" never loosely match other "Add" controls (the Note-panel "Add note" exact-match precedent). "Remove" stays a `menuitem` by name (`isDestructive` only adds the red class). Update `openRowAction`'s doc-comment example item list (`:341-342`) which currently names "Add measure".
2. **Section-grow step (§5.3).** Rewire the current section-menu "Add measure" step (`:594-602`) to the new **`SectionPanel` "Add measure"** sidebar button — scoped + `exact: true`, mirroring the existing "Add section" sidebar step (`:622-624`). This is the cleanest, decoupled from row ordinals. (A measure-row "Add after" is the documented alternative if the team keeps a grow-via-tree flavor — but the panel button is the recommendation.) The selection must reveal the Section panel first (select a section row), then click its "Add measure" button.
3. **A dedicated positional-insert test (§5.3).** Add (new test, or extend the build/edit test) a measure-row "Add before" and "Add after" exercise, asserting via the ordinal-independent `storedSongObject` polls: (1) the measure count grew, (2) the new measure landed at the right index (before → at `i`; after → at `i+1`), (3) the new node is auto-selected (its panel open / its row `aria-current`).
4. **The ORDINAL-SHIFT gotcha — re-derive, do not find-replace (§5.3).** "Add before" at index `i` shifts every later sibling's ordinal +1; "Add after" inserts at `i+1` shifting everything after. The existing test navigates by ORDINAL labels ("Measure 3 of section 1", "Actions for Section 3"); after a positional insert a row that was "Measure 2" may become "Measure 3", so any name-based row lookup AFTER an insert must be **re-derived**. The count-via-stored-JSON polls are ordinal-independent and stay robust; auto-select also moves the open panel / `aria-current` to the inserted node. Re-walk the affected test (`:575-661`) and fix every post-insert ordinal lookup — this is the only non-mechanical change.
5. **Plumbing STAYS.** `openRowAction` / `rowChevron` / `expandRow` / the portal-`getByRole("menu")` read all stay as-is (`:355-374`) — they already read the portalled popover; the render-function fix (T1) is what makes that popover actually render. The only behavioral change is item names + ordinal re-mapping.

**Depends on.** T2 (the final menu items + the SectionPanel "Add measure" button must exist for the spec to describe them honestly).

**Traces to.** R-REG3c. AC-REG3 (third bullet — e2e menu names + plumbing match the delivered render-function menu).

**Acceptance.**
- `npx playwright test --list specs/editor.spec.js` (or the project's discovery equivalent) parses the spec without syntax errors and lists the tests, INCLUDING the new positional-insert test. (Full execution is impossible here — wp-env/Docker unavailable; this is discovery + by-construction review only.)
- Inspect `specs/editor.spec.js`: no "Add measure" tree-menu assertion remains; the tree-menu items are "Duplicate"/"Add before"/"Add after"/"Remove" with `{ exact: true }`; the section-grow step clicks the SectionPanel button; every post-insert ordinal lookup is re-derived (not stale); the `openRowAction`/`rowChevron`/`expandRow` plumbing is unchanged.
- `npm run check` clean (Biome lints the spec file).

---

## Requirements-coverage map (task → requirement)

| Requirement | Task(s) |
|---|---|
| R-REG1 (per-row menu renders, render-function children) | T1 |
| R-REG2 (hand "Add note" real glyph `icon={plus}`) | T1 |
| R-REG3a (hardened `DropdownMenu` mock + toggle-presence assertion) | T1 |
| R-REG3b (real-icon guard + six-module React-dedup mapper) | T4 |
| R-REG3c (e2e consistent-by-construction) | T5 |
| R-MENU1 (block-menu item set + grouping at all three levels) | T2 |
| R-MENU2 (six positional-insert handlers, valid-by-construction) | T2 |
| R-MENU3 (hand rows keep the direct "Add note") | T1 (icon), T2 (untouched in the reshape) |
| R-POLISH1 (chevron centered on label, Recipe A) | T3 |
| R-POLISH2 (tree/canvas separation, logical props) | T3 |
| R-KEEP1 (byte-identical publish; editor-side only) | T1–T5 (no schema/`render.php`/SVG/`data-*`/font touch) |
| R-KEEP2 (only WP-provided runtime deps) | T1, T4 (mapper + base-styles are test/build-config only) |
| R-KEEP3 (review-6 wins preserved) | T1 (toggle/roving-tabindex untouched), T3 (`[aria-level]` indent + `1.5em`) |
| R-KEEP4 (keyboard/a11y parity) | T1 (`toggleProps` path byte-unchanged) |
| R-KEEP5 (raw-JSON unchanged; valid-by-construction) | T2 (every insert routes through `commit`) |
| R-KEEP6 (field reachability; SectionPanel "Add measure" re-home) | T2 |
